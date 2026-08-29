-- Read-only audit for Nana Attakorah II Ventures. A row returned by a
-- duplicate query requires investigation; legitimate variants remain separate.

-- Exact supplier listing identities: supplier + product + variant + branch.
select l.supplier_id,l.product_id,l.product_variant_id,l.branch_id,
       count(*) listing_count,array_agg(l.id order by l.created_at) listing_ids
from public.supplier_listings l
where l.supplier_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
group by l.supplier_id,l.product_id,l.product_variant_id,l.branch_id
having count(*)>1;

-- Legitimate variants currently represented by separate supplier listings.
select p.name product,v.name variant,b.name branch,l.id listing_id
from public.supplier_listings l
join public.products p on p.id=l.product_id
join public.product_variants v on v.id=l.product_variant_id
left join public.supplier_branches b on b.id=l.branch_id
where l.supplier_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
order by p.name,v.name,b.name;

-- More than one balance for the exact listing/location identity.
select organisation_id,supplier_listing_id,branch_id,warehouse_id,
       count(*) balance_count,array_agg(id) balance_ids
from public.inventory_balances
where organisation_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
group by organisation_id,supplier_listing_id,branch_id,warehouse_id
having count(*)>1;

-- Opening stock is immutable and must occur at most once per listing.
select supplier_listing_id,count(*) receipt_count,array_agg(id) receipt_ids
from public.inventory_receipts
where organisation_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
  and entry_type='opening_stock'
group by supplier_listing_id
having count(*)>1;

-- Reused media records within a listing (storage paths are globally unique).
select pm.listing_id,pm.storage_path,count(*) media_count,array_agg(pm.id) media_ids
from public.product_media pm
join public.supplier_listings l on l.id=pm.listing_id
where l.supplier_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff'
group by pm.listing_id,pm.storage_path
having count(*)>1;

-- Potential catalogue-name collisions; canonical slugs remain unique.
select lower(trim(name)) normalised_name,count(*) product_count,
       array_agg(id order by created_at) product_ids,array_agg(slug order by slug) slugs
from public.products
group by lower(trim(name))
having count(*)>1;
