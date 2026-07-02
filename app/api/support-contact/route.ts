import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/support-contact — supporter/partner first-contact form (public
 * /support page). Login-free, rate-limited, honeypot-guarded.
 *
 * The DURABLE sink is support_leads (service-role only): a lead is never lost
 * even if the notification email fails. A best-effort email then alerts the
 * team (reply-to = the submitter) so they can reply personally. NOT a citizen
 * report — this never touches the reports pipeline or anything public.
 */
const ROLES = ["hotel", "municipality", "ngo", "local", "other"];
const LOCALES = ["el", "en", "de"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_LABEL: Record<string, string> = {
  hotel: "Hotel / tourism business",
  municipality: "Municipality / public body",
  ngo: "NGO / environmental group",
  local: "Local business",
  other: "Other",
};

interface Lead {
  name: string;
  organisation: string | null;
  email: string;
  role: string;
  place: string | null;
  message: string;
  locale: string | null;
}

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Best-effort team notification. Never throws — the lead is already stored, so
 * an email failure must not fail the visitor's submission. Dev (no re_ key):
 * log to console. Production without a key: warn (the row is still queryable).
 */
async function notifyTeam(lead: Lead): Promise<void> {
  const to = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "info@drosia.eu";
  const from = process.env.EMAIL_FROM ?? "reports@drosia.eu";
  const subject = `New Drosia supporter message: ${ROLE_LABEL[lead.role] ?? lead.role}`;
  const text = [
    `Name: ${lead.name}`,
    `Organisation: ${lead.organisation || "—"}`,
    `Email: ${lead.email}`,
    `Type: ${ROLE_LABEL[lead.role] ?? lead.role}`,
    `Place / area: ${lead.place || "—"}`,
    `Language: ${lead.locale ?? "—"}`,
    ``,
    `Message:`,
    lead.message,
  ].join("\n");

  const rawKey = process.env.RESEND_API_KEY;
  const apiKey = rawKey && rawKey.startsWith("re_") ? rawKey : null;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[support-contact] RESEND_API_KEY missing — lead stored, notification email NOT sent.");
    } else {
      console.info(`[support-contact:dev] → ${to} | ${subject}\n${text}`);
    }
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const send = resend.emails.send({ from, to, subject, text, replyTo: lead.email });
    void send.catch(() => {}); // avoid an unhandled rejection if the timeout wins
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Resend send timed out after 15s")), 15_000),
    );
    const { error } = await Promise.race([send, timeout]);
    if (error) console.warn(`[support-contact] notification email failed: ${error.message}`);
  } catch (e) {
    console.warn(`[support-contact] notification email failed: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!configured()) {
    return NextResponse.json({ error: "Backend not configured." }, { status: 503 });
  }

  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`support:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: "Too many messages." }, { status: 429 });

  let body: {
    name?: string;
    organisation?: string;
    email?: string;
    role?: string;
    place?: string;
    message?: string;
    locale?: string;
    website?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Honeypot: silently accept (so bots see success) but store nothing.
  if (body.website?.length) return NextResponse.json({ ok: true });

  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().slice(0, 200);
  const role = (body.role ?? "").trim();
  const message = (body.message ?? "").trim().slice(0, 2000);
  const organisation = (body.organisation ?? "").trim().slice(0, 160) || null;
  const place = (body.place ?? "").trim().slice(0, 200) || null;
  const locale = typeof body.locale === "string" && LOCALES.includes(body.locale) ? body.locale : null;

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Please choose what best describes you." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const lead: Lead = { name, organisation, email, role, place, message, locale };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("support_leads").insert(lead as never);
  if (error) {
    console.error(`[support-contact] insert failed: ${error.message}`);
    return NextResponse.json({ error: "Could not save your message." }, { status: 500 });
  }

  await notifyTeam(lead);

  return NextResponse.json({ ok: true });
}
