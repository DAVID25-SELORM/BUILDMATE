-- Replace Cement & Concrete with its approved, category-specific image.
begin;

update public.categories
set image_path='/images/categories/cement-and-concrete-v3.webp',
    image_alt='Cement bags, sand, stone chippings, concrete blocks and concrete materials'
where slug='cement-concrete' and parent_id is null;

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
select null,'category',c.id::text,'CATEGORY_MEDIA_REPLACED',jsonb_build_object('slug',c.slug,'image_path',c.image_path,'migration','202608220074')
from public.categories c
where c.slug='cement-concrete'
and not exists(select 1 from public.audit_logs a where a.entity_type='category' and a.entity_id=c.id::text and a.action='CATEGORY_MEDIA_REPLACED' and a.after_data->>'migration'='202608220074');

commit;
