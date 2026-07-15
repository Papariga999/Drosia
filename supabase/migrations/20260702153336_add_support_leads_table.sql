-- Supporter / partner first-contact leads (from the public /support form).
-- NOT citizen reports and NOT public: service-role only (RLS on, no anon policy).
-- Durable sink so a lead is never lost even if the notification email fails.
create table if not exists support_leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  organisation text,
  email        text not null,
  role         text not null,            -- hotel|municipality|ngo|local|other
  place        text,
  message      text not null,
  locale       text,                     -- UI language the form was filled in
  created_at   timestamptz not null default now()
);
create index if not exists idx_support_leads_created on support_leads (created_at desc);
alter table support_leads enable row level security;
-- No permissive policies = anon/authenticated cannot read/write. The service-role
-- key (server code only) bypasses RLS; the /api/support-contact route uses it.;
