-- Raw settlement credentials are owner/finance-only. Other supplier administrators receive masked values through a shaped RPC.
drop policy if exists "settlement read" on public.supplier_settlement_details;
create policy "settlement owner or finance read" on public.supplier_settlement_details for select to authenticated
using(public.is_org_owner_or_finance(organisation_id) or public.admin_has_permission('finance'));

create or replace function public.admin_masked_supplier_settlement(target_supplier uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not(public.admin_has_permission('supplier_verification') or public.admin_has_permission('finance')) then raise exception 'Not authorised'; end if;
 select jsonb_build_object('configured',true,'method',settlement_method,'bank_name',bank_name,'account_name',account_name,'account_number_masked',case when account_number is null then null else repeat('•',greatest(length(account_number)-4,0))||right(account_number,4) end,'momo_network',momo_network,'momo_account_name',momo_account_name,'momo_number_masked',case when momo_number is null then null else repeat('•',greatest(length(momo_number)-4,0))||right(momo_number,4) end) into result from supplier_settlement_details where organisation_id=target_supplier;
 return coalesce(result,jsonb_build_object('configured',false));
end;$$;
revoke all on function public.admin_masked_supplier_settlement(uuid) from public,anon;
grant execute on function public.admin_masked_supplier_settlement(uuid) to authenticated;
