import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDict, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site-url";
import { notifyReportFollowers } from "@/lib/push/send";

/** Notify followers only after a delivery provider confirmed authority delivery. */
export async function notifyForwardedReportFollowers(reportId: string): Promise<void> {
  const { data: report } = await getSupabaseAdmin()
    .from("reports")
    .select("public_token, locale, status")
    .eq("id", reportId)
    .maybeSingle<{ public_token: string; locale: string; status: string }>();
  if (!report || report.status !== "notified") return;

  const dict = getDict(isLocale(report.locale) ? report.locale : DEFAULT_LOCALE);
  await notifyReportFollowers(reportId, {
    title: dict.push.forwardedTitle,
    body: dict.push.forwardedBody,
    url: `${SITE_URL}/r/${report.public_token}`,
  });
}
