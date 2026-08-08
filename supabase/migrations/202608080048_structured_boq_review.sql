create table public.procurement_upload_items(
 id uuid primary key default gen_random_uuid(),upload_id uuid not null references public.project_procurement_uploads(id)on delete cascade,
 source_sheet text not null,source_row integer not null check(source_row>0),description text not null check(char_length(description)between 2 and 500),quantity numeric not null check(quantity>0),unit text not null check(char_length(unit)between 1 and 80),
 matched_product_id uuid references public.products(id),match_confidence numeric(4,3)check(match_confidence between 0 and 1),review_status text not null default'extracted'check(review_status in('extracted','confirmed','excluded')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(upload_id,source_sheet,source_row)
);
alter table public.procurement_upload_items enable row level security;
create policy "authorised users read procurement rows"on public.procurement_upload_items for select to authenticated using(exists(select 1 from project_procurement_uploads u where u.id=upload_id and(u.owner_id=auth.uid()or(u.organisation_id is not null and has_permission('organisation.view',u.organisation_id))or is_platform_admin())));
create policy "authorised customers update procurement rows"
on public.procurement_upload_items for update to authenticated
using (
 exists(select 1 from public.project_procurement_uploads u
  where u.id=upload_id and (
   u.owner_id=auth.uid() or
   (u.organisation_id is not null and public.has_permission('purchase_requests.create',u.organisation_id))
  )
 )
)
with check (
 exists(select 1 from public.project_procurement_uploads u
  where u.id=upload_id and (
   u.owner_id=auth.uid() or
   (u.organisation_id is not null and public.has_permission('purchase_requests.create',u.organisation_id))
  )
 )
);
create policy "upload owner inserts extracted rows"on public.procurement_upload_items for insert to authenticated with check(exists(select 1 from project_procurement_uploads u where u.id=upload_id and u.owner_id=auth.uid()));
create index procurement_items_upload_status on public.procurement_upload_items(upload_id,review_status);
alter table public.project_procurement_uploads add column rfq_id uuid unique references public.quote_requests(id);

create or replace function public.procurement_create_rfq(target_upload uuid,target_location text,target_required_date date default null)returns uuid language plpgsql security definer set search_path=public as $$
declare source project_procurement_uploads;request_id uuid;member_id uuid;
begin select * into source from project_procurement_uploads where id=target_upload for update;if source.id is null or source.rfq_id is not null or not(source.owner_id=auth.uid()or(source.organisation_id is not null and has_permission('purchase_requests.create',source.organisation_id)))then raise exception'Upload unavailable or RFQ already created';end if;if length(trim(target_location))<3 then raise exception'Delivery location required';end if;if target_required_date is not null and target_required_date<current_date then raise exception'Required date cannot be in the past';end if;if not exists(select 1 from procurement_upload_items where upload_id=source.id and review_status='confirmed')then raise exception'Confirm at least one requirement';end if;if source.organisation_id is not null then select id into member_id from organisation_members where organisation_id=source.organisation_id and user_id=auth.uid()and status='active'and is_active;end if;insert into quote_requests(requester_id,organisation_id,requested_by_membership_id,project_id,title,delivery_location,required_date,notes,status)values(auth.uid(),source.organisation_id,member_id,source.project_id,source.title,target_location,target_required_date,'Created from reviewed BOQ upload '||source.original_filename,'open')returning id into request_id;insert into quote_request_items(quote_request_id,product_id,description,quantity,unit,specifications)select request_id,matched_product_id,description,quantity,unit,jsonb_build_object('source_upload_id',source.id,'source_sheet',source_sheet,'source_row',source_row,'match_confidence',match_confidence)from procurement_upload_items where upload_id=source.id and review_status='confirmed';update project_procurement_uploads set status='ready',rfq_id=request_id where id=source.id;insert into audit_logs(actor_id,entity_type,entity_id,action,after_data)values(auth.uid(),'quote_request',request_id::text,'created_from_procurement_upload',jsonb_build_object('upload_id',source.id));return request_id;end;$$;
grant execute on function public.procurement_create_rfq(uuid,text,date)to authenticated;
