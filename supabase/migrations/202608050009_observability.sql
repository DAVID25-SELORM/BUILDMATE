-- Phase 12: privacy-conscious product analytics and operational incident records.
create table public.analytics_events(id bigint generated always as identity primary key,user_id uuid references public.profiles(id) on delete set null,event_name text not null check(event_name~'^[a-z][a-z0-9_]{1,63}$'),properties jsonb not null default '{}',session_id text,created_at timestamptz not null default now());
create table public.incidents(id uuid primary key default gen_random_uuid(),title text not null,severity text not null check(severity in('sev1','sev2','sev3')),status text not null check(status in('open','monitoring','resolved')),summary text,started_at timestamptz not null default now(),resolved_at timestamptz,created_by uuid references public.profiles(id));
alter table public.analytics_events enable row level security;alter table public.incidents enable row level security;
create policy "analytics authenticated insert" on public.analytics_events for insert with check(user_id=auth.uid() or user_id is null);
create policy "analytics admin read" on public.analytics_events for select using(public.is_platform_admin());
create policy "incident admin manage" on public.incidents for all using(public.is_platform_admin()) with check(public.is_platform_admin());
create index idx_analytics_event_time on public.analytics_events(event_name,created_at desc);
