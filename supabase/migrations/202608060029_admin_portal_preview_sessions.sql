-- Expiring, audited admin portal previews. The authenticated identity remains auth.uid().
create table public.admin_portal_preview_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  portal_type text not null check (portal_type in ('customer','supplier')),
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_organisation_id uuid references public.organisations(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 5 and 1000),
  reference_number text check (reference_number is null or length(reference_number) <= 120),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  status text not null default 'active' check (status in ('active','exited','expired','revoked')),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint preview_target_matches_portal check (
    (portal_type='customer' and target_user_id is not null and target_organisation_id is null) or
    (portal_type='supplier' and target_user_id is null and target_organisation_id is not null)
  )
);

create index idx_admin_preview_active on public.admin_portal_preview_sessions(admin_user_id,status,expires_at desc);
create index idx_admin_preview_customer on public.admin_portal_preview_sessions(target_user_id,started_at desc) where portal_type='customer';
create index idx_admin_preview_supplier on public.admin_portal_preview_sessions(target_organisation_id,started_at desc) where portal_type='supplier';
alter table public.admin_portal_preview_sessions enable row level security;

create policy "preview initiator or super admin reads" on public.admin_portal_preview_sessions
for select using (
  admin_user_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='super_admin')
);

create or replace function public.start_admin_portal_preview(
  target_portal text,
  target_user uuid default null,
  target_organisation uuid default null,
  target_reason text default null,
  target_reference text default null,
  request_ip text default null,
  request_user_agent text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  if length(trim(coalesce(target_reason,'')))<5 then raise exception 'A preview reason is required'; end if;
  if target_portal='customer' then
    if not public.admin_has_permission('customer_support') then raise exception 'Customer support permission required'; end if;
    if target_user is null or target_organisation is not null or not exists(select 1 from profiles where id=target_user and role in('customer','contractor','professional')) then raise exception 'Customer not found'; end if;
  elsif target_portal='supplier' then
    if not public.admin_has_permission('supplier_verification') then raise exception 'Supplier verification permission required'; end if;
    if target_organisation is null or target_user is not null or not exists(select 1 from organisations where id=target_organisation and organisation_type='supplier') then raise exception 'Supplier organisation not found'; end if;
  else raise exception 'Invalid portal type';
  end if;
  update admin_portal_preview_sessions set status='expired',ended_at=now()
    where admin_user_id=auth.uid() and status='active' and expires_at<=now();
  update admin_portal_preview_sessions set status='exited',ended_at=now()
    where admin_user_id=auth.uid() and status='active';
  insert into admin_portal_preview_sessions(admin_user_id,portal_type,target_user_id,target_organisation_id,reason,reference_number,ip_address,user_agent)
    values(auth.uid(),target_portal,target_user,target_organisation,trim(target_reason),nullif(trim(coalesce(target_reference,'')),''),nullif(request_ip,'')::inet,left(request_user_agent,1000)) returning id into result;
  insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata)
    values(auth.uid(),'portal_preview_started',target_portal,coalesce(target_user,target_organisation),trim(target_reason),jsonb_build_object('preview_session_id',result,'reference_number',nullif(trim(coalesce(target_reference,'')),'')));
  return result;
end;$$;

create or replace function public.log_admin_portal_preview_access(target_session uuid,target_route text,target_action text default 'preview_page_opened')
returns void language plpgsql security definer set search_path=public as $$
declare s public.admin_portal_preview_sessions;
begin
  select * into s from admin_portal_preview_sessions where id=target_session and admin_user_id=auth.uid();
  if s.id is null then raise exception 'Preview session not found'; end if;
  if s.status<>'active' or s.expires_at<=now() then
    update admin_portal_preview_sessions set status='expired',ended_at=coalesce(ended_at,now()) where id=s.id and status='active';
    raise exception 'Preview session has expired';
  end if;
  insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata)
    values(auth.uid(),target_action,s.portal_type,coalesce(s.target_user_id,s.target_organisation_id),s.reason,jsonb_build_object('preview_session_id',s.id,'route',left(target_route,500)));
end;$$;

create or replace function public.end_admin_portal_preview(target_session uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.admin_portal_preview_sessions;
begin
  select * into s from admin_portal_preview_sessions where id=target_session for update;
  if s.id is null or not(s.admin_user_id=auth.uid() or exists(select 1 from profiles where id=auth.uid() and role='super_admin')) then raise exception 'Preview session not found'; end if;
  if s.status='active' then
    update admin_portal_preview_sessions set status='exited',ended_at=now() where id=s.id;
    insert into admin_action_history(actor_id,action,subject_type,subject_id,reason,metadata)
      values(auth.uid(),'portal_preview_exited',s.portal_type,coalesce(s.target_user_id,s.target_organisation_id),s.reason,jsonb_build_object('preview_session_id',s.id));
  end if;
end;$$;

revoke all on table public.admin_portal_preview_sessions from public,anon,authenticated;
grant select on table public.admin_portal_preview_sessions to authenticated;
revoke all on function public.start_admin_portal_preview(text,uuid,uuid,text,text,text,text),public.log_admin_portal_preview_access(uuid,text,text),public.end_admin_portal_preview(uuid) from public,anon;
grant execute on function public.start_admin_portal_preview(text,uuid,uuid,text,text,text,text),public.log_admin_portal_preview_access(uuid,text,text),public.end_admin_portal_preview(uuid) to authenticated;
