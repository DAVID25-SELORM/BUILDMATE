create or replace function public.list_organisation_staff(target_organisation uuid)
returns table(membership_id uuid,user_id uuid,full_name text,email text,phone text,role_key text,role_label text,status text,joined_at timestamptz,branch_names text[],warehouse_names text[],project_names text[],approval_limit numeric)
language plpgsql stable security definer set search_path=public,auth as $$
declare target_scope text:=public.organisation_scope(target_organisation);
begin
 if not public.has_permission(case when target_scope='supplier' then 'supplier.staff.view' else 'organisation.view' end,target_organisation) then raise exception 'Not authorised'; end if;
 return query select m.id,m.user_id,p.full_name::text,u.email::text,p.phone::text,r.key::text,r.label::text,m.status::text,m.joined_at,
   coalesce((select array_agg(b.name::text order by b.name) from public.branch_memberships bm join public.supplier_branches b on b.id=bm.branch_id where bm.membership_id=m.id),'{}'::text[]),
   coalesce((select array_agg(w.name::text order by w.name) from public.warehouse_memberships wm join public.supplier_warehouses w on w.id=wm.warehouse_id where wm.membership_id=m.id),'{}'::text[]),
   coalesce((select array_agg(pr.name::text order by pr.name) from public.project_memberships pm join public.projects pr on pr.id=pm.project_id where pm.membership_id=m.id),'{}'::text[]),
   (select max(pm.approval_limit) from public.project_memberships pm where pm.membership_id=m.id)
 from public.organisation_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id join public.organisation_roles r on r.id=m.role_id
 where m.organisation_id=target_organisation order by m.created_at;
end;$$;
revoke all on function public.list_organisation_staff(uuid) from public,anon;
grant execute on function public.list_organisation_staff(uuid) to authenticated;
