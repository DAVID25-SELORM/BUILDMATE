-- Phase 3: catalogue and supplier listing management.

create unique index if not exists supplier_listings_unique_product_default_sku
  on public.supplier_listings (supplier_id, product_id)
  where sku is null;

drop policy if exists "public approved suppliers" on public.organisations;
create policy "public approved suppliers" on public.organisations for select
  using (organisation_type = 'supplier' and verification_status = 'approved');

drop policy if exists "catalogue admin categories" on public.categories;
create policy "catalogue admin categories" on public.categories for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "catalogue admin brands" on public.brands;
create policy "catalogue admin brands" on public.brands for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "catalogue admin products" on public.products;
create policy "catalogue admin products" on public.products for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "supplier listing member read" on public.supplier_listings;
create policy "supplier listing member read" on public.supplier_listings for select
  using (public.is_org_member(supplier_id) or public.is_platform_admin());

drop policy if exists "supplier listing member insert" on public.supplier_listings;
create policy "supplier listing member insert" on public.supplier_listings for insert
  with check (
    public.is_org_member(supplier_id)
    and exists (
      select 1 from public.organisations o
      where o.id = supplier_id and o.verification_status = 'approved'
    )
  );

drop policy if exists "supplier listing member update" on public.supplier_listings;
create policy "supplier listing member update" on public.supplier_listings for update
  using (public.is_org_member(supplier_id) or public.is_platform_admin())
  with check (public.is_org_member(supplier_id) or public.is_platform_admin());

drop policy if exists "supplier listing member delete" on public.supplier_listings;
create policy "supplier listing member delete" on public.supplier_listings for delete
  using (public.is_org_member(supplier_id) or public.is_platform_admin());

create or replace function public.audit_catalogue_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    auth.uid(), tg_table_name, coalesce(new.id, old.id)::text, lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products
for each row execute function public.audit_catalogue_change();

drop trigger if exists supplier_listings_audit on public.supplier_listings;
create trigger supplier_listings_audit after insert or update or delete on public.supplier_listings
for each row execute function public.audit_catalogue_change();
