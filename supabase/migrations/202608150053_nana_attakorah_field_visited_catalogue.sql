-- Requires 202608120050_master_catalogue_listing_lifecycle.sql.
-- Field-visit catalogue bootstrap for Nana Attakorah II Ventures.
-- These records are deliberately created as supplier drafts: the visit confirms
-- the product ranges, not current price, exact specification, or stock count.

do $$
declare
  target_supplier uuid := '9b232d45-65f6-4f7d-83d5-d0907f98b4ff';
begin
  if to_regtype('public.supplier_listing_status') is null
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'supplier_listings'
         and column_name = 'listing_status'
     ) then
    raise exception 'Apply migration 202608120050_master_catalogue_listing_lifecycle.sql before this catalogue bootstrap';
  end if;

  if not exists (
    select 1
    from public.organisations
    where id = target_supplier
      and name = 'Nana Attakorah II Ventures'
      and organisation_type = 'supplier'
  ) then
    raise exception 'Expected Nana Attakorah II Ventures supplier organisation was not found';
  end if;
end $$;

insert into public.categories(name, slug, sort_order)
values
  ('Timber & Wood', 'timber-wood', 1),
  ('Steel & Reinforcement', 'steel-reinforcement', 2),
  ('Roofing', 'roofing', 3),
  ('Tools & Equipment', 'tools-equipment', 4),
  ('Paint & Finishes', 'paint-finishes', 5),
  ('Hardware & Fittings', 'hardware-fittings', 6)
on conflict (slug) do nothing;

with catalogue(category_slug, name, slug, base_unit, description, image_path) as (
  values
    ('timber-wood', 'Sawn Hardwood Timber', 'sawn-hardwood-timber', 'piece', 'Sawn timber stock photographed during the Nana Attakorah II Ventures field visit. Confirm timber species, dimensions and available lengths before ordering.', '/images/suppliers/nana-attakorah/sawn-timber.jpg'),
    ('timber-wood', 'Bamboo Construction Poles', 'bamboo-construction-poles', 'piece', 'Bamboo poles for formwork and temporary site support. Confirm diameter and length before ordering.', '/images/suppliers/nana-attakorah/wood-poles.jpg'),
    ('steel-reinforcement', 'High-Tensile Reinforcement Bars', 'high-tensile-reinforcement-bars', 'length', 'Reinforcement bars photographed at the supplier yard. Confirm bar diameter, grade and length before ordering.', '/images/suppliers/nana-attakorah/steel-bars.jpg'),
    ('steel-reinforcement', 'Binding Wire', 'binding-wire', 'coil', 'Binding wire for reinforcement work. Confirm gauge and coil weight before ordering.', '/images/suppliers/nana-attakorah/metal-fittings.jpg'),
    ('roofing', 'Corrugated Roofing Sheets', 'corrugated-roofing-sheets', 'sheet', 'Corrugated roofing sheets photographed at the supplier premises. Confirm profile, gauge, colour and sheet length before ordering.', '/images/suppliers/nana-attakorah/hardware-stock.jpg'),
    ('steel-reinforcement', 'Welded Wire Mesh', 'welded-wire-mesh', 'roll', 'Welded wire mesh photographed at the supplier premises. Confirm aperture, wire gauge and roll dimensions before ordering.', '/images/suppliers/nana-attakorah/hardware-stock.jpg'),
    ('tools-equipment', 'Construction Wheelbarrow', 'construction-wheelbarrow', 'unit', 'Construction wheelbarrows photographed at the supplier yard. Confirm tray type, wheel configuration and availability before ordering.', '/images/suppliers/nana-attakorah/wheelbarrows.jpg'),
    ('tools-equipment', 'Shovels, Spades & Metal Pans', 'shovels-spades-metal-pans', 'unit', 'Site hand tools and metal pans photographed at the supplier premises. Confirm the exact tool and size before ordering.', '/images/suppliers/nana-attakorah/metal-fittings.jpg'),
    ('paint-finishes', 'Interior & Exterior Paint', 'interior-exterior-paint', 'bucket', 'Paint stock photographed at the supplier premises. Confirm brand, finish, colour and bucket size before ordering.', '/images/suppliers/nana-attakorah/paint-stock.jpg'),
    ('hardware-fittings', 'PVC & Metal Building Fittings', 'pvc-metal-building-fittings', 'piece', 'PVC and metal building fittings photographed at the supplier premises. Confirm fitting type and size before ordering.', '/images/suppliers/nana-attakorah/shop-front.jpg')
)
insert into public.products(category_id, name, slug, description, base_unit, images, is_active)
select c.id, x.name, x.slug, x.description, x.base_unit, array[x.image_path], true
from catalogue x
join public.categories c on c.slug = x.category_slug
on conflict (slug) do nothing;

with source_products(slug) as (
  values
    ('sawn-hardwood-timber'), ('bamboo-construction-poles'),
    ('high-tensile-reinforcement-bars'), ('binding-wire'),
    ('corrugated-roofing-sheets'), ('welded-wire-mesh'),
    ('construction-wheelbarrow'), ('shovels-spades-metal-pans'),
    ('interior-exterior-paint'), ('pvc-metal-building-fittings')
)
insert into public.supplier_listings(
  supplier_id, product_id, price, stock_status, is_active, listing_status,
  delivery_available, pickup_available, supplier_notes
)
select
  '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'::uuid,
  p.id,
  null,
  'confirmation_required',
  false,
  'draft',
  true,
  true,
  'Added from the 8 August 2026 field visit. Confirm price, stock, exact specification and delivery availability before publishing.'
from source_products s
join public.products p on p.slug = s.slug
where not exists (
  select 1
  from public.supplier_listings l
  where l.supplier_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'::uuid
    and l.product_id = p.id
    and l.sku is null
);

insert into public.audit_logs(actor_id, entity_type, entity_id, action, after_data)
select
  null,
  'supplier_catalogue',
  '9b232d45-65f6-4f7d-83d5-d0907f98b4ff',
  'SUPPLIER_FIELD_VISIT_CATALOGUE_BOOTSTRAP',
  jsonb_build_object(
    'supplier_name', 'Nana Attakorah II Ventures',
    'field_visit_date', '2026-08-08',
    'listing_status', 'draft',
    'product_count', 10,
    'reason', 'Field visit confirms product ranges only; commercial details require supplier confirmation.'
  )
where not exists (
  select 1
  from public.audit_logs
  where entity_type = 'supplier_catalogue'
    and entity_id = '9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
    and action = 'SUPPLIER_FIELD_VISIT_CATALOGUE_BOOTSTRAP'
);
