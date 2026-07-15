import "server-only";
import { LOCALES, type Locale } from "./i18n";
import { isReportCategory } from "./categories";
import { anonymizedPhotoUrl } from "./storage";
import { distanceKm } from "./geo";
import type { NearbyReport, PublicReport } from "./mock";
import { MOCK_REPORTS } from "./mock";
import { getSupabasePublic, publicSupabaseConfigured } from "./supabase/public";

/**
 * Server-side public reads. ALWAYS go through the SQL views
 * (v_public_reports / v_public_report_photos), never the base tables —
 * the views already strip author_token, is_test and originals, and only expose
 * reports whose photo is anonymized (blur_status='done').
 *
 * Dev fallback: when Supabase isn't configured (no real URL) and we're NOT in
 * production, return the design mock so the prototype still renders. In
 * production a missing config returns empty — we never invent public data.
 */
function supabaseConfigured(): boolean {
  return publicSupabaseConfigured();
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

const REPORT_COLUMNS =
  "id, public_token, category, lat, lng, status, vote_count, confirm_count, created_at, notified_at, resolved_at, authority_name, authority_level";

type ViewRow = {
  id: string;
  public_token: string;
  category: string;
  lat: number;
  lng: number;
  status: string;
  vote_count: number;
  confirm_count: number;
  created_at: string;
  notified_at: string | null;
  resolved_at: string | null;
  authority_name: Record<string, string> | null;
  authority_level: string | null;
};

function emptyLocaleMap(): Record<Locale, string> {
  return LOCALES.reduce((acc, l) => ({ ...acc, [l]: "" }), {} as Record<Locale, string>);
}

function toLocaleMap(name: Record<string, string> | null): Record<Locale, string> {
  const map = emptyLocaleMap();
  if (!name) return map;
  for (const l of LOCALES) if (typeof name[l] === "string") map[l] = name[l];
  return map;
}

function mapRow(row: ViewRow): PublicReport | null {
  if (!isReportCategory(row.category)) return null;
  if (row.status !== "in_review" && row.status !== "notified" && row.status !== "resolved") return null;
  return {
    public_token: row.public_token,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    vote_count: row.vote_count ?? 0,
    confirm_count: row.confirm_count ?? 0,
    created_at: row.created_at,
    notified_at: row.notified_at,
    resolved_at: row.resolved_at,
    authority_name: toLocaleMap(row.authority_name),
    place: "",
  };
}

export async function getPublicReport(token: string): Promise<PublicReport | null> {
  if (!supabaseConfigured()) {
    if (isProd()) return null;
    return MOCK_REPORTS.find((r) => r.public_token === token) ?? null;
  }

  try {
    const client = getSupabasePublic();
    const { data, error } = await client
      .from("v_public_reports")
      .select(REPORT_COLUMNS)
      .eq("public_token", token)
      .maybeSingle<ViewRow>();

    if (error || !data) return null;
    const report = mapRow(data);
    if (!report) return null;

    const { data: photo } = await client
      .from("v_public_report_photos")
      .select("public_path")
      .eq("report_id", data.id)
      .limit(1)
      .maybeSingle<{ public_path: string }>();
    if (photo?.public_path) report.photo_url = anonymizedPhotoUrl(photo.public_path);

    return report;
  } catch (e) {
    console.error("[getPublicReport] read failed:", e);
    return null;
  }
}

/**
 * Geographically closest public reports to the one being viewed — powers the
 * nearby cards and the swipe-to-next navigation on /r/<token>. Reuses the
 * public-view read (anonymized photos included) and sorts by haversine
 * distance in process; at launch scale (one island region, ≤200 public
 * reports) that beats maintaining a PostGIS RPC on the public read path.
 */
export async function listNearbyReports(current: PublicReport, limit = 6): Promise<NearbyReport[]> {
  const all = await listPublicReports(200);
  return all
    .filter((r) => r.public_token !== current.public_token)
    .map((r) => ({ ...r, distance_km: distanceKm(current.lat, current.lng, r.lat, r.lng) }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}

export interface ScorecardEntry {
  authority_id: string;
  name: Record<Locale, string>;
  notified_count: number;
  resolved_count: number;
  resolution_rate_pct: number;
}

/** Authority scorecard — fairness already enforced in the view (n>=10, notified-only). */
export async function getScorecard(): Promise<ScorecardEntry[]> {
  if (!supabaseConfigured()) return []; // no fake board, even in dev (anti-pattern guard)
  try {
    const { data, error } = await getSupabasePublic()
      .from("v_authority_scorecard")
      .select("authority_id, name_i18n, notified_count, resolved_count, resolution_rate_pct")
      .order("resolution_rate_pct", { ascending: false })
      .returns<
        {
          authority_id: string;
          name_i18n: Record<string, string> | null;
          notified_count: number;
          resolved_count: number;
          resolution_rate_pct: number;
        }[]
      >();
    if (error || !data) return [];
    return data.map((r) => ({
      authority_id: r.authority_id,
      name: toLocaleMap(r.name_i18n),
      notified_count: r.notified_count,
      resolved_count: r.resolved_count,
      resolution_rate_pct: r.resolution_rate_pct ?? 0,
    }));
  } catch (e) {
    console.error("[getScorecard] read failed:", e);
    return [];
  }
}

export async function listPublicReports(limit = 200): Promise<PublicReport[]> {
  if (!supabaseConfigured()) {
    if (isProd()) return [];
    return MOCK_REPORTS;
  }

  try {
    const client = getSupabasePublic();
    const { data, error } = await client
      .from("v_public_reports")
      .select(REPORT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<ViewRow[]>();

    if (error || !data) return [];

    const ids = data.map((r) => r.id);
    const photoByReport = new Map<string, string>();
    if (ids.length) {
      const { data: photos } = await client
        .from("v_public_report_photos")
        .select("report_id, public_path")
        .in("report_id", ids)
        .returns<{ report_id: string; public_path: string }[]>();
      for (const p of photos ?? []) {
        if (!photoByReport.has(p.report_id)) photoByReport.set(p.report_id, p.public_path);
      }
    }

    return data
      .map((row) => {
        const report = mapRow(row);
        if (report) {
          const path = photoByReport.get(row.id);
          if (path) report.photo_url = anonymizedPhotoUrl(path);
        }
        return report;
      })
      .filter((r): r is PublicReport => r !== null);
  } catch (e) {
    console.error("[listPublicReports] read failed:", e);
    return [];
  }
}
