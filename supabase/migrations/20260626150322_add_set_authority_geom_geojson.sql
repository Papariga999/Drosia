create or replace function set_authority_geom_geojson(p_id uuid, p_geojson text)
returns void
language sql
as $$
  update authorities
  set geom = st_multi(
               st_collectionextract(
                 st_makevalid(st_setsrid(st_geomfromgeojson(p_geojson), 4326)),
                 3)
             )::geography
  where id = p_id;
$$;
revoke all on function set_authority_geom_geojson(uuid, text) from public;
revoke all on function set_authority_geom_geojson(uuid, text) from anon, authenticated;;
