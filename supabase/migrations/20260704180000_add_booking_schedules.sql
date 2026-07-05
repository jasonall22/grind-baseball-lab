create table if not exists public.booking_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_schedules_name_key'
  ) then
    alter table public.booking_schedules
      add constraint booking_schedules_name_key unique (name);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_schedules_slug_key'
  ) then
    alter table public.booking_schedules
      add constraint booking_schedules_slug_key unique (slug);
  end if;
end
$$;

create unique index if not exists booking_schedules_default_idx
  on public.booking_schedules ((is_default))
  where is_default = true;

create table if not exists public.booking_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.booking_schedules(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  day_name text not null,
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create unique index if not exists booking_schedule_slots_schedule_day_order_idx
  on public.booking_schedule_slots (schedule_id, weekday, sort_order);

create table if not exists public.booking_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.booking_schedules(id) on delete cascade,
  override_date date not null,
  is_closed boolean not null default false,
  start_time time,
  end_time time,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_closed = true and start_time is null and end_time is null)
    or
    (is_closed = false and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create unique index if not exists booking_schedule_overrides_schedule_date_order_idx
  on public.booking_schedule_overrides (schedule_id, override_date, sort_order);

alter table public.booking_resources
  add column if not exists schedule_id uuid references public.booking_schedules(id) on delete set null;

alter table public.booking_services
  add column if not exists schedule_id uuid references public.booking_schedules(id) on delete set null;

drop trigger if exists touch_booking_schedules on public.booking_schedules;
create trigger touch_booking_schedules
before update on public.booking_schedules
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_schedule_slots on public.booking_schedule_slots;
create trigger touch_booking_schedule_slots
before update on public.booking_schedule_slots
for each row execute function public.touch_updated_at();

drop trigger if exists touch_booking_schedule_overrides on public.booking_schedule_overrides;
create trigger touch_booking_schedule_overrides
before update on public.booking_schedule_overrides
for each row execute function public.touch_updated_at();

alter table public.booking_schedules enable row level security;
alter table public.booking_schedule_slots enable row level security;
alter table public.booking_schedule_overrides enable row level security;

drop policy if exists "Admins can manage booking schedules" on public.booking_schedules;
create policy "Admins can manage booking schedules"
on public.booking_schedules
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking schedule slots" on public.booking_schedule_slots;
create policy "Admins can manage booking schedule slots"
on public.booking_schedule_slots
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage booking schedule overrides" on public.booking_schedule_overrides;
create policy "Admins can manage booking schedule overrides"
on public.booking_schedule_overrides
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.booking_schedules (name, slug, is_default, is_active)
values ('Working Hours', 'working-hours', true, true)
on conflict (slug) do update
set
  name = excluded.name,
  is_default = true,
  is_active = true;

with working_schedule as (
  select id
  from public.booking_schedules
  where slug = 'working-hours'
  limit 1
)
insert into public.booking_schedule_slots (
  schedule_id,
  weekday,
  day_name,
  start_time,
  end_time,
  sort_order
)
select
  working_schedule.id,
  availability.weekday,
  availability.day_name,
  availability.start_time,
  availability.end_time,
  1
from public.booking_availability availability
cross join working_schedule
where availability.is_open = true
  and not exists (
    select 1
    from public.booking_schedule_slots slot
    where slot.schedule_id = working_schedule.id
      and slot.weekday = availability.weekday
      and slot.sort_order = 1
  );

with working_schedule as (
  select id
  from public.booking_schedules
  where slug = 'working-hours'
  limit 1
)
update public.booking_resources resource
set schedule_id = working_schedule.id
from working_schedule
where resource.schedule_id is null;
