-- Make category imagery database-driven and unique across the public catalogue.
begin;

alter table public.categories
 add column if not exists image_path text,
 add column if not exists image_alt text,
 add column if not exists description text;

do $$ begin
 if not exists(select 1 from pg_constraint where conname='categories_image_path_safe') then
  alter table public.categories add constraint categories_image_path_safe
   check(image_path is null or image_path ~ '^/images/categories/[a-z0-9][a-z0-9._-]*\.(webp|png|jpg|jpeg|avif)$');
 end if;
 if not exists(select 1 from pg_constraint where conname='categories_image_alt_length') then
  alter table public.categories add constraint categories_image_alt_length check(image_alt is null or char_length(image_alt)<=240);
 end if;
 if not exists(select 1 from pg_constraint where conname='categories_description_length') then
  alter table public.categories add constraint categories_description_length check(description is null or char_length(description)<=1000);
 end if;
end $$;

create unique index if not exists categories_top_level_image_path_unique
 on public.categories(image_path) where parent_id is null and image_path is not null;

with media(slug,image_path,image_alt,description) as(values
 ('cement-concrete','/images/categories/cement-and-concrete.webp','Cement bags, sand and concrete aggregates','Cement, concrete, sand, stone chippings and related materials.'),
 ('blocks-masonry','/images/categories/blocks-and-bricks.webp','Concrete blocks and masonry construction','Blocks, bricks, masonry and foundation materials.'),
 ('steel-reinforcement','/images/categories/steel-reinforcement.webp','Steel reinforcement bars arranged on a construction site','Rebar, reinforcement steel, mesh and tying accessories.'),
 ('timber-wood','/images/categories/timber-and-boards-v2.webp','Stacks of timber, plywood and construction boards','Structural timber, plywood and sheet-board materials.'),
 ('roofing','/images/categories/roofing-installation.webp','Roofing sheets being installed on a building','Roofing sheets, ridge caps, gutters and roof accessories.'),
 ('doors-windows','/images/categories/doors-and-windows-v2.webp','Security door, aluminium windows and louvre glass','Doors, frames, aluminium windows, louvres and glass.'),
 ('plumbing-sanitary','/images/categories/plumbing-materials.webp','Plumbing pipes, fittings and sanitary materials','Pipes, fittings, taps, sanitary ware and water storage.'),
 ('electrical','/images/categories/electrical-materials.webp','Electrical wiring, sockets and distribution equipment','Wires, cables, breakers, sockets, conduits and lighting.'),
 ('tiles-flooring','/images/categories/tiles-flooring.webp','Ceramic and porcelain floor tile display','Floor and wall tiles, adhesives, grout and flooring accessories.'),
 ('ceilings-drywall','/images/categories/ceilings-and-drywall-v2.webp','Gypsum boards, ceiling panels and metal framing sections','Gypsum boards, ceiling panels, POP and drywall framing.'),
 ('paint-finishes','/images/categories/paint-finishes.webp','Paint buckets, rollers and decorating materials','Paints, primers, putty, brushes, rollers and finishing materials.'),
 ('kitchen-joinery','/images/categories/kitchen-and-joinery-v2.webp','Cabinet boards, worktops, hinges and handles','Cabinet materials, worktops, joinery boards and fittings.'),
 ('external-works','/images/categories/external-works-v2.webp','Paving blocks, kerbs, drainage channels and fencing','Paving, kerbs, drainage, fencing, gates and external works.'),
 ('tools-equipment','/images/categories/tools-and-equipment-v2.webp','Wheelbarrow, hand tools, power tools and protective equipment','Site tools, measuring equipment, power tools and PPE.'),
 ('hardware-fittings','/images/categories/hardware-and-fittings-v2.webp','Screws, bolts, hinges, locks and metal brackets','Nails, screws, bolts, hinges, locks, handles and brackets.')
)
update public.categories c set image_path=m.image_path,image_alt=m.image_alt,description=m.description
from media m where c.slug=m.slug and c.parent_id is null;

do $$ declare top_level_count integer; image_count integer; unique_image_count integer;
begin
 select count(*),count(image_path),count(distinct image_path)
 into top_level_count,image_count,unique_image_count
 from public.categories where parent_id is null and is_active;
 if top_level_count<>15 then raise exception 'Expected 15 active top-level categories, found %',top_level_count;end if;
 if image_count<>15 then raise exception 'Every active top-level category requires image metadata';end if;
 if unique_image_count<>15 then raise exception 'Top-level category image paths must be unique';end if;
end $$;

insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'category',c.id::text,'CATEGORY_MEDIA_ASSIGNED',jsonb_build_object('slug',c.slug,'image_path',c.image_path,'migration','202608220072')
from public.categories c where c.parent_id is null and c.is_active
and not exists(select 1 from public.audit_logs a where a.entity_type='category' and a.entity_id=c.id::text and a.action='CATEGORY_MEDIA_ASSIGNED' and a.after_data->>'migration'='202608220072');

commit;
