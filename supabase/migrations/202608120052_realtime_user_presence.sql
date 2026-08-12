-- Authenticated, multi-session presence. Presence is operational metadata:
-- users may write only their own sessions; platform staff with user-view access
-- may read it. Stale rows are retained briefly for last-seen reporting.
create table public.user_presence (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  current_path text not null default '/',
  last_seen_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  primary key (user_id, session_id),
  constraint user_presence_path_length check (length(current_path) between 1 and 500)
);

create index idx_user_presence_last_seen on public.user_presence(last_seen_at desc);
alter table public.user_presence enable row level security;
alter table public.user_presence force row level security;

create policy "users manage own presence" on public.user_presence
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "platform staff view presence" on public.user_presence
  for select to authenticated
  using (public.has_permission('platform.users.view'));

grant select,insert,update,delete on public.user_presence to authenticated;
revoke all on public.user_presence from anon;

alter table public.user_presence replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.user_presence;
exception when duplicate_object then null;
end $$;

create or replace function public.touch_user_presence(target_session uuid,target_path text)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.user_presence where user_id=auth.uid() and last_seen_at<now()-interval '7 days';
  insert into public.user_presence(user_id,session_id,current_path,last_seen_at)
  values(auth.uid(),target_session,left(coalesce(nullif(target_path,''),'/'),500),now())
  on conflict(user_id,session_id) do update
    set current_path=excluded.current_path,last_seen_at=excluded.last_seen_at;
  update public.profiles set last_activity_at=now() where id=auth.uid();
end;$$;

create or replace function public.admin_list_user_presence()
returns table(user_id uuid,full_name text,email text,role text,current_path text,last_seen_at timestamptz,session_count bigint)
language plpgsql stable security definer set search_path=public,auth as $$
begin
  if not public.has_permission('platform.users.view') then raise exception 'Not authorised'; end if;
  return query
  select p.id,p.full_name,u.email::text,p.role::text,
    (array_agg(up.current_path order by up.last_seen_at desc))[1],max(up.last_seen_at),count(*)
  from public.user_presence up
  join public.profiles p on p.id=up.user_id
  join auth.users u on u.id=up.user_id
  where up.last_seen_at > now()-interval '24 hours'
  group by p.id,p.full_name,u.email,p.role
  order by max(up.last_seen_at) desc
  limit 500;
end;$$;

revoke all on function public.touch_user_presence(uuid,text),public.admin_list_user_presence() from public,anon;
grant execute on function public.touch_user_presence(uuid,text),public.admin_list_user_presence() to authenticated;
