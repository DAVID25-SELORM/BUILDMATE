-- Align supplier publishing validation with the exact customer marketplace
-- eligibility rule. A listing cannot claim to be published while remaining
-- hidden because price, inventory, fulfilment, branch or supplier approval is
-- incomplete.
begin;

create or replace function public.validate_supplier_listing_publish()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.listing_status='published' or new.is_active then
    if new.listing_status<>'published' or not new.is_active then
      raise exception 'Published status and active visibility must be enabled together';
    end if;
    if new.price is null or new.price<=0 then
      raise exception 'A retail price greater than zero is required before publishing';
    end if;
    if not (new.delivery_available or new.pickup_available) then
      raise exception 'Delivery or pickup is required before publishing';
    end if;
    if new.branch_id is null or not exists(
      select 1 from public.supplier_branches b
      where b.id=new.branch_id and b.organisation_id=new.supplier_id and b.is_active
    ) then
      raise exception 'An active supplier branch is required before publishing';
    end if;
    if not (
      (new.inventory_mode='exact_quantity' and new.stock_quantity is not null and new.stock_quantity>0)
      or (new.inventory_mode='status_only' and new.stock_status='in_stock')
    ) then
      raise exception 'Available stock must be configured before publishing';
    end if;
    if not exists(
      select 1 from public.organisations o
      where o.id=new.supplier_id and o.organisation_type='supplier'
        and o.account_status='active' and o.verification_status='approved'
        and o.product_publishing_enabled
    ) then
      raise exception 'Supplier publishing is not enabled';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_listing_publish_readiness_guard on public.supplier_listings;
create trigger supplier_listing_publish_readiness_guard
before insert or update of listing_status,is_active,price,stock_status,stock_quantity,
  inventory_mode,delivery_available,pickup_available,supplier_id,branch_id
on public.supplier_listings
for each row execute function public.validate_supplier_listing_publish();

create or replace function public.marketplace_listing_is_eligible(l public.supplier_listings)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select l.listing_status='published' and l.is_active
    and l.price is not null and l.price>0
    and l.branch_id is not null
    and (l.delivery_available or l.pickup_available)
    and ((l.inventory_mode='exact_quantity' and l.stock_quantity is not null and l.stock_quantity>0)
      or (l.inventory_mode='status_only' and l.stock_status='in_stock'))
    and exists(
      select 1 from public.organisations o
      where o.id=l.supplier_id and o.organisation_type='supplier'
        and o.verification_status='approved'
        and coalesce(o.account_status,'active')='active'
        and o.product_publishing_enabled
    )
    and exists(
      select 1 from public.supplier_branches b
      where b.id=l.branch_id and b.organisation_id=l.supplier_id and b.is_active
    )
$$;

revoke all on function public.validate_supplier_listing_publish() from public,anon,authenticated;
revoke all on function public.marketplace_listing_is_eligible(public.supplier_listings) from public;
grant execute on function public.marketplace_listing_is_eligible(public.supplier_listings) to anon,authenticated;

commit;
