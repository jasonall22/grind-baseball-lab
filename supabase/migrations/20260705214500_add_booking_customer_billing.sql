alter table public.booking_customers
add column if not exists stripe_customer_id text,
add column if not exists stripe_default_payment_method_id text;

create unique index if not exists booking_customers_stripe_customer_id_key
on public.booking_customers (stripe_customer_id)
where stripe_customer_id is not null;

create table if not exists public.booking_customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.booking_customers(id) on delete cascade,
  booking_id uuid references public.booking_bookings(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'Pending' check (status in ('Pending', 'Succeeded', 'Failed', 'Cancelled', 'Refunded')),
  description text,
  payment_method_brand text,
  payment_method_last4 text,
  receipt_url text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_customer_payments_customer_id_idx
on public.booking_customer_payments (customer_id, created_at desc);

drop trigger if exists touch_booking_customer_payments on public.booking_customer_payments;
create trigger touch_booking_customer_payments
before update on public.booking_customer_payments
for each row execute function public.touch_updated_at();

alter table public.booking_customer_payments enable row level security;

drop policy if exists "Admins can manage booking customer payments" on public.booking_customer_payments;
create policy "Admins can manage booking customer payments"
on public.booking_customer_payments
for all
using (public.is_admin())
with check (public.is_admin());
