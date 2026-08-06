-- Fix runtime issues found by linked-database lint after Phase 1 deployment.
create or replace function public.has_permission(target_permission text, target_organisation uuid default null)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare uid uuid := auth.uid(); selected_membership_id uuid; role_grant boolean; override_grant boolean;
begin
  if uid is null then return false; end if;
  if target_organisation is not null then return false; end if;
  select m.id into selected_membership_id from public.platform_staff_memberships m where m.user_id=uid and m.status='active' limit 1;
  if selected_membership_id is null then return false; end if;
  select exists(
    select 1 from public.platform_role_permissions rp
    join public.platform_staff_memberships m on m.platform_role_id=rp.role_id
    join public.platform_permissions p on p.id=rp.permission_id
    where m.id=selected_membership_id and p.key=target_permission
  ) into role_grant;
  select o.granted into override_grant from public.platform_staff_permission_overrides o
    join public.platform_permissions p on p.id=o.permission_id
    where o.membership_id=selected_membership_id and p.key=target_permission;
  return coalesce(override_grant, role_grant, false);
end;$$;

create or replace function public.admin_list_platform_staff()
returns table (
  membership_id uuid, user_id uuid, full_name text, email text, phone text,
  role_key text, role_label text, department text, status text,
  invited_at timestamptz, joined_at timestamptz, suspended_at timestamptz, removed_at timestamptz,
  invitation_id uuid, invitation_status text, invitation_expires_at timestamptz
) language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.has_permission('platform.users.view') then raise exception 'Not authorised'; end if;
  return query
  select m.id, m.user_id,
    coalesce(p.full_name, i.full_name)::text,
    coalesce(u.email::text, i.email)::text,
    coalesce(p.phone, i.phone)::text,
    r.key::text, r.label::text, m.department::text, m.status::text,
    m.invited_at, m.joined_at, m.suspended_at, m.removed_at,
    i.id, i.status::text, i.expires_at
  from public.platform_staff_memberships m
  join public.platform_roles r on r.id = m.platform_role_id
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  left join public.invitations i on i.id = m.invitation_id
  order by m.created_at desc;
end;$$;
