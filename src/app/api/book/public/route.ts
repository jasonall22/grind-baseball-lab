import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fallbackPublicBookingData,
  isoDate,
  normalizeClock,
  shiftDate,
  type PublicBookingCategory,
  type PublicBookingData,
  type PublicMembershipBillingPeriod,
  type PublicMembershipCreditLimitPeriod,
  type PublicMembershipCreditScope,
  type PublicMembershipCreditRule,
  type PublicBookingSchedule,
  type PublicBookingStaffAvailability,
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

function normalizeBillingPeriod(value: unknown): PublicMembershipBillingPeriod {
  return value === "Weekly" || value === "Yearly" ? value : "Monthly";
}

function normalizeCreditLimitPeriod(value: unknown): PublicMembershipCreditLimitPeriod {
  return value === "week" || value === "weekly" ? "weekly" : value === "month" || value === "monthly" ? "monthly" : "daily";
}

function normalizeCreditScope(value: unknown): PublicMembershipCreditScope {
  return value === "all_services" ? "all_services" : "selected_services";
}

function normalizeCreditRules(value: unknown): PublicMembershipCreditRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const rawServiceIds = Array.isArray(record.serviceIds)
        ? record.serviceIds
        : Array.isArray(record.service_ids)
          ? record.service_ids
          : [];
      return {
        id: String(record.id ?? `rule-${index + 1}`),
        serviceIds: stringArray(rawServiceIds),
        credits: Math.max(0, Math.floor(parseNumber(record.credits))),
        period: normalizeCreditLimitPeriod(record.period ?? record.credit_limit_period),
      };
    })
    .filter((rule) => rule.credits > 0 && rule.serviceIds.length > 0);
}

function legacyCreditRules(service: Record<string, unknown>): PublicMembershipCreditRule[] {
  const credits = Math.max(0, Math.floor(parseNumber(service.membership_credits_per_day)));
  if (credits < 1) return [];
  const creditScope = normalizeCreditScope(service.membership_credit_scope);
  const serviceIds = creditScope === "all_services" ? ["all_services"] : stringArray(service.membership_eligible_service_ids);
  if (!serviceIds.length) return [];
  return [
    {
      id: "legacy",
      serviceIds,
      credits,
      period: normalizeCreditLimitPeriod(service.membership_credit_limit_period),
    },
  ];
}

function normalizeRecurrenceFrequency(value: unknown) {
  return value === "weekly" ? "weekly" : "daily";
}

function staffAvailabilityRowsForRange(rows: Array<Record<string, unknown>>, fromDate: string, throughDate: string): PublicBookingStaffAvailability[] {
  const byKey = new Map<string, PublicBookingStaffAvailability>();

  for (const row of rows) {
    const startDate = String(row.availability_date);
    const recurrenceEndDate = typeof row.recurrence_end_date === "string" ? row.recurrence_end_date : startDate;
    const finalDate = row.is_recurring ? recurrenceEndDate : startDate;
    const frequency = normalizeRecurrenceFrequency(row.recurrence_frequency);
    const stepDays = frequency === "weekly" ? 7 : 1;
    let date = startDate;
    let index = 0;

    while (date <= finalDate && date <= throughDate && index < 120) {
      if (date >= fromDate) {
        const entry = {
          id: `${String(row.id)}-${date}`,
          staffId: String(row.staff_member_id ?? ""),
          date,
          start: normalizeClock(String(row.start_time)),
          end: normalizeClock(String(row.end_time)),
          resourceNames: stringArray(row.resource_names),
        };
        const key = `${entry.staffId}-${entry.date}-${entry.start}-${entry.end}-${entry.resourceNames.join("|")}`;
        byKey.set(key, entry);
      }
      date = shiftDate(date, stepDays);
      index += 1;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin() as unknown as PublicSupabaseClient;
    const today = new Date();
    const fromDate = isoDate(today);
    const throughDate = new Date(today);
    throughDate.setDate(today.getDate() + 90);
    const throughDateIso = isoDate(throughDate);

    const [
      settingsResult,
      resourcesResult,
      servicesResult,
      serviceNamesResult,
      schedulesResult,
      slotsResult,
      overridesResult,
      bookingsResult,
      staffResult,
      staffAvailabilityResult,
    ] = await Promise.all([
      supabase.from("booking_settings").select("*").eq("key", "default").maybeSingle(),
      supabase.from("booking_resources").select("id,name,sort_order,is_active,schedule_id").eq("is_active", true).order("sort_order"),
      supabase.from("booking_services").select("*").eq("status", "Active").order("sort_order"),
      supabase.from("booking_services").select("id,name").order("sort_order"),
      supabase.from("booking_schedules").select("id,name,slug,is_default,is_active").eq("is_active", true),
      supabase.from("booking_schedule_slots").select("id,schedule_id,weekday,start_time,end_time,sort_order").order("weekday").order("sort_order"),
      supabase.from("booking_schedule_overrides").select("schedule_id,override_date,is_closed,start_time,end_time,sort_order").order("override_date").order("sort_order"),
      supabase
        .from("booking_bookings")
        .select("id,booking_date,start_time,end_time,resource_id,staff_member_id,status")
        .gte("booking_date", fromDate)
        .lte("booking_date", throughDateIso)
        .neq("status", "Cancelled"),
      supabase
        .from("booking_staff_members")
        .select("id,full_name,email,role,is_active,sort_order,calendar_color")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("booking_staff_availability")
        .select("id,staff_member_id,availability_date,start_time,end_time,resource_names,is_recurring,recurrence_frequency,recurrence_end_date")
        .order("availability_date")
        .order("start_time"),
    ]);

    const failed = [
      settingsResult,
      resourcesResult,
      servicesResult,
      serviceNamesResult,
      schedulesResult,
      slotsResult,
      overridesResult,
      bookingsResult,
      staffResult,
      staffAvailabilityResult,
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
    const serviceNameMap = new Map(
      ((serviceNamesResult.data ?? []) as Array<Record<string, unknown>>).map((service) => [
        String(service.id),
        String(service.name ?? ""),
      ])
    );

    const services = ((servicesResult.data ?? []) as Array<Record<string, unknown>>).map((service) => {
      const membershipCreditRules = normalizeCreditRules(service.membership_credit_rules);
      const rules = membershipCreditRules.length ? membershipCreditRules : legacyCreditRules(service);
      const eligibleServiceIds = Array.from(
        new Set(rules.flatMap((rule) => rule.serviceIds).filter((serviceId) => serviceId !== "all_services"))
      );
      return {
        id: String(service.id),
        name: String(service.name ?? ""),
        category: normalizeCategory(service.service_type),
        duration: Math.max(15, parseNumber(service.duration_minutes, 30)),
        price: parseNumber(service.price),
        previewText: String(service.preview_text ?? ""),
        description: String(service.description ?? ""),
        mediaUrl: String(service.media_url ?? ""),
        rooms: stringArray(service.resource_names),
        resourceId: typeof service.resource_id === "string" ? service.resource_id : null,
        instructors: stringArray(service.instructor_names),
        scheduleId: typeof service.schedule_id === "string" ? service.schedule_id : null,
        collectTax: Boolean(service.collect_tax),
        collectFee: Boolean(service.collect_fee),
        membershipBillingPeriod: normalizeBillingPeriod(service.membership_billing_period),
        membershipCreditsPerDay: Math.max(0, Math.floor(parseNumber(service.membership_credits_per_day))),
        membershipCreditLimitPeriod: normalizeCreditLimitPeriod(service.membership_credit_limit_period),
        membershipCreditScope: normalizeCreditScope(service.membership_credit_scope),
        membershipEligibleServiceIds: eligibleServiceIds.length ? eligibleServiceIds : stringArray(service.membership_eligible_service_ids),
        membershipEligibleServiceNames: (eligibleServiceIds.length ? eligibleServiceIds : stringArray(service.membership_eligible_service_ids))
          .map((serviceId) => serviceNameMap.get(serviceId) ?? "")
          .filter(Boolean),
        membershipCreditRules: rules,
        stripePriceId: typeof service.stripe_price_id === "string" && service.stripe_price_id.trim() ? service.stripe_price_id.trim() : null,
      };
    });

    const payload: PublicBookingData = {
      settings: {
        facilityName: String(settings.facility_name || fallbackSettings.facilityName),
        address: String(settings.address || fallbackSettings.address),
        phone: String(settings.phone || fallbackSettings.phone),
        taxRates: normalizeMoneySettings(settings.tax_rates, fallbackSettings.taxRates) as PublicBookingData["settings"]["taxRates"],
        customFees: normalizeMoneySettings(settings.custom_fees, fallbackSettings.customFees) as PublicBookingData["settings"]["customFees"],
        waiverEnabled: Boolean(settings.waiver_enabled ?? fallbackSettings.waiverEnabled),
        waiverDocumentUrl: String(settings.waiver_document_url || fallbackSettings.waiverDocumentUrl),
        waiverDocumentName: String(settings.waiver_document_name || fallbackSettings.waiverDocumentName),
        waiverIntro: String(settings.waiver_intro || fallbackSettings.waiverIntro),
        waiverAllowInPerson: Boolean(settings.waiver_allow_in_person ?? fallbackSettings.waiverAllowInPerson),
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
        staffId: typeof booking.staff_member_id === "string" ? booking.staff_member_id : null,
      })),
      staff: ((staffResult.data ?? []) as Array<Record<string, unknown>>).map((member) => ({
        id: String(member.id),
        name: String(member.full_name ?? ""),
        email: String(member.email ?? ""),
        role: String(member.role ?? "Staff"),
        calendarColor: String(member.calendar_color ?? "#249b41"),
      })),
      staffAvailability: staffAvailabilityRowsForRange(
        (staffAvailabilityResult.data ?? []) as Array<Record<string, unknown>>,
        fromDate,
        throughDateIso
      ),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json(fallbackPublicBookingData, {
      headers: { "x-grind-booking-fallback": "true" },
    });
  }
}
