import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";
import { registerDevice } from "@/lib/anon-device";
import { anonymizeReportPhotos } from "@/lib/anonymize-runner";
import {
  reportFieldsSchema,
  validatePhotos,
  MAX_PHOTOS,
  MAX_TOTAL_UPLOAD_BYTES,
} from "@/lib/report-intake";
import { readMultipartFormData, RequestBodyError } from "@/lib/http-body";
import { normalizeUploadedImage, ImageValidationError } from "@/lib/image-upload";

/**
 * POST /api/report — login-free report submission (Phase 1 core loop).
 *
 *   validate → compress (sharp) → upload originals (private bucket) →
 *   intake_report RPC (country detection + authority routing ST_Contains, atomic)
 *
 * Intake is worldwide. Active country boundaries still drive country and
 * authority routing; unmatched reports remain private and await admin review.
 * Anonymization is kicked off best-effort;
 * the report stays non-public until blur_status='done' (Phase 2 anonymizer).
 */
export const runtime = "nodejs";

const ORIGINALS_BUCKET = "report-originals";
const RATE_LIMIT = 5; // submissions
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes per IP
const MAX_MULTIPART_BYTES = MAX_TOTAL_UPLOAD_BYTES + 512 * 1024;

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function POST(req: Request): Promise<Response> {
  if (!configured()) {
    return NextResponse.json(
      { error: "Backend not configured (Supabase env missing)." },
      { status: 503 },
    );
  }

  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`report:${ip}`, RATE_LIMIT, RATE_WINDOW_MS, {
    failClosedInProduction: true,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many reports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await readMultipartFormData(req, MAX_MULTIPART_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  // Honeypot: silently reject bots that fill the hidden field.
  const website = form.get("website");
  if (typeof website === "string" && website.length) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const parsed = reportFieldsSchema.safeParse({
    lat: form.get("lat"),
    lng: form.get("lng"),
    category: form.get("category"),
    description: form.get("description") ?? "",
    locale: form.get("locale") ?? "en",
    consent: form.get("consent"),
    authorToken: form.get("authorToken") ?? "",
    website: form.get("website") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const fields = parsed.data;

  const photoParts = form.getAll("photos");
  if (photoParts.length > MAX_PHOTOS || photoParts.some((part) => !(part instanceof File))) {
    return NextResponse.json({ error: `At most ${MAX_PHOTOS} valid photos allowed` }, { status: 400 });
  }
  const photos = photoParts as File[];
  const photoCheck = validatePhotos(photos.map((p) => ({ size: p.size, type: p.type })));
  if (!photoCheck.ok) {
    return NextResponse.json({ error: photoCheck.error }, { status: 400 });
  }

  // Decode and normalize every frame before writing any blob. MIME declarations
  // are only a first filter; Sharp verifies the actual encoding and pixel count.
  const normalizedPhotos: Buffer[] = [];
  try {
    for (const photo of photos) {
      normalizedPhotos.push(await normalizeUploadedImage(new Uint8Array(await photo.arrayBuffer())));
    }
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Image validation failed." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const storage = admin.storage.from(ORIGINALS_BUCKET);
  const uploaded: string[] = [];
  const cleanupUploaded = async (): Promise<void> => {
    if (!uploaded.length) return;
    const { error } = await storage.remove([...uploaded]);
    if (error) throw new Error(`uploaded blob cleanup failed: ${error.message}`);
    uploaded.length = 0;
  };

  try {
    for (const compressed of normalizedPhotos) {
      const path = `originals/${randomUUID()}.jpg`;
      const { error } = await storage.upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw new Error(`upload failed: ${error.message}`);
      uploaded.push(path);
    }

    // Untyped client (no generated Database types): cast the RPC args.
    const rpcArgs = {
      p_lng: fields.lng,
      p_lat: fields.lat,
      p_category: fields.category,
      p_description: fields.description,
      p_locale: fields.locale,
      p_author_token: fields.authorToken,
      p_photo_paths: uploaded,
    } as never;
    // Active country polygons route covered points. Worldwide points without
    // configured coverage are accepted with country_code/authority_id = null.
    // They follow the same anonymization and moderation gate before publication.
    const { data: rpcToken, error: rpcError } = await admin.rpc("intake_report", rpcArgs);

    let token = rpcToken as string | null;
    if (rpcError) {
      if (!rpcError.message.includes("OUT_OF_BOUNDS")) {
        await cleanupUploaded(); // atomic cleanup — never orphan blobs
        throw new Error(rpcError.message);
      }

      // Compatibility path for a live database whose intake RPC still has the
      // former strict geofence. Use an active country only as a temporary FK host;
      // authority stays null, so no delivery is possible. The worldwide migration
      // removes this need and normalizes out-of-bound host assignments to null.
      const { data: hostCountry, error: countryError } = await admin
        .from("countries")
        .select("code")
        .eq("is_active", true)
        .order("code", { ascending: true })
        .limit(1)
        .maybeSingle<{ code: string }>();
      if (countryError || !hostCountry) {
        await cleanupUploaded();
        throw new Error(countryError?.message ?? "No active country available for worldwide intake");
      }

      const { data: fallbackReport, error: fallbackError } = await admin
        .from("reports")
        .insert({
          country_code: hostCountry.code,
          authority_id: null,
          category: fields.category,
          description: fields.description || null,
          geom: `SRID=4326;POINT(${fields.lng} ${fields.lat})`,
          locale: fields.locale,
          author_token: fields.authorToken || null,
          status: "submitted",
          excluded_from_ranking: true,
        } as never)
        .select("id, public_token")
        .single<{ id: string; public_token: string }>();
      if (fallbackError || !fallbackReport) {
        await cleanupUploaded();
        throw new Error(fallbackError?.message ?? "Worldwide report insert failed");
      }

      const { error: photoInsertError } = await admin.from("report_photos").insert(
        uploaded.map((originalPath) => ({ report_id: fallbackReport.id, original_path: originalPath })) as never,
      );
      if (photoInsertError) {
        await admin.from("reports").delete().eq("id", fallbackReport.id);
        await cleanupUploaded();
        throw new Error(`Worldwide photo insert failed: ${photoInsertError.message}`);
      }
      token = fallbackReport.public_token;
    }
    if (!token) throw new Error("intake_report did not return a token");

    // Anonymize off the hot path: after() runs once the response is flushed, so a
    // slow blur on 3 large photos can't time out the submit. Safe metadata is
    // public as pending immediately; photos stay private until every photo is
    // blur_status='done'. Approval also re-runs anonymization if needed.
    const reportToken = token;
    after(async () => {
      try {
        // A reporter's device becomes vote-eligible without touching the per-IP
        // new-device budget — submitting is already the expensive action.
        await registerDevice(fields.authorToken);
        const { data: row } = await admin
          .from("reports")
          .select("id")
          .eq("public_token", reportToken)
          .maybeSingle<{ id: string }>();
        if (row?.id) await anonymizeReportPhotos(row.id);
      } catch (e) {
        console.warn("[/api/report] background anonymization failed:", e);
      }
    });

    return NextResponse.json({ token, status: "submitted" }, { status: 201 });
  } catch (err) {
    try {
      await cleanupUploaded();
    } catch (cleanupError) {
      console.error("[/api/report] CRITICAL: orphan upload cleanup failed:", cleanupError);
    }
    console.error("[/api/report] submit failed:", err);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}
