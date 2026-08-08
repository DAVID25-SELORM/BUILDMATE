create table public.contact_inquiries(
 id uuid primary key default gen_random_uuid(),
 full_name text not null check(char_length(full_name) between 2 and 120),
 phone text,
 email text not null check(char_length(email) between 5 and 254),
 topic text not null check(topic in('general','supplier','order','corporate')),
 message text not null check(char_length(message) between 10 and 4000),
 status text not null default 'new' check(status in('new','in_progress','resolved','spam')),
 created_at timestamptz not null default now()
);
alter table public.contact_inquiries enable row level security;
create policy "support staff read contact inquiries" on public.contact_inquiries for select to authenticated using(has_permission('customers.view')or is_platform_admin());
revoke insert,update,delete on public.contact_inquiries from anon,authenticated;
create or replace function public.submit_contact_inquiry(target_name text,target_phone text,target_email text,target_topic text,target_message text,target_website text default '')returns uuid language plpgsql security definer set search_path=public as $$declare result uuid;begin
 if coalesce(trim(target_website),'')<>'' then return gen_random_uuid();end if;
 if char_length(trim(coalesce(target_name,'')))not between 2 and 120 then raise exception 'Enter your full name';end if;
 if char_length(trim(coalesce(target_email,'')))not between 5 and 254 or position('@'in target_email)=0 then raise exception 'Enter a valid email address';end if;
 if target_topic not in('general','supplier','order','corporate')then raise exception 'Choose a valid topic';end if;
 if char_length(trim(coalesce(target_message,'')))not between 10 and 4000 then raise exception 'Enter at least 10 characters';end if;
 insert into contact_inquiries(full_name,phone,email,topic,message)values(trim(target_name),nullif(trim(coalesce(target_phone,'')),''),lower(trim(target_email)),target_topic,trim(target_message))returning id into result;
 return result;
end;$$;
revoke all on function public.submit_contact_inquiry(text,text,text,text,text,text)from public;
grant execute on function public.submit_contact_inquiry(text,text,text,text,text,text)to anon,authenticated;
