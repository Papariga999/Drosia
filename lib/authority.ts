import "server-only";
import type { Locale } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getScorecard } from "@/lib/reports";
import type { PublicReport } from "@/lib/mock";

/**
 * Authority accountability page data. The slug is the authority id (uuid).
 * Ranking comes from v_authority_scorecard (fairness enforced: n>=10) — null
 * until the authority qualifies, so the page can show the honest "not enough
 * data" state instead of a misleading score.
 */
export interface AuthorityPageData {
  id: string;
  name: Record<Locale, string>;
  level: string;
  ranked: { rate: number; notified: number; resolved: number; rank: number } | null;
  disputed: boolean;
  reports: PublicReport[];
}

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function toMap(name: Record<string, string> | null): Record<Locale, string> {
  const m = LOCALES.reduce((acc, l) => ({ ...acc, [l]: "" }), {} as Record<Locale, string>);
  if (name) for (const l of LOCALES) if (typeof name[l] === "string") m[l] = name[l];
  return m;
}

export async function getAuthorityPage(id: string): Promise<AuthorityPageData | null> {
  if (!configured()) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data: authority } = await admin
      .from("authorities")
      .select("id, name_i18n, level")
      .eq("id", id)
      .maybeSingle<{ id: string; name_i18n: Record<string, string> | null; level: string }>();
    if (!authority) return null;

    const scorecard = await getScorecard();
    const idx = scorecard.findIndex((s) => s.authority_id === id);
    const entry = idx >= 0 ? scorecard[idx] : null;

    const { data: disp } = await admin
      .from("authority_responses")
      .select("id")
      .eq("authority_id", id)
      .in("response_type", ["disputed", "not_responsible"])
      .limit(1);

    // Query the public view filtered to this authority.
    const { data: rows } = await admin
      .from("v_public_reports")
      .select("public_token, category, lat, lng, status, vote_count, confirm_count, created_at, notified_at, resolved_at, authority_name")
      .eq("authority_id", id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<
        {
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
        }[]
      >();

    const mapped: PublicReport[] = (rows ?? [])
      .filter((r) => r.status === "in_review" || r.status === "notified" || r.status === "resolved")
      .map((r) => ({
        public_token: r.public_token,
        category: r.category as PublicReport["category"],
        lat: r.lat,
        lng: r.lng,
        status: r.status as PublicReport["status"],
        vote_count: r.vote_count ?? 0,
        confirm_count: r.confirm_count ?? 0,
        created_at: r.created_at,
        notified_at: r.notified_at,
        resolved_at: r.resolved_at,
        authority_name: toMap(r.authority_name),
        place: "",
      }));

    return {
      id,
      name: toMap(authority.name_i18n),
      level: authority.level,
      ranked: entry
        ? { rate: Math.round(entry.resolution_rate_pct), notified: entry.notified_count, resolved: entry.resolved_count, rank: idx + 1 }
        : null,
      disputed: !!(disp && disp.length),
      reports: mapped,
    };
  } catch (e) {
    console.error("[getAuthorityPage] read failed:", e);
    return null;
  }
}
