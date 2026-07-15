-- Worldwide report intake.
-- Unmatched coordinates remain country/authority-null until coverage is added.
-- Publication still requires anonymization + moderation; authority delivery is
-- skipped by the application when authority_id is null.

alter table public.reports alter column country_code drop not null;
alter table public.reports drop constraint if exists reports_country_required;

create or replace function public.intake_report(
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
  v_point     geography;
  v_country   text;
  v_authority uuid;
  v_report_id uuid;
  v_token     text;
  v_path      text;
begin
  if p_photo_paths is null or array_length(p_photo_paths, 1) is null then
    raise exception 'NO_PHOTOS' using errcode = 'P0001';
  end if;

  if array_length(p_photo_paths, 1) > 4 then
    raise exception 'TOO_MANY_PHOTOS' using errcode = 'P0001';
  end if;

  if p_lat is null or p_lng is null
    or not (p_lat between -90 and 90)
    or not (p_lng between -180 and 180) then
    raise exception 'INVALID_COORDINATES' using errcode = 'P0001';
  end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  select code into v_country
  from public.countries
  where is_active = true
    and boundary is not null
    and st_covers(boundary, v_point)
  limit 1;

  select id into v_authority
  from public.authorities
  where country_code = v_country
    and is_active = true
    and is_test = false
    and geom is not null
    and st_covers(geom, v_point)
  order by st_area(geom) asc
  limit 1;

  insert into public.reports (
    country_code, authority_id, category, description, geom, locale,
    author_token, status
  )
  values (
    v_country,
    v_authority,
    p_category::public.report_category,
    nullif(p_description, ''),
    v_point,
    coalesce(nullif(p_locale, ''), 'en'),
    nullif(p_author_token, ''),
    'submitted'
  )
  returning id, public_token into v_report_id, v_token;

  foreach v_path in array p_photo_paths loop
    if v_path is null or btrim(v_path) = '' then
      raise exception 'INVALID_PHOTO_PATH' using errcode = 'P0001';
    end if;
    insert into public.report_photos (report_id, original_path)
    values (v_report_id, v_path);
  end loop;

  return v_token;
end;
$$;

revoke all on function public.intake_report(
  double precision, double precision, text, text, text, text, text[]
) from public, anon, authenticated;
grant execute on function public.intake_report(
  double precision, double precision, text, text, text, text, text[]
) to service_role;

create or replace view public.v_public_reports with (security_barrier = true) as
  select r.id, r.public_token, r.country_code, r.authority_id, r.category, r.description,
         st_y(r.geom::geometry) as lat, st_x(r.geom::geometry) as lng,
         r.status, r.vote_count, r.confirm_count,
         r.created_at, r.notified_at, r.resolved_at, r.last_confirmed_at,
         a.name_i18n as authority_name, a.level as authority_level
  from public.reports r
  left join public.authorities a
    on a.id = r.authority_id and a.is_active = true and a.is_test = false
  where r.status in ('in_review','notified','resolved')
    and r.is_test = false
    and r.admin_hidden = false
    and exists (
      select 1
      from public.report_photos ph
      where ph.report_id = r.id
        and ph.blur_status = 'done'
        and ph.public_path is not null
    )
    and not exists (
      select 1
      from public.report_photos ph
      where ph.report_id = r.id
        and (ph.blur_status <> 'done' or ph.public_path is null)
    );

create or replace view public.v_public_report_photos with (security_barrier = true) as
  select ph.report_id, ph.public_path
  from public.report_photos ph
  join public.reports r on r.id = ph.report_id
  where ph.blur_status = 'done' and ph.public_path is not null
    and r.status in ('in_review','notified','resolved') and r.is_test = false
    and r.admin_hidden = false
    and not exists (
      select 1
      from public.report_photos pending
      where pending.report_id = r.id
        and (pending.blur_status <> 'done' or pending.public_path is null)
    );

revoke all on public.v_public_reports, public.v_public_report_photos
  from public, anon, authenticated;
grant select on public.v_public_reports, public.v_public_report_photos
  to anon, authenticated;
