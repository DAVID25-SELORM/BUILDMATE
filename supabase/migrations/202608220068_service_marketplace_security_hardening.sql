-- Close direct-write paths around provider verification and service lifecycles.
begin;

drop policy if exists "provider profile owner update" on public.service_provider_profiles;
drop policy if exists "service request provider update" on public.service_requests;
drop policy if exists "provider documents private" on public.service_provider_documents;

create policy "provider documents read" on public.service_provider_documents for select to authenticated
using(public.provider_can_manage(provider_id));
create policy "provider documents submit" on public.service_provider_documents for insert to authenticated
with check(public.provider_can_manage(provider_id) and status='pending' and reviewed_by is null and reviewed_at is null and review_note is null);
create policy "provider pending documents delete" on public.service_provider_documents for delete to authenticated
using(public.provider_can_manage(provider_id) and status='pending');

alter table public.service_requests drop constraint if exists service_requests_budget_nonnegative;
alter table public.service_requests add constraint service_requests_budget_nonnegative check(budget is null or budget>=0);
alter table public.service_provider_categories drop constraint if exists service_provider_categories_price_nonnegative;
alter table public.service_provider_categories add constraint service_provider_categories_price_nonnegative check(base_price is null or base_price>=0);

create or replace function public.update_service_provider_profile(target_provider uuid,target_display_name text,target_bio text,target_phone text,target_region text,target_city text,target_radius numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not provider_can_manage(target_provider) then raise exception 'Provider profile permission required';end if;
 if length(trim(target_display_name))<2 or length(trim(target_bio))<20 or length(trim(target_region))<2 or target_radius is not null and target_radius<0 then raise exception 'Complete the provider profile details';end if;
 update service_provider_profiles set display_name=trim(target_display_name),bio=trim(target_bio),phone=nullif(trim(target_phone),''),region=trim(target_region),city=nullif(trim(target_city),''),service_radius_km=target_radius,verification_status=case when verification_status='approved' then 'under_review' else verification_status end,updated_at=now() where id=target_provider;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'service_provider',target_provider::text,'SERVICE_PROVIDER_PROFILE_UPDATED',jsonb_build_object('verification_reopened',true));
end;$$;

create or replace function public.admin_review_service_provider(target_provider uuid,target_status text,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare p service_provider_profiles;
begin
 if not is_platform_admin() then raise exception 'Platform administrator required';end if;
 if target_status not in('approved','information_required','rejected','suspended') or length(trim(coalesce(target_reason,'')))<5 then raise exception 'Choose a decision and provide a detailed reason';end if;
 select * into p from service_provider_profiles where id=target_provider for update;
 if p.id is null then raise exception 'Provider not found';end if;
 update service_provider_profiles set verification_status=target_status,account_status=case when target_status='suspended' then 'suspended' else 'active' end,updated_at=now() where id=p.id;
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'service_provider',p.id::text,'SERVICE_PROVIDER_REVIEWED',jsonb_build_object('verification_status',p.verification_status,'account_status',p.account_status),jsonb_build_object('verification_status',target_status,'reason',trim(target_reason)));
 perform enqueue_user_notification(p.user_id,'service_provider_reviewed',jsonb_build_object('provider_id',p.id,'status',target_status,'reason',trim(target_reason)));
end;$$;

create or replace function public.admin_review_service_provider_document(target_document uuid,target_status text,target_note text)
returns void language plpgsql security definer set search_path=public as $$
declare d service_provider_documents;
begin
 if not is_platform_admin() then raise exception 'Platform administrator required';end if;
 if target_status not in('approved','rejected') or length(trim(coalesce(target_note,'')))<5 then raise exception 'Choose a decision and provide a review note';end if;
 select * into d from service_provider_documents where id=target_document for update;
 if d.id is null then raise exception 'Provider document not found';end if;
 update service_provider_documents set status=target_status,review_note=trim(target_note),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'service_provider_document',d.id::text,'SERVICE_PROVIDER_DOCUMENT_REVIEWED',jsonb_build_object('status',d.status),jsonb_build_object('status',target_status,'note',trim(target_note)));
end;$$;

revoke all on function public.update_service_provider_profile(uuid,text,text,text,text,text,numeric),public.admin_review_service_provider(uuid,text,text),public.admin_review_service_provider_document(uuid,text,text) from public,anon;
grant execute on function public.update_service_provider_profile(uuid,text,text,text,text,text,numeric),public.admin_review_service_provider(uuid,text,text),public.admin_review_service_provider_document(uuid,text,text) to authenticated;

commit;
