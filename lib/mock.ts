import type { ReportCategory } from "./categories";
import type { Locale } from "./i18n";

/**
 * Demo data standing in for the `v_public_reports` view until the backend is
 * wired. Shapes mirror the read-only public view (anonymized photo path only).
 * NOTE: every record here is demo-only (is_test) and must never feed real
 * public aggregates / boards.
 */
export type PublicReport = {
  public_token: string;
  category: ReportCategory;
  lat: number;
  lng: number;
  status: "in_review" | "notified" | "resolved";
  vote_count: number;
  confirm_count: number;
  created_at: string;
  notified_at: string | null;
  resolved_at: string | null;
  authority_name: Record<Locale, string>;
  place: string;
  /** Anonymized public photo URL (report-public bucket); undefined in mock/demo. */
  photo_url?: string;
};

const RHODES = { el: "Δήμος Ρόδου", en: "Municipality of Rhodes", de: "Gemeinde Rhodos" };
const KOS = { el: "Δήμος Κω", en: "Municipality of Kos", de: "Gemeinde Kos" };

export const MOCK_REPORTS: PublicReport[] = [
  {
    public_token: "demo-open",
    category: "illegal_dump",
    lat: 36.3461,
    lng: 28.1233,
    status: "notified",
    vote_count: 14,
    confirm_count: 6,
    created_at: "2026-05-12T09:20:00Z",
    notified_at: "2026-05-14T08:00:00Z",
    resolved_at: null,
    authority_name: RHODES,
    place: "Φαληράκι",
  },
  {
    public_token: "demo-resolved",
    category: "coast",
    lat: 36.3925,
    lng: 28.2107,
    status: "resolved",
    vote_count: 31,
    confirm_count: 9,
    created_at: "2026-05-12T09:20:00Z",
    notified_at: "2026-05-14T08:00:00Z",
    resolved_at: "2026-05-26T12:00:00Z",
    authority_name: RHODES,
    place: "Λίνδος",
  },
  {
    public_token: "demo-plastic",
    category: "plastic",
    lat: 36.89,
    lng: 27.288,
    status: "notified",
    vote_count: 8,
    confirm_count: 3,
    created_at: "2026-06-02T10:00:00Z",
    notified_at: "2026-06-03T09:00:00Z",
    resolved_at: null,
    authority_name: KOS,
    place: "Κως",
  },
];

export function getMockReport(token: string): PublicReport | undefined {
  return MOCK_REPORTS.find((r) => r.public_token === token);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}
