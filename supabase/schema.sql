-- ============================================================================
-- Drosia — Database schema (SINGLE SOURCE OF TRUTH, idempotent)
-- Run on an empty Postgres → exactly the schema the code expects.
-- Re-runnable: every statement is guarded (if not exists / or replace / drop-if-exists).
-- Principles baked in here (not bolted on later):
--   • EU-ready: country + authority are DATA, not constants.
--   • Geofencing + authority routing via PostGIS polygons.
--   • No PII leak: public reads go through VIEWS; base tables are service-role only.
--   • Originals stay private; only anonymized photos are exposed.
--   • Leaderboard fairness (n>=10, notified-only, no test data) is enforced in a VIEW.
-- ============================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ── Enums (idempotent) ──────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type report_status as enum ('submitted','in_review','notified','resolved','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_category') then
    create type report_category as enum
      ('illegal_dump','construction_waste','litter','plastic','tires',
       'appliances','vehicle','green_waste','bulky','coast','sewage','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_channel') then
    create type delivery_channel as enum ('email','open311','none');
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type delivery_status as enum ('queued','sent','delivered','bounced','failed','complained');
  end if;
  if not exists (select 1 from pg_type where typname = 'vote_type') then
    create type vote_type as enum ('priority','still_here');
  end if;
  if not exists (select 1 from pg_type where typname = 'authority_response_type') then
    create type authority_response_type as enum ('in_progress','resolved','not_responsible','disputed');
  end if;
  if not exists (select 1 from pg_type where typname = 'flag_status') then
    create type flag_status as enum ('open','actioned','dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'blur_status') then
    create type blur_status as enum ('pending','done','failed');
  end if;
end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

-- Countries: geofence boundary + active flag. New country = new row, no code change.
create table if not exists countries (
  code           text primary key,                 -- ISO-3166-1 alpha-2, e.g. 'GR'
  name_i18n      jsonb not null default '{}'::jsonb,
  boundary       geography(MultiPolygon, 4326),     -- outer geofence; null until loaded
  default_locale text not null default 'en',
  locales        text[] not null default '{}',
  is_active      boolean not null default false,    -- only active countries accept reports
  created_at     timestamptz not null default now()
);

-- Authorities (EU-neutral; replaces "municipalities"). Coverage polygon + delivery channel.
create table if not exists authorities (
  id                 uuid primary key default gen_random_uuid(),
  country_code       text not null references countries(code),
  name_i18n          jsonb not null default '{}'::jsonb,
  level              text not null default 'municipality',  -- municipality|region|port|environment|...
  geom               geography(MultiPolygon, 4326),
  delivery_channel   delivery_channel not null default 'email',
  email_official     text,
  open311_endpoint   text,
  open311_jurisdiction text,
  is_active          boolean not null default true,
  is_auto_created    boolean not null default false,        -- flag for admin review
  is_test            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Reports.
create table if not exists reports (
  id                   uuid primary key default gen_random_uuid(),
  public_token         text not null unique default encode(gen_random_bytes(8), 'hex'),
  country_code         text references countries(code),
  authority_id         uuid references authorities(id),
  category             report_category not null,
  description          text check (description is null or char_length(description) <= 500),
  geom                 geography(Point, 4326) not null,
  status               report_status not null default 'submitted',
  locale               text not null default 'en',
  author_token         text,                       -- anonymous device token (NOT PII, but not public)
  vote_count           integer not null default 0,
  confirm_count        integer not null default 0,
  is_test              boolean not null default false,
  excluded_from_ranking boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  notified_at          timestamptz,
  resolved_at          timestamptz,
  last_confirmed_at    timestamptz
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'reports_description_max_500'
  ) then
    alter table reports
      add constraint reports_description_max_500
      check (description is null or char_length(description) <= 500) not valid;
  end if;
end $$;

-- Admin moderation: reversibly hide a report from ALL public surfaces (the
-- "deactivate / pause" operator action) WITHOUT deleting it. Independent of the
-- status machine, so even a 'notified' report can be pulled offline and put back
-- later. Additive + idempotent; defaults to visible.
alter table reports add column if not exists admin_hidden boolean not null default false;

-- Moderation audit: why a report was rejected ('private_person' | 'spam_invalid'
-- | 'out_of_scope' | 'dsa_takedown'; validated in the route). Additive + idempotent.
alter table reports add column if not exists reject_reason text;

-- Photos: original (private) + anonymized public variant.
create table if not exists report_photos (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  original_path text not null,                      -- private storage bucket
  public_path   text,                               -- anonymized; null until blur done
  blur_status   blur_status not null default 'pending',
  created_at    timestamptz not null default now()
);

-- Delivery log (email / open311). Never let delivery fail silently.
create table if not exists delivery_logs (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references reports(id) on delete cascade,
  channel             delivery_channel not null,
  recipient           text,
  provider_message_id text,
  status              delivery_status not null default 'queued',
  error               text,
  created_at          timestamptz not null default now()
);

-- Authority responses (right to respond / dispute → feeds fairness).
create table if not exists authority_responses (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  authority_id  uuid references authorities(id),
  response_type authority_response_type not null,
  note          text,
  created_at    timestamptz not null default now()
);

-- Content flags (DSA notice-and-takedown).
create table if not exists content_flags (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references reports(id) on delete cascade,
  reason           text not null,
  reporter_contact text,
  status           flag_status not null default 'open',
  created_at       timestamptz not null default now()
);

-- Anonymous devices (engagement identity; NO PII, NO email).
create table if not exists anon_devices (
  id           uuid primary key default gen_random_uuid(),
  device_token text not null unique,
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

-- Votes / "still here" confirmations (deduped per device per type).
create table if not exists report_votes (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  voter_token  text not null,
  type         vote_type not null,
  created_at   timestamptz not null default now(),
  unique (report_id, voter_token, type)
);

-- Web-push subscriptions (per-report and area follow). NO email.
create table if not exists push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  device_token      text not null,
  endpoint          text not null unique,
  keys              jsonb not null,
  area_authority_id uuid references authorities(id),
  created_at        timestamptz not null default now()
);

-- Geocode cache (rounded lat/lng key).
create table if not exists geocode_cache (
  key        text primary key,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_countries_boundary    on countries using gist (boundary);
create index if not exists idx_authorities_geom       on authorities using gist (geom);
create index if not exists idx_authorities_country    on authorities (country_code);
create index if not exists idx_reports_geom           on reports using gist (geom);
create index if not exists idx_reports_status         on reports (status);
create index if not exists idx_reports_authority      on reports (authority_id);
create index if not exists idx_reports_created        on reports (created_at desc);
create index if not exists idx_reports_public         on reports (status) where is_test = false;
create index if not exists idx_report_photos_report   on report_photos (report_id);
create index if not exists idx_delivery_logs_report   on delivery_logs (report_id);
create index if not exists idx_delivery_logs_status   on delivery_logs (status);
create index if not exists idx_content_flags_status   on content_flags (status);

-- ── Triggers: updated_at + denormalized vote/confirm counts ─────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_reports_updated_at on reports;
create trigger trg_reports_updated_at before update on reports
  for each row execute function set_updated_at();

drop trigger if exists trg_authorities_updated_at on authorities;
create trigger trg_authorities_updated_at before update on authorities
  for each row execute function set_updated_at();

create or replace function refresh_report_vote_counts() returns trigger as $$
declare
  rid uuid := coalesce(new.report_id, old.report_id);
begin
  update reports r set
    vote_count = (select count(*) from report_votes v where v.report_id = rid and v.type = 'priority'),
    confirm_count = (select count(*) from report_votes v where v.report_id = rid and v.type = 'still_here'),
    last_confirmed_at = (select max(created_at) from report_votes v where v.report_id = rid and v.type = 'still_here')
  where r.id = rid;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_votes_count on report_votes;
create trigger trg_votes_count after insert or delete on report_votes
  for each row execute function refresh_report_vote_counts();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Default-deny: enable RLS on every table, grant NO anon policies on base tables.
-- All writes happen server-side via the service role (rate-limited routes).
-- Public reads happen ONLY through the views below (no PII, no originals).
alter table countries          enable row level security;
alter table authorities        enable row level security;
alter table reports            enable row level security;
alter table report_photos      enable row level security;
alter table delivery_logs      enable row level security;
alter table authority_responses enable row level security;
alter table content_flags      enable row level security;
alter table anon_devices       enable row level security;
alter table report_votes       enable row level security;
alter table push_subscriptions enable row level security;
alter table geocode_cache      enable row level security;
-- (No permissive policies = anon/authenticated cannot read/write base tables.
--  The service-role key bypasses RLS and is used only in server code.)

-- ── Public read VIEWS (safe columns only) ───────────────────────────────────
-- Published reports, without author_token / is_test.
create or replace view v_public_reports as
  select r.id, r.public_token, r.country_code, r.authority_id, r.category, r.description,
         st_y(r.geom::geometry) as lat, st_x(r.geom::geometry) as lng,
         r.status, r.vote_count, r.confirm_count,
         r.created_at, r.notified_at, r.resolved_at, r.last_confirmed_at,
         a.name_i18n as authority_name, a.level as authority_level
  from reports r
  left join authorities a on a.id = r.authority_id
  where r.status in ('in_review','notified','resolved')
    and r.is_test = false
    and r.admin_hidden = false
    and exists (
      select 1
      from report_photos ph
      where ph.report_id = r.id
        and ph.blur_status = 'done'
        and ph.public_path is not null
    );

-- Anonymized photos only (never original_path), for published reports.
create or replace view v_public_report_photos as
  select ph.report_id, ph.public_path
  from report_photos ph
  join reports r on r.id = ph.report_id
  where ph.blur_status = 'done' and ph.public_path is not null
    and r.status in ('in_review','notified','resolved') and r.is_test = false
    and r.admin_hidden = false;

-- Pending pins: reports submitted but not yet fully published (awaiting
-- moderation and/or photo anonymization). PRODUCT DECISION 2026-07-02: a fresh
-- report appears on the public map IMMEDIATELY as a clearly-marked pending pin,
-- and its /r/<token> page shows a status-only view — otherwise a shared link
-- 404s until approval, which reads as "report lost". Exposes the MINIMUM:
-- token, category, position, date. No photo, no description, no author_token —
-- pre-moderation content stays behind the anonymization/moderation gate.
create or replace view v_pending_report_pins as
  select r.public_token, r.category,
         st_y(r.geom::geometry) as lat, st_x(r.geom::geometry) as lng,
         r.created_at
  from reports r
  where r.is_test = false
    and r.admin_hidden = false
    and (
      r.status = 'submitted'
      or (r.status = 'in_review' and not exists (
        select 1 from report_photos ph
        where ph.report_id = r.id
          and ph.blur_status = 'done'
          and ph.public_path is not null
      ))
    );

-- Authority accountability scorecard — FAIRNESS ENFORCED:
--   • only delivered ('notified'+'resolved') count, • >= 10, • no test, • no excluded.
create or replace view v_authority_scorecard as
  select a.id as authority_id, a.country_code, a.name_i18n, a.level,
         count(*) filter (where r.status in ('notified','resolved')) as notified_count,
         count(*) filter (where r.status = 'resolved')               as resolved_count,
         round(100.0 * count(*) filter (where r.status = 'resolved')
               / nullif(count(*) filter (where r.status in ('notified','resolved')), 0), 1) as resolution_rate_pct
  from authorities a
  join reports r on r.authority_id = a.id
   and r.is_test = false and r.excluded_from_ranking = false and r.admin_hidden = false
  group by a.id, a.country_code, a.name_i18n, a.level
  having count(*) filter (where r.status in ('notified','resolved')) >= 10;

grant select on v_public_reports        to anon, authenticated;
grant select on v_public_report_photos  to anon, authenticated;
grant select on v_authority_scorecard   to anon, authenticated;
grant select on v_pending_report_pins   to anon, authenticated;

-- ── Intake RPC: geofence + authority routing + insert, atomic ───────────────
-- Called SERVER-SIDE ONLY (service role) from the rate-limited /api/report route,
-- AFTER originals have been uploaded to the private bucket. One transaction:
--   • Geofence: STRICT. The point must fall inside an ACTIVE country boundary,
--     otherwise the function raises OUT_OF_BOUNDS and nothing is inserted.
--   • Authority routing: smallest covering polygon wins (most specific); no
--     match → authority_id stays null and the report is flagged for admin review.
-- Photos start blur_status='pending'; the report is NOT public until anonymized.
create or replace function intake_report(
  p_lng          double precision,
  p_lat          double precision,
  p_category     text,
  p_description  text,
  p_locale       text,
  p_author_token text,
  p_photo_paths  text[]
) returns text
language plpgsql
as $$
declare
  v_point     geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_country   text;
  v_authority uuid;
  v_report_id uuid;
  v_token     text;
  v_path      text;
begin
  if p_photo_paths is null or array_length(p_photo_paths, 1) is null then
    raise exception 'NO_PHOTOS' using errcode = 'P0001';
  end if;

  select code into v_country
  from countries
  where is_active = true
    and boundary is not null
    and st_covers(boundary, v_point)
  limit 1;

  -- STRICT geofence: a point outside every active country is rejected. The
  -- caller (rate-limited /api/report) maps OUT_OF_BOUNDS to HTTP 422 and may opt
  -- into a relaxed testing fallback. Never silently accept out-of-bounds reports.
  if v_country is null then
    raise exception 'OUT_OF_BOUNDS' using errcode = 'P0001';
  end if;

  select id into v_authority
  from authorities
  where country_code = v_country
    and is_active = true
    and geom is not null
    and st_covers(geom, v_point)
  order by st_area(geom::geometry) asc
  limit 1;

  insert into reports (country_code, authority_id, category, description, geom, locale, author_token, status)
  values (
    v_country,
    v_authority,
    p_category::report_category,
    nullif(p_description, ''),
    v_point,
    coalesce(nullif(p_locale, ''), 'en'),
    nullif(p_author_token, ''),
    'submitted'
  )
  returning id, public_token into v_report_id, v_token;

  foreach v_path in array p_photo_paths loop
    insert into report_photos (report_id, original_path) values (v_report_id, v_path);
  end loop;

  return v_token;
end;
$$;

-- Only the service role (server) may submit. anon/authenticated must use the route.
revoke all on function intake_report(double precision, double precision, text, text, text, text, text[]) from public;
revoke all on function intake_report(double precision, double precision, text, text, text, text, text[]) from anon, authenticated;

-- Helper: set a country geofence boundary from (E)WKT. supabase-js can't write a
-- geography column directly, so loaders/seeds call this RPC. Service-role only.
create or replace function set_country_boundary(p_code text, p_wkt text)
returns void
language sql
as $$
  update countries set boundary = st_geogfromtext(p_wkt) where code = p_code;
$$;
revoke all on function set_country_boundary(text, text) from public;
revoke all on function set_country_boundary(text, text) from anon, authenticated;

-- Helper: set an authority coverage polygon from (E)WKT. Service-role only.
create or replace function set_authority_geom(p_id uuid, p_wkt text)
returns void
language sql
as $$
  update authorities set geom = st_geogfromtext(p_wkt) where id = p_id;
$$;
revoke all on function set_authority_geom(uuid, text) from public;
revoke all on function set_authority_geom(uuid, text) from anon, authenticated;

-- Helper: set an authority coverage polygon from a GeoJSON geometry. Used by the
-- bulk OSM boundary import. Repairs self-intersections from simplification
-- (ST_MakeValid), keeps polygonal parts only, and coerces to MultiPolygon before
-- the geography cast so every row stores a uniform, valid coverage shape.
create or replace function set_authority_geom_geojson(p_id uuid, p_geojson text)
returns void
language sql
as $$
  update authorities
  set geom = st_multi(
               st_collectionextract(
                 st_makevalid(st_setsrid(st_geomfromgeojson(p_geojson), 4326)),
                 3)            -- 3 = keep polygons only
             )::geography
  where id = p_id;
$$;
revoke all on function set_authority_geom_geojson(uuid, text) from public;
revoke all on function set_authority_geom_geojson(uuid, text) from anon, authenticated;

-- ── Admin moderation queue read (service-role only) ─────────────────────────
-- Exposes lat/lng (decoded from geom) + authority + blur progress for the
-- operator board, WITHOUT leaking geom WKB or author_token to anything but the
-- server (anon/authenticated are revoked below).
-- Drop first: this RETURNS TABLE signature has grown over time (e.g. admin_hidden)
-- and Postgres refuses `create or replace` when the return shape changes.
drop function if exists admin_list_reports(text);
create or replace function admin_list_reports(p_status text)
returns table (
  id               uuid,
  public_token     text,
  category         text,
  description      text,
  status           text,
  lat              double precision,
  lng              double precision,
  created_at       timestamptz,
  notified_at      timestamptz,
  authority_id     uuid,
  authority_name   jsonb,
  authority_email  text,
  delivery_channel text,
  photo_count      integer,
  blur_done_count  integer,
  admin_hidden     boolean
)
language sql
as $$
  select r.id, r.public_token, r.category::text, r.description, r.status::text,
         st_y(r.geom::geometry), st_x(r.geom::geometry), r.created_at, r.notified_at,
         r.authority_id, a.name_i18n, a.email_official, a.delivery_channel::text,
         (select count(*)::int from report_photos p where p.report_id = r.id),
         (select count(*)::int from report_photos p where p.report_id = r.id and p.blur_status = 'done'),
         r.admin_hidden
  from reports r
  left join authorities a on a.id = r.authority_id
  where r.is_test = false
    and (p_status is null or r.status::text = p_status)
  order by r.created_at desc
  limit 200;
$$;
revoke all on function admin_list_reports(text) from public;
revoke all on function admin_list_reports(text) from anon, authenticated;

-- Authority directory with derived pending count + last delivery status + bounces.
create or replace function admin_list_authorities()
returns table (
  id                  uuid,
  name_i18n           jsonb,
  level               text,
  country_code        text,
  email_official      text,
  delivery_channel    text,
  is_active           boolean,
  has_geom            boolean,
  pending_count       integer,
  last_delivery_status text,
  last_delivery_at    timestamptz,
  bounce_count        integer
)
language sql
as $$
  select a.id, a.name_i18n, a.level, a.country_code, a.email_official,
         a.delivery_channel::text, a.is_active, a.geom is not null,
         (select count(*)::int from reports r
            where r.authority_id = a.id and r.is_test = false
              and r.status in ('submitted','in_review')),
         (select dl.status::text from delivery_logs dl
            join reports r2 on r2.id = dl.report_id
            where r2.authority_id = a.id order by dl.created_at desc limit 1),
         (select dl.created_at from delivery_logs dl
            join reports r2 on r2.id = dl.report_id
            where r2.authority_id = a.id order by dl.created_at desc limit 1),
         (select count(*)::int from delivery_logs dl
            join reports r3 on r3.id = dl.report_id
            where r3.authority_id = a.id and dl.status in ('bounced','complained'))
  from authorities a
  where a.is_test = false
  order by a.name_i18n->>'en' nulls last;
$$;
revoke all on function admin_list_authorities() from public;
revoke all on function admin_list_authorities() from anon, authenticated;

-- Delivery & bounce monitor: logs joined with report token + authority name.
create or replace function admin_list_deliveries(p_status text)
returns table (
  id                  uuid,
  report_id           uuid,
  report_token        text,
  authority_name      jsonb,
  recipient           text,
  channel             text,
  status              text,
  error               text,
  provider_message_id text,
  created_at          timestamptz
)
language sql
as $$
  select dl.id, dl.report_id, r.public_token, a.name_i18n,
         dl.recipient, dl.channel::text, dl.status::text, dl.error,
         dl.provider_message_id, dl.created_at
  from delivery_logs dl
  join reports r on r.id = dl.report_id
  left join authorities a on a.id = r.authority_id
  where (p_status is null or dl.status::text = p_status)
  order by dl.created_at desc
  limit 200;
$$;
revoke all on function admin_list_deliveries(text) from public;
revoke all on function admin_list_deliveries(text) from anon, authenticated;

-- DSA notice-and-takedown queue: content flags joined with report token.
create or replace function admin_list_flags(p_status text)
returns table (
  id               uuid,
  report_id        uuid,
  report_token     text,
  reason           text,
  reporter_contact text,
  status           text,
  created_at       timestamptz
)
language sql
as $$
  select cf.id, cf.report_id, r.public_token, cf.reason, cf.reporter_contact,
         cf.status::text, cf.created_at
  from content_flags cf
  join reports r on r.id = cf.report_id
  where (p_status is null or cf.status::text = p_status)
  order by cf.created_at desc
  limit 200;
$$;
revoke all on function admin_list_flags(text) from public;
revoke all on function admin_list_flags(text) from anon, authenticated;

-- Authority dispute queue: responses joined with report token + authority name.
create or replace function admin_list_disputes()
returns table (
  id             uuid,
  report_id      uuid,
  report_token   text,
  authority_name jsonb,
  response_type  text,
  note           text,
  excluded       boolean,
  created_at     timestamptz
)
language sql
as $$
  select ar.id, ar.report_id, r.public_token, a.name_i18n,
         ar.response_type::text, ar.note, r.excluded_from_ranking, ar.created_at
  from authority_responses ar
  join reports r on r.id = ar.report_id
  left join authorities a on a.id = ar.authority_id
  where ar.response_type in ('disputed','not_responsible')
  order by ar.created_at desc
  limit 200;
$$;
revoke all on function admin_list_disputes() from public;
revoke all on function admin_list_disputes() from anon, authenticated;

-- ── Durable rate limiting (cross-instance) ─────────────────────────────────
-- The app's in-memory limiter is per-serverless-instance and resets on cold
-- start, so it cannot protect the admin login from brute force. This fixed-window
-- counter is shared across all instances. Called SERVER-SIDE ONLY (service role).
create table if not exists rate_limits (
  bucket_key   text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket_key, window_start)
);
create index if not exists idx_rate_limits_window on rate_limits (window_start);
alter table rate_limits enable row level security;  -- service-role only (no policies)

create or replace function rate_limit_hit(p_key text, p_limit integer, p_window_ms bigint)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
as $$
declare
  v_secs         double precision := p_window_ms / 1000.0;
  v_window_start timestamptz;
  v_window_end   timestamptz;
  v_count        integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / v_secs) * v_secs);
  v_window_end   := v_window_start + make_interval(secs => v_secs);

  insert into rate_limits (bucket_key, window_start, count)
    values (p_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
    do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup of stale windows (keeps the table tiny without a cron).
  if random() < 0.01 then
    delete from rate_limits where window_start < clock_timestamp() - interval '1 day';
  end if;

  if v_count > p_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_window_end - clock_timestamp())))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;
revoke all on function rate_limit_hit(text, integer, bigint) from public;
revoke all on function rate_limit_hit(text, integer, bigint) from anon, authenticated;

-- ── Cookieless first-party web analytics ────────────────────────────────────
-- /api/track ingests events WITHOUT storing the IP (coarse country only, random
-- session id, bots dropped). Raw events roll up into web_events_daily and are
-- purged after 180 days by web_events_maintenance(). Service-role only (RLS on,
-- no anon policies; the admin_* RPCs below are revoked from anon/authenticated).
create table if not exists web_events (
  id           uuid primary key default gen_random_uuid(),
  event        text not null default 'pageview',
  path         text,
  report_token text,
  source       text,
  country      text,          -- coarse ISO country from the edge header; never the IP
  device       text,          -- 'mobile' | 'desktop' (bots are dropped at ingest)
  sid          text,          -- random session-scoped id, NOT an identity
  locale       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_web_events_created on web_events (created_at);
create index if not exists idx_web_events_report  on web_events (report_token) where report_token is not null;
create index if not exists idx_web_events_event   on web_events (event);
alter table web_events enable row level security;

create table if not exists web_events_daily (
  day          date primary key,
  pageviews    integer not null default 0,
  sessions     integer not null default 0,
  report_views integer not null default 0
);
alter table web_events_daily enable row level security;

-- Roll raw events up into daily aggregates and purge raw rows older than the
-- 180-day retention window. Called opportunistically from /api/track (no cron).
create or replace function web_events_maintenance()
returns void
language plpgsql
as $$
begin
  insert into web_events_daily (day, pageviews, sessions, report_views)
  select created_at::date,
         count(*) filter (where event = 'pageview'),
         count(distinct sid),
         count(*) filter (where event = 'pageview' and report_token is not null)
  from web_events
  group by created_at::date
  on conflict (day) do update
    set pageviews = excluded.pageviews,
        sessions = excluded.sessions,
        report_views = excluded.report_views;
  delete from web_events where created_at < now() - interval '180 days';
end; $$;
revoke all on function web_events_maintenance() from public;
revoke all on function web_events_maintenance() from anon, authenticated;

-- Traffic + report-funnel aggregate for the admin dashboard (and weekly digest).
create or replace function admin_web_analytics(p_days integer default 30)
returns jsonb
language sql
stable
as $$
with d as (select greatest(1, least(coalesce(p_days,30),365)) as days),
b as (select now() - ((select days from d) || ' days')::interval as since,
             now() - ((2*(select days from d)) || ' days')::interval as prev_since),
ev  as (select e.* from web_events e, b where e.created_at >= b.since),
evp as (select e.* from web_events e, b where e.created_at >= b.prev_since and e.created_at < b.since),
series as (select gs::date as day from generate_series((current_date - ((select days from d)-1))::timestamp, current_date::timestamp, interval '1 day') gs),
ts as (select s.day, count(e.id) filter (where e.event='pageview') as pageviews, count(distinct e.sid) as sessions
       from series s left join ev e on e.created_at::date = s.day group by s.day)
select jsonb_build_object(
  'days',(select days from d),
  'web', jsonb_build_object(
    'pageviews',(select count(*) from ev where event='pageview'),
    'sessions',(select count(distinct sid) from ev),
    'report_views',(select count(*) from ev where event='pageview' and report_token is not null),
    'timeseries',(select coalesce(jsonb_agg(jsonb_build_object('day',day,'pageviews',pageviews,'sessions',sessions) order by day),'[]'::jsonb) from ts),
    'sources',(select coalesce(jsonb_agg(j),'[]'::jsonb) from (select jsonb_build_object('label',coalesce(source,'direct'),'views',count(*)) j from ev where event='pageview' group by coalesce(source,'direct') order by count(*) desc limit 8) x),
    'countries',(select coalesce(jsonb_agg(j),'[]'::jsonb) from (select jsonb_build_object('label',coalesce(country,'?'),'views',count(*)) j from ev where event='pageview' group by coalesce(country,'?') order by count(*) desc limit 8) x),
    'devices',(select coalesce(jsonb_agg(j),'[]'::jsonb) from (select jsonb_build_object('label',coalesce(device,'?'),'views',count(*)) j from ev where event='pageview' group by coalesce(device,'?') order by count(*) desc) x),
    'languages',(select coalesce(jsonb_agg(j),'[]'::jsonb) from (select jsonb_build_object('label',coalesce(locale,'?'),'views',count(*)) j from ev where event='pageview' group by coalesce(locale,'?') order by count(*) desc) x),
    'top_reports',(select coalesce(jsonb_agg(j),'[]'::jsonb) from (select jsonb_build_object('label',report_token,'views',count(*)) j from ev where event='pageview' and report_token is not null group by report_token order by count(*) desc limit 8) x),
    'prev', jsonb_build_object(
      'pageviews',(select count(*) from evp where event='pageview'),
      'sessions',(select count(distinct sid) from evp),
      'report_views',(select count(*) from evp where event='pageview' and report_token is not null))
  ),
  'funnel', jsonb_build_object(
    'sessions',(select count(distinct sid) from ev),
    'report_start',(select count(distinct sid) from ev where event='report_start'),
    'photo_added',(select count(distinct sid) from ev where event='photo_added'),
    'geolocate',(select count(distinct sid) from ev where event='geolocate'),
    'submit_success',(select count(distinct sid) from ev where event='submit_success'),
    'submit_fail',(select count(distinct sid) from ev where event='submit_fail')),
  'reports', jsonb_build_object(
    'submitted_in_range',(select count(*) from reports r,b where r.is_test=false and r.created_at>=b.since),
    'submitted_prev',(select count(*) from reports r,b where r.is_test=false and r.created_at>=b.prev_since and r.created_at<b.since),
    'notified',(select count(*) from reports r,b where r.is_test=false and r.notified_at>=b.since),
    'resolved',(select count(*) from reports r,b where r.is_test=false and r.resolved_at>=b.since),
    'by_status',(select coalesce(jsonb_object_agg(status,c),'{}'::jsonb) from (select status::text as status, count(*) c from reports where is_test=false group by status) x))
);
$$;
revoke all on function admin_web_analytics(integer) from public;
revoke all on function admin_web_analytics(integer) from anon, authenticated;

-- Civic-outcome reporting (categories, authorities, resolution times, delivery
-- health, rejections, map points) from existing report data. No test data.
create or replace function admin_report_analytics(p_days integer default 90)
returns jsonb
language sql
stable
as $$
with d as (select greatest(1, least(coalesce(p_days,90),3650)) as days),
b as (select now() - ((select days from d) || ' days')::interval as since),
r as (select rep.* from reports rep, b where rep.is_test=false and rep.created_at >= b.since)
select jsonb_build_object(
  'days',(select days from d),
  'totals', jsonb_build_object('reports',(select count(*) from r),
    'by_status',(select coalesce(jsonb_object_agg(status,c),'{}'::jsonb) from (select status::text status,count(*) c from r group by status) x)),
  'by_category',(select coalesce(jsonb_agg(j order by cnt desc),'[]'::jsonb) from (
     select jsonb_build_object('label',category::text,'count',count(*),'resolved',count(*) filter(where status='resolved')) j,count(*) cnt from r group by category) x),
  'by_authority',(select coalesce(jsonb_agg(j order by cnt desc),'[]'::jsonb) from (
     select jsonb_build_object('label',coalesce(a.name_i18n->>'en',a.name_i18n->>'el','—'),'count',count(*),'resolved',count(*) filter(where r2.status='resolved')) j,count(*) cnt
     from r r2 join authorities a on a.id=r2.authority_id group by a.id,a.name_i18n order by count(*) desc limit 10) x),
  'resolution', jsonb_build_object(
     'median_notify_hours',(select percentile_cont(0.5) within group (order by extract(epoch from (notified_at-created_at))/3600.0) from r where notified_at is not null),
     'median_resolve_hours',(select percentile_cont(0.5) within group (order by extract(epoch from (resolved_at-notified_at))/3600.0) from r where resolved_at is not null and notified_at is not null),
     'notified',(select count(*) from r where notified_at is not null),
     'resolved',(select count(*) from r where status='resolved')),
  'delivery',(select jsonb_build_object('total',count(*),'delivered',count(*) filter(where status='delivered'),'sent',count(*) filter(where status='sent'),
     'bounced',count(*) filter(where status='bounced'),'failed',count(*) filter(where status='failed'),'complained',count(*) filter(where status='complained'))
     from delivery_logs dl,b where dl.created_at>=b.since),
  'rejections', jsonb_build_object('total',(select count(*) from r where status='rejected'),
     'by_reason',(select coalesce(jsonb_agg(j order by cnt desc),'[]'::jsonb) from (select jsonb_build_object('label',coalesce(reject_reason,'unspecified'),'count',count(*)) j,count(*) cnt from r where status='rejected' group by reject_reason) y)),
  'points',(select coalesce(jsonb_agg(jsonb_build_object('lat',st_y(geom::geometry),'lng',st_x(geom::geometry),'status',status::text)),'[]'::jsonb)
            from (select geom,status from r where geom is not null limit 500) z));
$$;
revoke all on function admin_report_analytics(integer) from public;
revoke all on function admin_report_analytics(integer) from anon, authenticated;

-- Per-report engagement stats (views + votes) for the admin report detail.
create or replace function admin_report_stats(p_token text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'views',(select count(*) from web_events where report_token=p_token and event='pageview'),
    'priority',(select count(*) from report_votes v join reports rr on rr.id=v.report_id where rr.public_token=p_token and v.type='priority'),
    'still_here',(select count(*) from report_votes v join reports rr on rr.id=v.report_id where rr.public_token=p_token and v.type='still_here'));
$$;
revoke all on function admin_report_stats(text) from public;
revoke all on function admin_report_stats(text) from anon, authenticated;

-- ── Operator task list (admin board “Tasks” tab; service-role only) ─────────
create table if not exists admin_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  details    text,
  status     text not null default 'open',      -- 'open' | 'done'
  priority   text not null default 'p2',        -- 'p0' | 'p1' | 'p2'
  category   text not null default 'task',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table admin_tasks enable row level security;

-- ── Storage buckets (originals private, public anonymized) ──────────────────
-- We only create the buckets. We deliberately do NOT touch storage.objects:
--   • on Supabase it is owned by supabase_storage_admin (ALTER/CREATE POLICY
--     there raises "must be owner of table objects"), and RLS is already on;
--   • a PUBLIC bucket ('report-public') is served publicly by the Storage API
--     with no extra policy needed;
--   • the PRIVATE bucket ('report-originals') is only ever read via the service
--     role (anonymization), which bypasses RLS — so no policy is required.
-- Wrapped so a least-privileged role degrades to a NOTICE instead of failing;
-- in that case create the two buckets from the Supabase dashboard.
do $$
begin
  insert into storage.buckets (id, name, public)
    values ('report-originals', 'report-originals', false)
    on conflict (id) do nothing;
  insert into storage.buckets (id, name, public)
    values ('report-public', 'report-public', true)
    on conflict (id) do nothing;
exception
  when insufficient_privilege then
    raise notice 'Skipped storage bucket creation (insufficient privilege). Create buckets "report-originals" (private) and "report-public" (public) in the Supabase dashboard.';
end $$;
