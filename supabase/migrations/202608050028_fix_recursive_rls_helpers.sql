-- RLS helper functions must bypass the policies on the tables they inspect;
-- otherwise admin-wide profile/member queries recurse while self reads appear to work.
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in('admin','super_admin'));
$$;
create or replace function public.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organisation_members where organisation_id=target_org and user_id=auth.uid() and is_active);
$$;
create or replace function public.is_org_owner_or_finance(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organisation_members where organisation_id=target_org and user_id=auth.uid() and is_active and member_role in('owner','finance'));
$$;
create or replace function public.is_org_editable(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organisations where id=target_org and verification_status in('draft','information_required'));
$$;
