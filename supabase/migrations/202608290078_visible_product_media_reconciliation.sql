-- Correct presentation-critical master product media without changing supplier
-- offers, prices, stock, catalogue ownership or marketplace eligibility.
begin;

with media(slug,image_path) as(values
 ('cabinet-adhesive','/images/products/cabinet-adhesive-v1.webp'),
 ('louvre-glass','/images/products/louvre-glass-v1.webp')
)
update public.products p
set images=array[m.image_path],updated_at=now()
from media m
where p.slug=m.slug
  and p.images is distinct from array[m.image_path];

insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'product',p.id::text,'PRODUCT_MEDIA_RECONCILED',
 jsonb_build_object('slug',p.slug,'images',p.images,'migration','202608290078','scope','master catalogue fallback')
from public.products p
where p.slug in('cabinet-adhesive','louvre-glass')
and not exists(
 select 1 from public.audit_logs a
 where a.entity_type='product' and a.entity_id=p.id::text
 and a.action='PRODUCT_MEDIA_RECONCILED' and a.after_data->>'migration'='202608290078'
);

commit;
