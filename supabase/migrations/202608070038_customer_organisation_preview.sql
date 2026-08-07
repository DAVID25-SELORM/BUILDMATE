-- Uses preview_project_id from the role-context migration for project-scoped customer previews.
alter table public.admin_portal_preview_sessions drop constraint preview_target_matches_portal;
alter table public.admin_portal_preview_sessions add constraint preview_target_matches_portal check(
 (portal_type='customer' and ((target_user_id is not null and target_organisation_id is null) or (target_user_id is null and target_organisation_id is not null))) or
 (portal_type='supplier' and target_user_id is null and target_organisation_id is not null)
);
create or replace function public.start_admin_portal_preview(target_portal text,target_user uuid default null,target_organisation uuid default null,target_reason text default null,target_reference text default null,request_ip text default null,request_user_agent text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A preview reason is required'; end if;
 if target_portal='customer' then
  if not public.admin_has_permission('customer_support') then raise exception 'Customer support permission required'; end if;
  if (target_user is null)=(target_organisation is null) then raise exception 'Choose exactly one customer or customer organisation'; end if;
  if target_user is not null and not exists(select 1 from profiles where id=target_user and role in('customer','contractor','professional')) then raise exception 'Customer not found'; end if;
  if target_organisation is not null and not exists(select 1 from organisations where id=target_organisation and organisation_type<>'supplier') then raise exception 'Customer organisation not found'; end if;
 elsif target_portal='supplier' then
  if not public.admin_has_permission('supplier_verification') then raise exception 'Supplier verification permission required'; end if;
  if target_organisation is null or target_user is not null or not exists(select 1 from organisations where id=target_organisation and organisation_type='supplier') then raise exception 'Supplier organisation not found'; end if;
 else raise exception 'Invalid portal type'; end if;
 update admin_portal_preview_sessions set status='expired',ended_at=now() where admin_user_id=auth.uid() and status='active' and expires_at<=now();
 update admin_portal_preview_sessions set status='exited',ended_at=now() where admin_user_id=auth.uid() and status='active';
 insert into admin_portal_preview_sessions(admin_user_id,portal_type,target_user_id,target_organisation_id,reason,reference_number,ip_address,user_agent) values(auth.uid(),target_portal,target_user,target_organisation,trim(target_reason),nullif(trim(coalesce(target_reference,'')),''),nullif(request_ip,'')::inet,left(request_user_agent,1000)) returning id into result;
 insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata) values(auth.uid(),'portal_preview_started',case when target_organisation is not null and target_portal='customer' then 'customer_organisation' else target_portal end,coalesce(target_user,target_organisation),trim(target_reason),jsonb_build_object('preview_session_id',result,'reference_number',nullif(trim(coalesce(target_reference,'')),'')));
 return result;
end;$$;
