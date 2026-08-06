-- RBAC Phase 1 (1/3): generalized permission engine, platform role/permission
-- catalog. Additive only — does not touch profiles.role, organisation_members,
-- or the existing admin_permissions/admin_has_permission() system, which keeps
-- gating its existing RPCs unchanged during the transition.

create table public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('super_admin','operations_admin','customer_support_admin','supplier_verification_admin','finance_admin','catalogue_admin','logistics_admin','reports_admin','audit_viewer','platform_viewer')),
  label text not null,
  created_at timestamptz not null default now()
);

create table public.platform_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('platform.users.view','platform.users.invite','platform.users.manage_roles','customers.view','customers.suspend','suppliers.view','suppliers.verify','suppliers.suspend','catalogue.manage','orders.manage','deliveries.manage','payments.view','refunds.process','settlements.view','settlements.release','reports.view','audit_logs.view')),
  label text not null,
  created_at timestamptz not null default now()
);

create table public.platform_role_permissions (
  role_id uuid not null references public.platform_roles(id) on delete cascade,
  permission_id uuid not null references public.platform_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table public.platform_roles enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;

create policy "platform roles readable by authenticated" on public.platform_roles for select using (auth.uid() is not null);
create policy "platform permissions readable by authenticated" on public.platform_permissions for select using (auth.uid() is not null);
create policy "platform role permissions readable by authenticated" on public.platform_role_permissions for select using (auth.uid() is not null);
revoke insert,update,delete on public.platform_roles,public.platform_permissions,public.platform_role_permissions from anon,authenticated;

insert into public.platform_roles (key,label) values
 ('super_admin','Super Administrator'),('operations_admin','Operations Administrator'),('customer_support_admin','Customer Support Administrator'),
 ('supplier_verification_admin','Supplier Verification Administrator'),('finance_admin','Finance Administrator'),('catalogue_admin','Catalogue Administrator'),
 ('logistics_admin','Logistics Administrator'),('reports_admin','Reports Administrator'),('audit_viewer','Audit Viewer'),('platform_viewer','Platform Viewer');

insert into public.platform_permissions (key,label) values
 ('platform.users.view','View platform staff'),('platform.users.invite','Invite platform staff'),('platform.users.manage_roles','Manage platform staff roles and status'),
 ('customers.view','View customers'),('customers.suspend','Suspend customers'),('suppliers.view','View suppliers'),('suppliers.verify','Verify suppliers'),
 ('suppliers.suspend','Suspend suppliers'),('catalogue.manage','Manage catalogue'),('orders.manage','Manage orders'),('deliveries.manage','Manage deliveries'),
 ('payments.view','View payments'),('refunds.process','Process refunds'),('settlements.view','View settlements'),('settlements.release','Release settlements'),
 ('reports.view','View reports'),('audit_logs.view','View audit logs');

-- Default role -> permission grants. super_admin gets every permission (replacing
-- the old role='super_admin' bypass with an explicit, auditable grant set).
insert into public.platform_role_permissions (role_id,permission_id)
select r.id, p.id from public.platform_roles r cross join public.platform_permissions p where r.key='super_admin';

insert into public.platform_role_permissions (role_id,permission_id)
select r.id, p.id from public.platform_roles r join public.platform_permissions p on p.key=any(case r.key
  when 'operations_admin' then array['catalogue.manage','orders.manage','deliveries.manage','reports.view']
  when 'customer_support_admin' then array['platform.users.view','customers.view','customers.suspend','reports.view']
  when 'supplier_verification_admin' then array['platform.users.view','suppliers.view','suppliers.verify','suppliers.suspend','reports.view']
  when 'finance_admin' then array['payments.view','refunds.process','settlements.view','settlements.release','reports.view']
  when 'catalogue_admin' then array['catalogue.manage','reports.view']
  when 'logistics_admin' then array['deliveries.manage','reports.view']
  when 'reports_admin' then array['reports.view']
  when 'audit_viewer' then array['audit_logs.view','reports.view']
  when 'platform_viewer' then array['platform.users.view','customers.view','suppliers.view','reports.view']
  else array[]::text[] end)
where r.key <> 'super_admin';

-- has_permission() is defined in the next migration (202608060031), once
-- platform_staff_memberships/platform_staff_permission_overrides exist.
