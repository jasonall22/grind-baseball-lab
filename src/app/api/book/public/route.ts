import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fallbackPublicBookingData,
  normalizeClock,
  type PublicBookingCategory,
  type PublicBookingData,
  type PublicBookingSchedule,
} from "@/lib/publicBooking";

export const dynamic = "force-dynamic";

type QueryError = { message?: string } | null;
type QueryResult<T = unknown> = { data: T; error: QueryError };
type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  maybeSingle(): Promise<QueryResult<T>>;
};
type PublicSupabaseClient = {
  from(table: string): QueryBuilder;
};

function parseNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeCategory(value: unknown): PublicBookingCategory {
  if (
    value === "rentals" ||
    value === "lessons" ||
    value === "camps" ||
    value === "classes" ||
    value === "memberships" ||
    value === "packages"
  ) {
    return value;
  }
  return "rentals";
}

function normalizeMoneySettings(value: unknown, fallback: unknown[]) {
  return Array.isArray(value) && value.length ? (value as Array<{ id: string; name: string }>) : fallback;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin() as unknown as PublicSupabaseClient;
    const today = new Date();
    const fromDate = today.toISOString().slice(0, 10);
    const throughDate = new Date(today);
    throughDate.setDate(today.getDate() + 90);

    const [
      settingsResult,
      resourcesResult,
      servicesResult,
      schedulesResult,
      slotsResult,
      overridesResult,
      bookingsResult,
      staffResult,
    ] = await Promise.all([
      supabase.from("booking_settings").select("*").eq("key", "default").maybeSingle(),
      supabase.from("booking_resources").select("id,name,sort_order,is_active,schedule_id").eq("is_active", true).order("sort_order"),
      supabase.from("booking_services").select("*").eq("status", "Active").order("sort_order"),
      supabase.from("booking_schedules").select("id,name,slug,is_default,is_active").eq("is_active", true),
      supabase.from("booking_schedule_slots").select("id,schedule_id,weekday,start_time,end_time,sort_order").order("weekday").order("sort_order"),
      supabase.from("booking_schedule_overrides").select("schedule_id,override_date,is_closed,start_time,end_time,sort_order").order("override_date").order("sort_order"),
      supabase
        .from("booking_bookings")
        .select("id,booking_date,start_time,end_time,resource_id,status")
        .gte("booking_date", fromDate)
        .lte("booking_date", throughDate.toISOString().slice(0, 10))
        .neq("status", "Cancelled"),
      supabase.from("booking_staff_members").select("id,full_name,email,role,is_active,sort_order").eq("is_active", true).order("sort_order"),
    ]);

    const failed = [
      settingsResult,
      resourcesResult,
      servicesResult,
      schedulesResult,
      slotsResult,
      overridesResult,
      bookingsResult,
      staffResult,
    ].find((result) => result.error);

    if (failed?.error) throw failed.error;

    const rawSchedules = (schedulesResult.data ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      is_default: boolean;
    }>;
    const scheduleMap = new Map<string, PublicBookingSchedule>();

    for (const schedule of rawSchedules) {
      scheduleMap.set(schedule.id, {
        id: schedule.id,
        name: schedule.name,
        slug: schedule.slug,
        isDefault: Boolean(schedule.is_default),
        slotsByWeekday: {},
        overridesByDate: {},
      });
    }

    for (const slot of (slotsResult.data ?? []) as Array<{
      id: string;
      schedule_id: string;
      weekday: number;
      start_time: string;
      end_time: string;
      sort_order: number;
    }>) {
      const schedule = scheduleMap.get(slot.schedule_id);
      if (!schedule) continue;
      const key = String(slot.weekday);
      schedule.slotsByWeekday[key] = [
        ...(schedule.slotsByWeekday[key] ?? []),
        {
          id: slot.id,
          start: normalizeClock(slot.start_time),
          end: normalizeClock(slot.end_time),
          sortOrder: slot.sort_order,
        },
      ].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    for (const override of (overridesResult.data ?? []) as Array<{
      schedule_id: string;
      override_date: string;
      is_closed: boolean;
      start_time: string | null;
      end_time: string | null;
      sort_order: number;
    }>) {
      const schedule = scheduleMap.get(override.schedule_id);
      if (!schedule) continue;
      const date = override.override_date;
      const current = schedule.overridesByDate[date] ?? { isClosed: Boolean(override.is_closed), slots: [] };
      if (override.is_closed) {
        schedule.overridesByDate[date] = { isClosed: true, slots: [] };
      } else if (override.start_time && override.end_time) {
        schedule.overridesByDate[date] = {
          isClosed: false,
          slots: [
            ...current.slots,
            {
              id: `${override.schedule_id}-${date}-${override.sort_order}`,
              start: normalizeClock(override.start_time),
              end: normalizeClock(override.end_time),
              sortOrder: override.sort_order,
            },
          ].sort((a, b) => a.sortOrder - b.sortOrder),
        };
      }
    }

    const settings = (settingsResult.data ?? {}) as Record<string, unknown>;
    const fallbackSettings = fallbackPublicBookingData.settings;
    const resources = ((resourcesResult.data ?? []) as Array<Record<string, unknown>>).map((resource) => ({
      id: String(resource.id),
      name: String(resource.name ?? ""),
      sortOrder: parseNumber(resource.sort_order),
      scheduleId: typeof resource.schedule_id === "string" ? resource.schedule_id : null,
    }));

    const services = ((servicesResult.data ?? []) as Array<Record<string, unknown>>).map((service) => ({
      id: String(service.id),
      name: String(service.name ?? ""),
      category: normalizeCategory(service.service_type),
      duration: Math.max(15, parseNumber(service.duration_minutes, 30)),
      price: parseNumber(service.price),
      rooms: stringArray(service.resource_names),
      resourceId: typeof service.resource_id === "string" ? service.resource_id : null,
      instructors: stringArray(service.instructor_names),
      scheduleId: typeof service.schedule_id === "string" ? service.schedule_id : null,
      collectTax: Boolean(service.collect_tax),
      collectFee: Boolean(service.collect_fee),
    }));

    const payload: PublicBookingData = {
      settings: {
        facilityName: String(settings.facility_name || fallbackSettings.facilityName),
        address: String(settings.address || fallbackSettings.address),
        phone: String(settings.phone || fallbackSettings.phone),
        taxRates: normalizeMoneySettings(settings.tax_rates, fallbackSettings.taxRates) as PublicBookingData["settings"]["taxRates"],
        customFees: normalizeMoneySettings(settings.custom_fees, fallbackSettings.customFees) as PublicBookingData["settings"]["customFees"],
      },
      resources,
      services,
      schedules: Array.from(scheduleMap.values()),
      bookings: ((bookingsResult.data ?? []) as Array<Record<string, unknown>>).map((booking) => ({
        id: String(booking.id),
        date: String(booking.booking_date),
        start: normalizeClock(String(booking.start_time)),
        end: normalizeClock(String(booking.end_time)),
        resourceId: typeof booking.resource_id === "string" ? booking.resource_id : null,
      })),
      staff: ((staffResult.data ?? []) as Array<Record<string, unknown>>).map((member) => ({
        id: String(member.id),
        name: String(member.full_name ?? ""),
        email: String(member.email ?? ""),
        role: String(member.role ?? "Staff"),
      })),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json(fallbackPublicBookingData, {
      headers: { "x-grind-booking-fallback": "true" },
    });
  }
}
