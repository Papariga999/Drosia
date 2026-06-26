import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isReportCategory, type ReportCategory } from "@/lib/categories";

/**
 * "Impact of THIS device" — reads the device's own reports by author_token (the
 * token is the secret, so this is service-role server-side only). Honest: counts
 * the device's submissions, not an account. Rejected reports are excluded.
 */
export interface DeviceImpact {
  reported: number;
  resolved: number;
  confirms: number;
  mine: { token: string; category: ReportCategory; status: string; created_at: string }[];
}

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function getDeviceImpact(token: string): Promise<DeviceImpact> {
  const empty: DeviceImpact = { reported: 0, resolved: 0, confirms: 0, mine: [] };
  if (!configured() || !token) return empty;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("reports")
      .select("public_token, category, status, created_at, confirm_count")
      .eq("author_token", token)
      .eq("is_test", false)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .returns<{ public_token: string; category: string; status: string; created_at: string; confirm_count: number }[]>();

    if (error || !data) return empty;

    const mine = data
      .filter((r) => isReportCategory(r.category))
      .map((r) => ({
        token: r.public_token,
        category: r.category as ReportCategory,
        status: r.status,
        created_at: r.created_at,
      }));

    return {
      reported: data.length,
      resolved: data.filter((r) => r.status === "resolved").length,
      confirms: data.reduce((s, r) => s + (r.confirm_count ?? 0), 0),
      mine,
    };
  } catch (e) {
    console.error("[getDeviceImpact] read failed:", e);
    return empty;
  }
}
