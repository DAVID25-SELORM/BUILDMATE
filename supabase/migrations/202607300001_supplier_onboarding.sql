-- Supplier onboarding, verification and audit trail.
-- NEW migration; does not edit 202607280001_initial_schema.sql or 202607290001_auth_hardening.sql.

-- ===================================================================
-- Enums
-- ===================================================================

create type public.supplier_verification_status as enum (
  'draft','submitted','under_review','information_required','approved','rejected','suspended'
);

create type public.supplier_verification_level as enum (
  'identity_verified','business_verified','warehouse_verified','authorised_distributor','premium_supplier'
);

create type public.supplier_business_type as enum (
  'sole_proprietorship','partnership','limited_liability_company','manufacturer',
  'distributor','wholesaler','retailer','hardware_shop','other'
);

create type public.supplier_branch_type as enum ('head_office','branch','warehouse','showroom');

create type public.supplier_document_type as enum (
  'business_registration_certificate','identification','tin_document','vat_certificate',
  'proof_of_address','distributor_authorisation','warehouse_photo','other'
);

-- ===================================================================
-- Migrate organisations.verification_status onto the new enum and
-- add verification workflow columns.
-- ===================================================================

alter table public.organisations alter column verification_status drop default;
alter table public.organisations
  alter column verification_status type public.supplier_verification_status
  using (case verification_status::text
    when 'pending' then 'draft'
    when 'under_review' then 'under_review'
    when 'verified' then 'approved'
    when 'rejected' then 'rejected'
    when 'suspended' then 'suspended'
    else 'draft'
  end)::public.supplier_verification_status;
alter table public.organisations alter column verification_status set default 'draft';
drop type public.verification_status;

alter table public.organisations
  add column reviewer_id uuid references public.profiles(id),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column decision_reason text,
  add column verification_levels public.supplier_verification_level[] not null default '{}',
  add column approved_at timestamptz,
  add column suspended_at timestamptz,
  add column suspended_reason text;

-- ===================================================================
-- Helper functions (run with caller privileges, under RLS)
-- ===================================================================

create or replace function public.is_platform_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin'));
$$;

create or replace function public.is_org_member(target_org uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from public.organisation_members
    where organisation_id = target_org and user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_org_owner_or_finance(target_org uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from public.organisation_members
    where organisation_id = target_org and user_id = auth.uid() and is_active
      and member_role in ('owner','finance')
  );
$$;

create or replace function public.is_org_editable(target_org uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from public.organisations
    where id = target_org and verification_status in ('draft','information_required')
  );
$$;

create or replace function public.is_valid_supplier_transition(
  from_status public.supplier_verification_status,
  to_status public.supplier_verification_status
) returns boolean language sql immutable as $$
  select case
    when from_status = 'draft' and to_status = 'submitted' then true
    when from_status = 'submitted' and to_status in ('under_review','information_required','approved','rejected') then true
    when from_status = 'under_review' and to_status in ('information_required','approved','rejected') then true
    when from_status = 'information_required' and to_status = 'submitted' then true
    when from_status = 'approved' and to_status = 'suspended' then true
    when from_status = 'suspended' and to_status = 'approved' then true
    when from_status = 'rejected' and to_status = 'submitted' then true
    else false
  end;
$$;

-- ===================================================================
-- Tables
-- ===================================================================

create table public.supplier_profiles (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  trading_name text,
  business_type public.supplier_business_type,
  business_description text,
  year_established integer,
  website text,
  primary_categories text[] not null default '{}',
  branch_count integer,
  employee_count integer,
  primary_contact_name text,
  primary_phone text,
  alternative_phone text,
  business_email text,
  whatsapp_number text,
  physical_address text,
  region text,
  city text,
  area text,
  ghanapost_gps text,
  vat_registered boolean not null default false,
  vat_number text,
  gsa_registration_number text,
  distributor_authorisation_number text,
  registration_document_expiry date,
  vat_certificate_expiry date,
  distributor_authorisation_expiry date,
  onboarding_step text not null default 'business_information',
  onboarding_completed_steps text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_branches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  branch_type public.supplier_branch_type not null default 'branch',
  phone text,
  address text not null,
  region text not null,
  city text not null,
  area text,
  ghanapost_gps text,
  latitude numeric,
  longitude numeric,
  operating_hours text,
  contact_person text,
  is_main_branch boolean not null default false,
  supports_pickup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_main_branch_per_org on public.supplier_branches (organisation_id) where is_main_branch;
create index idx_supplier_branches_org on public.supplier_branches (organisation_id);

create table public.supplier_delivery_coverage (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  regions_served text[] not null default '{}',
  cities_served text[] not null default '{}',
  max_delivery_radius_km numeric,
  minimum_order_value numeric,
  same_day_delivery boolean not null default false,
  standard_lead_time_days integer,
  customer_pickup_available boolean not null default false,
  delivery_handled_by text not null default 'internal' check (delivery_handled_by in ('internal','platform_logistics')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_settlement_details (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  settlement_method text not null default 'bank' check (settlement_method in ('bank','mobile_money')),
  bank_name text,
  account_name text,
  account_number text,
  momo_network text,
  momo_number text,
  momo_account_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  document_type public.supplier_document_type not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_supplier_documents_org on public.supplier_documents (organisation_id);

create table public.supplier_review_notes (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index idx_supplier_review_notes_org on public.supplier_review_notes (organisation_id, created_at desc);

create table public.supplier_review_events (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  from_status public.supplier_verification_status,
  to_status public.supplier_verification_status,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_supplier_review_events_org on public.supplier_review_events (organisation_id, created_at desc);

-- ===================================================================
-- Row level security
-- ===================================================================

alter table public.supplier_profiles enable row level security;
alter table public.supplier_branches enable row level security;
alter table public.supplier_delivery_coverage enable row level security;
alter table public.supplier_settlement_details enable row level security;
alter table public.supplier_documents enable row level security;
alter table public.supplier_review_notes enable row level security;
alter table public.supplier_review_events enable row level security;

-- organisations: members and admins can read; only admins may reach protected
-- columns (enforced below with column-level grants, not just row policies).
create policy "org member read" on public.organisations for select using (public.is_org_member(id));
create policy "org admin read" on public.organisations for select using (public.is_platform_admin());
create policy "org member update basic fields" on public.organisations for update
  using (public.is_org_member(id) and public.is_org_editable(id))
  with check (public.is_org_member(id) and public.is_org_editable(id));

revoke update on public.organisations from authenticated, anon;
grant update (name, organisation_type, registration_number, tax_id) on public.organisations to authenticated;

-- supplier_profiles
create policy "supplier profile read" on public.supplier_profiles for select
  using (public.is_org_member(organisation_id) or public.is_platform_admin());
create policy "supplier profile insert" on public.supplier_profiles for insert
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));
create policy "supplier profile update" on public.supplier_profiles for update
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));

-- supplier_branches
create policy "branch read" on public.supplier_branches for select
  using (public.is_org_member(organisation_id) or public.is_platform_admin());
create policy "branch insert" on public.supplier_branches for insert
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));
create policy "branch update" on public.supplier_branches for update
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));
create policy "branch delete" on public.supplier_branches for delete
  using (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));

-- supplier_delivery_coverage
create policy "delivery coverage read" on public.supplier_delivery_coverage for select
  using (public.is_org_member(organisation_id) or public.is_platform_admin());
create policy "delivery coverage insert" on public.supplier_delivery_coverage for insert
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));
create policy "delivery coverage update" on public.supplier_delivery_coverage for update
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));

-- supplier_settlement_details: owners/finance staff and admins only
create policy "settlement read" on public.supplier_settlement_details for select
  using (public.is_org_owner_or_finance(organisation_id) or public.is_platform_admin());
create policy "settlement insert" on public.supplier_settlement_details for insert
  with check (public.is_org_owner_or_finance(organisation_id) and public.is_org_editable(organisation_id));
create policy "settlement update" on public.supplier_settlement_details for update
  using (public.is_org_owner_or_finance(organisation_id))
  with check (public.is_org_owner_or_finance(organisation_id) and public.is_org_editable(organisation_id));

-- supplier_documents
create policy "documents read" on public.supplier_documents for select
  using (public.is_org_member(organisation_id) or public.is_platform_admin());
create policy "documents insert" on public.supplier_documents for insert
  with check (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id) and uploaded_by = auth.uid());
create policy "documents delete" on public.supplier_documents for delete
  using (public.is_org_member(organisation_id) and public.is_org_editable(organisation_id));

-- supplier_review_notes: internal, admin only (never visible to suppliers)
create policy "review notes admin read" on public.supplier_review_notes for select
  using (public.is_platform_admin());
create policy "review notes admin insert" on public.supplier_review_notes for insert
  with check (public.is_platform_admin() and author_id = auth.uid());

-- supplier_review_events: admin-readable audit trail; rows are written only
-- by the SECURITY DEFINER functions and triggers below, never inserted directly.
create policy "review events admin read" on public.supplier_review_events for select
  using (public.is_platform_admin());

-- ===================================================================
-- Status transition RPCs (the only way verification_status can change)
-- ===================================================================

create or replace function public.submit_supplier_application(target_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  current_status public.supplier_verification_status;
begin
  if not public.is_org_member(target_org) then
    raise exception 'not authorised';
  end if;

  select verification_status into current_status from public.organisations where id = target_org;

  if not public.is_valid_supplier_transition(current_status, 'submitted') then
    raise exception 'application cannot be submitted from status %', current_status;
  end if;

  update public.organisations
  set verification_status = 'submitted', submitted_at = now(), decision_reason = null
  where id = target_org;

  insert into public.supplier_review_events (organisation_id, actor_id, event_type, from_status, to_status)
  values (target_org, auth.uid(), 'submitted', current_status, 'submitted');
end;
$$;

create or replace function public.admin_set_supplier_status(
  target_org uuid,
  new_status public.supplier_verification_status,
  reason text default null,
  new_verification_levels public.supplier_verification_level[] default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  current_status public.supplier_verification_status;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  select verification_status into current_status from public.organisations where id = target_org;
  if current_status is null then
    raise exception 'organisation not found';
  end if;

  if not public.is_valid_supplier_transition(current_status, new_status) then
    raise exception 'cannot move supplier from % to %', current_status, new_status;
  end if;

  update public.organisations
  set
    verification_status = new_status,
    decision_reason = case when new_status in ('rejected','information_required') then reason else null end,
    suspended_reason = case when new_status = 'suspended' then reason else suspended_reason end,
    reviewer_id = auth.uid(),
    reviewed_at = now(),
    approved_at = case when new_status = 'approved' then now() else approved_at end,
    suspended_at = case when new_status = 'suspended' then now() else suspended_at end,
    verification_levels = coalesce(new_verification_levels, verification_levels)
  where id = target_org;

  insert into public.supplier_review_events (organisation_id, actor_id, event_type, from_status, to_status, reason)
  values (target_org, auth.uid(), new_status::text, current_status, new_status, reason);
end;
$$;

create or replace function public.assign_supplier_reviewer(target_org uuid, reviewer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  update public.organisations set reviewer_id = reviewer where id = target_org;

  insert into public.supplier_review_events (organisation_id, actor_id, event_type, metadata)
  values (target_org, auth.uid(), 'reviewer_assigned', jsonb_build_object('reviewer_id', reviewer));
end;
$$;

create or replace function public.add_supplier_review_note(target_org uuid, note_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  insert into public.supplier_review_notes (organisation_id, author_id, note) values (target_org, auth.uid(), note_text);
  insert into public.supplier_review_events (organisation_id, actor_id, event_type) values (target_org, auth.uid(), 'note_added');
end;
$$;

-- ===================================================================
-- Automatic audit triggers
-- ===================================================================

create or replace function public.log_supplier_document_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.supplier_review_events (organisation_id, actor_id, event_type, metadata)
    values (new.organisation_id, auth.uid(), 'document_uploaded', jsonb_build_object('document_type', new.document_type, 'file_name', new.file_name));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.supplier_review_events (organisation_id, actor_id, event_type, metadata)
    values (old.organisation_id, auth.uid(), 'document_deleted', jsonb_build_object('document_type', old.document_type, 'file_name', old.file_name));
    return old;
  end if;
  return null;
end;
$$;

create trigger supplier_documents_audit
after insert or delete on public.supplier_documents
for each row execute function public.log_supplier_document_event();

create or replace function public.log_supplier_settlement_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.supplier_review_events (organisation_id, actor_id, event_type)
  values (coalesce(new.organisation_id, old.organisation_id), auth.uid(), 'settlement_updated');
  return coalesce(new, old);
end;
$$;

create trigger supplier_settlement_audit
after insert or update on public.supplier_settlement_details
for each row execute function public.log_supplier_settlement_event();

create or replace function public.log_supplier_profile_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.supplier_review_events (organisation_id, actor_id, event_type, metadata)
  values (coalesce(new.organisation_id, old.organisation_id), auth.uid(), 'profile_updated', jsonb_build_object('table', tg_table_name));
  return coalesce(new, old);
end;
$$;

create trigger supplier_profile_audit
after insert or update on public.supplier_profiles
for each row execute function public.log_supplier_profile_event();

create trigger supplier_branch_audit
after insert or update or delete on public.supplier_branches
for each row execute function public.log_supplier_profile_event();

create trigger supplier_delivery_audit
after insert or update on public.supplier_delivery_coverage
for each row execute function public.log_supplier_profile_event();

-- ===================================================================
-- Private storage bucket for supplier documents
-- ===================================================================

insert into storage.buckets (id, name, public)
values ('supplier-documents', 'supplier-documents', false)
on conflict (id) do nothing;

create policy "supplier documents storage read" on storage.objects for select
  using (
    bucket_id = 'supplier-documents'
    and (public.is_org_member(((storage.foldername(name))[1])::uuid) or public.is_platform_admin())
  );

create policy "supplier documents storage insert" on storage.objects for insert
  with check (
    bucket_id = 'supplier-documents'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
    and public.is_org_editable(((storage.foldername(name))[1])::uuid)
  );

create policy "supplier documents storage delete" on storage.objects for delete
  using (
    bucket_id = 'supplier-documents'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
    and public.is_org_editable(((storage.foldername(name))[1])::uuid)
  );
