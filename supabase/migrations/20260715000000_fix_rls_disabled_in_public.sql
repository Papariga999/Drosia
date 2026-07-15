-- Remediate Supabase Security Advisor: rls_disabled_in_public.
--
-- This migration is intentionally additive and safe to run repeatedly. Older
-- Drosia deployments may not have every table yet, so absent tables are skipped.
-- Existing public views are not touched; they expose only the sanitized columns
-- defined in supabase/schema.sql.

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'countries',
    'authorities',
    'reports',
    'report_photos',
    'delivery_logs',
    'delivery_webhook_events',
    'authority_responses',
    'content_flags',
    'support_leads',
    'anon_devices',
    'report_votes',
    'push_subscriptions',
    'report_follows',
    'geocode_cache',
    'rate_limits',
    'web_events',
    'web_events_daily',
    'admin_tasks'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);
      execute format(
        'revoke all on table public.%I from public, anon, authenticated',
        table_name
      );
    end if;
  end loop;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname = any (array[
        'countries',
        'authorities',
        'reports',
        'report_photos',
        'delivery_logs',
        'delivery_webhook_events',
        'authority_responses',
        'content_flags',
        'support_leads',
        'anon_devices',
        'report_votes',
        'push_subscriptions',
        'report_follows',
        'geocode_cache',
        'rate_limits',
        'web_events',
        'web_events_daily',
        'admin_tasks'
      ])
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'RLS remediation failed: an application table remains unprotected';
  end if;
end
$migration$;
