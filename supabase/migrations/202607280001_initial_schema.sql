create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer','contractor','supplier','driver','professional','admin','super_admin');
create type public.verification_status as enum ('pending','under_review','verified','rejected','suspended');
create type public.stock_status as enum ('in_stock','low_stock','out_of_stock','confirmation_required','available_on_order');
create type public.order_status as enum ('draft','awaiting_payment','paid','awaiting_supplier_confirmation','confirmed','preparing','ready_for_dispatch','driver_assigned','picked_up','in_transit','partially_delivered','delivered','customer_confirmation_pending','completed','return_requested','disputed','refunded','cancelled');
create type public.quote_status as enum ('draft','open','responded','accepted','rejected','expired','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.user_role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation_type text not null check (organisation_type in ('contractor','supplier','developer','institution','transport_provider')),
  registration_number text,
  tax_id text,
  verification_status public.verification_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid references public.organisations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  member_role text not null,
  is_active boolean not null default true,
  primary key (organisation_id,user_id)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  label text,
  region text,
  city text,
  area text,
  digital_address text,
  latitude numeric,
  longitude numeric,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  brand_id uuid references public.brands(id),
  name text not null,
  slug text not null unique,
  description text,
  base_unit text not null,
  specifications jsonb not null default '{}'::jsonb,
  images text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_listings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.organisations(id),
  product_id uuid not null references public.products(id),
  sku text,
  price numeric(14,2) not null check (price >= 0),
  wholesale_price numeric(14,2),
  wholesale_minimum numeric,
  stock_quantity numeric,
  stock_status public.stock_status not null default 'confirmation_required',
  lead_time_days integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id,product_id,sku)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  organisation_id uuid references public.organisations(id),
  name text not null,
  description text,
  location_address text,
  budget numeric(14,2),
  status text not null default 'active',
  start_date date,
  target_date date,
  created_at timestamptz not null default now()
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  project_id uuid references public.projects(id),
  title text not null,
  delivery_location text not null,
  required_date date,
  notes text,
  attachment_urls text[] not null default '{}',
  status public.quote_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.quote_request_items (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  specifications jsonb not null default '{}'::jsonb
);

create table public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id),
  supplier_id uuid not null references public.organisations(id),
  subtotal numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (subtotal + delivery_fee) stored,
  valid_until date,
  delivery_days integer,
  notes text,
  status public.quote_status not null default 'responded',
  created_at timestamptz not null default now(),
  unique (quote_request_id,supplier_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles(id),
  project_id uuid references public.projects(id),
  supplier_id uuid not null references public.organisations(id),
  quote_id uuid references public.supplier_quotes(id),
  status public.order_status not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null default 0,
  service_fee numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (subtotal + delivery_fee + service_fee) stored,
  delivery_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid references public.supplier_listings(id),
  product_name_snapshot text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) generated always as (quantity * unit_price) stored
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_reference text unique,
  amount numeric(14,2) not null,
  currency text not null default 'GHS',
  status text not null default 'pending',
  payment_method text,
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  driver_id uuid references public.profiles(id),
  vehicle_registration text,
  status text not null default 'pending_assignment',
  pickup_location text,
  delivery_location text not null,
  otp_hash text,
  proof_urls text[] not null default '{}',
  recipient_name text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  reviewer_id uuid not null references public.profiles(id),
  supplier_id uuid not null references public.organisations(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(order_id,reviewer_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_products_category on public.products(category_id);
create index idx_listings_supplier on public.supplier_listings(supplier_id,is_active);
create index idx_listings_product on public.supplier_listings(product_id,is_active);
create index idx_projects_owner on public.projects(owner_id);
create index idx_quotes_requester on public.quote_requests(requester_id,created_at desc);
create index idx_orders_customer on public.orders(customer_id,created_at desc);
create index idx_orders_supplier on public.orders(supplier_id,created_at desc);
create index idx_payments_order on public.payments(order_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id,full_name,phone,role)
  values (new.id,coalesce(new.raw_user_meta_data->>'full_name','New user'),new.raw_user_meta_data->>'phone',coalesce((new.raw_user_meta_data->>'role')::public.user_role,'customer'));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.supplier_listings enable row level security;
alter table public.projects enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_request_items enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_logs enable row level security;

create policy "public catalogue categories" on public.categories for select using (is_active);
create policy "public catalogue brands" on public.brands for select using (is_active);
create policy "public catalogue products" on public.products for select using (is_active);
create policy "public active listings" on public.supplier_listings for select using (is_active);
create policy "profile owner read" on public.profiles for select using (auth.uid()=id);
create policy "profile owner update" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "project owner access" on public.projects for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "quote requester access" on public.quote_requests for all using (auth.uid()=requester_id) with check (auth.uid()=requester_id);
create policy "customer order read" on public.orders for select using (auth.uid()=customer_id);
create policy "customer review create" on public.reviews for insert with check (auth.uid()=reviewer_id);

-- Supplier and admin policies should be completed using organisation membership and a hardened
-- server-side authorisation function before production. Never expose service-role credentials to the browser.
