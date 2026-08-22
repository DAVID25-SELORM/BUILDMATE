-- Replace four top-level category images with approved, category-specific assets.
begin;

with replacements(slug,image_path,image_alt) as(values
 ('tiles-flooring','/images/categories/tiles-and-flooring-v3.webp','Floor tiles, wall tiles, porcelain, ceramic and tile installation materials'),
 ('electrical','/images/categories/electrical-v3.webp','Electrical cables, breakers, sockets, conduits and lighting accessories'),
 ('plumbing-sanitary','/images/categories/plumbing-and-sanitary-v3.webp','Pipes, fittings, taps, sanitary ware, water storage and plumbing tools'),
 ('roofing','/images/categories/roofing-v3.webp','Roofing sheets, roof framing, gutters, fasteners and installation work')
)
update public.categories c
set image_path=r.image_path,image_alt=r.image_alt
from replacements r
where c.slug=r.slug and c.parent_id is null;

do $$ declare assigned_count integer; unique_count integer;
begin
 select count(image_path),count(distinct image_path)
 into assigned_count,unique_count
 from public.categories where parent_id is null and is_active;
 if assigned_count<>15 or unique_count<>15 then
  raise exception 'Expected 15 assigned and unique top-level category images; assigned %, unique %',assigned_count,unique_count;
 end if;
end $$;

insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'category',c.id::text,'CATEGORY_MEDIA_REPLACED',jsonb_build_object('slug',c.slug,'image_path',c.image_path,'migration','202608220073')
from public.categories c
where c.slug in('tiles-flooring','electrical','plumbing-sanitary','roofing')
and not exists(select 1 from public.audit_logs a where a.entity_type='category' and a.entity_id=c.id::text and a.action='CATEGORY_MEDIA_REPLACED' and a.after_data->>'migration'='202608220073');

commit;
