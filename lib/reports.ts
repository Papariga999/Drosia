import "server-only";
import { LOCALES, type Locale } from "./i18n";
import { isReportCategory } from "./categories";
import { anonymizedPhotoUrl } from "./storage";
import { distanceKm } from "./geo";
import type { NearbyReport, PublicReport } from "./mock";
import { MOCK_REPORTS } from "./mock";
import { getSupabasePublic, publicSupabaseConfigured } from "./supabase/public";
import { getSupabaseAdmin } from "./supabase/admin";
import { parseReportPoint } from "./report-point";
import { TtlCache } from "./ttl-cache";

/**
 * Server-side public reads. Published reports use privacy-safe SQL views.
 * Pending reports use the pending views, with a narrow service-role fallback
 * for databases awaiting the additive migration. Original paths, descriptions,
 * and author tokens are never selected on the pending path.
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
const PENDING_COLUMNS =
  "id, public_token, category, lat, lng, status, vote_count, confirm_count, created_at, notified_at, resolved_at";

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

type PendingRow = Omit<ViewRow, "authority_name" | "authority_level">;

type PendingPhotoRow = {
  report_id: string;
  public_path: string | null;
  blur_status: string;
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

function mapPendingRow(row: PendingRow): PublicReport | null {
  if (!isReportCategory(row.category) || row.status !== "submitted") return null;
  return {
    public_token: row.public_token,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    status: "submitted",
    vote_count: row.vote_count ?? 0,
    confirm_count: row.confirm_count ?? 0,
    created_at: row.created_at,
    notified_at: null,
    resolved_at: null,
    authority_name: emptyLocaleMap(),
    place: "",
    pending: true,
  };
}

/**
 * Read privacy-safe pending pins. The service-role fallback keeps this release
 * compatible with live databases where the new public view migration has not
 * been applied yet; it selects only the same safe fields and never any photo.
 */
async function listPendingReports(limit: number, token?: string): Promise<PublicReport[]> {
  const publicClient = getSupabasePublic();
  let viewQuery = publicClient.from("v_pending_report_pins").select(PENDING_COLUMNS);
  if (token) viewQuery = viewQuery.eq("public_token", token);
  const { data: viewData, error: viewError } = await viewQuery
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PendingRow[]>();
  if (!viewError) return mapPendingReportsWithPhotos(viewData ?? []);

  const admin = getSupabaseAdmin();
  let baseQuery = admin
    .from("reports")
    .select("id, public_token, category, status, vote_count, confirm_count, created_at, notified_at, resolved_at, geom")
    .eq("status", "submitted")
    .eq("is_test", false)
    .eq("admin_hidden", false);
  if (token) baseQuery = baseQuery.eq("public_token", token);
  const { data: baseData, error: baseError } = await baseQuery
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Array<{
      id: string;
      public_token: string;
      category: string;
      status: string;
      vote_count: number;
      confirm_count: number;
      created_at: string;
      notified_at: null;
      resolved_at: null;
      geom: unknown;
    }>>();
  if (baseError) throw new Error(baseError.message);
  const rows = (baseData ?? [])
    .map((row): PendingRow | null => {
      const point = parseReportPoint(row.geom);
      if (!point) return null;
      return { ...row, ...point };
    })
    .filter((row): row is PendingRow => row !== null);
  return mapPendingReportsWithPhotos(rows);
}

/** Only expose pending photos after every image has an anonymized public copy. */
async function mapPendingReportsWithPhotos(rows: PendingRow[]): Promise<PublicReport[]> {
  if (!rows.length) return [];

  const reports = rows
    .map((row) => ({ row, report: mapPendingRow(row) }))
    .filter(
      (entry): entry is { row: PendingRow; report: PublicReport } => entry.report !== null,
    );
  if (!reports.length) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("report_photos")
    .select("report_id, public_path, blur_status")
    .in(
      "report_id",
      reports.map(({ row }) => row.id),
    )
    .returns<PendingPhotoRow[]>();

  if (error) {
    console.error("[listPendingReports] pending photo read failed:", error.message);
    return reports.map(({ report }) => report);
  }

  const photosByReport = new Map<string, PendingPhotoRow[]>();
  for (const photo of data ?? []) {
    const photos = photosByReport.get(photo.report_id) ?? [];
    photos.push(photo);
    photosByReport.set(photo.report_id, photos);
  }

  return reports.map(({ row, report }) => {
    const photos = photosByReport.get(row.id) ?? [];
    const safeToShow =
      photos.length > 0 &&
      photos.every((photo) => photo.blur_status === "done" && !!photo.public_path);
    if (safeToShow && photos[0]?.public_path) {
      report.photo_url = anonymizedPhotoUrl(photos[0].public_path);
    }
    return report;
  });
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

    if (!error && data) {
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
    }
    return (await listPendingReports(1, token))[0] ?? null;
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

/**
 * Short-TTL caches for the flood-prone public reads (landing, map, urgent,
 * nearby, /r/<token> nearby cards). Moderation actions appear within the TTL;
 * a request flood collapses to O(1) DB reads per instance per window instead
 * of 3–4 queries per page view. getPublicReport stays UNCACHED on purpose:
 * its key space is unbounded (cache-pollution vector) and the submitter's
 * status/photo polling must be fresh. See lib/ttl-cache.ts.
 */
const REPORT_LIST_TTL_MS = 30_000;
const SCORECARD_TTL_MS = 60_000;
const reportListCache = new TtlCache<PublicReport[]>(REPORT_LIST_TTL_MS);
const scorecardCache = new TtlCache<ScorecardEntry[]>(SCORECARD_TTL_MS);

/** Authority scorecard — fairness already enforced in the view (n>=10, notified-only). */
export async function getScorecard(): Promise<ScorecardEntry[]> {
  return scorecardCache.get("scorecard", getScorecardUncached);
}

async function getScorecardUncached(): Promise<ScorecardEntry[]> {
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
  return reportListCache.get(`list:${limit}`, () => listPublicReportsUncached(limit));
}

async function listPublicReportsUncached(limit: number): Promise<PublicReport[]> {
  if (!supabaseConfigured()) {
    if (isProd()) return [];
    return MOCK_REPORTS;
  }

  try {
    const client = getSupabasePublic();
    const [{ data, error }, pending] = await Promise.all([
      client
      .from("v_public_reports")
      .select(REPORT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<ViewRow[]>(),
      listPendingReports(limit),
    ]);

    if (error || !data) return pending;

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

    const published = data
      .map((row) => {
        const report = mapRow(row);
        if (report) {
          const path = photoByReport.get(row.id);
          if (path) report.photo_url = anonymizedPhotoUrl(path);
        }
        return report;
      })
      .filter((r): r is PublicReport => r !== null);
    return [...pending, ...published]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  } catch (e) {
    console.error("[listPublicReports] read failed:", e);
    return [];
  }
}
