import { createClient } from "@supabase/supabase-js";

/**
 * Browser / anon client — RLS applies.
 * Public data is read through the SQL views (v_public_reports, v_public_report_photos,
 * v_authority_scorecard), never the base tables.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
