-- Run after migrations. Raises if any public table lacks RLS or if critical
-- service functions are executable by ordinary API roles.
do $$ declare missing text; begin
 select string_agg(schemaname||'.'||tablename,', ') into missing from pg_tables where schemaname='public' and not rowsecurity;
 if missing is not null then raise exception 'Tables without RLS: %',missing; end if;
 if has_function_privilege('authenticated','public.record_verified_payment(text,text,text,text,numeric,jsonb)','execute') then raise exception 'authenticated can finalize payments';end if;
 if has_table_privilege('authenticated','public.payment_events','insert') then raise exception 'authenticated can insert payment events';end if;
 if has_table_privilege('anon','public.audit_logs','select') then raise exception 'anon can read audit logs';end if;
 if has_function_privilege('anon','public.supplier_progress_order(uuid,public.order_status)','execute') then raise exception 'anon can progress orders';end if;
 if has_function_privilege('anon','public.customer_cancel_order(uuid)','execute') then raise exception 'anon can invoke customer order cancellation';end if;
 if has_function_privilege('anon','public.admin_resolve_dispute(uuid,text,text,text)','execute') then raise exception 'anon can invoke dispute resolution';end if;
 if has_table_privilege('anon','public.admin_internal_notes','select') then raise exception 'anon can read internal notes';end if;
 if has_table_privilege('authenticated','public.admin_internal_notes','insert') then raise exception 'authenticated can insert internal notes directly';end if;
 if has_table_privilege('authenticated','public.supplier_performance_metrics','update') then raise exception 'authenticated can overwrite performance scores';end if;
 if has_function_privilege('anon','public.start_support_view(text,uuid,text)','execute') then raise exception 'anon can start support preview';end if;
 if has_function_privilege('anon','public.admin_set_settlement_hold(uuid,boolean,text)','execute') then raise exception 'anon can hold settlements';end if;
 if has_function_privilege('anon','public.admin_masked_supplier_settlement(uuid)','execute') then raise exception 'anon can request masked settlement data';end if;
end $$;

select tablename,count(*) as policy_count from pg_policies where schemaname='public' group by tablename order by tablename;
