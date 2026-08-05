-- Phase 4: RFQ requests, supplier responses and comparison.

create table if not exists public.supplier_quote_items (
  id uuid primary key default gen_random_uuid(),
  supplier_quote_id uuid not null references public.supplier_quotes(id) on delete cascade,
  quote_request_item_id uuid not null references public.quote_request_items(id),
  description_snapshot text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  unique (supplier_quote_id, quote_request_item_id)
);

alter table public.supplier_quote_items enable row level security;

drop policy if exists "supplier read open rfqs" on public.quote_requests;
create policy "supplier read open rfqs" on public.quote_requests for select using (
  status = 'open' and exists (
    select 1 from public.organisation_members m join public.organisations o on o.id = m.organisation_id
    where m.user_id = auth.uid() and m.is_active and o.organisation_type = 'supplier' and o.verification_status = 'approved'
  )
);

drop policy if exists "request items participant read" on public.quote_request_items;
create policy "request items participant read" on public.quote_request_items for select using (
  exists (select 1 from public.quote_requests r where r.id = quote_request_id and (
    r.requester_id = auth.uid() or (r.status = 'open' and exists (
      select 1 from public.organisation_members m join public.organisations o on o.id = m.organisation_id
      where m.user_id = auth.uid() and m.is_active and o.organisation_type = 'supplier' and o.verification_status = 'approved'
    ))
  ))
);
drop policy if exists "requester insert request items" on public.quote_request_items;
create policy "requester insert request items" on public.quote_request_items for insert with check (
  exists (select 1 from public.quote_requests r where r.id = quote_request_id and r.requester_id = auth.uid() and r.status = 'open')
);

drop policy if exists "quote participant read" on public.supplier_quotes;
create policy "quote participant read" on public.supplier_quotes for select using (
  public.is_org_member(supplier_id) or exists (
    select 1 from public.quote_requests r where r.id = quote_request_id and r.requester_id = auth.uid()
  ) or public.is_platform_admin()
);
drop policy if exists "supplier create quote" on public.supplier_quotes;
create policy "supplier create quote" on public.supplier_quotes for insert with check (public.is_org_member(supplier_id));
drop policy if exists "supplier update quote" on public.supplier_quotes;
create policy "supplier update quote" on public.supplier_quotes for update
  using (public.is_org_member(supplier_id)) with check (public.is_org_member(supplier_id));

create policy "quote item participant read" on public.supplier_quote_items for select using (
  exists (select 1 from public.supplier_quotes q join public.quote_requests r on r.id = q.quote_request_id
    where q.id = supplier_quote_id and (public.is_org_member(q.supplier_id) or r.requester_id = auth.uid() or public.is_platform_admin()))
);
create policy "supplier create quote items" on public.supplier_quote_items for insert with check (
  exists (select 1 from public.supplier_quotes q where q.id = supplier_quote_id and public.is_org_member(q.supplier_id))
);
create policy "supplier update quote items" on public.supplier_quote_items for update
  using (exists (select 1 from public.supplier_quotes q where q.id = supplier_quote_id and public.is_org_member(q.supplier_id)))
  with check (exists (select 1 from public.supplier_quotes q where q.id = supplier_quote_id and public.is_org_member(q.supplier_id)));
create policy "supplier delete quote items" on public.supplier_quote_items for delete using (
  exists (select 1 from public.supplier_quotes q where q.id = supplier_quote_id and public.is_org_member(q.supplier_id))
);

create index if not exists idx_quote_items_request on public.quote_request_items(quote_request_id);
create index if not exists idx_supplier_quotes_request on public.supplier_quotes(quote_request_id, created_at desc);
create index if not exists idx_supplier_quote_items_quote on public.supplier_quote_items(supplier_quote_id);
