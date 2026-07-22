alter table public.booking_services
  add column if not exists membership_credit_limit_period text not null default 'day';

alter table public.booking_customer_memberships
  add column if not exists credit_limit_period text not null default 'day';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_services_membership_credit_limit_period_check') then
    alter table public.booking_services
      add constraint booking_services_membership_credit_limit_period_check
      check (membership_credit_limit_period in ('day', 'week', 'month'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_customer_memberships_credit_limit_period_check') then
    alter table public.booking_customer_memberships
      add constraint booking_customer_memberships_credit_limit_period_check
      check (credit_limit_period in ('day', 'week', 'month'));
  end if;
end $$;
