-- Complete the COD supplier fulfilment workflow after 202608180064.
begin;

alter table public.order_cash_payments add column if not exists reference text;

-- Marketplace COD orders created before the COD checkout migration used the
-- online-payment state. Quote-created orders are deliberately excluded.
update public.orders
set status='awaiting_supplier_confirmation',updated_at=now()
where status='awaiting_payment' and quote_id is null
  and payment_method in('cash_on_delivery','cash_on_pickup');

insert into public.order_events(order_id,event_type,note)
select o.id,'submitted','Migrated legacy marketplace COD order to supplier confirmation'
from public.orders o
where o.status='awaiting_supplier_confirmation' and o.quote_id is null
and not exists(select 1 from public.order_events e where e.order_id=o.id and e.event_type='submitted');

create or replace function public.supplier_acknowledge_order(target_order uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not has_permission('orders.accept',o.supplier_id) then raise exception 'Order management permission required';end if;
 if o.status<>'awaiting_supplier_confirmation' then raise exception 'Order is not awaiting acknowledgement';end if;
 if o.supplier_received_at is null then
  update orders set supplier_received_at=now(),supplier_received_by=auth.uid(),updated_at=now() where id=o.id;
  insert into order_events(order_id,event_type,actor_id) values(o.id,'received_by_supplier',auth.uid());
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'order',o.id::text,'ORDER_ACKNOWLEDGED',jsonb_build_object('order_number',o.order_number,'supplier_id',o.supplier_id));
  perform enqueue_user_notification(o.customer_id,'order_status_changed',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status','received_by_supplier'));
 end if;
end;$$;

create or replace function public.supplier_progress_order(target_order uuid,new_status public.order_status)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;event_name text;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not has_permission('orders.accept',o.supplier_id) then raise exception 'Order not found or supplier acceptance is restricted';end if;
 if new_status='confirmed' and o.supplier_received_at is null then raise exception 'Acknowledge the order before accepting it';end if;
 if not((o.status='awaiting_supplier_confirmation' and new_status='confirmed')or(o.status='confirmed' and new_status='preparing')or(o.status='preparing' and new_status='ready_for_dispatch')) then raise exception 'Invalid order transition';end if;
 update orders set status=new_status,updated_at=now() where id=o.id;
 event_name:=case when new_status='ready_for_dispatch' and o.fulfilment_method='pickup' then 'ready_for_pickup' else new_status::text end;
 insert into order_events(order_id,event_type,actor_id) values(o.id,event_name,auth.uid());
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'order',o.id::text,'ORDER_STATUS_CHANGED',jsonb_build_object('status',o.status),jsonb_build_object('status',new_status,'event',event_name));
 if new_status='ready_for_dispatch' and o.fulfilment_method='delivery' then
  insert into deliveries(order_id,status,delivery_location) values(o.id,'pending_assignment',o.delivery_address) on conflict(order_id) do nothing;
 end if;
 perform enqueue_user_notification(o.customer_id,'order_status_changed',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status',event_name));
end;$$;

create or replace function public.supplier_reject_order(target_order uuid,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not has_permission('orders.accept',o.supplier_id) then raise exception 'Order unavailable';end if;
 if o.status<>'awaiting_supplier_confirmation' or o.supplier_received_at is null or length(trim(coalesce(target_reason,'')))<5 then raise exception 'Acknowledge the order and provide a detailed rejection reason';end if;
 update orders set status='cancelled',rejection_reason=trim(target_reason),updated_at=now() where id=o.id;
 insert into order_events(order_id,event_type,actor_id,note) values(o.id,'rejected',auth.uid(),trim(target_reason));
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'order',o.id::text,'ORDER_REJECTED',jsonb_build_object('status',o.status),jsonb_build_object('status','cancelled','reason',trim(target_reason)));
 perform enqueue_user_notification(o.customer_id,'order_status_changed',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status','rejected','reason',trim(target_reason)));
end;$$;

create or replace function public.supplier_record_cash_payment(target_order uuid,target_reference text default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;inserted_count integer:=0;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not has_permission('finance.view',o.supplier_id) then raise exception 'Finance permission required';end if;
 if o.payment_method not in('cash_on_delivery','cash_on_pickup') or o.status not in('customer_confirmation_pending','delivered') then raise exception 'Cash can only be recorded after fulfilment';end if;
 insert into order_cash_payments(order_id,amount,method,recorded_by,reference) values(o.id,o.total,o.payment_method,auth.uid(),nullif(trim(coalesce(target_reference,'')),'')) on conflict(order_id) do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count>0 then
  insert into order_events(order_id,event_type,actor_id,note) values(o.id,'cash_payment_recorded',auth.uid(),'Customer confirmation pending');
  insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'order',o.id::text,'CASH_PAYMENT_RECORDED',jsonb_build_object('amount',o.total,'method',o.payment_method,'reference',nullif(trim(coalesce(target_reference,'')),'')));
 end if;
end;$$;

create or replace function public.supplier_complete_pickup(target_order uuid,target_reference text default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not has_permission('orders.accept',o.supplier_id) or not has_permission('finance.view',o.supplier_id) then raise exception 'Order and finance permissions are required';end if;
 if o.fulfilment_method<>'pickup' or o.status<>'ready_for_dispatch' then raise exception 'Pickup order is not ready for handover';end if;
 update orders set status='customer_confirmation_pending',updated_at=now() where id=o.id;
 insert into order_events(order_id,event_type,actor_id) values(o.id,'picked_up',auth.uid());
 perform supplier_record_cash_payment(o.id,target_reference);
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'order',o.id::text,'PICKUP_HANDED_OVER',jsonb_build_object('payment_method',o.payment_method,'customer_confirmation_pending',true));
 perform enqueue_user_notification(o.customer_id,'order_status_changed',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status','customer_confirmation_pending'));
end;$$;

-- Delivery code remains canonical; this observer only records customer-visible
-- milestones and notifications when that workflow changes the order.
create or replace function public.record_delivery_order_milestone()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.status is distinct from new.status and new.status in('driver_assigned','picked_up','in_transit','partially_delivered','customer_confirmation_pending') then
  if not exists(select 1 from order_events where order_id=new.id and event_type=new.status::text) then
   insert into order_events(order_id,event_type,actor_id) values(new.id,new.status::text,auth.uid());
  end if;
  perform enqueue_user_notification(new.customer_id,'order_status_changed',jsonb_build_object('order_id',new.id,'order_number',new.order_number,'status',new.status));
 end if;
 return new;
end;$$;
drop trigger if exists order_delivery_milestone on public.orders;
create trigger order_delivery_milestone after update of status on public.orders for each row execute function public.record_delivery_order_milestone();

create or replace function public.customer_confirm_delivery(target_order uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not customer_can_read_order(o) or o.status<>'customer_confirmation_pending' then raise exception 'Order is not awaiting confirmation';end if;
 if o.payment_method in('cash_on_delivery','cash_on_pickup') and not exists(select 1 from order_cash_payments where order_id=o.id) then raise exception 'Ask the supplier or driver to record the cash payment before confirming completion';end if;
 update order_cash_payments set customer_confirmed_at=now(),customer_confirmed_by=auth.uid() where order_id=o.id;
 update orders set status='completed',updated_at=now() where id=o.id;
 insert into order_events(order_id,event_type,actor_id) values(o.id,'completed',auth.uid());
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'order',o.id::text,'CUSTOMER_RECEIPT_CONFIRMED',jsonb_build_object('status',o.status),jsonb_build_object('status','completed','payment_confirmed',true));
end;$$;

create or replace function public.customer_cancel_order(target_order uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=target_order for update;
 if o.id is null or not customer_can_read_order(o) or o.status not in('awaiting_payment','awaiting_supplier_confirmation') then raise exception 'Order cannot be cancelled';end if;
 update orders set status='cancelled',updated_at=now() where id=o.id;
 insert into order_events(order_id,event_type,actor_id,note) values(o.id,'cancelled',auth.uid(),'Cancelled by customer');
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'order',o.id::text,'ORDER_CANCELLED_BY_CUSTOMER',jsonb_build_object('status',o.status),jsonb_build_object('status','cancelled'));
end;$$;

revoke all on function public.supplier_record_cash_payment(uuid) from public,anon,authenticated;
drop function if exists public.supplier_record_cash_payment(uuid);
revoke all on function public.record_delivery_order_milestone() from public,anon,authenticated;
revoke all on function public.supplier_acknowledge_order(uuid),public.supplier_progress_order(uuid,public.order_status),public.supplier_reject_order(uuid,text),public.supplier_record_cash_payment(uuid,text),public.supplier_complete_pickup(uuid,text),public.customer_confirm_delivery(uuid),public.customer_cancel_order(uuid) from public,anon;
grant execute on function public.supplier_acknowledge_order(uuid),public.supplier_progress_order(uuid,public.order_status),public.supplier_reject_order(uuid,text),public.supplier_record_cash_payment(uuid,text),public.supplier_complete_pickup(uuid,text),public.customer_confirm_delivery(uuid),public.customer_cancel_order(uuid) to authenticated;

commit;
