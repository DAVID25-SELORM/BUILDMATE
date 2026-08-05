-- Additive helpers; migrations 016-020 are already deployed.
create or replace function public.admin_log_customer_access_reset(target_customer uuid, target_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.admin_has_permission('customer_support') then raise exception 'Not authorised'; end if;
  if length(trim(target_reason)) < 5 then raise exception 'A detailed reason is required'; end if;
  if not exists(select 1 from public.profiles where id=target_customer and role in('customer','contractor','professional')) then raise exception 'Customer not found'; end if;
  insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason) values(auth.uid(),'customer_access_reset_requested','customer',target_customer,trim(target_reason));
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'profile',target_customer::text,'customer_access_reset_requested',jsonb_build_object('reason',trim(target_reason)));
end;$$;

create or replace function public.end_support_view(target_session uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
declare s public.support_view_sessions;
begin
  select * into s from public.support_view_sessions where id=target_session and admin_id=auth.uid() for update;
  if s.id is null then raise exception 'Preview session not found'; end if;
  if s.ended_at is null then
    update public.support_view_sessions set ended_at=now() where id=s.id;
    insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason) values(auth.uid(),'support_view_ended',s.subject_type,s.subject_id,s.reason);
  end if;
end;$$;

create or replace function public.super_admin_set_permission(target_admin uuid,target_permission text,should_grant boolean,target_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare old_role text; allowed constant text[]:=array['operations','supplier_verification','customer_support','catalogue','finance','logistics','reports','audit','viewer'];
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='super_admin') then raise exception 'Super administrator required'; end if;
  if not target_permission=any(allowed) then raise exception 'Invalid permission'; end if;
  if length(trim(target_reason))<5 then raise exception 'A detailed reason is required'; end if;
  select role::text into old_role from public.profiles where id=target_admin and role in('admin','super_admin');
  if old_role is null then raise exception 'Administrator not found'; end if;
  if should_grant then insert into public.admin_permissions(admin_id,permission,granted_by) values(target_admin,target_permission,auth.uid()) on conflict(admin_id,permission) do nothing;
  else delete from public.admin_permissions where admin_id=target_admin and permission=target_permission; end if;
  insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason,after_data) values(auth.uid(),case when should_grant then 'admin_permission_granted' else 'admin_permission_revoked' end,'admin',target_admin,trim(target_reason),jsonb_build_object('permission',target_permission));
end;$$;

revoke all on function public.admin_log_customer_access_reset(uuid,text) from public,anon;
revoke all on function public.end_support_view(uuid) from public,anon;
revoke all on function public.super_admin_set_permission(uuid,text,boolean,text) from public,anon;
grant execute on function public.admin_log_customer_access_reset(uuid,text) to authenticated;
grant execute on function public.end_support_view(uuid) to authenticated;
grant execute on function public.super_admin_set_permission(uuid,text,boolean,text) to authenticated;
