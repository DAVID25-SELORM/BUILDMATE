-- Administrative management foundation: scoped permissions, account controls,
-- internal notes, read-only previews, supplier restrictions and audited actions.

alter table public.profiles
 add column account_status text not null default 'active' check(account_status in('active','pending','suspended','restricted','deactivated')),
 add column alternative_phone text,
 add column verification_status text not null default 'unverified' check(verification_status in('unverified','pending','verified','rejected')),
 add column last_activity_at timestamptz;

alter table public.organisations
 add column account_status text not null default 'active' check(account_status in('active','pending','suspended','restricted','deactivated')),
 add column product_publishing_enabled boolean not null default true,
 add column order_acceptance_enabled boolean not null default true,
 add column settlement_hold boolean not null default false,
 add column settlement_hold_reason text,
 add column settlement_held_at timestamptz,
 add column settlement_held_by uuid references public.profiles(id);

create table public.admin_permissions(
 admin_id uuid not null references public.profiles(id) on delete cascade,
 permission text not null check(permission in('operations','supplier_verification','customer_support','finance','catalogue','logistics','reports','audit','settings','viewer')),
 granted_by uuid references public.profiles(id), granted_at timestamptz not null default now(), primary key(admin_id,permission)
);
insert into public.admin_permissions(admin_id,permission)
select p.id,scope from public.profiles p cross join unnest(array['operations','supplier_verification','customer_support','catalogue','logistics','reports','audit','viewer']) scope
where p.role='admin' on conflict do nothing;
create table public.admin_internal_notes(
 id bigint generated always as identity primary key, subject_type text not null check(subject_type in('customer','supplier','order','dispute')),
 subject_id uuid not null, note text not null check(length(trim(note)) between 2 and 4000), author_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.admin_action_history(
 id bigint generated always as identity primary key, actor_id uuid not null references public.profiles(id), action text not null,
 subject_type text not null, subject_id uuid not null, reason text not null, before_data jsonb, after_data jsonb, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.support_view_sessions(
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references public.profiles(id), subject_type text not null check(subject_type in('customer','supplier')),
 subject_id uuid not null, reason text not null check(length(trim(reason)) between 5 and 1000), read_only boolean not null default true check(read_only), started_at timestamptz not null default now(), ended_at timestamptz
);
create table public.supplier_performance_metrics(
 supplier_id uuid primary key references public.organisations(id) on delete cascade, order_count integer not null default 0, completed_orders integer not null default 0,
 cancelled_orders integer not null default 0, disputed_orders integer not null default 0, on_time_deliveries integer not null default 0, rated_orders integer not null default 0,
 average_rating numeric(4,2) not null default 0, fulfilment_rate numeric(5,2) not null default 0, cancellation_rate numeric(5,2) not null default 0,
 dispute_rate numeric(5,2) not null default 0, on_time_rate numeric(5,2) not null default 0, score numeric(5,2) not null default 0,
 rating text not null default 'needs_attention' check(rating in('excellent','good','needs_attention','high_risk')), calculated_at timestamptz not null default now()
);

alter table public.admin_permissions enable row level security;alter table public.admin_internal_notes enable row level security;
alter table public.admin_action_history enable row level security;alter table public.support_view_sessions enable row level security;alter table public.supplier_performance_metrics enable row level security;

create or replace function public.admin_has_permission(required_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='super_admin' or (p.role='admin' and exists(select 1 from public.admin_permissions ap where ap.admin_id=p.id and ap.permission=required_permission))));
$$;
revoke all on function public.admin_has_permission(text) from public,anon;grant execute on function public.admin_has_permission(text) to authenticated;

create policy "admin permission self read" on public.admin_permissions for select using(admin_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='super_admin'));
create policy "super admin permission manage" on public.admin_permissions for all using(exists(select 1 from public.profiles where id=auth.uid() and role='super_admin')) with check(exists(select 1 from public.profiles where id=auth.uid() and role='super_admin'));
create policy "admin internal notes read" on public.admin_internal_notes for select using(public.admin_has_permission('customer_support') or public.admin_has_permission('supplier_verification'));
create policy "admin action history read" on public.admin_action_history for select using(public.admin_has_permission('audit'));
create policy "admin preview sessions read" on public.support_view_sessions for select using(admin_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='super_admin'));
create policy "admin supplier performance read" on public.supplier_performance_metrics for select using(public.is_platform_admin());

create or replace function public.admin_manage_customer(target_customer uuid,target_action text,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare old_row public.profiles;new_status text;begin if not public.admin_has_permission('customer_support') then raise exception 'Not authorised';end if;if length(trim(target_reason))<5 then raise exception 'A detailed reason is required';end if;new_status=case target_action when 'suspend' then 'suspended' when 'restrict' then 'restricted' when 'reactivate' then 'active' when 'deactivate' then 'deactivated' else null end;if new_status is null then raise exception 'Invalid customer action';end if;select * into old_row from public.profiles where id=target_customer and role in('customer','contractor','professional') for update;if old_row.id is null then raise exception 'Customer not found';end if;update public.profiles set account_status=new_status,updated_at=now() where id=target_customer;insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason,before_data,after_data)values(auth.uid(),'customer_'||target_action,'customer',target_customer,trim(target_reason),jsonb_build_object('account_status',old_row.account_status),jsonb_build_object('account_status',new_status));insert into public.audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data)values(auth.uid(),'profile',target_customer::text,'customer_'||target_action,jsonb_build_object('account_status',old_row.account_status),jsonb_build_object('account_status',new_status));end;$$;

create or replace function public.admin_manage_supplier(target_supplier uuid,target_action text,target_reason text) returns void language plpgsql security definer set search_path=public as $$
declare old_row public.organisations;begin if not public.admin_has_permission('supplier_verification') then raise exception 'Not authorised';end if;if length(trim(target_reason))<5 then raise exception 'A detailed reason is required';end if;select * into old_row from public.organisations where id=target_supplier and organisation_type='supplier' for update;if old_row.id is null then raise exception 'Supplier not found';end if;update public.organisations set account_status=case when target_action='suspend' then 'suspended' when target_action='reactivate' then 'active' else account_status end,product_publishing_enabled=case when target_action='disable_publishing' then false when target_action='enable_publishing' then true else product_publishing_enabled end,order_acceptance_enabled=case when target_action='disable_orders' then false when target_action='enable_orders' then true else order_acceptance_enabled end where id=target_supplier;if not found or target_action not in('suspend','reactivate','disable_publishing','enable_publishing','disable_orders','enable_orders') then raise exception 'Invalid supplier action';end if;insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason,before_data,after_data)select auth.uid(),'supplier_'||target_action,'supplier',target_supplier,trim(target_reason),to_jsonb(old_row)-'tax_id',to_jsonb(o)-'tax_id' from public.organisations o where o.id=target_supplier;insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)values(auth.uid(),'organisation',target_supplier::text,'supplier_'||target_action,jsonb_build_object('reason',trim(target_reason)));end;$$;

create or replace function public.admin_set_settlement_hold(target_supplier uuid,hold boolean,target_reason text) returns void language plpgsql security definer set search_path=public as $$
begin if not public.admin_has_permission('finance') then raise exception 'Finance permission required';end if;if length(trim(target_reason))<5 then raise exception 'A detailed reason is required';end if;update public.organisations set settlement_hold=hold,settlement_hold_reason=case when hold then trim(target_reason) else null end,settlement_held_at=case when hold then now() else null end,settlement_held_by=case when hold then auth.uid() else null end where id=target_supplier and organisation_type='supplier';if not found then raise exception 'Supplier not found';end if;insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason,after_data)values(auth.uid(),case when hold then 'settlement_hold' else 'settlement_release' end,'supplier',target_supplier,trim(target_reason),jsonb_build_object('hold',hold));end;$$;

create or replace function public.add_admin_internal_note(target_type text,target_id uuid,note_text text) returns void language plpgsql security definer set search_path=public as $$
begin if not(public.admin_has_permission('customer_support')or public.admin_has_permission('supplier_verification'))then raise exception 'Not authorised';end if;if length(trim(note_text))<2 then raise exception 'Note is required';end if;insert into public.admin_internal_notes(subject_type,subject_id,note,author_id)values(target_type,target_id,trim(note_text),auth.uid());insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason)values(auth.uid(),'internal_note_added',target_type,target_id,'Internal note added');end;$$;

create or replace function public.start_support_view(target_type text,target_id uuid,target_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;begin if not public.admin_has_permission('customer_support') then raise exception 'Not authorised';end if;if length(trim(target_reason))<5 then raise exception 'A reason is required';end if;if target_type not in('customer','supplier')then raise exception 'Invalid preview type';end if;insert into public.support_view_sessions(admin_id,subject_type,subject_id,reason)values(auth.uid(),target_type,target_id,trim(target_reason))returning id into result;insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata)values(auth.uid(),'read_only_preview_started',target_type,target_id,trim(target_reason),jsonb_build_object('session_id',result));return result;end;$$;

revoke all on function public.admin_manage_customer(uuid,text,text),public.admin_manage_supplier(uuid,text,text),public.admin_set_settlement_hold(uuid,boolean,text),public.add_admin_internal_note(text,uuid,text),public.start_support_view(text,uuid,text) from public,anon;
grant execute on function public.admin_manage_customer(uuid,text,text),public.admin_manage_supplier(uuid,text,text),public.admin_set_settlement_hold(uuid,boolean,text),public.add_admin_internal_note(text,uuid,text),public.start_support_view(text,uuid,text) to authenticated;

create index idx_profiles_admin_customer_filters on public.profiles(role,account_status,created_at desc);create index idx_profiles_last_activity on public.profiles(last_activity_at desc);
create index idx_org_admin_supplier_filters on public.organisations(organisation_type,verification_status,account_status,created_at desc);
create index idx_admin_notes_subject on public.admin_internal_notes(subject_type,subject_id,created_at desc);create index idx_admin_actions_subject on public.admin_action_history(subject_type,subject_id,created_at desc);
create index idx_support_views_admin on public.support_view_sessions(admin_id,started_at desc);

revoke insert,update,delete on public.admin_internal_notes,public.admin_action_history,public.support_view_sessions,public.supplier_performance_metrics from anon,authenticated;
