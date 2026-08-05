-- Promote the explicitly identified BuildMate platform-owner account only.
do $$
declare target_id uuid; old_role public.user_role;
begin
 select p.id,p.role into target_id,old_role from public.profiles p join auth.users u on u.id=p.id where lower(u.email)=lower('admin.regent@gmail.com') for update;
 if target_id is null then raise exception 'Platform owner account not found'; end if;
 if old_role<>'super_admin' then
  update public.profiles set role='super_admin',updated_at=now() where id=target_id;
  insert into public.audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(null,'profile',target_id::text,'platform_owner_promoted',jsonb_build_object('role',old_role),jsonb_build_object('role','super_admin','migration','202608050027'));
 end if;
end $$;
