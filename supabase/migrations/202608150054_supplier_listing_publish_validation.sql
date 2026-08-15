-- Enforce publish readiness at the database boundary. Drafts remain editable
-- for onboarding suppliers; only customer-visible listings require approval.

create or replace function public.validate_supplier_listing_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listing_status = 'published' or new.is_active then
    if new.listing_status <> 'published' or not new.is_active then
      raise exception 'Published status and active visibility must be enabled together';
    end if;
    if new.price is null or new.price < 0 then
      raise exception 'A valid retail price is required before publishing';
    end if;
    if new.stock_status = 'out_of_stock' then
      raise exception 'An out-of-stock listing cannot be published';
    end if;
    if not (new.delivery_available or new.pickup_available) then
      raise exception 'Delivery or pickup is required before publishing';
    end if;
    if new.branch_id is null or not exists (
      select 1 from public.supplier_branches b
      where b.id = new.branch_id and b.organisation_id = new.supplier_id
    ) then
      raise exception 'A supplier branch is required before publishing';
    end if;
    if not exists (
      select 1 from public.organisations o
      where o.id = new.supplier_id
        and o.organisation_type = 'supplier'
        and o.account_status = 'active'
        and o.verification_status = 'approved'
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
before insert or update of listing_status,is_active,price,stock_status,delivery_available,pickup_available,supplier_id,branch_id
on public.supplier_listings
for each row execute function public.validate_supplier_listing_publish();

revoke all on function public.validate_supplier_listing_publish() from public,anon,authenticated;
