alter table public.admin_portal_preview_sessions
 add column preview_role_key text,
 add column preview_branch_id uuid references public.supplier_branches(id),
 add column preview_warehouse_id uuid references public.supplier_warehouses(id),
 add column preview_project_id uuid references public.projects(id);

create or replace function public.configure_admin_portal_preview_context(target_session uuid,target_role_key text,target_branch uuid default null,target_warehouse uuid default null,target_project uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare s public.admin_portal_preview_sessions; target_scope text;
begin
 select * into s from public.admin_portal_preview_sessions where id=target_session and admin_user_id=auth.uid() and status='active' for update;
 if s.id is null then raise exception 'Active preview session not found'; end if;
 target_scope:=case when s.portal_type='supplier' then 'supplier' else 'customer' end;
 if not exists(select 1 from public.organisation_roles where scope=target_scope and key=target_role_key) then raise exception 'Invalid preview role'; end if;
 if target_branch is not null and not exists(select 1 from public.supplier_branches where id=target_branch and organisation_id=s.target_organisation_id) then raise exception 'Branch is outside this organisation'; end if;
 if target_warehouse is not null and not exists(select 1 from public.supplier_warehouses where id=target_warehouse and organisation_id=s.target_organisation_id) then raise exception 'Warehouse is outside this organisation'; end if;
 if target_project is not null and not exists(select 1 from public.projects where id=target_project and organisation_id=s.target_organisation_id) then raise exception 'Project is outside this organisation'; end if;
 update public.admin_portal_preview_sessions set preview_role_key=target_role_key,preview_branch_id=target_branch,preview_warehouse_id=target_warehouse,preview_project_id=target_project where id=s.id;
 insert into public.admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata) values(auth.uid(),'preview_role_selected',s.portal_type,coalesce(s.target_user_id,s.target_organisation_id),s.reason,jsonb_build_object('preview_session_id',s.id,'role',target_role_key,'branch',target_branch,'warehouse',target_warehouse,'project',target_project));
end;$$;

create or replace function public.preview_role_has_permission(target_session uuid,target_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_portal_preview_sessions s join public.organisation_roles r on r.scope=case when s.portal_type='supplier' then 'supplier' else 'customer' end and r.key=s.preview_role_key join public.organisation_role_permissions rp on rp.role_id=r.id join public.organisation_permissions p on p.id=rp.permission_id where s.id=target_session and s.admin_user_id=auth.uid() and s.status='active' and s.expires_at>now() and p.key=target_permission);
$$;
revoke all on function public.configure_admin_portal_preview_context(uuid,text,uuid,uuid,uuid),public.preview_role_has_permission(uuid,text) from public,anon;
grant execute on function public.configure_admin_portal_preview_context(uuid,text,uuid,uuid,uuid),public.preview_role_has_permission(uuid,text) to authenticated;
