import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { anonymizeReportPhotos } from "@/lib/anonymize-runner";
import { reportFieldsSchema, validatePhotos, MAX_PHOTOS, type ReportFields } from "@/lib/report-intake";

/**
 * POST /api/report — login-free report submission (Phase 1 core loop).
 *
 *   validate → compress (sharp) → upload originals (private bucket) →
 *   intake_report RPC (country detection + authority routing ST_Contains, atomic)
 *
 * Temporary worldwide testing: older live DBs may still throw OUT_OF_BOUNDS; in
 * that case we insert an unrouted review item with country/authority null.
 * Atomicity: if every insert path fails, the just-uploaded blobs are deleted.
 * Anonymization is kicked off best-effort;
 * the report stays non-public until blur_status='done' (Phase 2 anonymizer).
 */
export const runtime = "nodejs";

const ORIGINALS_BUCKET = "report-originals";
const RATE_LIMIT = 5; // submissions
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes per IP

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
  const limit = rateLimit(`report:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many reports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  // Honeypot: silently reject bots that fill the hidden field.
  if ((form.get("website") as string)?.length) {
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

  const photos = form.getAll("photos").filter((p): p is File => p instanceof File).slice(0, MAX_PHOTOS);
  const photoCheck = validatePhotos(photos.map((p) => ({ size: p.size, type: p.type })));
  if (!photoCheck.ok) {
    return NextResponse.json({ error: photoCheck.error }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const storage = admin.storage.from(ORIGINALS_BUCKET);
  const uploaded: string[] = [];

  try {
    for (const photo of photos) {
      const input = Buffer.from(await photo.arrayBuffer());
      const compressed = await sharp(input)
        .rotate() // honor EXIF orientation
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

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
    const { data: rpcToken, error: rpcError } = await admin.rpc("intake_report", rpcArgs);

    let token = rpcToken as string | null;
    if (rpcError) {
      if (rpcError.message.includes("OUT_OF_BOUNDS")) {
        token = await insertUnroutedReport(fields, uploaded);
      } else {
        await storage.remove(uploaded); // atomic cleanup — never orphan blobs
        throw new Error(rpcError.message);
      }
    }
    if (!token) throw new Error("intake_report did not return a token");

    // Anonymize + persist (best-effort). The report stays non-public until every
    // photo is blur_status='done' AND it is approved in moderation.
    try {
      const { data: row } = await admin
        .from("reports")
        .select("id")
        .eq("public_token", token)
        .maybeSingle<{ id: string }>();
      if (row?.id) await anonymizeReportPhotos(row.id);
    } catch (e) {
      console.warn("[/api/report] anonymization deferred:", e);
    }

    return NextResponse.json({ token, status: "submitted" }, { status: 201 });
  } catch (err) {
    if (uploaded.length) await storage.remove(uploaded).catch(() => {});
    console.error("[/api/report] submit failed:", err);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}

async function insertUnroutedReport(fields: ReportFields, photoPaths: string[]): Promise<string> {
  const admin = getSupabaseAdmin();
  const point = `SRID=4326;POINT(${fields.lng} ${fields.lat})`;

  const { data: report, error: reportError } = await admin
    .from("reports")
    .insert({
      country_code: null,
      authority_id: null,
      category: fields.category,
      description: fields.description || null,
      geom: point,
      locale: fields.locale,
      author_token: fields.authorToken || null,
      status: "submitted",
    } as never)
    .select("id, public_token")
    .single<{ id: string; public_token: string }>();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "fallback insert failed");
  }

  const photoRows = photoPaths.map((path) => ({ report_id: report.id, original_path: path }));
  const { error: photosError } = await admin.from("report_photos").insert(photoRows as never);
  if (photosError) {
    await admin.from("reports").delete().eq("id", report.id);
    throw new Error(photosError.message);
  }

  return report.public_token;
}
