import { NextResponse } from "next/server";

import {
  minutesToTime,
  normalizeClock,
  scheduleSlotsForDate,
  serviceRooms,
  timeToMinutes,
  type PublicBookingData,
} from "@/lib/publicBooking";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type QueryError = { message?: string } | null;
type QueryResult<T = unknown> = { data: T; error: QueryError };
type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  insert(values: unknown): QueryBuilder<T>;
  update(values: unknown): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
};
type PublicSupabaseClient = {
  from(table: string): QueryBuilder;
};

type CreateBookingBody = {
  serviceId?: string;
  date?: string;
  start?: string;
  resourceId?: string;
  staffMemberId?: string;
  customerId?: string;
  parentName?: string;
  playerName?: string;
  email?: string;
  phone?: string;
  paymentMethod?: "online" | "in-person" | "membership-credit";
  waiverAgreed?: boolean;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeCreditLimitPeriod(value: unknown) {
  if (value === "week" || value === "weekly") return "week";
  if (value === "month" || value === "monthly") return "month";
  return "day";
}

function localDateFromIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function creditPeriodRange(date: string, periodValue: unknown) {
  const period = normalizeCreditLimitPeriod(periodValue);
  const start = localDateFromIso(date);
  const end = localDateFromIso(date);

  if (period === "week") {
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (period === "month") {
    start.setUTCDate(1);
    end.setUTCMonth(start.getUTCMonth() + 1, 0);
  }

  return { start: isoFromDate(start), end: isoFromDate(end) };
}

function membershipCoversService(membership: Record<string, unknown>, serviceId: string, date: string) {
  const currentPeriodStart = clean(membership.current_period_start).slice(0, 10);
  const currentPeriodEnd = clean(membership.current_period_end).slice(0, 10);
  if (currentPeriodStart && date < currentPeriodStart) return false;
  if (currentPeriodEnd && date >= currentPeriodEnd) return false;
  if (clean(membership.credit_scope) === "all_services") return true;
  return stringArray(membership.eligible_service_ids).includes(serviceId);
}

function lessonCoachOptions(data: PublicBookingData, service: PublicBookingData["services"][number]) {
  const assignedNames = new Set(service.instructors.map((name) => name.trim().toLowerCase()).filter(Boolean));
  if (assignedNames.size) return data.staff.filter((member) => assignedNames.has(member.name.trim().toLowerCase()));
  return data.staff.filter((member) => ["instructor", "owner", "admin"].includes(member.role.trim().toLowerCase()));
}

function coachAvailabilityCovers(
  data: PublicBookingData,
  staffMemberId: string,
  date: string,
  start: string,
  end: string,
  resourceName: string
) {
  return data.staffAvailability.some(
    (entry) =>
      entry.staffId === staffMemberId &&
      entry.date === date &&
      timeToMinutes(start) >= timeToMinutes(entry.start) &&
      timeToMinutes(end) <= timeToMinutes(entry.end) &&
      (!entry.resourceNames.length || entry.resourceNames.includes(resourceName))
  );
}

async function loadPublicData(origin: string): Promise<PublicBookingData> {
  const response = await fetch(`${origin.replace(/\/$/, "")}/api/book/public`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load booking data.");
  if (response.headers.get("x-grind-booking-fallback") === "true") {
    throw new Error("Live booking data is temporarily unavailable.");
  }
  return response.json() as Promise<PublicBookingData>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBookingBody;
    const serviceId = String(body.serviceId ?? "");
    const date = String(body.date ?? "");
    const start = normalizeClock(body.start);
    const resourceId = String(body.resourceId ?? "");
    const staffMemberId = String(body.staffMemberId ?? "").trim();
    const submittedCustomerId = String(body.customerId ?? "").trim();
    const parentName = String(body.parentName ?? "").trim();
    const playerName = String(body.playerName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();

    if (!serviceId || !date || !start || !resourceId) return badRequest("Choose a service, date, time, and room.");
    if (!parentName || !playerName || !email) return badRequest("Enter the parent name, player name, and email.");

    const data = await loadPublicData(new URL(req.url).origin);
    const service = data.services.find((item) => item.id === serviceId);
    const resource = data.resources.find((item) => item.id === resourceId);
    if (!service || !resource) return badRequest("That service or room is no longer available.", 409);
    if (!serviceRooms(service, data.resources).includes(resource.name)) {
      return badRequest("That room is not available for this service.", 409);
    }

    const end = minutesToTime(timeToMinutes(start) + service.duration);
    const schedulesById = new Map(data.schedules.map((schedule) => [schedule.id, schedule]));
    const schedule = schedulesById.get(service.scheduleId || "") ?? schedulesById.get(resource.scheduleId || "") ?? data.schedules.find((item) => item.isDefault);
    const openSlots = scheduleSlotsForDate(schedule, date);
    const fitsOpenSlot = openSlots.some((slot) => timeToMinutes(start) >= timeToMinutes(slot.start) && timeToMinutes(end) <= timeToMinutes(slot.end));

    if (!fitsOpenSlot) return badRequest("That time is outside the current booking hours.", 409);

    if (service.category === "lessons") {
      if (!staffMemberId) return badRequest("Choose a hitting coach for this lesson.", 400);

      const coachOptions = lessonCoachOptions(data, service);
      if (!coachOptions.some((coach) => coach.id === staffMemberId)) {
        return badRequest("That coach is not available for this lesson.", 409);
      }

      if (!coachAvailabilityCovers(data, staffMemberId, date, start, end, resource.name)) {
        return badRequest("That coach is not available at this time.", 409);
      }
    }

    const conflict = data.bookings.some(
      (booking) => booking.date === date && booking.resourceId === resourceId && overlaps(start, end, booking.start, booking.end)
    );

    if (conflict) return badRequest("That room is already booked for that time.", 409);

    const coachConflict =
      service.category === "lessons" &&
      data.bookings.some(
        (booking) => booking.date === date && booking.staffId === staffMemberId && overlaps(start, end, booking.start, booking.end)
      );

    if (coachConflict) return badRequest("That coach already has a booking for that time.", 409);

    const supabase = getSupabaseAdmin() as unknown as PublicSupabaseClient;
    const existingCustomer = submittedCustomerId
      ? await supabase.from("booking_customers").select("id,waiver_agreed").eq("id", submittedCustomerId).maybeSingle()
      : await supabase
          .from("booking_customers")
          .select("id,waiver_agreed")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    if (existingCustomer.error) throw existingCustomer.error;

    let customerId = (existingCustomer.data as { id?: string; waiver_agreed?: boolean | null } | null)?.id;
    const existingWaiverAgreed = Boolean((existingCustomer.data as { waiver_agreed?: boolean | null } | null)?.waiver_agreed);
    if (data.settings.waiverEnabled && !existingWaiverAgreed && body.waiverAgreed !== true) {
      return badRequest("Agree to the liability waiver before completing this booking.");
    }

    if (!customerId) {
      const customerResult = await supabase
        .from("booking_customers")
        .insert({
          parent_name: parentName,
          player_name: playerName,
          email,
          phone,
          waiver_agreed: Boolean(body.waiverAgreed),
          notes: "Created from public booking page.",
        })
        .select("id")
        .single();

      if (customerResult.error) throw customerResult.error;
      customerId = (customerResult.data as { id: string }).id;
    } else if (body.waiverAgreed === true && !existingWaiverAgreed) {
      const waiverResult = await supabase.from("booking_customers").update({ waiver_agreed: true }).eq("id", customerId);
      if (waiverResult.error) throw waiverResult.error;
    }

    let membershipCreditRedemption: { membershipId: string; label: string } | null = null;

    if (body.paymentMethod === "membership-credit") {
      const membershipsResult = await supabase
        .from("booking_customer_memberships")
        .select("id,membership_service_id,status,credits_per_day,credit_limit_period,credit_scope,eligible_service_ids,current_period_start,current_period_end")
        .eq("customer_id", customerId)
        .eq("status", "Active");

      if (membershipsResult.error) throw membershipsResult.error;

      const eligibleMemberships = ((membershipsResult.data ?? []) as Array<Record<string, unknown>>)
        .filter((membership) => Number(membership.credits_per_day ?? 0) > 0)
        .filter((membership) => membershipCoversService(membership, service.id, date));

      for (const membership of eligibleMemberships) {
        const creditsAllowed = Math.max(0, Math.floor(Number(membership.credits_per_day ?? 0)));
        const range = creditPeriodRange(date, membership.credit_limit_period);
        const ledgerResult = await supabase
          .from("booking_membership_credit_ledger")
          .select("amount,reason,credit_date")
          .eq("customer_membership_id", membership.id)
          .gte("credit_date", range.start)
          .lte("credit_date", range.end);

        if (ledgerResult.error) throw ledgerResult.error;

        const usedCredits = ((ledgerResult.data ?? []) as Array<Record<string, unknown>>).reduce((total, row) => {
          if (clean(row.reason) !== "booking") return total;
          return total + Math.abs(Number(row.amount ?? 0));
        }, 0);

        if (usedCredits < creditsAllowed) {
          membershipCreditRedemption = {
            membershipId: String(membership.id),
            label: `${creditsAllowed} credit${creditsAllowed === 1 ? "" : "s"} per ${normalizeCreditLimitPeriod(membership.credit_limit_period)}`,
          };
          break;
        }
      }

      if (!membershipCreditRedemption) {
        return badRequest("No membership credits are available for this booking. Please choose another payment option.", 409);
      }
    }

    const bookingResult = await supabase
      .from("booking_bookings")
      .insert({
        booking_date: date,
        start_time: start,
        end_time: end,
        customer_id: customerId,
        player_name: playerName,
        service_id: service.id,
        resource_id: resource.id,
        staff_member_id: service.category === "lessons" ? staffMemberId : null,
        status: "Pending",
        paid: Boolean(membershipCreditRedemption),
        notes: `Public booking. Payment selected: ${
          body.paymentMethod === "membership-credit" ? "membership credit" : body.paymentMethod === "online" ? "online" : "in person"
        }.`,
      })
      .select("id")
      .single();

    if (bookingResult.error) throw bookingResult.error;

    if (membershipCreditRedemption) {
      const ledgerResult = await supabase.from("booking_membership_credit_ledger").insert({
        customer_membership_id: membershipCreditRedemption.membershipId,
        customer_id: customerId,
        booking_id: (bookingResult.data as { id: string }).id,
        service_id: service.id,
        credit_date: date,
        amount: -1,
        reason: "booking",
        note: `${service.name} on ${date} ${start}-${end}. ${membershipCreditRedemption.label}.`,
      });

      if (ledgerResult.error) throw ledgerResult.error;
    }

    return NextResponse.json({ ok: true, bookingId: (bookingResult.data as { id: string }).id });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not create booking.", 500);
  }
}
