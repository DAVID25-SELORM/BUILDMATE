-- Complete supplier filtering and preview authorisation without changing applied migrations.
create or replace function public.start_support_view(target_type text,target_id uuid,target_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  if target_type='customer' then
    if not public.admin_has_permission('customer_support') then raise exception 'Customer support permission required'; end if;
    if not exists(select 1 from profiles where id=target_id and role in('customer','contractor','professional')) then raise exception 'Customer not found'; end if;
  elsif target_type='supplier' then
    if not public.admin_has_permission('supplier_verification') then raise exception 'Supplier verification permission required'; end if;
    if not exists(select 1 from organisations where id=target_id and organisation_type='supplier') then raise exception 'Supplier not found'; end if;
  else raise exception 'Invalid preview type'; end if;
  if length(trim(target_reason))<5 then raise exception 'A reason is required'; end if;
  insert into support_view_sessions(admin_id,subject_type,subject_id,reason) values(auth.uid(),target_type,target_id,trim(target_reason)) returning id into result;
  insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata) values(auth.uid(),'read_only_preview_started',target_type,target_id,trim(target_reason),jsonb_build_object('session_id',result));
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'support_view',result::text,'read_only_preview_started',jsonb_build_object('subject_type',target_type,'subject_id',target_id,'reason',trim(target_reason)));
  return result;
end;$$;

create or replace function public.admin_set_supplier_status(target_org uuid,new_status public.supplier_verification_status,reason text default null,new_verification_levels public.supplier_verification_level[] default null)
returns void language plpgsql security definer set search_path=public as $$
declare current_status public.supplier_verification_status;
begin
 if not public.admin_has_permission('supplier_verification') then raise exception 'Not authorised'; end if;
 if length(trim(coalesce(reason,'')))<5 then raise exception 'A detailed reason is required'; end if;
 select verification_status into current_status from organisations where id=target_org and organisation_type='supplier' for update; if current_status is null then raise exception 'Supplier not found'; end if;
 if not public.is_valid_supplier_transition(current_status,new_status) then raise exception 'Cannot move supplier from % to %',current_status,new_status; end if;
 update organisations set verification_status=new_status,decision_reason=case when new_status in('rejected','information_required') then trim(reason) else null end,suspended_reason=case when new_status='suspended' then trim(reason) else suspended_reason end,reviewer_id=auth.uid(),reviewed_at=now(),approved_at=case when new_status='approved' then now() else approved_at end,suspended_at=case when new_status='suspended' then now() else suspended_at end,verification_levels=coalesce(new_verification_levels,verification_levels) where id=target_org;
 insert into supplier_review_events(organisation_id,actor_id,event_type,from_status,to_status,reason) values(target_org,auth.uid(),new_status::text,current_status,new_status,trim(reason));
 insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,before_data,after_data) values(auth.uid(),'supplier_verification_'||new_status,'supplier',target_org,trim(reason),jsonb_build_object('status',current_status),jsonb_build_object('status',new_status,'verification_levels',new_verification_levels));
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'supplier',target_org::text,'supplier_verification_'||new_status,jsonb_build_object('status',current_status),jsonb_build_object('status',new_status,'reason',trim(reason)));
end;$$;

create or replace function public.assign_supplier_reviewer_v2(target_org uuid,reviewer uuid,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.admin_has_permission('supplier_verification') then raise exception 'Not authorised'; end if; if length(trim(target_reason))<5 then raise exception 'A detailed reason is required'; end if;
 if not exists(select 1 from profiles where id=reviewer and role in('admin','super_admin')) then raise exception 'Admin reviewer required'; end if;
 update organisations set reviewer_id=reviewer where id=target_org and organisation_type='supplier'; if not found then raise exception 'Supplier not found'; end if;
 insert into supplier_review_events(organisation_id,actor_id,event_type,reason,metadata) values(target_org,auth.uid(),'reviewer_assigned',trim(target_reason),jsonb_build_object('reviewer_id',reviewer));
 insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata) values(auth.uid(),'supplier_reviewer_assigned','supplier',target_org,trim(target_reason),jsonb_build_object('reviewer_id',reviewer));
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'supplier',target_org::text,'supplier_reviewer_assigned',jsonb_build_object('reviewer_id',reviewer,'reason',trim(target_reason)));
end;$$;
revoke all on function public.assign_supplier_reviewer_v2(uuid,uuid,text) from public,anon; grant execute on function public.assign_supplier_reviewer_v2(uuid,uuid,text) to authenticated;

create or replace function public.admin_list_suppliers_v2(search_text text default null,status_filter text default null,verification_level_filter text default null,region_filter text default null,category_filter text default null,performance_filter text default null,registered_from date default null,registered_to date default null,sort_by text default 'newest',page_number integer default 1,page_size integer default 25)
returns table(id uuid,business_name text,trading_name text,primary_contact text,phone text,email text,business_type text,region text,categories text[],verification_status text,verification_levels text[],product_count bigint,order_count bigint,total_sales numeric,fulfilment_rate numeric,average_rating numeric,settlement_status text,account_status text,registered_at timestamptz,performance_rating text,total_rows bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.admin_has_permission('supplier_verification') then raise exception 'Not authorised'; end if;
 return query with base as(
  select o.id,o.name business_name,sp.trading_name,sp.primary_contact_name,sp.primary_phone,sp.business_email,sp.business_type::text,sp.region,sp.primary_categories,o.verification_status::text,o.verification_levels::text[],coalesce(l.product_count,0) product_count,coalesce(m.order_count,0)::bigint order_count,coalesce(s.total_sales,0) total_sales,coalesce(m.fulfilment_rate,0) fulfilment_rate,coalesce(m.average_rating,0) average_rating,case when o.settlement_hold then 'held' when sd.organisation_id is null then 'missing' else 'ready' end settlement_status,o.account_status,o.created_at,coalesce(m.rating,'needs_attention') performance_rating
  from organisations o left join supplier_profiles sp on sp.organisation_id=o.id left join supplier_settlement_details sd on sd.organisation_id=o.id left join supplier_performance_metrics m on m.supplier_id=o.id
  left join lateral(select count(*) product_count from supplier_listings where supplier_id=o.id)l on true
  left join lateral(select coalesce(sum(total),0) total_sales from orders where supplier_id=o.id and status not in('cancelled','refunded'))s on true
  where o.organisation_type='supplier'), filtered as(
   select *,count(*)over() total_rows from base where
   (search_text is null or business_name ilike '%'||search_text||'%' or trading_name ilike '%'||search_text||'%' or primary_contact_name ilike '%'||search_text||'%' or business_email ilike '%'||search_text||'%')
   and(status_filter is null or verification_status=status_filter or account_status=status_filter)
   and(verification_level_filter is null or verification_level_filter=any(verification_levels))
   and(region_filter is null or region=region_filter) and(category_filter is null or category_filter=any(categories)) and(performance_filter is null or performance_rating=performance_filter)
   and(registered_from is null or created_at::date>=registered_from) and(registered_to is null or created_at::date<=registered_to))
 select f.id,f.business_name,f.trading_name,f.primary_contact_name,f.primary_phone,f.business_email,f.business_type,f.region,f.primary_categories,f.verification_status,f.verification_levels,f.product_count,f.order_count,f.total_sales,f.fulfilment_rate,f.average_rating,f.settlement_status,f.account_status,f.created_at,f.performance_rating,f.total_rows
 from filtered f order by case when sort_by='oldest' then f.created_at end asc,case when sort_by='highest_sales' then f.total_sales end desc,case when sort_by='most_orders' then f.order_count end desc,f.created_at desc offset greatest(page_number-1,0)*least(greatest(page_size,1),100) limit least(greatest(page_size,1),100);
end;$$;

revoke all on function public.admin_list_suppliers_v2(text,text,text,text,text,text,date,date,text,integer,integer) from public,anon;
grant execute on function public.admin_list_suppliers_v2(text,text,text,text,text,text,date,date,text,integer,integer) to authenticated;

create or replace function public.end_support_view(target_session uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
declare s public.support_view_sessions;
begin
 select * into s from support_view_sessions where id=target_session and admin_id=auth.uid() for update;
 if s.id is null then raise exception 'Preview session not found'; end if;
 if s.ended_at is null then
  update support_view_sessions set ended_at=now() where id=s.id;
  insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata) values(auth.uid(),'support_view_ended',s.subject_type,s.subject_id,s.reason,jsonb_build_object('session_id',s.id));
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'support_view',s.id::text,'read_only_preview_ended',jsonb_build_object('subject_type',s.subject_type,'subject_id',s.subject_id));
 end if;
end;$$;

create or replace function public.super_admin_set_permission(target_admin uuid,target_permission text,should_grant boolean,target_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare old_role text; allowed constant text[]:=array['operations','supplier_verification','customer_support','catalogue','finance','logistics','reports','audit','settings','viewer'];
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='super_admin') then raise exception 'Super administrator required'; end if;
 if not target_permission=any(allowed) then raise exception 'Invalid permission'; end if;
 if length(trim(target_reason))<5 then raise exception 'A detailed reason is required'; end if;
 select role::text into old_role from profiles where id=target_admin and role in('admin','super_admin'); if old_role is null then raise exception 'Administrator not found'; end if;
 if should_grant then insert into admin_permissions(admin_id,permission,granted_by) values(target_admin,target_permission,auth.uid()) on conflict(admin_id,permission) do nothing; else delete from admin_permissions where admin_id=target_admin and permission=target_permission; end if;
 insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,after_data) values(auth.uid(),case when should_grant then 'admin_permission_granted' else 'admin_permission_revoked' end,'admin',target_admin,trim(target_reason),jsonb_build_object('permission',target_permission));
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'admin_permission',target_admin::text,case when should_grant then 'permission_granted' else 'permission_revoked' end,jsonb_build_object('permission',target_permission,'reason',trim(target_reason)));
end;$$;
