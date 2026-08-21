-- Canonical support tickets, conversations, platform operations and privacy.
begin;

alter table public.platform_permissions drop constraint if exists platform_permissions_key_check;
alter table public.platform_permissions add constraint platform_permissions_key_check check(key in(
 'platform.users.view','platform.users.invite','platform.users.manage_roles','customers.view','customers.suspend',
 'suppliers.view','suppliers.verify','suppliers.suspend','catalogue.manage','orders.manage','deliveries.manage',
 'payments.view','refunds.process','settlements.view','settlements.release','reports.view','audit_logs.view',
 'support.view','support.reply','support.assign','support.resolve','support.manage'));

insert into public.platform_permissions(key,label) values
 ('support.view','View support tickets'),('support.reply','Reply to support tickets'),
 ('support.assign','Assign support tickets'),('support.resolve','Resolve support tickets'),
 ('support.manage','Manage support settings') on conflict(key) do update set label=excluded.label;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_roles r cross join public.platform_permissions p
where r.key='super_admin' and p.key like 'support.%' on conflict do nothing;
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_roles r cross join public.platform_permissions p
where r.key='customer_support_admin' and p.key in('support.view','support.reply','support.assign','support.resolve') on conflict do nothing;
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_roles r cross join public.platform_permissions p
where r.key='operations_admin' and p.key in('support.view','support.reply','support.assign','support.resolve') on conflict do nothing;

create sequence if not exists public.support_ticket_number_seq;
create table public.support_tickets(
 id uuid primary key default gen_random_uuid(),
 ticket_number text not null unique,
 created_by uuid not null references public.profiles(id),
 requester_role text not null,
 organisation_id uuid references public.organisations(id),
 category text not null check(category in('shopping_products','quotations','orders','payments','delivery','returns_refunds','supplier_support','driver_support','service_provider_support','account_login','technical_problem')),
 subcategory text,subject text not null,description text not null,
 priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
 status text not null default 'open' check(status in('open','in_progress','awaiting_user','resolved','closed')),
 assigned_to uuid references public.profiles(id),
 related_order_id uuid references public.orders(id),related_delivery_id uuid references public.deliveries(id),
 related_quote_id uuid references public.quote_requests(id),related_service_request_id uuid references public.service_requests(id),
 source_route text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 first_response_at timestamptz,resolved_at timestamptz,closed_at timestamptz,
 check(length(trim(subject)) between 5 and 160),check(length(trim(description)) between 10 and 5000)
);
create table public.support_messages(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),sender_role text not null,body text not null,
 internal_note boolean not null default false,created_at timestamptz not null default now(),
 check(length(trim(body)) between 1 and 5000)
);
create table public.support_attachments(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 message_id uuid references public.support_messages(id) on delete cascade,uploader_id uuid not null references public.profiles(id),
 storage_path text not null,file_name text not null,mime_type text,size_bytes bigint,
 created_at timestamptz not null default now(),check(size_bytes is null or size_bytes between 1 and 10485760)
);
create index support_tickets_status_updated on public.support_tickets(status,updated_at desc);
create index support_tickets_priority_updated on public.support_tickets(priority,updated_at desc);
create index support_tickets_assigned_updated on public.support_tickets(assigned_to,updated_at desc);
create index support_tickets_created_by_updated on public.support_tickets(created_by,updated_at desc);
create index support_tickets_organisation_updated on public.support_tickets(organisation_id,updated_at desc);
create index support_messages_ticket_created on public.support_messages(ticket_id,created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
create policy "support requester or staff read" on public.support_tickets for select to authenticated
 using(created_by=auth.uid() or has_permission('support.view'));
create policy "support requester public messages" on public.support_messages for select to authenticated
 using(exists(select 1 from support_tickets t where t.id=ticket_id and
  (has_permission('support.view') or (t.created_by=auth.uid() and not internal_note))));
create policy "support attachment participant read" on public.support_attachments for select to authenticated
 using(exists(select 1 from support_tickets t where t.id=ticket_id and
  (has_permission('support.view') or (t.created_by=auth.uid() and not exists(select 1 from support_messages m where m.id=message_id and m.internal_note)))));
revoke insert,update,delete on public.support_tickets,public.support_messages,public.support_attachments from anon,authenticated;

create or replace function public.create_support_ticket(target_category text,target_subject text,target_description text,target_priority text default 'normal',target_organisation uuid default null,target_order uuid default null,target_delivery uuid default null,target_quote uuid default null,target_service_request uuid default null,target_source_route text default null)
returns table(ticket_id uuid,ticket_number text) language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();role_name text:='customer';new_id uuid;new_number text;admin_user uuid;
begin
 if uid is null then raise exception 'Sign in to contact BuildMate Support';end if;
 if target_category not in('shopping_products','quotations','orders','payments','delivery','returns_refunds','supplier_support','driver_support','service_provider_support','account_login','technical_problem') then raise exception 'Choose a support category';end if;
 if target_priority not in('low','normal','high','urgent') then raise exception 'Choose a valid priority';end if;
 if length(trim(coalesce(target_subject,'')))<5 or length(trim(coalesce(target_description,'')))<10 then raise exception 'Provide a subject and a detailed description';end if;
 select case when exists(select 1 from service_provider_profiles p where p.user_id=uid) then 'service_provider' else coalesce(p.role::text,'customer') end into role_name from profiles p where p.id=uid;
 if target_organisation is not null and not exists(select 1 from organisation_members m where m.organisation_id=target_organisation and m.user_id=uid and m.status='active' and m.is_active) then raise exception 'Organisation context is unavailable';end if;
 if target_order is not null and not exists(select 1 from orders o where o.id=target_order and (customer_can_read_order(o) or has_permission('orders.view',o.supplier_id))) then raise exception 'Order context is unavailable';end if;
 if target_delivery is not null and not exists(select 1 from deliveries d join orders o on o.id=d.order_id where d.id=target_delivery and (customer_can_read_order(o) or has_permission('orders.view',o.supplier_id) or d.driver_id=uid)) then raise exception 'Delivery context is unavailable';end if;
 if target_quote is not null and not exists(select 1 from quote_requests q where q.id=target_quote and (q.requester_id=uid or (q.organisation_id is not null and has_permission('quotations.view',q.organisation_id)))) then raise exception 'Quotation context is unavailable';end if;
 if target_service_request is not null and not can_read_service_request(target_service_request) then raise exception 'Service request context is unavailable';end if;
 new_number:='SUP-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('support_ticket_number_seq')::text,5,'0');
 insert into support_tickets(ticket_number,created_by,requester_role,organisation_id,category,subject,description,priority,related_order_id,related_delivery_id,related_quote_id,related_service_request_id,source_route)
 values(new_number,uid,role_name,target_organisation,target_category,trim(target_subject),trim(target_description),target_priority,target_order,target_delivery,target_quote,target_service_request,left(target_source_route,500)) returning id into new_id;
 insert into support_messages(ticket_id,sender_id,sender_role,body) values(new_id,uid,role_name,trim(target_description));
 insert into audit_logs(actor_id,entity_type,entity_id,action,after_data) values(uid,'support_ticket',new_id::text,'SUPPORT_TICKET_CREATED',jsonb_build_object('ticket_number',new_number,'category',target_category,'priority',target_priority));
 for admin_user in select distinct m.user_id from platform_staff_memberships m
  join platform_permissions p on p.key='support.view'
  left join platform_role_permissions rp on rp.role_id=m.platform_role_id and rp.permission_id=p.id
  left join platform_staff_permission_overrides x on x.membership_id=m.id and x.permission_id=p.id
  where m.status='active' and coalesce(x.granted,rp.permission_id is not null,false) loop
  perform enqueue_user_notification(admin_user,case when target_priority='urgent' then 'urgent_support_ticket_created' else 'support_ticket_created' end,jsonb_build_object('ticket_id',new_id,'ticket_number',new_number,'priority',target_priority));
 end loop;
 return query select new_id,new_number;
end;$$;

create or replace function public.reply_support_ticket(target_ticket uuid,target_body text,target_internal boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare t support_tickets;staff boolean:=has_permission('support.reply');sender_role text;recipient uuid;
begin
 if auth.uid() is null or length(trim(coalesce(target_body,'')))<1 then raise exception 'Enter a reply';end if;
 select * into t from support_tickets where id=target_ticket for update;
 if t.id is null or not(staff or t.created_by=auth.uid()) then raise exception 'Support ticket unavailable';end if;
 if target_internal and not staff then raise exception 'Internal notes are restricted to support staff';end if;
 if t.status='closed' then raise exception 'Closed tickets cannot receive replies';end if;
 sender_role:=case when staff then 'platform_support' else t.requester_role end;
 insert into support_messages(ticket_id,sender_id,sender_role,body,internal_note) values(t.id,auth.uid(),sender_role,trim(target_body),target_internal);
 if staff and not target_internal then
  update support_tickets set status='awaiting_user',first_response_at=coalesce(first_response_at,now()),updated_at=now() where id=t.id;
  perform enqueue_user_notification(t.created_by,'support_reply_received',jsonb_build_object('ticket_id',t.id,'ticket_number',t.ticket_number));
 elsif not staff then
  update support_tickets set status=case when status in('awaiting_user','resolved') then 'open' else status end,
   resolved_at=case when status='resolved' then null else resolved_at end,updated_at=now() where id=t.id;
  if t.assigned_to is not null then perform enqueue_user_notification(t.assigned_to,'support_requester_replied',jsonb_build_object('ticket_id',t.id,'ticket_number',t.ticket_number));end if;
 else update support_tickets set updated_at=now() where id=t.id;end if;
end;$$;

create or replace function public.admin_update_support_ticket(target_ticket uuid,target_status text,target_priority text,target_category text,target_assignee uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare t support_tickets;
begin
 if not has_permission('support.view') then raise exception 'Support permission required';end if;
 select * into t from support_tickets where id=target_ticket for update;if t.id is null then raise exception 'Support ticket not found';end if;
 if target_status not in('open','in_progress','awaiting_user','resolved','closed') or target_priority not in('low','normal','high','urgent') then raise exception 'Invalid support ticket update';end if;
 if target_category not in('shopping_products','quotations','orders','payments','delivery','returns_refunds','supplier_support','driver_support','service_provider_support','account_login','technical_problem') then raise exception 'Invalid support category';end if;
 if target_assignee is distinct from t.assigned_to and not has_permission('support.assign') then raise exception 'Support assignment permission required';end if;
 if target_status in('resolved','closed') and not has_permission('support.resolve') then raise exception 'Support resolution permission required';end if;
 if target_assignee is not null and not exists(select 1 from platform_staff_memberships m where m.user_id=target_assignee and m.status='active') then raise exception 'Assignee is not active platform staff';end if;
 update support_tickets set status=target_status,priority=target_priority,category=target_category,assigned_to=target_assignee,
  resolved_at=case when target_status='resolved' then coalesce(resolved_at,now()) when target_status in('open','in_progress','awaiting_user') then null else resolved_at end,
  closed_at=case when target_status='closed' then coalesce(closed_at,now()) when target_status<>'closed' then null else closed_at end,updated_at=now() where id=t.id;
 insert into audit_logs(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'support_ticket',t.id::text,'SUPPORT_TICKET_UPDATED',jsonb_build_object('status',t.status,'priority',t.priority,'assigned_to',t.assigned_to),jsonb_build_object('status',target_status,'priority',target_priority,'assigned_to',target_assignee));
 if target_status is distinct from t.status then perform enqueue_user_notification(t.created_by,'support_status_changed',jsonb_build_object('ticket_id',t.id,'ticket_number',t.ticket_number,'status',target_status));end if;
end;$$;

revoke all on function public.create_support_ticket(text,text,text,text,uuid,uuid,uuid,uuid,uuid,text),public.reply_support_ticket(uuid,text,boolean),public.admin_update_support_ticket(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.create_support_ticket(text,text,text,text,uuid,uuid,uuid,uuid,uuid,text),public.reply_support_ticket(uuid,text,boolean),public.admin_update_support_ticket(uuid,text,text,text,uuid) to authenticated;

commit;
