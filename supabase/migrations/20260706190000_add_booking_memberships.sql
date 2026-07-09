alter table public.booking_services
  add column if not exists membership_billing_period text not null default 'Monthly',
  add column if not exists membership_member_limit integer,
  add column if not exists membership_credits_per_day integer not null default 0,
  add column if not exists membership_credit_scope text not null default 'selected_services',
  add column if not exists membership_eligible_service_ids uuid[] not null default '{}'::uuid[],
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_services_membership_billing_period_check') then
    alter table public.booking_services
      add constraint booking_services_membership_billing_period_check
      check (membership_billing_period in ('Weekly', 'Monthly', 'Yearly'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_services_membership_credit_scope_check') then
    alter table public.booking_services
      add constraint booking_services_membership_credit_scope_check
      check (membership_credit_scope in ('all_services', 'selected_services'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_services_membership_member_limit_check') then
    alter table public.booking_services
      add constraint booking_services_membership_member_limit_check
      check (membership_member_limit is null or membership_member_limit >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_services_membership_credits_per_day_check') then
    alter table public.booking_services
      add constraint booking_services_membership_credits_per_day_check
      check (membership_credits_per_day >= 0);
  end if;
end $$;

create table if not exists public.booking_customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.booking_customers(id) on delete cascade,
  membership_service_id uuid not null references public.booking_services(id) on delete cascade,
  status text not null default 'Active',
  billing_period text not null default 'Monthly',
  price_cents integer not null default 0,
  credits_per_day integer not null default 0,
  credit_scope text not null default 'selected_services',
  eligible_service_ids uuid[] not null default '{}'::uuid[],
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_subscription_id text unique,
  stripe_price_id text,
  auto_renew boolean not null default true,
  started_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_customer_memberships_status_check') then
    alter table public.booking_customer_memberships
      add constraint booking_customer_memberships_status_check
      check (status in ('Active', 'Paused', 'Past Due', 'Cancelled', 'Expired'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_customer_memberships_billing_period_check') then
    alter table public.booking_customer_memberships
      add constraint booking_customer_memberships_billing_period_check
      check (billing_period in ('Weekly', 'Monthly', 'Yearly'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_customer_memberships_credit_scope_check') then
    alter table public.booking_customer_memberships
      add constraint booking_customer_memberships_credit_scope_check
      check (credit_scope in ('all_services', 'selected_services'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_customer_memberships_price_cents_check') then
    alter table public.booking_customer_memberships
      add constraint booking_customer_memberships_price_cents_check
      check (price_cents >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_customer_memberships_credits_per_day_check') then
    alter table public.booking_customer_memberships
      add constraint booking_customer_memberships_credits_per_day_check
      check (credits_per_day >= 0);
  end if;
end $$;

create index if not exists booking_customer_memberships_customer_idx
  on public.booking_customer_memberships(customer_id);

create index if not exists booking_customer_memberships_service_idx
  on public.booking_customer_memberships(membership_service_id);

create unique index if not exists booking_customer_memberships_active_unique
  on public.booking_customer_memberships(customer_id, membership_service_id)
  where status in ('Active', 'Paused', 'Past Due');

create table if not exists public.booking_membership_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_membership_id uuid references public.booking_customer_memberships(id) on delete cascade,
  customer_id uuid not null references public.booking_customers(id) on delete cascade,
  booking_id uuid references public.booking_bookings(id) on delete set null,
  service_id uuid references public.booking_services(id) on delete set null,
  credit_date date not null default current_date,
  amount integer not null,
  reason text not null default 'booking',
  note text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_membership_credit_ledger_amount_check') then
    alter table public.booking_membership_credit_ledger
      add constraint booking_membership_credit_ledger_amount_check
      check (amount <> 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'booking_membership_credit_ledger_reason_check') then
    alter table public.booking_membership_credit_ledger
      add constraint booking_membership_credit_ledger_reason_check
      check (reason in ('booking', 'manual_adjustment', 'refund', 'expiration'));
  end if;
end $$;

create index if not exists booking_membership_credit_ledger_customer_date_idx
  on public.booking_membership_credit_ledger(customer_id, credit_date);

create index if not exists booking_membership_credit_ledger_membership_idx
  on public.booking_membership_credit_ledger(customer_membership_id);

drop trigger if exists touch_booking_customer_memberships_updated_at on public.booking_customer_memberships;
create trigger touch_booking_customer_memberships_updated_at
before update on public.booking_customer_memberships
for each row execute function public.touch_updated_at();

alter table public.booking_customer_memberships enable row level security;
alter table public.booking_membership_credit_ledger enable row level security;

drop policy if exists "Admins can manage booking customer memberships" on public.booking_customer_memberships;
create policy "Admins can manage booking customer memberships"
on public.booking_customer_memberships
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking membership credit ledger" on public.booking_membership_credit_ledger;
create policy "Admins can manage booking membership credit ledger"
on public.booking_membership_credit_ledger
for all
using (public.is_admin())
with check (public.is_admin());
