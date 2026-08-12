-- The custom cross-device recovery email flow uses the service-role link generator,
-- so it needs an application-owned throttle. Only a SHA-256 digest is retained.
create table public.password_reset_rate_limits(
  email_hash text primary key check(email_hash ~ '^[0-9a-f]{64}$'),
  last_requested_at timestamptz not null default now()
);

alter table public.password_reset_rate_limits enable row level security;
alter table public.password_reset_rate_limits force row level security;
revoke all on table public.password_reset_rate_limits from public,anon,authenticated;

create or replace function public.claim_password_reset_rate_limit(
  target_email_hash text,
  minimum_interval_seconds integer default 60
) returns boolean
language plpgsql security definer set search_path=public as $$
declare previous_request timestamptz;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'Service role required';
  end if;
  if target_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid email digest';
  end if;
  if minimum_interval_seconds < 30 or minimum_interval_seconds > 3600 then
    raise exception 'Invalid rate-limit interval';
  end if;

  -- Serialize requests for the same digest, including when no row exists yet.
  perform pg_advisory_xact_lock(hashtextextended(target_email_hash,0));

  select last_requested_at into previous_request
  from public.password_reset_rate_limits
  where email_hash=target_email_hash
  for update;

  if previous_request is not null and previous_request > now() - make_interval(secs=>minimum_interval_seconds) then
    return false;
  end if;

  insert into public.password_reset_rate_limits(email_hash,last_requested_at)
  values(target_email_hash,now())
  on conflict(email_hash) do update set last_requested_at=excluded.last_requested_at;
  return true;
end;
$$;

revoke all on function public.claim_password_reset_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.claim_password_reset_rate_limit(text,integer) to service_role;
