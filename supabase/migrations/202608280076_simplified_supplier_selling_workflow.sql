-- One transactional supplier workflow: listing, opening stock and publication.
begin;

create table if not exists public.supplier_catalogue_requests(
 id uuid primary key default gen_random_uuid(),
 supplier_id uuid not null references public.organisations(id) on delete cascade,
 requested_by uuid not null references public.profiles(id),
 product_name text not null check(char_length(trim(product_name)) between 2 and 160),
 category text not null check(char_length(trim(category)) between 2 and 120),
 description text not null check(char_length(trim(description)) between 5 and 1000),
 image_path text,
 status text not null default 'pending' check(status in('pending','approved','declined','merged')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.supplier_catalogue_requests enable row level security;
create policy "supplier catalogue request read" on public.supplier_catalogue_requests for select
 using(has_permission('products.view',supplier_id) or is_platform_admin());
create policy "supplier catalogue request create" on public.supplier_catalogue_requests for insert
 with check(requested_by=auth.uid() and has_permission('products.create',supplier_id));
create policy "catalogue admin request manage" on public.supplier_catalogue_requests for all
 using(admin_has_permission('catalogue')) with check(admin_has_permission('catalogue'));

create or replace function public.audit_supplier_catalogue_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data)
 values(new.requested_by,'supplier_catalogue_request',new.id::text,'CATALOGUE_PRODUCT_REQUESTED',
  jsonb_build_object('supplier_id',new.supplier_id,'product_name',new.product_name,'category',new.category,'has_image',new.image_path is not null));
 return new;
end;$$;
create trigger audit_supplier_catalogue_request_created after insert on public.supplier_catalogue_requests
 for each row execute function public.audit_supplier_catalogue_request();
revoke all on function public.audit_supplier_catalogue_request() from public,anon,authenticated;

create or replace function public.supplier_create_product_for_sale(
 target_supplier uuid,target_product uuid,target_variant uuid,target_branch uuid,target_price numeric,
 target_quantity numeric,target_unit_cost numeric,target_delivery boolean,target_pickup boolean,
 target_sku text,target_notes text,target_publish boolean,target_request_key uuid
) returns table(listing_id uuid,stock_reference text,published boolean)
language plpgsql security definer set search_path=public as $$
declare org organisations;p products;v product_variants;b supplier_branches;l supplier_listings;stock record;
begin
 if target_request_key is null then raise exception 'Please try again. A request reference is required';end if;
 select o.* into org from organisations o join organisation_members m on m.organisation_id=o.id
  where o.id=target_supplier and m.user_id=auth.uid() and m.status='active' and m.is_active and o.organisation_type='supplier'
   and has_permission('products.create',o.id) limit 1;
 if org.id is null or not has_permission('products.create',org.id) then raise exception 'You do not have permission to add products';end if;
 if org.verification_status<>'approved' then raise exception 'Your supplier account is awaiting approval';end if;
 select * into p from products where id=target_product and is_active;if p.id is null then raise exception 'Choose a valid catalogue product';end if;
 if target_variant is not null then select * into v from product_variants where id=target_variant and product_id=target_product and is_active;
  if v.id is null then raise exception 'Choose a valid product variant';end if;end if;
 select * into b from supplier_branches where id=target_branch and organisation_id=org.id and is_active;
 if b.id is null or not member_has_branch_access(org.id,b.id) then raise exception 'Choose a valid selling location';end if;
 if target_price is null or target_price<=0 then raise exception 'Add a selling price';end if;
 if target_quantity is null or target_quantity<=0 then raise exception 'Enter available quantity';end if;
 if target_unit_cost is null or target_unit_cost<=0 then raise exception 'Enter what you paid for one unit';end if;
 if not coalesce(target_delivery,false) and not coalesce(target_pickup,false) then raise exception 'Choose delivery, pickup, or both';end if;
 select sl.* into l from supplier_listings sl where sl.supplier_id=org.id and sl.product_id=target_product
  and sl.product_variant_id is not distinct from target_variant and sl.branch_id=target_branch limit 1;
 if l.id is not null then raise exception 'You already sell this product at % [listing:%]',b.name,l.id;end if;
 insert into supplier_listings(supplier_id,product_id,product_variant_id,branch_id,warehouse_id,sku,price,currency,
  price_effective_date,price_source,price_updated_by,stock_quantity,stock_status,inventory_mode,delivery_available,pickup_available,
  supplier_notes,listing_status,is_active,availability_confirmed_at)
 values(org.id,target_product,target_variant,target_branch,null,nullif(trim(coalesce(target_sku,'')),''),target_price,'GHS',current_date,
  'supplier portal',auth.uid(),null,'confirmation_required','confirmation_required',target_delivery,target_pickup,
  nullif(trim(coalesce(target_notes,'')),''),'draft',false,now()) returning * into l;
 select * into stock from inventory_set_opening_stock(l.id,target_quantity,target_unit_cost,current_date,target_notes,target_request_key);
 if target_publish then
  if not has_permission('products.publish',org.id) then raise exception 'You do not have permission to publish products';end if;
  if org.account_status<>'active' or not org.product_publishing_enabled then raise exception 'Product publishing is not enabled for your supplier account';end if;
  update supplier_listings set listing_status='published',is_active=true,updated_at=now() where id=l.id;
 end if;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'supplier_listing',l.id::text,
  case when target_publish then 'SUPPLIER_PRODUCT_CREATED_AND_PUBLISHED' else 'SUPPLIER_PRODUCT_DRAFT_CREATED' end,
  jsonb_build_object('product_id',target_product,'variant_id',target_variant,'branch_id',target_branch,'quantity',target_quantity,'stock_reference',stock.internal_reference));
 return query select l.id,stock.internal_reference,target_publish;
end;$$;
revoke all on function public.supplier_create_product_for_sale(uuid,uuid,uuid,uuid,numeric,numeric,numeric,boolean,boolean,text,text,boolean,uuid) from public,anon;
grant execute on function public.supplier_create_product_for_sale(uuid,uuid,uuid,uuid,numeric,numeric,numeric,boolean,boolean,text,text,boolean,uuid) to authenticated;

commit;
