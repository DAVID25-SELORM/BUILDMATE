-- RBAC Phase 1 (2/3): platform staff memberships, permission overrides,
-- generic membership audit log, has_permission(), and staff management RPCs.

create table public.platform_staff_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  invitation_id uuid,
  platform_role_id uuid not null references public.platform_roles(id),
  department text,
  status text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references public.profiles(id),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  suspended_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_membership_user_required_when_active check (status = 'invited' or user_id is not null)
);
create unique index idx_platform_staff_one_open_per_user on public.platform_staff_memberships(user_id) where status in ('invited','active');
create index idx_platform_staff_status on public.platform_staff_memberships(status,platform_role_id);

create table public.platform_staff_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.platform_staff_memberships(id) on delete cascade,
  permission_id uuid not null references public.platform_permissions(id) on delete cascade,
  granted boolean not null,
  granted_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  unique (membership_id,permission_id)
);

create table public.membership_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  scope text not null check (scope in ('platform','supplier','customer')),
  target_membership_id uuid,
  target_user_id uuid references public.profiles(id),
  organisation_id uuid references public.organisations(id),
  action text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_membership_audit_target on public.membership_audit_log(target_membership_id,created_at desc);
create index idx_membership_audit_org on public.membership_audit_log(organisation_id,created_at desc);

alter table public.platform_staff_memberships enable row level security;
alter table public.platform_staff_permission_overrides enable row level security;
alter table public.membership_audit_log enable row level security;

create or replace function public.has_permission(target_permission text, target_organisation uuid default null)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare uid uuid := auth.uid(); membership_id uuid; role_grant boolean; override_grant boolean;
begin
  if uid is null then return false; end if;
  if target_organisation is not null then return false; end if;
  select m.id into membership_id from public.platform_staff_memberships m where m.user_id=uid and m.status='active' limit 1;
  if membership_id is null then return false; end if;
  select exists(
    select 1 from public.platform_role_permissions rp
    join public.platform_staff_memberships m on m.platform_role_id=rp.role_id
    join public.platform_permissions p on p.id=rp.permission_id
    where m.id=membership_id and p.key=target_permission
  ) into role_grant;
  select o.granted into override_grant from public.platform_staff_permission_overrides o
    join public.platform_permissions p on p.id=o.permission_id
    where o.membership_id=membership_id and p.key=target_permission;
  return coalesce(override_grant, role_grant, false);
end;$$;
revoke all on function public.has_permission(text,uuid) from public,anon;
grant execute on function public.has_permission(text,uuid) to authenticated;

create or replace function public.has_platform_access()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='super_admin')
    or exists(select 1 from public.platform_staff_memberships m where m.user_id=auth.uid() and m.status='active')
    or exists(
      select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'
      and not exists(select 1 from public.platform_staff_memberships m where m.user_id=auth.uid())
    );
$$;
revoke all on function public.has_platform_access() from public,anon;
grant execute on function public.has_platform_access() to authenticated;

create policy "platform staff self or permitted read" on public.platform_staff_memberships
  for select using (user_id = auth.uid() or public.has_permission('platform.users.view'));
create policy "platform staff overrides self or permitted read" on public.platform_staff_permission_overrides
  for select using (exists(select 1 from public.platform_staff_memberships m where m.id=membership_id and m.user_id=auth.uid()) or public.has_permission('platform.users.view'));
create policy "membership audit log permitted read" on public.membership_audit_log
  for select using (actor_id = auth.uid() or public.has_permission('audit_logs.view'));

revoke insert,update,delete on public.platform_staff_memberships,public.platform_staff_permission_overrides,public.membership_audit_log from anon,authenticated;

-- Backfill: give every existing super_admin an active new-model membership.
-- Plain 'admin' profiles are NOT auto-migrated — they keep using the existing
-- admin_permissions/admin_has_permission() system until explicitly invited
-- into the new model.
insert into public.platform_staff_memberships (user_id,platform_role_id,status,joined_at)
select p.id, r.id, 'active', now()
from public.profiles p cross join public.platform_roles r
where p.role = 'super_admin' and r.key = 'super_admin'
on conflict do nothing;

create or replace function public.set_platform_staff_role(target_membership uuid, target_role_key text, target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare old_row public.platform_staff_memberships; new_role_id uuid;
begin
  if not public.has_permission('platform.users.manage_roles') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;
  select id into new_role_id from public.platform_roles where key = target_role_key;
  if new_role_id is null then raise exception 'Unknown platform role'; end if;
  select * into old_row from public.platform_staff_memberships where id = target_membership for update;
  if old_row.id is null then raise exception 'Membership not found'; end if;
  update public.platform_staff_memberships set platform_role_id = new_role_id, updated_at = now() where id = target_membership;
  insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,action,reason,before_data,after_data)
    values(auth.uid(),'platform',target_membership,old_row.user_id,'role_changed',trim(target_reason),jsonb_build_object('platform_role_id',old_row.platform_role_id),jsonb_build_object('platform_role_id',new_role_id));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data)
    values(auth.uid(),'platform_staff_membership',target_membership::text,'role_changed',jsonb_build_object('platform_role_id',old_row.platform_role_id),jsonb_build_object('platform_role_id',new_role_id));
end;$$;

create or replace function public.set_platform_staff_permission_override(target_membership uuid, target_permission_key text, should_grant boolean, target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare target_permission_id uuid;
begin
  if not public.has_permission('platform.users.manage_roles') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;
  if should_grant and not public.has_permission(target_permission_key) then
    raise exception 'You cannot grant a permission you do not hold yourself';
  end if;
  select id into target_permission_id from public.platform_permissions where key = target_permission_key;
  if target_permission_id is null then raise exception 'Unknown permission'; end if;
  if not exists(select 1 from public.platform_staff_memberships where id = target_membership) then raise exception 'Membership not found'; end if;
  insert into public.platform_staff_permission_overrides(membership_id,permission_id,granted,granted_by,reason)
    values(target_membership,target_permission_id,should_grant,auth.uid(),trim(target_reason))
    on conflict (membership_id,permission_id) do update set granted = excluded.granted, granted_by = excluded.granted_by, reason = excluded.reason, created_at = now();
  insert into public.membership_audit_log(actor_id,scope,target_membership_id,action,reason,after_data)
    values(auth.uid(),'platform',target_membership,'permission_override_set',trim(target_reason),jsonb_build_object('permission',target_permission_key,'granted',should_grant));
end;$$;

create or replace function public.suspend_platform_staff(target_membership uuid, target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare old_row public.platform_staff_memberships;
begin
  if not public.has_permission('platform.users.manage_roles') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;
  select * into old_row from public.platform_staff_memberships where id = target_membership and status = 'active' for update;
  if old_row.id is null then raise exception 'Active membership not found'; end if;
  update public.platform_staff_memberships set status = 'suspended', suspended_at = now(), updated_at = now() where id = target_membership;
  insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,action,reason,before_data,after_data)
    values(auth.uid(),'platform',target_membership,old_row.user_id,'suspended',trim(target_reason),jsonb_build_object('status',old_row.status),jsonb_build_object('status','suspended'));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),'platform_staff_membership',target_membership::text,'suspended',jsonb_build_object('reason',trim(target_reason)));
end;$$;

create or replace function public.reactivate_platform_staff(target_membership uuid, target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare old_row public.platform_staff_memberships;
begin
  if not public.has_permission('platform.users.manage_roles') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;
  select * into old_row from public.platform_staff_memberships where id = target_membership and status = 'suspended' for update;
  if old_row.id is null then raise exception 'Suspended membership not found'; end if;
  update public.platform_staff_memberships set status = 'active', suspended_at = null, updated_at = now() where id = target_membership;
  insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,action,reason,before_data,after_data)
    values(auth.uid(),'platform',target_membership,old_row.user_id,'reactivated',trim(target_reason),jsonb_build_object('status',old_row.status),jsonb_build_object('status','active'));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),'platform_staff_membership',target_membership::text,'reactivated',jsonb_build_object('reason',trim(target_reason)));
end;$$;

create or replace function public.remove_platform_staff(target_membership uuid, target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare old_row public.platform_staff_memberships;
begin
  if not public.has_permission('platform.users.manage_roles') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;
  select * into old_row from public.platform_staff_memberships where id = target_membership and status in ('invited','active','suspended') for update;
  if old_row.id is null then raise exception 'Membership not found'; end if;
  update public.platform_staff_memberships set status = 'removed', removed_at = now(), updated_at = now() where id = target_membership;
  insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,action,reason,before_data,after_data)
    values(auth.uid(),'platform',target_membership,old_row.user_id,'removed',trim(target_reason),jsonb_build_object('status',old_row.status),jsonb_build_object('status','removed'));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),'platform_staff_membership',target_membership::text,'removed',jsonb_build_object('reason',trim(target_reason)));
end;$$;

revoke all on function public.set_platform_staff_role(uuid,text,text),public.set_platform_staff_permission_override(uuid,text,boolean,text),public.suspend_platform_staff(uuid,text),public.reactivate_platform_staff(uuid,text),public.remove_platform_staff(uuid,text) from public,anon;
grant execute on function public.set_platform_staff_role(uuid,text,text),public.set_platform_staff_permission_override(uuid,text,boolean,text),public.suspend_platform_staff(uuid,text),public.reactivate_platform_staff(uuid,text),public.remove_platform_staff(uuid,text) to authenticated;
