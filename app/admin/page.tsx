import { AdminBoard } from "@/components/admin/AdminBoard";

/**
 * Admin / operator board — /admin. Desktop, English-only (for future
 * international staff). Outside the public i18n + phone-frame layout.
 * Note: outbound authority emails stay in the authority's locale, not English.
 */
export default function AdminPage() {
  return <AdminBoard />;
}
