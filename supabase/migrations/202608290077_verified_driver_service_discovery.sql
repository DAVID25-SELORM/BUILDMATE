-- Make verified operational drivers discoverable through the public transport
-- service directory without exposing unverified or suspended driver accounts.
begin;

alter table public.service_provider_profiles
  add column if not exists profile_source text not null default 'self_registered'
  check (profile_source in ('self_registered','operational_driver'));

create or replace function public.sync_verified_driver_service_profile(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  driver_record public.profiles;
  transport_category uuid;
  provider_record public.service_provider_profiles;
  default_address public.addresses;
begin
  select * into driver_record from public.profiles where id=target_user;
  if driver_record.id is null then return null; end if;

  select id into transport_category
  from public.service_categories
  where slug='transport-delivery' and is_active;

  select * into provider_record
  from public.service_provider_profiles
  where user_id=target_user;

  if driver_record.role='driver'
     and driver_record.verification_status='verified'
     and driver_record.account_status='active' then
    if transport_category is null then
      raise exception 'Active Transport & Delivery service category is required';
    end if;

    select * into default_address
    from public.addresses
    where user_id=target_user
    order by is_default desc,created_at asc
    limit 1;

    if provider_record.id is null then
      insert into public.service_provider_profiles(
        user_id,display_name,bio,phone,region,city,verification_status,
        account_status,availability_status,profile_source
      ) values (
        driver_record.id,driver_record.full_name,
        'Verified BuildMate transport and delivery driver.',driver_record.phone,
        default_address.region,default_address.city,'approved','active','offline',
        'operational_driver'
      ) returning * into provider_record;

      insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
      values(null,'service_provider',provider_record.id::text,'VERIFIED_DRIVER_PUBLISHED',
        jsonb_build_object('user_id',target_user,'category','transport-delivery','source','verified driver account'));
    elsif provider_record.profile_source='operational_driver' then
      update public.service_provider_profiles
      set display_name=driver_record.full_name,
          phone=coalesce(driver_record.phone,phone),
          region=coalesce(default_address.region,region),
          city=coalesce(default_address.city,city),
          verification_status='approved',account_status='active',updated_at=now()
      where id=provider_record.id
      returning * into provider_record;
    else
      -- A self-registered professional keeps the independent admin-review
      -- lifecycle. Driver verification must not silently approve other trades,
      -- but an already-approved profile may safely advertise transport.
      if provider_record.verification_status='approved' and provider_record.account_status='active' then
        insert into public.service_provider_categories(provider_id,category_id)
        values(provider_record.id,transport_category)
        on conflict(provider_id,category_id) do nothing;
      end if;
      return provider_record.id;
    end if;

    insert into public.service_provider_categories(provider_id,category_id)
    values(provider_record.id,transport_category)
    on conflict(provider_id,category_id) do nothing;
    return provider_record.id;
  end if;

  if provider_record.id is not null and provider_record.profile_source='operational_driver' then
    update public.service_provider_profiles
    set verification_status='suspended',account_status='suspended',
        availability_status='offline',updated_at=now()
    where id=provider_record.id
      and (verification_status<>'suspended' or account_status<>'suspended' or availability_status<>'offline');
  end if;
  return provider_record.id;
end;
$$;

revoke all on function public.sync_verified_driver_service_profile(uuid) from public,anon,authenticated;

create or replace function public.sync_verified_driver_service_profile_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.sync_verified_driver_service_profile(new.id);
  return new;
end;
$$;

drop trigger if exists sync_verified_driver_service_profile on public.profiles;
create trigger sync_verified_driver_service_profile
after insert or update of role,verification_status,account_status,full_name,phone
on public.profiles
for each row execute function public.sync_verified_driver_service_profile_trigger();

do $$ declare driver_id uuid;
begin
  for driver_id in
    select id from public.profiles
    where role='driver' and verification_status='verified' and account_status='active'
  loop
    perform public.sync_verified_driver_service_profile(driver_id);
  end loop;
end $$;

commit;
