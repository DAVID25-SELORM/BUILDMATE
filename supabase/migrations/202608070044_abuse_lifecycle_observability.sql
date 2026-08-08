alter table public.organisations
  add column lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','suspended','closure_requested','retention_hold','anonymised')),
  add column closure_requested_at timestamptz,
  add column retention_until timestamptz,
  add column anonymised_at timestamptz;

-- All organisation permission checks stop at the tenant lifecycle boundary.  We
-- deliberately keep memberships intact so the final-owner invariant remains true.
create or replace function public.has_permission(target_permission text,target_organisation uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
 select case when auth.uid() is null then false
 when target_organisation is null then
   exists(
     select 1 from public.platform_staff_memberships m
     join public.platform_roles r on r.id=m.platform_role_id
     join public.platform_role_permissions rp on rp.role_id=r.id
     join public.platform_permissions p on p.id=rp.permission_id
     where m.user_id=auth.uid() and m.status='active' and p.key=target_permission
       and not exists(select 1 from public.platform_staff_permission_overrides x where x.membership_id=m.id and x.permission_id=p.id and not x.granted)
   ) or exists(
     select 1 from public.platform_staff_memberships m
     join public.platform_staff_permission_overrides x on x.membership_id=m.id
     join public.platform_permissions p on p.id=x.permission_id
     where m.user_id=auth.uid() and m.status='active' and x.granted and p.key=target_permission
   )
 else exists(select 1 from public.organisations o where o.id=target_organisation and o.lifecycle_status='active') and (
   exists(
     select 1 from public.organisation_members m
     join public.organisation_roles r on r.id=m.role_id
     join public.organisation_role_permissions rp on rp.role_id=r.id
     join public.organisation_permissions p on p.id=rp.permission_id
     where m.user_id=auth.uid() and m.organisation_id=target_organisation and m.status='active' and m.is_active
       and p.key=target_permission and p.scope=public.organisation_scope(target_organisation)
       and not exists(select 1 from public.membership_permission_overrides x where x.membership_id=m.id and x.permission_id=p.id and not x.granted)
   ) or exists(
     select 1 from public.organisation_members m
     join public.membership_permission_overrides x on x.membership_id=m.id
     join public.organisation_permissions p on p.id=x.permission_id
     where m.user_id=auth.uid() and m.organisation_id=target_organisation and m.status='active' and m.is_active
       and x.granted and p.key=target_permission
   )
 ) end;
$$;

create table public.action_rate_counters(
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key(actor_id,action_key,window_started_at)
);
alter table public.action_rate_counters enable row level security;
revoke all on public.action_rate_counters from anon,authenticated;

create or replace function public.consume_rate_limit(target_action text,target_limit integer,target_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare bucket timestamptz; current_count integer;
begin
  if auth.uid() is null or target_limit<1 or target_window_seconds<1 then return false; end if;
  bucket:=to_timestamp(floor(extract(epoch from now())/target_window_seconds)*target_window_seconds);
  insert into action_rate_counters(actor_id,action_key,window_started_at,request_count)
  values(auth.uid(),target_action,bucket,1)
  on conflict(actor_id,action_key,window_started_at) do update
    set request_count=action_rate_counters.request_count+1
  returning request_count into current_count;
  if current_count>target_limit then
    insert into audit_logs(actor_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),'security',target_action,'rate_limit_exceeded',jsonb_build_object('limit',target_limit,'window_seconds',target_window_seconds,'count',current_count));
    return false;
  end if;
  return true;
end;$$;

create or replace function public.enforce_invitation_rate_limit()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and (tg_op='INSERT' or old.token_hash is distinct from new.token_hash)
     and not consume_rate_limit('staff_invitation',10,3600) then
    raise exception 'Invitation rate limit exceeded. Try again later.';
  end if;
  return new;
end;$$;
create trigger invitation_rate_limit before insert or update of token_hash on public.invitations
for each row execute function public.enforce_invitation_rate_limit();

alter table public.purchase_request_approvals
  add constraint one_approval_stage_per_actor unique(purchase_request_id,actor_membership_id,stage);

-- One person may not approve multiple stages. This both enforces separation of
-- duties and makes rapid repeat submissions unable to advance a request twice.
create or replace function public.decide_purchase_request(target_request uuid,target_decision text,target_notes text)
returns void language plpgsql security definer set search_path=public as $$
declare r purchase_requests; member_id uuid; next_stage text; next_status text; limit_value numeric;
begin
  select * into r from purchase_requests where id=target_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not has_permission('purchase_requests.approve',r.organisation_id) then raise exception 'Not authorised'; end if;
  select m.id,max(pm.approval_limit) into member_id,limit_value
  from organisation_members m
  left join project_memberships pm on pm.membership_id=m.id and (r.project_id is null or pm.project_id=r.project_id)
  where m.organisation_id=r.organisation_id and m.user_id=auth.uid() and m.status='active' and m.is_active group by m.id;
  if member_id is null then raise exception 'No active organisation membership'; end if;
  if exists(select 1 from purchase_request_approvals a where a.purchase_request_id=r.id and a.actor_membership_id=member_id) then
    raise exception 'A different authorised staff member must approve the next stage';
  end if;
  if target_decision='approved' and limit_value is not null and r.estimated_amount>limit_value then raise exception 'Request exceeds your approval limit'; end if;
  if target_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if target_decision='rejected' then next_status:='rejected'; next_stage:=r.current_stage;
  elsif r.current_stage='project_review' then next_status:='project_reviewed'; next_stage:='budget_check';
  elsif r.current_stage='budget_check' then next_status:='budget_checked'; next_stage:='authorisation';
  elsif r.current_stage='authorisation' then next_status:='approved'; next_stage:='procurement';
  else raise exception 'Request is not awaiting approval'; end if;
  insert into purchase_request_approvals(purchase_request_id,actor_membership_id,stage,decision,notes)
  values(r.id,member_id,r.current_stage,target_decision,nullif(trim(coalesce(target_notes,'')),''));
  update purchase_requests set status=next_status,current_stage=next_stage,updated_at=now() where id=r.id;
end;$$;

create table public.tenant_data_requests(
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  requested_by uuid not null references public.profiles(id),
  request_type text not null check(request_type in ('export','closure')),
  status text not null default 'pending' check(status in ('pending','processing','completed','rejected')),
  reason text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  handled_by uuid references public.profiles(id)
);
alter table public.tenant_data_requests enable row level security;
create policy "tenant managers read requests" on public.tenant_data_requests for select using(
  has_permission(case when organisation_scope(organisation_id)='supplier' then 'supplier.profile.edit' else 'organisation.manage' end,organisation_id)
  or is_platform_admin()
);
revoke insert,update,delete on public.tenant_data_requests from anon,authenticated;

create or replace function public.request_tenant_data_action(target_organisation uuid,target_type text,target_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; permission_key text;
begin
  permission_key:=case when organisation_scope(target_organisation)='supplier' then 'supplier.profile.edit' else 'organisation.manage' end;
  if not check_permission_audited(permission_key,target_organisation) then raise exception 'Not authorised'; end if;
  if target_type not in ('export','closure') then raise exception 'Invalid request type'; end if;
  if not consume_rate_limit('tenant_data_'||target_type,3,86400) then raise exception 'Request rate limit exceeded'; end if;
  insert into tenant_data_requests(organisation_id,requested_by,request_type,reason)
  values(target_organisation,auth.uid(),target_type,nullif(trim(coalesce(target_reason,'')),'')) returning id into result;
  if target_type='closure' then
    update organisations set lifecycle_status='closure_requested',closure_requested_at=now(),retention_until=now()+interval '7 years' where id=target_organisation;
  end if;
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),'organisation',target_organisation::text,'tenant_'||target_type||'_requested',jsonb_build_object('request_id',result));
  return result;
end;$$;

create or replace function public.admin_manage_organisation_lifecycle(target_organisation uuid,target_action text,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare scope_value text; permission_key text;
begin
  scope_value:=organisation_scope(target_organisation);
  if scope_value is null then raise exception 'Organisation not found'; end if;
  permission_key:=case when scope_value='supplier' then 'suppliers.suspend' else 'customers.suspend' end;
  if not check_permission_audited(permission_key,null) then raise exception 'Not authorised'; end if;
  if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
  if target_action='suspend' then update organisations set lifecycle_status='suspended',account_status='suspended' where id=target_organisation;
  elsif target_action='reactivate' then update organisations set lifecycle_status='active',account_status='active',closure_requested_at=null where id=target_organisation;
  elsif target_action='retention_hold' then update organisations set lifecycle_status='retention_hold',retention_until=null where id=target_organisation;
  else raise exception 'Invalid lifecycle action'; end if;
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),'organisation',target_organisation::text,'lifecycle_'||target_action,jsonb_build_object('reason',trim(target_reason)));
end;$$;

create or replace function public.admin_tenant_security_summary(hours_back integer default 24)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not has_permission('audit_logs.view') and not is_platform_admin() then raise exception 'Not authorised'; end if;
  return jsonb_build_object(
    'permission_denials',(select count(*) from audit_logs where action='permission_denied' and created_at>=now()-make_interval(hours=>hours_back)),
    'rate_limit_events',(select count(*) from audit_logs where action='rate_limit_exceeded' and created_at>=now()-make_interval(hours=>hours_back)),
    'suspended_memberships',(select count(*) from organisation_members where status='suspended'),
    'suspended_organisations',(select count(*) from organisations where lifecycle_status='suspended'),
    'open_incidents',(select count(*) from incidents where status<>'resolved'),
    'pending_data_requests',(select count(*) from tenant_data_requests where status='pending')
  );
end;$$;

create or replace function public.purge_expired_operational_data()
returns jsonb language plpgsql security definer set search_path=public as $$
declare counters_deleted integer; analytics_deleted integer;
begin
  delete from action_rate_counters where window_started_at<now()-interval '7 days'; get diagnostics counters_deleted=row_count;
  delete from analytics_events where created_at<now()-interval '24 months'; get diagnostics analytics_deleted=row_count;
  return jsonb_build_object('rate_counters_deleted',counters_deleted,'analytics_deleted',analytics_deleted);
end;$$;

revoke all on function public.consume_rate_limit(text,integer,integer),public.request_tenant_data_action(uuid,text,text),
  public.admin_manage_organisation_lifecycle(uuid,text,text),public.admin_tenant_security_summary(integer),
  public.purge_expired_operational_data() from public,anon;
grant execute on function public.consume_rate_limit(text,integer,integer),public.request_tenant_data_action(uuid,text,text) to authenticated;
grant execute on function public.admin_manage_organisation_lifecycle(uuid,text,text),public.admin_tenant_security_summary(integer) to authenticated;
grant execute on function public.purge_expired_operational_data() to service_role;
