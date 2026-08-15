-- Production acceptance repair: keep authenticated tenant policies away from
-- anon marketplace reads, while exposing only approved supplier locations.
begin;

drop policy if exists "supplier listing assignment read" on public.supplier_listings;
create policy "supplier listing assignment read" on public.supplier_listings
  for select to authenticated
  using(
    (public.has_permission('products.view',supplier_id)
      and public.member_has_branch_access(supplier_id,branch_id)
      and public.member_has_warehouse_access(supplier_id,warehouse_id))
    or public.is_platform_admin()
  );

drop policy if exists "org creator read" on public.organisations;
create policy "org creator read" on public.organisations for select to authenticated
  using(auth.uid()=created_by);
drop policy if exists "org member read" on public.organisations;
create policy "org member read" on public.organisations for select to authenticated
  using(public.is_org_member(id));
drop policy if exists "org admin read" on public.organisations;
create policy "org admin read" on public.organisations for select to authenticated
  using(public.is_platform_admin());
drop policy if exists "public approved suppliers" on public.organisations;
create policy "public approved suppliers" on public.organisations for select to anon,authenticated
  using(organisation_type='supplier' and verification_status='approved');

drop policy if exists "branch read" on public.supplier_branches;
create policy "branch read" on public.supplier_branches for select to authenticated
  using(public.is_org_member(organisation_id) or public.is_platform_admin());
drop policy if exists "public approved supplier branches" on public.supplier_branches;
create policy "public approved supplier branches" on public.supplier_branches for select to anon,authenticated
  using(exists(
    select 1 from public.organisations o
    where o.id=organisation_id and o.organisation_type='supplier'
      and o.verification_status='approved' and coalesce(o.account_status,'active')='active'
  ));

drop policy if exists "delivery coverage read" on public.supplier_delivery_coverage;
create policy "delivery coverage read" on public.supplier_delivery_coverage for select to authenticated
  using(public.is_org_member(organisation_id) or public.is_platform_admin());
drop policy if exists "public approved supplier coverage" on public.supplier_delivery_coverage;
create policy "public approved supplier coverage" on public.supplier_delivery_coverage for select to anon,authenticated
  using(exists(
    select 1 from public.organisations o
    where o.id=organisation_id and o.organisation_type='supplier'
      and o.verification_status='approved' and coalesce(o.account_status,'active')='active'
  ));

commit;
