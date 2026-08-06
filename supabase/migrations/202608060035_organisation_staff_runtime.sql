-- Secure organisation invitations, staff lifecycle, assignments and ownership transfer.
alter table public.invitations
  add column branch_ids uuid[] not null default '{}',
  add column warehouse_ids uuid[] not null default '{}',
  add column project_ids uuid[] not null default '{}',
  add column approval_limit numeric(14,2) check (approval_limit is null or approval_limit >= 0);

create or replace function public.organisation_manage_permission(target_scope text) returns text language sql immutable as $$
 select case when target_scope='supplier' then 'supplier.staff.manage' else 'staff.manage' end;
$$;
create or replace function public.organisation_invite_permission(target_scope text) returns text language sql immutable as $$
 select case when target_scope='supplier' then 'supplier.staff.invite' else 'staff.invite' end;
$$;

create or replace function public.invite_organisation_staff(
 target_organisation uuid,target_email text,target_full_name text,target_phone text,target_role_key text,
 target_extra_permissions text[],target_branch_ids uuid[],target_warehouse_ids uuid[],target_project_ids uuid[],
 target_approval_limit numeric,target_token_hash text,target_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare target_scope text; normalised_email text:=lower(trim(target_email)); invitation_id uuid; permission_key text; role_record public.organisation_roles;
begin
 target_scope:=public.organisation_scope(target_organisation);
 if target_scope is null then raise exception 'Organisation not found'; end if;
 if not public.has_permission(public.organisation_invite_permission(target_scope),target_organisation) then raise exception 'Not authorised'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 if normalised_email='' or target_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'A valid email address is required'; end if;
 select * into role_record from public.organisation_roles where scope=target_scope and key=target_role_key;
 if role_record.id is null then raise exception 'Unknown organisation role'; end if;
 if exists(select 1 from public.invitations where scope=target_scope and organisation_id=target_organisation and lower(email)=normalised_email and status='pending') then raise exception 'An invitation is already pending for this email'; end if;
 foreach permission_key in array coalesce(target_extra_permissions,'{}') loop
   if not public.has_permission(permission_key,target_organisation) then raise exception 'You cannot grant a permission you do not hold yourself: %',permission_key; end if;
   if not exists(select 1 from public.organisation_permissions where scope=target_scope and key=permission_key) then raise exception 'Unknown permission: %',permission_key; end if;
 end loop;
 if exists(select 1 from public.supplier_branches where id=any(coalesce(target_branch_ids,'{}')) and organisation_id<>target_organisation) then raise exception 'Branch belongs to another organisation'; end if;
 if exists(select 1 from public.supplier_warehouses where id=any(coalesce(target_warehouse_ids,'{}')) and organisation_id<>target_organisation) then raise exception 'Warehouse belongs to another organisation'; end if;
 if exists(select 1 from public.projects where id=any(coalesce(target_project_ids,'{}')) and organisation_id<>target_organisation) then raise exception 'Project belongs to another organisation'; end if;
 insert into public.invitations(scope,organisation_id,full_name,email,phone,role_key,extra_permissions,token_hash,invited_by,branch_ids,warehouse_ids,project_ids,approval_limit)
 values(target_scope,target_organisation,trim(target_full_name),normalised_email,nullif(trim(coalesce(target_phone,'')),''),target_role_key,coalesce(target_extra_permissions,'{}'),target_token_hash,auth.uid(),coalesce(target_branch_ids,'{}'),coalesce(target_warehouse_ids,'{}'),coalesce(target_project_ids,'{}'),target_approval_limit)
 returning id into invitation_id;
 insert into public.membership_audit_log(actor_id,scope,organisation_id,action,reason,after_data)
 values(auth.uid(),target_scope,target_organisation,'invitation_created',trim(target_reason),jsonb_build_object('invitation_id',invitation_id,'email',normalised_email,'role',target_role_key));
 insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'invitation',invitation_id::text,'invitation_created',jsonb_build_object('scope',target_scope,'organisation_id',target_organisation));
 return invitation_id;
end;$$;

create or replace function public.accept_invitation(target_token_hash text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare inv public.invitations; caller_email text; role_record public.organisation_roles; new_membership_id uuid; permission_key text; assignment uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into inv from public.invitations where token_hash=target_token_hash for update;
 if inv.id is null then raise exception 'Invitation not found'; end if;
 if inv.status='accepted' then raise exception 'This invitation has already been used'; end if;
 if inv.status='revoked' then raise exception 'This invitation has been revoked'; end if;
 if inv.status<>'pending' or inv.expires_at<=now() then update public.invitations set status='expired' where id=inv.id and status='pending'; raise exception 'This invitation has expired'; end if;
 select email into caller_email from auth.users where id=auth.uid();
 if lower(coalesce(caller_email,''))<>lower(inv.email) then raise exception 'This invitation was sent to a different email address'; end if;
 if inv.scope='platform' then
   update public.platform_staff_memberships set user_id=auth.uid(),status='active',joined_at=now(),updated_at=now() where invitation_id=inv.id returning id into new_membership_id;
   if new_membership_id is null then raise exception 'Membership record not found for this invitation'; end if;
 else
   select * into role_record from public.organisation_roles where scope=inv.scope and key=inv.role_key;
   if role_record.id is null then raise exception 'Invitation role no longer exists'; end if;
   insert into public.organisation_members(organisation_id,user_id,member_role,is_active,role_id,status,invited_by,invited_at,joined_at)
   values(inv.organisation_id,auth.uid(),inv.role_key,true,role_record.id,'active',inv.invited_by,inv.invited_at,now())
   on conflict(organisation_id,user_id) do update set member_role=excluded.member_role,role_id=excluded.role_id,status='active',is_active=true,invited_by=excluded.invited_by,invited_at=excluded.invited_at,joined_at=now(),suspended_at=null,removed_at=null,updated_at=now()
   returning id into new_membership_id;
   foreach permission_key in array inv.extra_permissions loop
     insert into public.membership_permission_overrides(membership_id,permission_id,granted,granted_by,reason)
     select new_membership_id,p.id,true,inv.invited_by,'Granted with invitation' from public.organisation_permissions p where p.scope=inv.scope and p.key=permission_key on conflict(membership_id,permission_id) do update set granted=true,granted_by=excluded.granted_by,reason=excluded.reason,created_at=now();
   end loop;
   foreach assignment in array inv.branch_ids loop insert into public.branch_memberships values(new_membership_id,assignment,inv.invited_by,now()) on conflict do nothing; end loop;
   foreach assignment in array inv.warehouse_ids loop insert into public.warehouse_memberships values(new_membership_id,assignment,inv.invited_by,now()) on conflict do nothing; end loop;
   foreach assignment in array inv.project_ids loop insert into public.project_memberships values(new_membership_id,assignment,inv.approval_limit,inv.invited_by,now()) on conflict do nothing; end loop;
 end if;
 update public.invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
 insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,organisation_id,action,after_data) values(auth.uid(),inv.scope,new_membership_id,auth.uid(),inv.organisation_id,'invitation_accepted',jsonb_build_object('invitation_id',inv.id));
 insert into public.audit_logs(actor_id,entity_type,entity_id,action) values(auth.uid(),'invitation',inv.id::text,'invitation_accepted');
 return jsonb_build_object('scope',inv.scope,'organisation_id',inv.organisation_id);
end;$$;

create or replace function public.list_organisation_staff(target_organisation uuid)
returns table(membership_id uuid,user_id uuid,full_name text,email text,phone text,role_key text,role_label text,status text,joined_at timestamptz,branch_names text[],warehouse_names text[],project_names text[],approval_limit numeric)
language plpgsql stable security definer set search_path=public,auth as $$
declare target_scope text:=public.organisation_scope(target_organisation);
begin
 if not public.has_permission(case when target_scope='supplier' then 'supplier.staff.view' else 'organisation.view' end,target_organisation) then raise exception 'Not authorised'; end if;
 return query select m.id,m.user_id,p.full_name,u.email,p.phone,r.key,r.label,m.status,m.joined_at,
   coalesce((select array_agg(b.name order by b.name) from public.branch_memberships bm join public.supplier_branches b on b.id=bm.branch_id where bm.membership_id=m.id),'{}'),
   coalesce((select array_agg(w.name order by w.name) from public.warehouse_memberships wm join public.supplier_warehouses w on w.id=wm.warehouse_id where wm.membership_id=m.id),'{}'),
   coalesce((select array_agg(pr.name order by pr.name) from public.project_memberships pm join public.projects pr on pr.id=pm.project_id where pm.membership_id=m.id),'{}'),
   (select max(pm.approval_limit) from public.project_memberships pm where pm.membership_id=m.id)
 from public.organisation_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id join public.organisation_roles r on r.id=m.role_id
 where m.organisation_id=target_organisation order by m.created_at;
end;$$;

create or replace function public.list_organisation_invitations(target_organisation uuid)
returns table(invitation_id uuid,full_name text,email text,phone text,role_key text,status text,invited_at timestamptz,expires_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare target_scope text:=public.organisation_scope(target_organisation);
begin
 if not public.has_permission(case when target_scope='supplier' then 'supplier.staff.view' else 'organisation.view' end,target_organisation) then raise exception 'Not authorised'; end if;
 return query select i.id,i.full_name,i.email,i.phone,i.role_key,i.status,i.invited_at,i.expires_at from public.invitations i where i.organisation_id=target_organisation order by i.created_at desc;
end;$$;

create or replace function public.set_organisation_member_role(target_membership uuid,target_role_key text,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare m public.organisation_members; old_role uuid; new_role public.organisation_roles; target_scope text;
begin
 select * into m from public.organisation_members where id=target_membership for update; if m.id is null then raise exception 'Membership not found'; end if;
 target_scope:=public.organisation_scope(m.organisation_id);
 if not public.has_permission(public.organisation_manage_permission(target_scope),m.organisation_id) then raise exception 'Not authorised'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 select * into new_role from public.organisation_roles where scope=target_scope and key=target_role_key; if new_role.id is null then raise exception 'Unknown role'; end if;
 old_role:=m.role_id; update public.organisation_members set role_id=new_role.id,member_role=new_role.key,updated_at=now() where id=m.id;
 insert into public.role_change_history(membership_id,organisation_id,actor_id,previous_role_id,new_role_id,reason) values(m.id,m.organisation_id,auth.uid(),old_role,new_role.id,trim(target_reason));
 insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,organisation_id,action,reason,before_data,after_data) values(auth.uid(),target_scope,m.id,m.user_id,m.organisation_id,'role_changed',trim(target_reason),jsonb_build_object('role_id',old_role),jsonb_build_object('role_id',new_role.id));
end;$$;

create or replace function public.set_organisation_member_status(target_membership uuid,target_status text,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare m public.organisation_members; target_scope text;
begin
 if target_status not in('active','suspended','removed') then raise exception 'Invalid status'; end if;
 select * into m from public.organisation_members where id=target_membership for update; if m.id is null then raise exception 'Membership not found'; end if;
 target_scope:=public.organisation_scope(m.organisation_id);
 if not public.has_permission(public.organisation_manage_permission(target_scope),m.organisation_id) then raise exception 'Not authorised'; end if;
 if m.user_id=auth.uid() then raise exception 'You cannot change your own membership status'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 update public.organisation_members set status=target_status,is_active=(target_status='active'),suspended_at=case when target_status='suspended' then now() else null end,removed_at=case when target_status='removed' then now() else null end,updated_at=now() where id=m.id;
 insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,organisation_id,action,reason,before_data,after_data) values(auth.uid(),target_scope,m.id,m.user_id,m.organisation_id,'membership_'||target_status,trim(target_reason),jsonb_build_object('status',m.status),jsonb_build_object('status',target_status));
end;$$;

create or replace function public.set_organisation_permission_override(target_membership uuid,target_permission_key text,should_grant boolean,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare m public.organisation_members; p public.organisation_permissions; target_scope text;
begin
 select * into m from public.organisation_members where id=target_membership; if m.id is null then raise exception 'Membership not found'; end if;
 target_scope:=public.organisation_scope(m.organisation_id);
 if not public.has_permission(public.organisation_manage_permission(target_scope),m.organisation_id) then raise exception 'Not authorised'; end if;
 if should_grant and not public.has_permission(target_permission_key,m.organisation_id) then raise exception 'You cannot grant a permission you do not hold yourself'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 select * into p from public.organisation_permissions where scope=target_scope and key=target_permission_key; if p.id is null then raise exception 'Unknown permission'; end if;
 insert into public.membership_permission_overrides(membership_id,permission_id,granted,granted_by,reason) values(m.id,p.id,should_grant,auth.uid(),trim(target_reason)) on conflict(membership_id,permission_id) do update set granted=excluded.granted,granted_by=excluded.granted_by,reason=excluded.reason,created_at=now();
 insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,organisation_id,action,reason,after_data) values(auth.uid(),target_scope,m.id,m.user_id,m.organisation_id,'permission_override_changed',trim(target_reason),jsonb_build_object('permission',target_permission_key,'granted',should_grant));
end;$$;

create or replace function public.transfer_organisation_ownership(from_membership uuid,to_membership uuid,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare source public.organisation_members; destination public.organisation_members; owner_role public.organisation_roles; replacement_role public.organisation_roles; target_scope text;
begin
 select * into source from public.organisation_members where id=from_membership for update; select * into destination from public.organisation_members where id=to_membership for update;
 if source.id is null or destination.id is null or source.organisation_id<>destination.organisation_id then raise exception 'Both memberships must belong to the same organisation'; end if;
 target_scope:=public.organisation_scope(source.organisation_id);
 if source.user_id<>auth.uid() and not public.has_permission(public.organisation_manage_permission(target_scope),source.organisation_id) then raise exception 'Not authorised'; end if;
 if destination.status<>'active' or not destination.is_active then raise exception 'New owner must be active'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 select * into owner_role from public.organisation_roles where scope=target_scope and is_owner;
 select * into replacement_role from public.organisation_roles where scope=target_scope and key=case when target_scope='supplier' then 'administrator' else 'viewer' end;
 -- Promote first, preserving the invariant while the source is demoted.
 update public.organisation_members set role_id=owner_role.id,member_role=owner_role.key,updated_at=now() where id=destination.id;
 update public.organisation_members set role_id=replacement_role.id,member_role=replacement_role.key,updated_at=now() where id=source.id;
 insert into public.ownership_transfer_history(organisation_id,from_membership_id,to_membership_id,actor_id,reason) values(source.organisation_id,source.id,destination.id,auth.uid(),trim(target_reason));
 insert into public.membership_audit_log(actor_id,scope,target_membership_id,target_user_id,organisation_id,action,reason,after_data) values(auth.uid(),target_scope,destination.id,destination.user_id,source.organisation_id,'ownership_transferred',trim(target_reason),jsonb_build_object('from_membership',source.id,'to_membership',destination.id));
end;$$;

-- Extend generic revoke/resend authorisation to organisation scopes.
create or replace function public.revoke_invitation(target_invitation uuid,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare inv public.invitations;
begin
 select * into inv from public.invitations where id=target_invitation and status='pending' for update; if inv.id is null then raise exception 'Pending invitation not found'; end if;
 if (inv.scope='platform' and not public.has_permission('platform.users.manage_roles')) or (inv.scope<>'platform' and not public.has_permission(public.organisation_manage_permission(inv.scope),inv.organisation_id)) then raise exception 'Not authorised'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 update public.invitations set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=inv.id;
 update public.platform_staff_memberships set status='removed',removed_at=now(),updated_at=now() where invitation_id=inv.id and status='invited';
 insert into public.membership_audit_log(actor_id,scope,organisation_id,action,reason,before_data) values(auth.uid(),inv.scope,inv.organisation_id,'invitation_revoked',trim(target_reason),jsonb_build_object('invitation_id',inv.id,'email',inv.email));
end;$$;
create or replace function public.resend_invitation(target_invitation uuid,target_token_hash text,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare inv public.invitations;
begin
 select * into inv from public.invitations where id=target_invitation for update; if inv.id is null or inv.status not in('pending','expired') then raise exception 'Invitation cannot be resent'; end if;
 if (inv.scope='platform' and not public.has_permission('platform.users.invite')) or (inv.scope<>'platform' and not public.has_permission(public.organisation_invite_permission(inv.scope),inv.organisation_id)) then raise exception 'Not authorised'; end if;
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 update public.invitations set token_hash=target_token_hash,status='pending',expires_at=now()+interval '7 days',revoked_by=null,revoked_at=null where id=inv.id;
 insert into public.membership_audit_log(actor_id,scope,organisation_id,action,reason) values(auth.uid(),inv.scope,inv.organisation_id,'invitation_resent',trim(target_reason));
end;$$;

revoke all on function public.invite_organisation_staff(uuid,text,text,text,text,text[],uuid[],uuid[],uuid[],numeric,text,text),public.list_organisation_staff(uuid),public.list_organisation_invitations(uuid),public.set_organisation_member_role(uuid,text,text),public.set_organisation_member_status(uuid,text,text),public.set_organisation_permission_override(uuid,text,boolean,text),public.transfer_organisation_ownership(uuid,uuid,text) from public,anon;
grant execute on function public.invite_organisation_staff(uuid,text,text,text,text,text[],uuid[],uuid[],uuid[],numeric,text,text),public.list_organisation_staff(uuid),public.list_organisation_invitations(uuid),public.set_organisation_member_role(uuid,text,text),public.set_organisation_member_status(uuid,text,text),public.set_organisation_permission_override(uuid,text,boolean,text),public.transfer_organisation_ownership(uuid,uuid,text) to authenticated;
