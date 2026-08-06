-- RBAC Phase 1 (3/3): scope-generic invitations table (platform now, supplier
-- and customer scopes reuse this same table in later phases) plus the
-- invite/accept/revoke/resend RPCs for the platform scope.
--
-- Security note: raw invitation tokens are generated and hashed in
-- application code (lib/invitations/token.ts) and NEVER sent to Postgres —
-- only token_hash is stored/compared here. The invite/resend emails are sent
-- directly from the server action using the raw token still held in memory,
-- not via the notification_outbox queue, precisely so the raw token never
-- touches the database.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform','supplier','customer')),
  organisation_id uuid references public.organisations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role_key text not null,
  department text,
  extra_permissions text[] not null default '{}',
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  invited_by uuid not null references public.profiles(id),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitation_scope_matches_org check ((scope = 'platform' and organisation_id is null) or (scope in ('supplier','customer') and organisation_id is not null))
);
create unique index idx_invitations_pending_unique on public.invitations(scope, coalesce(organisation_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(email)) where status = 'pending';
create index idx_invitations_email on public.invitations(lower(email));

alter table public.platform_staff_memberships add constraint platform_staff_invitation_fk foreign key (invitation_id) references public.invitations(id) on delete set null;

alter table public.invitations enable row level security;
create policy "invitations visible to inviter or permitted admin" on public.invitations
  for select using (invited_by = auth.uid() or (scope = 'platform' and public.has_permission('platform.users.view')));
revoke insert,update,delete on public.invitations from anon,authenticated;

-- Only callable from other security definer functions (auth.users is never
-- reachable through the RLS-scoped client).
create or replace function public.find_user_id_by_email(target_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(target_email)) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public,anon,authenticated;

create or replace function public.invite_platform_staff(
  target_email text, target_full_name text, target_phone text, target_role_key text,
  target_department text, target_extra_permissions text[], target_token_hash text, target_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare normalised_email text := lower(trim(target_email)); existing_user uuid; new_invitation uuid; new_membership uuid; perm text;
begin
  if not public.has_permission('platform.users.invite') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;
  if normalised_email = '' or target_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'A valid email address is required'; end if;
  if not exists(select 1 from public.platform_roles where key = target_role_key) then raise exception 'Unknown platform role'; end if;
  if exists(select 1 from public.invitations where scope = 'platform' and lower(email) = normalised_email and status = 'pending') then
    raise exception 'An invitation is already pending for this email';
  end if;
  foreach perm in array coalesce(target_extra_permissions,'{}') loop
    if not public.has_permission(perm) then raise exception 'You cannot grant a permission you do not hold yourself: %', perm; end if;
  end loop;

  existing_user := public.find_user_id_by_email(normalised_email);

  insert into public.invitations(scope,full_name,email,phone,role_key,department,extra_permissions,token_hash,invited_by)
    values('platform',trim(target_full_name),normalised_email,nullif(trim(coalesce(target_phone,'')),''),target_role_key,nullif(trim(coalesce(target_department,'')),''),coalesce(target_extra_permissions,'{}'),target_token_hash,auth.uid())
    returning id into new_invitation;

  insert into public.platform_staff_memberships(user_id,invitation_id,platform_role_id,department,status,invited_by)
    select existing_user, new_invitation, r.id, nullif(trim(coalesce(target_department,'')),''), 'invited', auth.uid()
    from public.platform_roles r where r.key = target_role_key
    returning id into new_membership;

  foreach perm in array coalesce(target_extra_permissions,'{}') loop
    insert into public.platform_staff_permission_overrides(membership_id,permission_id,granted,granted_by,reason)
      select new_membership, p.id, true, auth.uid(), trim(target_reason) from public.platform_permissions p where p.key = perm;
  end loop;

  insert into public.membership_audit_log(actor_id,scope,target_membership_id,organisation_id,action,reason,after_data)
    values(auth.uid(),'platform',new_membership,null,'invitation_created',trim(target_reason),jsonb_build_object('email',normalised_email,'role',target_role_key,'invitation_id',new_invitation));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),'invitation',new_invitation::text,'invitation_created',jsonb_build_object('scope','platform','email',normalised_email,'role',target_role_key));

  return new_invitation;
end;$$;

create or replace function public.accept_invitation(target_token_hash text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare inv public.invitations; caller_email text; result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into inv from public.invitations where token_hash = target_token_hash for update;
  if inv.id is null then raise exception 'Invitation not found'; end if;
  if inv.status = 'accepted' then raise exception 'This invitation has already been used'; end if;
  if inv.status = 'revoked' then raise exception 'This invitation has been revoked'; end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then
    update public.invitations set status = 'expired' where id = inv.id and status = 'pending';
    raise exception 'This invitation has expired';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if lower(coalesce(caller_email,'')) <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  if inv.scope = 'platform' then
    update public.platform_staff_memberships set user_id = auth.uid(), status = 'active', joined_at = now(), updated_at = now()
      where invitation_id = inv.id;
    if not found then raise exception 'Membership record not found for this invitation'; end if;
  else
    raise exception 'This invitation scope is not yet supported';
  end if;

  update public.invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = inv.id;

  insert into public.membership_audit_log(actor_id,scope,target_user_id,organisation_id,action,after_data)
    values(auth.uid(),inv.scope,auth.uid(),inv.organisation_id,'invitation_accepted',jsonb_build_object('invitation_id',inv.id));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action)
    values(auth.uid(),'invitation',inv.id::text,'invitation_accepted');

  result := jsonb_build_object('scope',inv.scope,'organisation_id',inv.organisation_id);
  return result;
end;$$;

create or replace function public.revoke_invitation(target_invitation uuid, target_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where id = target_invitation and status = 'pending' for update;
  if inv.id is null then raise exception 'Pending invitation not found'; end if;
  if inv.scope = 'platform' and not public.has_permission('platform.users.manage_roles') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;

  update public.invitations set status = 'revoked', revoked_by = auth.uid(), revoked_at = now() where id = inv.id;
  update public.platform_staff_memberships set status = 'removed', removed_at = now(), updated_at = now() where invitation_id = inv.id and status = 'invited';

  insert into public.membership_audit_log(actor_id,scope,organisation_id,action,reason,before_data)
    values(auth.uid(),inv.scope,inv.organisation_id,'invitation_revoked',trim(target_reason),jsonb_build_object('invitation_id',inv.id,'email',inv.email));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action)
    values(auth.uid(),'invitation',inv.id::text,'invitation_revoked');
end;$$;

create or replace function public.resend_invitation(target_invitation uuid, target_token_hash text, target_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where id = target_invitation for update;
  if inv.id is null or inv.status not in ('pending','expired') then raise exception 'Invitation cannot be resent'; end if;
  if inv.scope = 'platform' and not public.has_permission('platform.users.invite') then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,''))) < 5 then raise exception 'A detailed reason is required'; end if;

  update public.invitations set token_hash = target_token_hash, status = 'pending', expires_at = now() + interval '7 days' where id = inv.id;

  insert into public.membership_audit_log(actor_id,scope,organisation_id,action,reason)
    values(auth.uid(),inv.scope,inv.organisation_id,'invitation_resent',trim(target_reason));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action)
    values(auth.uid(),'invitation',inv.id::text,'invitation_resent');
end;$$;

-- Public preview for the accept-invitation page — deliberately minimal fields,
-- callable before sign-in. The token itself is an unguessable 256-bit value,
-- so possession of it is the access control; this still avoids showing more
-- than necessary if a link is glimpsed over someone's shoulder.
create or replace function public.get_invitation_preview(target_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare inv public.invitations; role_label text;
begin
  select * into inv from public.invitations where token_hash = target_token_hash;
  if inv.id is null then return null; end if;
  if inv.scope = 'platform' then select label into role_label from public.platform_roles where key = inv.role_key; end if;
  return jsonb_build_object(
    'scope', inv.scope,
    'email', left(inv.email,2) || '***@' || split_part(inv.email,'@',2),
    'role_label', coalesce(role_label, inv.role_key),
    'status', case when inv.status = 'pending' and inv.expires_at <= now() then 'expired' else inv.status end,
    'expires_at', inv.expires_at
  );
end;$$;

revoke all on function public.invite_platform_staff(text,text,text,text,text,text[],text,text),public.accept_invitation(text),public.revoke_invitation(uuid,text),public.resend_invitation(uuid,text,text) from public,anon;
grant execute on function public.invite_platform_staff(text,text,text,text,text,text[],text,text),public.accept_invitation(text),public.revoke_invitation(uuid,text),public.resend_invitation(uuid,text,text) to authenticated;

-- Shaped listing for the staff management UI, matching the existing
-- admin_list_customers/admin_list_suppliers_v2 reporting-RPC convention
-- (email lives in auth.users, which the RLS-scoped client cannot join directly).
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
    coalesce(p.full_name, i.full_name),
    coalesce(u.email, i.email),
    coalesce(p.phone, i.phone),
    r.key, r.label, m.department, m.status,
    m.invited_at, m.joined_at, m.suspended_at, m.removed_at,
    i.id, i.status, i.expires_at
  from public.platform_staff_memberships m
  join public.platform_roles r on r.id = m.platform_role_id
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  left join public.invitations i on i.id = m.invitation_id
  order by m.created_at desc;
end;$$;
revoke all on function public.admin_list_platform_staff() from public,anon;
grant execute on function public.admin_list_platform_staff() to authenticated;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon,authenticated;
