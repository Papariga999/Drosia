import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side anon client for public projections. RLS/view grants apply.
 * Public rendering must use this client rather than the service role so a
 * future query cannot accidentally bypass the database publication boundary.
 */
type SupabasePublicClient = ReturnType<typeof createClient>;

let client: SupabasePublicClient | null = null;

export function publicSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!url && !url.includes("YOUR_PROJECT") && !!anonKey;
}

export function getSupabasePublic(): SupabasePublicClient {
  if (!publicSupabaseConfigured()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  return client;
}
