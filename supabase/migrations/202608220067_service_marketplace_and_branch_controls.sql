-- Complete branch assignment controls and establish the service marketplace lifecycle.
begin;

alter table public.supplier_branches add column if not exists is_active boolean not null default true;
alter table public.supplier_branches add column if not exists supports_delivery boolean not null default true;

create unique index if not exists supplier_listing_location_product_unique
on public.supplier_listings(supplier_id,product_id,coalesce(product_variant_id,'00000000-0000-0000-0000-000000000000'::uuid),branch_id,coalesce(warehouse_id,'00000000-0000-0000-0000-000000000000'::uuid))
where branch_id is not null;

create or replace function public.assign_supplier_listings_branch(target_listing_ids uuid[],target_branch uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare target_org uuid;changed integer;
begin
 select organisation_id into target_org from supplier_branches where id=target_branch and is_active;
 if target_org is null or not has_permission('products.edit',target_org) then raise exception 'Product editing permission required for this branch';end if;
 if exists(select 1 from supplier_listings where id=any(target_listing_ids) and (supplier_id<>target_org or branch_id is not null)) then raise exception 'Only unassigned products from this supplier can be assigned';end if;
 if exists(select 1 from supplier_listings source join supplier_listings existing on existing.supplier_id=source.supplier_id and existing.product_id=source.product_id and existing.product_variant_id is not distinct from source.product_variant_id and existing.branch_id=target_branch and existing.warehouse_id is null where source.id=any(target_listing_ids) and existing.id<>source.id) then raise exception 'A selected product already exists at this branch';end if;
 update supplier_listings set branch_id=target_branch,warehouse_id=null,updated_at=now() where id=any(target_listing_ids) and supplier_id=target_org and branch_id is null;
 get diagnostics changed=row_count;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'supplier_branch',target_branch::text,'LISTINGS_BRANCH_ASSIGNED',jsonb_build_object('listing_ids',target_listing_ids,'count',changed));
 return changed;
end;$$;

create or replace function public.create_supplier_listing_drafts_at_location(target_supplier uuid,target_product_ids uuid[],target_branch uuid,target_warehouse uuid default null)
returns integer language plpgsql security definer set search_path=public as $$declare inserted_count integer;begin
 if not has_permission('products.create',target_supplier) then raise exception 'Products create permission required';end if;
 if not exists(select 1 from supplier_branches where id=target_branch and organisation_id=target_supplier and is_active) then raise exception 'Choose an active supplier branch';end if;
 if target_warehouse is not null and not exists(select 1 from supplier_warehouses where id=target_warehouse and organisation_id=target_supplier and is_active and (branch_id is null or branch_id=target_branch)) then raise exception 'Choose a warehouse at this branch';end if;
 insert into supplier_listings(supplier_id,product_id,price,stock_status,inventory_mode,is_active,listing_status,branch_id,warehouse_id)
 select target_supplier,p.id,null,'confirmation_required','confirmation_required',false,'draft',target_branch,target_warehouse from products p where p.id=any(target_product_ids) and p.is_active
 and not exists(select 1 from supplier_listings l where l.supplier_id=target_supplier and l.product_id=p.id and l.product_variant_id is null and l.branch_id=target_branch and l.warehouse_id is not distinct from target_warehouse);
 get diagnostics inserted_count=row_count;
 return inserted_count;
end;$$;

create table if not exists public.service_categories(
 id uuid primary key default gen_random_uuid(),name text not null unique,slug text not null unique,description text,is_active boolean not null default true,sort_order integer not null default 0,created_at timestamptz not null default now()
);
create table if not exists public.service_provider_profiles(
 id uuid primary key default gen_random_uuid(),user_id uuid not null unique references public.profiles(id) on delete cascade,organisation_id uuid references public.organisations(id) on delete set null,display_name text not null,bio text,phone text,region text,city text,service_radius_km numeric,verification_status text not null default 'draft' check(verification_status in('draft','submitted','under_review','information_required','approved','rejected','suspended')),account_status text not null default 'active' check(account_status in('active','suspended','closed')),availability_status text not null default 'offline' check(availability_status in('available','busy','offline')),available_from timestamptz,available_until timestamptz,average_rating numeric not null default 0,review_count integer not null default 0,completed_jobs integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.service_provider_categories(
 provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,category_id uuid not null references public.service_categories(id) on delete cascade,experience_years integer,base_price numeric,price_unit text,primary key(provider_id,category_id)
);
create table if not exists public.service_provider_skills(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,name text not null,unique(provider_id,name));
create table if not exists public.service_provider_areas(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,region text not null,city text,area text,unique(provider_id,region,city,area));
create table if not exists public.service_provider_media(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,storage_path text not null,caption text,is_cover boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.service_provider_documents(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,document_type text not null,storage_path text not null,status text not null default 'pending' check(status in('pending','approved','rejected','expired')),expires_at date,review_note text,reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.service_provider_schedule(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,starts_at timestamptz not null,ends_at timestamptz not null,kind text not null default 'unavailable' check(kind in('available','unavailable','booking')),note text,check(ends_at>starts_at));

create table if not exists public.service_requests(
 id uuid primary key default gen_random_uuid(),request_number text not null unique default ('SR-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),customer_id uuid not null references public.profiles(id),customer_organisation_id uuid references public.organisations(id),provider_id uuid references public.service_provider_profiles(id),category_id uuid not null references public.service_categories(id),title text not null,description text not null,region text not null,city text,service_address text,preferred_at timestamptz,budget numeric,status text not null default 'requested' check(status in('requested','viewed','accepted','rescheduled','in_progress','completed','rejected','cancelled')),provider_message text,proposed_at timestamptz,rejection_reason text,completed_at timestamptz,cancelled_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.service_request_events(id bigint generated always as identity primary key,request_id uuid not null references public.service_requests(id) on delete cascade,event_type text not null,actor_id uuid references public.profiles(id),note text,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table if not exists public.service_reviews(id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.service_requests(id) on delete cascade,provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,customer_id uuid not null references public.profiles(id),rating integer not null check(rating between 1 and 5),comment text,created_at timestamptz not null default now());
create table if not exists public.saved_service_providers(customer_id uuid not null references public.profiles(id) on delete cascade,provider_id uuid not null references public.service_provider_profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(customer_id,provider_id));

create index if not exists service_provider_discovery on public.service_provider_profiles(verification_status,account_status,availability_status,region,city);
create index if not exists service_requests_customer on public.service_requests(customer_id,created_at desc);
create index if not exists service_requests_provider on public.service_requests(provider_id,status,created_at desc);

alter table public.service_categories enable row level security;
alter table public.service_provider_profiles enable row level security;
alter table public.service_provider_categories enable row level security;
alter table public.service_provider_skills enable row level security;
alter table public.service_provider_areas enable row level security;
alter table public.service_provider_media enable row level security;
alter table public.service_provider_documents enable row level security;
alter table public.service_provider_schedule enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;
alter table public.service_reviews enable row level security;
alter table public.saved_service_providers enable row level security;

create or replace function public.provider_can_manage(target_provider uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from service_provider_profiles p where p.id=target_provider and p.user_id=auth.uid()) or is_platform_admin()$$;
create or replace function public.can_read_service_request(target_request uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from service_requests r left join service_provider_profiles p on p.id=r.provider_id where r.id=target_request and (r.customer_id=auth.uid() or p.user_id=auth.uid() or is_platform_admin()))$$;

create policy "service categories public read" on public.service_categories for select using(is_active or is_platform_admin());
create policy "approved providers public read" on public.service_provider_profiles for select using((verification_status='approved' and account_status='active') or user_id=auth.uid() or is_platform_admin());
create policy "provider profile owner insert" on public.service_provider_profiles for insert with check(user_id=auth.uid());
create policy "provider profile owner update" on public.service_provider_profiles for update using(user_id=auth.uid() or is_platform_admin()) with check(user_id=auth.uid() or is_platform_admin());
create policy "provider categories read" on public.service_provider_categories for select using(exists(select 1 from service_provider_profiles p where p.id=provider_id and (p.verification_status='approved' or p.user_id=auth.uid() or is_platform_admin())));
create policy "provider categories manage" on public.service_provider_categories for all using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "provider skills read" on public.service_provider_skills for select using(exists(select 1 from service_provider_profiles p where p.id=provider_id and (p.verification_status='approved' or p.user_id=auth.uid() or is_platform_admin())));
create policy "provider skills manage" on public.service_provider_skills for all using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "provider areas read" on public.service_provider_areas for select using(exists(select 1 from service_provider_profiles p where p.id=provider_id and (p.verification_status='approved' or p.user_id=auth.uid() or is_platform_admin())));
create policy "provider areas manage" on public.service_provider_areas for all using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "provider media read" on public.service_provider_media for select using(exists(select 1 from service_provider_profiles p where p.id=provider_id and (p.verification_status='approved' or p.user_id=auth.uid() or is_platform_admin())));
create policy "provider media manage" on public.service_provider_media for all using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "provider documents private" on public.service_provider_documents for all using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "provider schedule private" on public.service_provider_schedule for all using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "service request participants read" on public.service_requests for select using(customer_id=auth.uid() or provider_can_manage(provider_id));
create policy "service request customer insert" on public.service_requests for insert with check(customer_id=auth.uid());
create policy "service request provider update" on public.service_requests for update using(provider_can_manage(provider_id)) with check(provider_can_manage(provider_id));
create policy "service events participants read" on public.service_request_events for select using(can_read_service_request(request_id));
create policy "service reviews public read" on public.service_reviews for select using(true);
create policy "service review customer insert" on public.service_reviews for insert with check(customer_id=auth.uid() and exists(select 1 from service_requests r where r.id=request_id and r.customer_id=auth.uid() and r.provider_id=provider_id and r.status='completed'));
create policy "saved providers owner" on public.saved_service_providers for all using(customer_id=auth.uid()) with check(customer_id=auth.uid());

create or replace function public.create_service_request(target_provider uuid,target_category uuid,target_title text,target_description text,target_region text,target_city text,target_address text,target_preferred_at timestamptz,target_budget numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$declare request_id uuid;provider_user uuid;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if length(trim(target_title))<4 or length(trim(target_description))<10 or length(trim(target_region))<2 then raise exception 'Complete the service request details';end if;
 select user_id into provider_user from service_provider_profiles where id=target_provider and verification_status='approved' and account_status='active';
 if provider_user is null or not exists(select 1 from service_provider_categories where provider_id=target_provider and category_id=target_category) then raise exception 'This provider is unavailable for the selected service';end if;
 insert into service_requests(customer_id,provider_id,category_id,title,description,region,city,service_address,preferred_at,budget) values(auth.uid(),target_provider,target_category,trim(target_title),trim(target_description),trim(target_region),nullif(trim(target_city),''),nullif(trim(target_address),''),target_preferred_at,target_budget) returning id into request_id;
 insert into service_request_events(request_id,event_type,actor_id) values(request_id,'requested',auth.uid());
 perform enqueue_user_notification(provider_user,'service_request_received',jsonb_build_object('request_id',request_id,'title',trim(target_title)));
 return request_id;
end;$$;

create or replace function public.register_service_provider(target_display_name text,target_bio text,target_phone text,target_region text,target_city text,target_categories uuid[])
returns uuid language plpgsql security definer set search_path=public as $$declare provider_id uuid;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if length(trim(target_display_name))<2 or length(trim(target_bio))<20 or length(trim(target_region))<2 or coalesce(cardinality(target_categories),0)=0 then raise exception 'Complete your profile and choose at least one service';end if;
 if exists(select 1 from service_provider_profiles where user_id=auth.uid()) then raise exception 'A provider profile already exists';end if;
 if (select count(*) from service_categories where id=any(target_categories) and is_active)<>cardinality(target_categories) then raise exception 'Choose active service categories';end if;
 insert into service_provider_profiles(user_id,display_name,bio,phone,region,city,verification_status) values(auth.uid(),trim(target_display_name),trim(target_bio),nullif(trim(target_phone),''),trim(target_region),nullif(trim(target_city),''),'submitted') returning id into provider_id;
 insert into service_provider_categories(provider_id,category_id) select provider_id,id from service_categories where id=any(target_categories) and is_active;
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'service_provider',provider_id::text,'SERVICE_PROVIDER_SUBMITTED',jsonb_build_object('categories',target_categories));
 return provider_id;
end;$$;

create or replace function public.provider_progress_service_request(target_request uuid,target_status text,target_message text default null,target_proposed_at timestamptz default null)
returns void language plpgsql security definer set search_path=public as $$declare r service_requests;begin
 select * into r from service_requests where id=target_request for update;
 if r.id is null or not provider_can_manage(r.provider_id) then raise exception 'Service request unavailable';end if;
 if not((r.status in('requested','viewed','rescheduled') and target_status in('viewed','accepted','rescheduled','rejected')) or (r.status='accepted' and target_status='in_progress') or (r.status='in_progress' and target_status='completed')) then raise exception 'Invalid service request transition';end if;
 if target_status='rejected' and length(trim(coalesce(target_message,'')))<5 then raise exception 'Provide a rejection reason';end if;
 if target_status='rescheduled' and target_proposed_at is null then raise exception 'Provide the proposed time';end if;
 update service_requests set status=target_status,provider_message=nullif(trim(coalesce(target_message,'')),''),proposed_at=case when target_status='rescheduled' then target_proposed_at else proposed_at end,rejection_reason=case when target_status='rejected' then trim(target_message) else rejection_reason end,completed_at=case when target_status='completed' then now() else completed_at end,updated_at=now() where id=r.id;
 if target_status='completed' then update service_provider_profiles set completed_jobs=completed_jobs+1,availability_status='available',updated_at=now() where id=r.provider_id;end if;
 insert into service_request_events(request_id,event_type,actor_id,note,metadata) values(r.id,target_status,auth.uid(),nullif(trim(coalesce(target_message,'')),''),jsonb_build_object('proposed_at',target_proposed_at));
 perform enqueue_user_notification(r.customer_id,'service_request_status_changed',jsonb_build_object('request_id',r.id,'status',target_status));
end;$$;

create or replace function public.customer_progress_service_request(target_request uuid,target_action text,target_reason text default null)
returns void language plpgsql security definer set search_path=public as $$declare r service_requests;begin
 select * into r from service_requests where id=target_request and customer_id=auth.uid() for update;
 if r.id is null then raise exception 'Service request unavailable';end if;
 if target_action='cancel' then
  if r.status not in('requested','viewed','accepted','rescheduled') then raise exception 'This service request can no longer be cancelled';end if;
  update service_requests set status='cancelled',cancelled_at=now(),updated_at=now() where id=r.id;
  insert into service_request_events(request_id,event_type,actor_id,note) values(r.id,'cancelled',auth.uid(),nullif(trim(coalesce(target_reason,'')),''));
 elsif target_action='accept_reschedule' then
  if r.status<>'rescheduled' or r.proposed_at is null then raise exception 'No reschedule proposal is awaiting acceptance';end if;
  update service_requests set status='accepted',preferred_at=r.proposed_at,updated_at=now() where id=r.id;
  insert into service_request_events(request_id,event_type,actor_id) values(r.id,'reschedule_accepted',auth.uid());
 else raise exception 'Invalid customer action';end if;
end;$$;

create or replace function public.set_provider_availability(target_provider uuid,target_status text,target_from timestamptz default null,target_until timestamptz default null)
returns void language plpgsql security definer set search_path=public as $$begin
 if not provider_can_manage(target_provider) or target_status not in('available','busy','offline') then raise exception 'Provider availability permission required';end if;
 if target_until is not null and target_from is not null and target_until<=target_from then raise exception 'Availability end must be later than start';end if;
 update service_provider_profiles set availability_status=target_status,available_from=target_from,available_until=target_until,updated_at=now() where id=target_provider;
end;$$;

create or replace function public.submit_service_review(target_request uuid,target_rating integer,target_comment text default null)
returns uuid language plpgsql security definer set search_path=public as $$declare r service_requests;review_id uuid;begin
 select * into r from service_requests where id=target_request and customer_id=auth.uid() and status='completed';
 if r.id is null or target_rating not between 1 and 5 then raise exception 'Only completed services can be reviewed';end if;
 insert into service_reviews(request_id,provider_id,customer_id,rating,comment) values(r.id,r.provider_id,auth.uid(),target_rating,nullif(trim(coalesce(target_comment,'')),'')) returning id into review_id;
 update service_provider_profiles p set average_rating=x.average_rating,review_count=x.review_count from(select provider_id,avg(rating)::numeric(3,2) average_rating,count(*)::integer review_count from service_reviews where provider_id=r.provider_id group by provider_id)x where p.id=x.provider_id;
 return review_id;
end;$$;

insert into public.service_categories(name,slug,description,sort_order) values
('Masonry & Construction','masonry-construction','Masons and general construction professionals',10),
('Plumbing','plumbing','Plumbing installation and repairs',20),
('Electrical','electrical','Electrical installation and repairs',30),
('Carpentry','carpentry','Carpentry, joinery and furniture work',40),
('Painting','painting','Interior and exterior painting',50),
('Tiling','tiling','Floor and wall tiling',60),
('Transport & Delivery','transport-delivery','Drivers and material transport',70)
on conflict(slug) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order;

revoke all on function public.assign_supplier_listings_branch(uuid[],uuid),public.create_supplier_listing_drafts_at_location(uuid,uuid[],uuid,uuid),public.provider_can_manage(uuid),public.can_read_service_request(uuid),public.create_service_request(uuid,uuid,text,text,text,text,text,timestamptz,numeric),public.register_service_provider(text,text,text,text,text,uuid[]),public.provider_progress_service_request(uuid,text,text,timestamptz),public.customer_progress_service_request(uuid,text,text),public.set_provider_availability(uuid,text,timestamptz,timestamptz),public.submit_service_review(uuid,integer,text) from public,anon;
grant execute on function public.create_service_request(uuid,uuid,text,text,text,text,text,timestamptz,numeric),public.register_service_provider(text,text,text,text,text,uuid[]),public.customer_progress_service_request(uuid,text,text),public.submit_service_review(uuid,integer,text) to authenticated;
grant execute on function public.assign_supplier_listings_branch(uuid[],uuid),public.create_supplier_listing_drafts_at_location(uuid,uuid[],uuid,uuid),public.provider_can_manage(uuid),public.can_read_service_request(uuid),public.provider_progress_service_request(uuid,text,text,timestamptz),public.set_provider_availability(uuid,text,timestamptz,timestamptz) to authenticated;

commit;
