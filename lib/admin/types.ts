export interface AdminAuthorityRow {
  id: string;
  name_i18n: Record<string, string> | null;
  level: string;
  country_code: string;
  email_official: string | null;
  delivery_channel: string;
  is_active: boolean;
  has_geom: boolean;
  pending_count: number;
  last_delivery_status: string | null;
  last_delivery_at: string | null;
  bounce_count: number;
}

export interface AdminDeliveryRow {
  id: string;
  report_id: string;
  report_token: string;
  authority_name: Record<string, string> | null;
  recipient: string | null;
  channel: string;
  status: string;
  error: string | null;
  provider_message_id: string | null;
  created_at: string;
}

export interface AdminFlagRow {
  id: string;
  report_id: string;
  report_token: string;
  reason: string;
  reporter_contact: string | null;
  status: string;
  created_at: string;
}

export interface AdminDisputeRow {
  id: string;
  report_id: string;
  report_token: string;
  authority_name: Record<string, string> | null;
  response_type: string;
  note: string | null;
  excluded: boolean;
  created_at: string;
}

export interface DeliveryHealth {
  total: number;
  deliveredPct: number;
  bouncePct: number;
  fromDomain: string | null;
  verifiedDomain: string | null;
  domainVerified: boolean;
}

/** Shared shape for the admin moderation queue (returned by admin_list_reports). */
export interface AdminReportRow {
  id: string;
  public_token: string;
  category: string;
  description: string | null;
  status: string;
  lat: number;
  lng: number;
  created_at: string;
  notified_at: string | null;
  authority_id: string | null;
  authority_name: Record<string, string> | null;
  authority_email: string | null;
  delivery_channel: string | null;
  photo_count: number;
  blur_done_count: number;
  /** Anonymized (public) preview URL of the first photo; null until blur is done. */
  photo_url: string | null;
}
