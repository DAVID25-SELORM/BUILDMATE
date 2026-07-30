-- Hardens the signup trigger so clients cannot self-assign admin/super_admin
-- roles, blocks non-service-role updates to profiles.role, and auto-creates
-- a pending supplier organisation on supplier signup.
-- This is a NEW migration; it does not edit 202607280001_initial_schema.sql.

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
  business_name text := nullif(trim(new.raw_user_meta_data->>'business_name'), '');
  new_org_id uuid;
begin
  if requested_role in ('customer','contractor','supplier','driver','professional') then
    safe_role := requested_role::public.user_role;
  else
    safe_role := 'customer';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New user'),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    safe_role
  );

  if safe_role = 'supplier' and business_name is not null then
    insert into public.organisations (name, organisation_type, verification_status, created_by)
    values (business_name, 'supplier', 'pending', new.id)
    returning id into new_org_id;

    insert into public.organisation_members (organisation_id, user_id, member_role, is_active)
    values (new_org_id, new.id, 'owner', true);
  end if;

  return new;
end;
$$;

-- Defense in depth: even if a request reaches profiles.update with a
-- different role, strip that change unless it comes from the service role
-- (server-side admin operations). Self-service role escalation is blocked.
create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.protect_profile_role();

-- Let a user read the organisation(s) they created and their own membership
-- rows, needed for the supplier onboarding flow.
drop policy if exists "org creator read" on public.organisations;
create policy "org creator read" on public.organisations for select using (auth.uid() = created_by);

drop policy if exists "member self read" on public.organisation_members;
create policy "member self read" on public.organisation_members for select using (auth.uid() = user_id);
