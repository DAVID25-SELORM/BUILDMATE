-- Phase 5: atomic quote acceptance and immutable order snapshots.
create sequence if not exists public.order_number_seq;
create policy "order supplier read" on public.orders for select using (public.is_org_member(supplier_id));
create policy "order admin read" on public.orders for select using (public.is_platform_admin());
create policy "order items participant read" on public.order_items for select using (exists (select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_org_member(o.supplier_id) or public.is_platform_admin())));
create or replace function public.accept_supplier_quote(target_quote uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare q public.supplier_quotes; r public.quote_requests; new_order uuid; snapshot_name text;
begin
 select * into q from public.supplier_quotes where id=target_quote for update;
 if q.id is null or q.status<>'responded' then raise exception 'Quotation is unavailable'; end if;
 select * into r from public.quote_requests where id=q.quote_request_id for update;
 if r.requester_id<>auth.uid() then raise exception 'Not authorised'; end if;
 if r.status<>'open' then raise exception 'Request is no longer open'; end if;
 select string_agg(description,'; ' order by id) into snapshot_name from public.quote_request_items where quote_request_id=r.id;
 insert into public.orders(order_number,customer_id,project_id,supplier_id,quote_id,status,subtotal,delivery_fee,delivery_address)
 values('BM-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.order_number_seq')::text,6,'0'),auth.uid(),r.project_id,q.supplier_id,q.id,'awaiting_payment',q.subtotal,q.delivery_fee,r.delivery_location) returning id into new_order;
 insert into public.order_items(order_id,product_name_snapshot,quantity,unit,unit_price) values(new_order,coalesce(snapshot_name,r.title),1,'quotation',q.subtotal);
 update public.supplier_quotes set status=case when id=q.id then 'accepted'::public.quote_status else 'rejected'::public.quote_status end where quote_request_id=r.id;
 update public.quote_requests set status='accepted' where id=r.id;
 insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'order',new_order::text,'created_from_quote',jsonb_build_object('quote_id',q.id));
 return new_order;
end; $$;
grant execute on function public.accept_supplier_quote(uuid) to authenticated;
