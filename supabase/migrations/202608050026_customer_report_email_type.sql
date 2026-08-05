create or replace function public.admin_list_customers(search_text text default null,role_filter text default null,status_filter text default null,region_filter text default null,registered_from date default null,registered_to date default null,min_spend numeric default null,sort_by text default 'newest',page_number integer default 1,page_size integer default 25)
returns table(id uuid,full_name text,email text,phone text,account_type text,organisation text,region text,registered_at timestamptz,order_count bigint,total_spent numeric,active_projects bigint,last_activity timestamptz,account_status text,verification_status text,total_rows bigint)
language plpgsql stable security definer set search_path=public,auth as $$
#variable_conflict use_column
begin
 if not public.admin_has_permission('customer_support') then raise exception 'Not authorised'; end if;
 return query with base as(
  select p.id,p.full_name,u.email::text email,p.phone,p.role::text account_type,orgs.organisation,addr.region,p.created_at,coalesce(ord.order_count,0) order_count,coalesce(ord.total_spent,0) total_spent,coalesce(proj.active_projects,0) active_projects,coalesce(p.last_activity_at,u.last_sign_in_at) last_activity,p.account_status,p.verification_status
  from profiles p join auth.users u on u.id=p.id
  left join lateral(select string_agg(o.name,', ' order by o.name) organisation from organisation_members om join organisations o on o.id=om.organisation_id where om.user_id=p.id and om.is_active)orgs on true
  left join lateral(select a.region from addresses a where a.user_id=p.id order by a.is_default desc,a.created_at desc limit 1)addr on true
  left join lateral(select count(*) order_count,coalesce(sum(total)filter(where status<>'cancelled'),0) total_spent from orders where customer_id=p.id)ord on true
  left join lateral(select count(*) active_projects from projects where owner_id=p.id and status='active')proj on true where p.role in('customer','contractor','professional')),
 filtered as(select base.*,count(*)over() total_rows from base where(search_text is null or base.full_name ilike '%'||search_text||'%' or base.email ilike '%'||search_text||'%' or base.phone ilike '%'||search_text||'%')and(role_filter is null or base.account_type=role_filter)and(status_filter is null or base.account_status=status_filter)and(region_filter is null or base.region=region_filter)and(registered_from is null or base.created_at::date>=registered_from)and(registered_to is null or base.created_at::date<=registered_to)and(min_spend is null or base.total_spent>=min_spend))
 select f.id,f.full_name,f.email,f.phone,f.account_type,f.organisation,f.region,f.created_at,f.order_count,f.total_spent,f.active_projects,f.last_activity,f.account_status,f.verification_status,f.total_rows from filtered f order by case when sort_by='oldest' then f.created_at end asc,case when sort_by='highest_spending' then f.total_spent end desc,case when sort_by='most_orders' then f.order_count end desc,f.created_at desc offset greatest(page_number-1,0)*least(greatest(page_size,1),100) limit least(greatest(page_size,1),100);
end;$$;
