-- Pending pins: reports submitted but not yet fully published (awaiting
-- moderation and/or photo anonymization). Product decision 2026-07-02: fresh
-- reports appear on the public map immediately as clearly-marked pending pins.
-- Minimum exposure: token, category, position, date. No photo, no description,
-- no author_token.
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

grant select on v_pending_report_pins to anon, authenticated;;
