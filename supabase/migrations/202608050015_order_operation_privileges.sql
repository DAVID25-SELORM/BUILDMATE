-- Remove PostgreSQL's default PUBLIC execute grant from operational RPCs.
revoke all on function public.supplier_progress_order(uuid,public.order_status) from public,anon;
revoke all on function public.customer_cancel_order(uuid) from public,anon;
revoke all on function public.customer_confirm_delivery(uuid) from public,anon;
revoke all on function public.customer_open_dispute(uuid,text) from public,anon;
revoke all on function public.admin_resolve_dispute(uuid,text,text,text) from public,anon;

grant execute on function public.supplier_progress_order(uuid,public.order_status) to authenticated;
grant execute on function public.customer_cancel_order(uuid) to authenticated;
grant execute on function public.customer_confirm_delivery(uuid) to authenticated;
grant execute on function public.customer_open_dispute(uuid,text) to authenticated;
grant execute on function public.admin_resolve_dispute(uuid,text,text,text) to authenticated;
