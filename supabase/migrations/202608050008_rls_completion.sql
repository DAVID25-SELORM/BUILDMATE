-- Phase 10: close remaining RLS gaps and make sensitive tables force RLS.
create policy "address owner read" on public.addresses for select using(user_id=auth.uid() or public.is_org_member(organisation_id));
create policy "address owner insert" on public.addresses for insert with check(user_id=auth.uid() or public.is_org_member(organisation_id));
create policy "address owner update" on public.addresses for update using(user_id=auth.uid() or public.is_org_member(organisation_id)) with check(user_id=auth.uid() or public.is_org_member(organisation_id));
create policy "address owner delete" on public.addresses for delete using(user_id=auth.uid() or public.is_org_member(organisation_id));
create policy "organisation member rows read" on public.organisation_members for select using(user_id=auth.uid() or public.is_org_member(organisation_id) or public.is_platform_admin());
create policy "public reviews read" on public.reviews for select using(true);
create policy "admin audit read" on public.audit_logs for select using(public.is_platform_admin());

-- Profile owners may edit contact fields, but role changes remain blocked by the
-- auth-hardening trigger. Admin visibility is needed for operational tooling.
create policy "admin profile read" on public.profiles for select using(public.is_platform_admin());

-- Quote items are mutable only while their owner-controlled request is a draft/open request.
create policy "requester update request items" on public.quote_request_items for update using(exists(select 1 from public.quote_requests r where r.id=quote_request_id and r.requester_id=auth.uid() and r.status in('draft','open'))) with check(exists(select 1 from public.quote_requests r where r.id=quote_request_id and r.requester_id=auth.uid() and r.status in('draft','open')));
create policy "requester delete request items" on public.quote_request_items for delete using(exists(select 1 from public.quote_requests r where r.id=quote_request_id and r.requester_id=auth.uid() and r.status in('draft','open')));
drop policy if exists "customer review create" on public.reviews;
create policy "review order participants insert" on public.reviews for insert with check(reviewer_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid() and o.supplier_id=reviews.supplier_id and o.status in('delivered','customer_confirmation_pending','completed')));

alter table public.supplier_settlement_details force row level security;
alter table public.payments force row level security;
alter table public.payment_events force row level security;
alter table public.supplier_ledger_entries force row level security;
alter table public.reconciliation_runs force row level security;
alter table public.deliveries force row level security;
alter table public.notification_outbox force row level security;
alter table public.audit_logs force row level security;

-- Service-owned tables cannot be written directly by normal API roles.
revoke insert,update,delete on public.payments,public.payment_events,public.supplier_ledger_entries,public.notification_outbox,public.audit_logs from anon,authenticated;
revoke insert,update,delete on public.orders,public.order_items,public.deliveries from anon,authenticated;
revoke select on public.audit_logs,public.payment_events,public.reconciliation_runs from anon;
