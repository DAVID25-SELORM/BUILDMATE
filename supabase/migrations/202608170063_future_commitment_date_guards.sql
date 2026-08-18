-- Reject newly written dates that predate the business event creating them.
-- Existing historical rows remain readable because these guards are NOT VALID.
begin;

alter table public.quote_requests
  add constraint quote_requests_required_date_not_past
  check(required_date is null or required_date>=created_at::date) not valid;

alter table public.supplier_quotes
  add constraint supplier_quotes_valid_until_not_past
  check(valid_until is null or valid_until>=created_at::date) not valid;

alter table public.delivery_attempts
  add constraint delivery_attempts_reschedule_is_future
  check(resolution is distinct from 'reschedule' or
    (rescheduled_for is not null and rescheduled_for>created_at)) not valid;

commit;
