-- Traffic + report-funnel aggregate for the admin dashboard (and weekly digest).
-- Adds a 'languages' breakdown (pageviews grouped by UI locale) to web.*.
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
revoke all on function admin_web_analytics(integer) from anon, authenticated;;
