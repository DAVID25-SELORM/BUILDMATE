-- Multi-user customer and supplier organisations with membership-scoped RBAC.
-- Additive/backwards-compatible: organisation_members remains the canonical
-- membership table, but now has a stable id, lifecycle, typed role and audits.

create table public.organisation_permissions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('supplier','customer')),
  key text not null,
  label text not null,
  unique(scope,key)
);

create table public.organisation_roles (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('supplier','customer')),
  key text not null,
  label text not null,
  is_owner boolean not null default false,
  is_system boolean not null default true,
  unique(scope,key)
);

create table public.organisation_role_permissions (
  role_id uuid not null references public.organisation_roles(id) on delete cascade,
  permission_id uuid not null references public.organisation_permissions(id) on delete cascade,
  primary key(role_id,permission_id)
);

alter table public.organisation_members
  add column id uuid default gen_random_uuid(),
  add column role_id uuid references public.organisation_roles(id),
  add column status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  add column invited_by uuid references public.profiles(id),
  add column invited_at timestamptz,
  add column joined_at timestamptz,
  add column suspended_at timestamptz,
  add column removed_at timestamptz,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
alter table public.organisation_members alter column id set not null;
alter table public.organisation_members add constraint organisation_members_id_unique unique(id);
create index idx_organisation_members_user_status on public.organisation_members(user_id,status);
create index idx_organisation_members_org_status on public.organisation_members(organisation_id,status);

create table public.membership_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.organisation_members(id) on delete cascade,
  permission_id uuid not null references public.organisation_permissions(id) on delete cascade,
  granted boolean not null,
  granted_by uuid not null references public.profiles(id),
  reason text not null,
  created_at timestamptz not null default now(),
  unique(membership_id,permission_id)
);

create table public.supplier_warehouses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  branch_id uuid references public.supplier_branches(id) on delete set null,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organisation_id,name)
);

create table public.branch_memberships (
  membership_id uuid not null references public.organisation_members(id) on delete cascade,
  branch_id uuid not null references public.supplier_branches(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key(membership_id,branch_id)
);

create table public.warehouse_memberships (
  membership_id uuid not null references public.organisation_members(id) on delete cascade,
  warehouse_id uuid not null references public.supplier_warehouses(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key(membership_id,warehouse_id)
);

create table public.project_memberships (
  membership_id uuid not null references public.organisation_members(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  approval_limit numeric(14,2) check (approval_limit is null or approval_limit >= 0),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key(membership_id,project_id)
);

create table public.role_change_history (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.organisation_members(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  previous_role_id uuid references public.organisation_roles(id),
  new_role_id uuid references public.organisation_roles(id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.ownership_transfer_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  from_membership_id uuid not null references public.organisation_members(id),
  to_membership_id uuid not null references public.organisation_members(id),
  actor_id uuid not null references public.profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);

insert into public.organisation_permissions(scope,key,label) values
('supplier','supplier.profile.view','View supplier profile'),('supplier','supplier.profile.edit','Edit supplier profile'),
('supplier','supplier.staff.view','View supplier staff'),('supplier','supplier.staff.invite','Invite supplier staff'),('supplier','supplier.staff.manage','Manage supplier staff'),
('supplier','branches.manage','Manage branches'),('supplier','warehouses.manage','Manage warehouses'),
('supplier','products.view','View products'),('supplier','products.create','Create products'),('supplier','products.edit','Edit products'),('supplier','products.publish','Publish products'),
('supplier','inventory.view','View inventory'),('supplier','inventory.adjust','Adjust inventory'),
('supplier','quotations.view','View quotations'),('supplier','quotations.submit','Submit quotations'),
('supplier','orders.view','View orders'),('supplier','orders.accept','Accept orders'),('supplier','orders.reject','Reject orders'),
('supplier','deliveries.view','View deliveries'),('supplier','deliveries.manage','Manage deliveries'),
('supplier','finance.view','View finance'),('supplier','settlements.view','View settlements'),('supplier','settlement_details.manage','Manage settlement details'),('supplier','reports.view','View reports'),
('customer','organisation.view','View organisation'),('customer','organisation.manage','Manage organisation'),
('customer','projects.create','Create projects'),('customer','projects.edit','Edit projects'),
('customer','purchase_requests.create','Create purchase requests'),('customer','purchase_requests.approve','Approve purchase requests'),
('customer','quotations.view','View quotations'),('customer','quotations.accept','Accept quotations'),
('customer','orders.create','Create orders'),('customer','orders.approve','Approve orders'),
('customer','payments.initiate','Initiate payments'),('customer','invoices.view','View invoices'),('customer','reports.view','View reports'),
('customer','staff.invite','Invite organisation staff'),('customer','staff.manage','Manage organisation staff');

insert into public.organisation_roles(scope,key,label,is_owner) values
('supplier','owner','Owner',true),('supplier','administrator','Administrator',false),('supplier','branch_manager','Branch manager',false),
('supplier','sales_officer','Sales officer',false),('supplier','quotation_officer','Quotation officer',false),('supplier','inventory_officer','Inventory officer',false),
('supplier','warehouse_officer','Warehouse officer',false),('supplier','finance_officer','Finance officer',false),('supplier','dispatch_officer','Dispatch officer',false),
('supplier','customer_service_officer','Customer service officer',false),('supplier','viewer','Viewer',false),
('customer','organisation_owner','Organisation owner',true),('customer','procurement_manager','Procurement manager',false),('customer','project_manager','Project manager',false),
('customer','quantity_surveyor','Quantity surveyor',false),('customer','finance_officer','Finance officer',false),('customer','site_supervisor','Site supervisor',false),
('customer','requester','Requester',false),('customer','approver','Approver',false),('customer','viewer','Viewer',false);

-- Owners receive their scope's complete permission catalog.
insert into public.organisation_role_permissions(role_id,permission_id)
select r.id,p.id from public.organisation_roles r join public.organisation_permissions p on p.scope=r.scope where r.is_owner;
-- Administrators manage operations and staff, but finance remains explicit.
insert into public.organisation_role_permissions(role_id,permission_id)
select r.id,p.id from public.organisation_roles r join public.organisation_permissions p on p.scope='supplier'
where r.scope='supplier' and r.key='administrator' and p.key not in ('finance.view','settlements.view','settlement_details.manage');
insert into public.organisation_role_permissions(role_id,permission_id)
select r.id,p.id from public.organisation_roles r join public.organisation_permissions p on p.scope='customer'
where r.scope='customer' and r.key='procurement_manager' and p.key in ('organisation.view','projects.create','projects.edit','purchase_requests.create','purchase_requests.approve','quotations.view','quotations.accept','orders.create','orders.approve','invoices.view','reports.view');

-- Explicit least-privilege role defaults.
with grants(role_key,permission_key) as (values
('branch_manager','supplier.profile.view'),('branch_manager','products.view'),('branch_manager','inventory.view'),('branch_manager','inventory.adjust'),('branch_manager','orders.view'),('branch_manager','orders.accept'),('branch_manager','deliveries.view'),
('sales_officer','products.view'),('sales_officer','quotations.view'),('sales_officer','quotations.submit'),('sales_officer','orders.view'),
('quotation_officer','products.view'),('quotation_officer','quotations.view'),('quotation_officer','quotations.submit'),
('inventory_officer','products.view'),('inventory_officer','products.edit'),('inventory_officer','inventory.view'),('inventory_officer','inventory.adjust'),('inventory_officer','warehouses.manage'),('inventory_officer','reports.view'),
('warehouse_officer','products.view'),('warehouse_officer','inventory.view'),('warehouse_officer','inventory.adjust'),('warehouse_officer','deliveries.view'),
('finance_officer','finance.view'),('finance_officer','settlements.view'),('finance_officer','reports.view'),
('dispatch_officer','orders.view'),('dispatch_officer','deliveries.view'),('dispatch_officer','deliveries.manage'),
('customer_service_officer','supplier.profile.view'),('customer_service_officer','orders.view'),('customer_service_officer','deliveries.view'),
('viewer','supplier.profile.view'),('viewer','products.view'),('viewer','inventory.view'),('viewer','quotations.view'),('viewer','orders.view'),('viewer','deliveries.view')
)
insert into public.organisation_role_permissions(role_id,permission_id)
select r.id,p.id from grants g join public.organisation_roles r on r.scope='supplier' and r.key=g.role_key join public.organisation_permissions p on p.scope='supplier' and p.key=g.permission_key on conflict do nothing;

with grants(role_key,permission_key) as (values
('project_manager','organisation.view'),('project_manager','projects.create'),('project_manager','projects.edit'),('project_manager','purchase_requests.create'),('project_manager','purchase_requests.approve'),('project_manager','quotations.view'),('project_manager','orders.create'),('project_manager','reports.view'),
('quantity_surveyor','organisation.view'),('quantity_surveyor','projects.edit'),('quantity_surveyor','purchase_requests.create'),('quantity_surveyor','quotations.view'),('quantity_surveyor','reports.view'),
('finance_officer','organisation.view'),('finance_officer','purchase_requests.approve'),('finance_officer','orders.approve'),('finance_officer','payments.initiate'),('finance_officer','invoices.view'),('finance_officer','reports.view'),
('site_supervisor','organisation.view'),('site_supervisor','projects.edit'),('site_supervisor','purchase_requests.create'),('site_supervisor','quotations.view'),
('requester','organisation.view'),('requester','purchase_requests.create'),('requester','quotations.view'),
('approver','organisation.view'),('approver','purchase_requests.approve'),('approver','quotations.view'),('approver','quotations.accept'),('approver','orders.approve'),
('viewer','organisation.view'),('viewer','quotations.view'),('viewer','invoices.view')
)
insert into public.organisation_role_permissions(role_id,permission_id)
select r.id,p.id from grants g join public.organisation_roles r on r.scope='customer' and r.key=g.role_key join public.organisation_permissions p on p.scope='customer' and p.key=g.permission_key on conflict do nothing;

-- Backfill existing memberships. The creator/legacy owner remains owner.
update public.organisation_members m set role_id=r.id,
  member_role=case when o.organisation_type='supplier' then (case when m.member_role='owner' then 'owner' else 'administrator' end) else (case when m.member_role='owner' then 'organisation_owner' else 'viewer' end) end,
  status=case when m.is_active then 'active' else 'suspended' end,
  joined_at=coalesce(joined_at,created_at)
from public.organisations o cross join public.organisation_roles r
where o.id=m.organisation_id
  and r.scope=case when o.organisation_type='supplier' then 'supplier' else 'customer' end
  and r.key=case when o.organisation_type='supplier' then (case when m.member_role='owner' then 'owner' else 'administrator' end) else (case when m.member_role='owner' then 'organisation_owner' else 'viewer' end) end;

create or replace function public.organisation_scope(target_org uuid) returns text language sql stable security definer set search_path=public as $$
 select case when organisation_type='supplier' then 'supplier' else 'customer' end from public.organisations where id=target_org;
$$;

create or replace function public.has_permission(target_permission text,target_organisation uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
 select case when auth.uid() is null then false
 when target_organisation is null then
   public.is_super_admin() or exists(
     select 1 from public.platform_staff_memberships m
     join public.platform_roles r on r.id=m.platform_role_id
     join public.platform_role_permissions rp on rp.role_id=r.id
     join public.platform_permissions p on p.id=rp.permission_id
     where m.user_id=auth.uid() and m.status='active' and p.key=target_permission
       and not exists(select 1 from public.platform_staff_permission_overrides x where x.membership_id=m.id and x.permission_id=p.id and not x.granted)
   ) or exists(
     select 1 from public.platform_staff_memberships m join public.platform_staff_permission_overrides x on x.membership_id=m.id
     join public.platform_permissions p on p.id=x.permission_id where m.user_id=auth.uid() and m.status='active' and x.granted and p.key=target_permission
   )
 else exists(
   select 1 from public.organisation_members m
   join public.organisation_roles r on r.id=m.role_id
   join public.organisation_role_permissions rp on rp.role_id=r.id
   join public.organisation_permissions p on p.id=rp.permission_id
   where m.user_id=auth.uid() and m.organisation_id=target_organisation and m.status='active' and m.is_active
     and p.key=target_permission and p.scope=public.organisation_scope(target_organisation)
     and not exists(select 1 from public.membership_permission_overrides x where x.membership_id=m.id and x.permission_id=p.id and not x.granted)
 ) or exists(
   select 1 from public.organisation_members m join public.membership_permission_overrides x on x.membership_id=m.id
   join public.organisation_permissions p on p.id=x.permission_id
   where m.user_id=auth.uid() and m.organisation_id=target_organisation and m.status='active' and m.is_active and x.granted and p.key=target_permission
 ) end;
$$;

create or replace function public.has_supplier_access() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organisation_members m join public.organisations o on o.id=m.organisation_id where m.user_id=auth.uid() and m.status='active' and m.is_active and o.organisation_type='supplier');
$$;
create or replace function public.has_customer_organisation_access() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organisation_members m join public.organisations o on o.id=m.organisation_id where m.user_id=auth.uid() and m.status='active' and m.is_active and o.organisation_type<>'supplier');
$$;

create or replace function public.prevent_final_organisation_owner() returns trigger language plpgsql security definer set search_path=public as $$
declare old_owner boolean; new_owner boolean; active_owners integer;
begin
 select coalesce(is_owner,false) into old_owner from public.organisation_roles where id=old.role_id;
 if tg_op='DELETE' then new_owner:=false; else select coalesce(is_owner,false) into new_owner from public.organisation_roles where id=new.role_id; end if;
 if old_owner and old.status='active' and old.is_active and (tg_op='DELETE' or not(new_owner and new.status='active' and new.is_active)) then
   select count(*) into active_owners from public.organisation_members m join public.organisation_roles r on r.id=m.role_id
   where m.organisation_id=old.organisation_id and m.id<>old.id and m.status='active' and m.is_active and r.is_owner;
   if active_owners=0 then raise exception 'The final active owner cannot be removed, suspended or demoted. Transfer ownership first.'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
create trigger protect_final_organisation_owner before update or delete on public.organisation_members for each row execute function public.prevent_final_organisation_owner();

alter table public.organisation_permissions enable row level security;
alter table public.organisation_roles enable row level security;
alter table public.organisation_role_permissions enable row level security;
alter table public.membership_permission_overrides enable row level security;
alter table public.supplier_warehouses enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.warehouse_memberships enable row level security;
alter table public.project_memberships enable row level security;
alter table public.role_change_history enable row level security;
alter table public.ownership_transfer_history enable row level security;
create policy "authenticated permission catalog read" on public.organisation_permissions for select to authenticated using(true);
create policy "authenticated role catalog read" on public.organisation_roles for select to authenticated using(true);
create policy "authenticated role permission read" on public.organisation_role_permissions for select to authenticated using(true);
create policy "member override read" on public.membership_permission_overrides for select to authenticated using(exists(select 1 from public.organisation_members m where m.id=membership_id and (m.user_id=auth.uid() or public.has_permission(case when public.organisation_scope(m.organisation_id)='supplier' then 'supplier.staff.view' else 'staff.manage' end,m.organisation_id))));
create policy "supplier warehouse member read" on public.supplier_warehouses for select to authenticated using(public.has_permission('inventory.view',organisation_id) or public.has_permission('warehouses.manage',organisation_id));
create policy "branch assignment member read" on public.branch_memberships for select to authenticated using(exists(select 1 from public.organisation_members m where m.id=membership_id and (m.user_id=auth.uid() or public.has_permission('supplier.staff.view',m.organisation_id))));
create policy "warehouse assignment member read" on public.warehouse_memberships for select to authenticated using(exists(select 1 from public.organisation_members m where m.id=membership_id and (m.user_id=auth.uid() or public.has_permission('supplier.staff.view',m.organisation_id))));
create policy "project assignment member read" on public.project_memberships for select to authenticated using(exists(select 1 from public.organisation_members m where m.id=membership_id and (m.user_id=auth.uid() or public.has_permission('staff.manage',m.organisation_id))));
create policy "role history manager read" on public.role_change_history for select to authenticated using(public.has_permission(case when public.organisation_scope(organisation_id)='supplier' then 'supplier.staff.view' else 'staff.manage' end,organisation_id));
create policy "ownership history manager read" on public.ownership_transfer_history for select to authenticated using(public.has_permission(case when public.organisation_scope(organisation_id)='supplier' then 'supplier.staff.view' else 'staff.manage' end,organisation_id));
revoke insert,update,delete on public.organisation_permissions,public.organisation_roles,public.organisation_role_permissions,public.membership_permission_overrides,public.branch_memberships,public.warehouse_memberships,public.project_memberships,public.role_change_history,public.ownership_transfer_history from anon,authenticated;
grant execute on function public.has_supplier_access(),public.has_customer_organisation_access() to authenticated;
