"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import Image from "next/image";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import {
  calculatePublicTotals,
  fallbackPublicBookingData,
  initials,
  isoDate,
  minutesToTime,
  money,
  parseLocalDate,
  publicBookingCategoryLabels,
  scheduleSlotsForDate,
  serviceRooms,
  shiftDate,
  timeLabel,
  timeToMinutes,
  type PublicBookingCategory,
  type PublicBookingData,
  type PublicBookingSchedule,
  type PublicBookingService,
} from "@/lib/publicBooking";
import { supabase } from "@/lib/supabaseClient";

const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type BookingStep = "overview" | "player" | "time" | "summary" | "done";
type TimeChoice = { start: string; end: string; resourceId: string; resourceName: string };
type MembershipCardSetup = { clientSecret: string; setupIntentId: string; customerId: string };
type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  birthDate: string;
  gender?: string;
  age?: string;
};
type ParentAccount = {
  id?: string;
  parentName: string;
  playerName: string;
  playerAge?: string;
  playerBirthDate?: string;
  gender?: string;
  email: string;
  phone: string;
  emergencyContactName?: string;
  emergencyContactEmail?: string;
  emergencyContactPhone?: string;
  familyMembers?: FamilyMember[];
  waiverAgreed?: boolean;
  isAdmin?: boolean;
};
type CustomerBookingRecord = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: string;
  paid: boolean;
  serviceName: string;
  serviceCategory: string;
  resourceName: string;
  staffName: string;
  playerName: string;
};
type CustomerMembershipCancelRequest = {
  id: string;
  status: string;
  message: string;
  requestedAt: string;
  reviewedAt: string;
  adminNotes: string;
};
type CustomerMembershipRecord = {
  id: string;
  serviceId: string;
  status: string;
  serviceName: string;
  billingPeriod: string;
  priceCents: number;
  creditsPerDay: number;
  creditLimitPeriod: string;
  creditScope: string;
  eligibleServiceIds: string[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  startedAt: string;
  cancelledAt: string;
  autoRenew: boolean;
  latestReceiptUrl: string;
  latestPaymentAmountCents: number;
  latestPaymentStatus: string;
  latestPaymentDate: string;
  latestPaymentMethod: string;
  cancelRequest: CustomerMembershipCancelRequest | null;
};
type CustomerDashboard = {
  upcomingBookings: CustomerBookingRecord[];
  pastBookings: CustomerBookingRecord[];
  memberships: CustomerMembershipRecord[];
  membershipHistory: CustomerMembershipRecord[];
};
type CustomerAccountPayload = {
  customer: ParentAccount | null;
  dashboard?: CustomerDashboard;
};
type AccountForm = {
  parentFirstName: string;
  parentLastName: string;
  email: string;
  phone: string;
  password: string;
  playerFirstName: string;
  playerLastName: string;
  playerBirthDate: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactEmail: string;
  emergencyContactPhone: string;
  waiverAgreed: boolean;
};
type SignInForm = {
  email: string;
  password: string;
};
type ResetPasswordForm = {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
};
type ChildForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
};
type ChildSetupStep = "prompt" | "child" | "another";

const categoryOrder: PublicBookingCategory[] = ["rentals", "lessons", "camps", "classes", "memberships", "packages"];
const emptyAccountForm: AccountForm = {
  parentFirstName: "",
  parentLastName: "",
  email: "",
  phone: "",
  password: "",
  playerFirstName: "",
  playerLastName: "",
  playerBirthDate: "",
  gender: "",
  emergencyContactName: "",
  emergencyContactEmail: "",
  emergencyContactPhone: "",
  waiverAgreed: false,
};
const emptyChildForm: ChildForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "",
};

function emptyCustomerDashboard(): CustomerDashboard {
  return { upcomingBookings: [], pastBookings: [], memberships: [], membershipHistory: [] };
}

function normalizeCustomerDashboard(value?: Partial<CustomerDashboard> | null): CustomerDashboard {
  return {
    upcomingBookings: Array.isArray(value?.upcomingBookings) ? value.upcomingBookings : [],
    pastBookings: Array.isArray(value?.pastBookings) ? value.pastBookings : [],
    memberships: Array.isArray(value?.memberships) ? value.memberships : [],
    membershipHistory: Array.isArray(value?.membershipHistory) ? value.membershipHistory : [],
  };
}

function todayIso() {
  return isoDate(new Date());
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].map((value) => value.trim()).filter(Boolean).join(" ");
}

function isoDateToUs(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
}

function usDateToIso(value: string) {
  const [month, day, year] = value.split("/");
  if (!year || !month || !day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function familyDobLabel(member: FamilyMember) {
  if (member.birthDate) return `DOB ${member.birthDate}`;
  return "";
}

function normalizeFamilyMembers(value?: FamilyMember[]) {
  return (value ?? []).filter((member) => member.name.trim());
}

function familyMembersForAccount(account: ParentAccount | null): FamilyMember[] {
  if (!account) return [];
  return normalizeFamilyMembers(account.familyMembers);
}

function buildFamilyMember(firstName: string, lastName: string, birthDate: string, gender = ""): FamilyMember {
  const name = fullName(firstName, lastName);
  return {
    id: `player-${Date.now()}`,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    name,
    birthDate: birthDate ? isoDateToUs(birthDate) : "",
    gender: gender.trim(),
  };
}

function durationLabel(minutes: number) {
  return `${minutes} mins`;
}

function membershipPeriodLabel(period: string) {
  return period === "Weekly" ? "week" : period === "Yearly" ? "year" : "month";
}

function membershipCreditPeriodLabel(period: string) {
  return period === "week" || period === "weekly" ? "week" : period === "month" || period === "monthly" ? "month" : "day";
}

function membershipStatusClasses(status: string) {
  switch (status) {
    case "Active":
      return "bg-[#e8f8ef] text-[#087238]";
    case "Cancelled":
      return "bg-red-50 text-red-700";
    case "Expired":
      return "bg-black/[0.06] text-black/55";
    case "Past Due":
      return "bg-orange-50 text-orange-700";
    case "Paused":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-black/[0.06] text-black/65";
  }
}

function membershipCreditLabel(service: PublicBookingService) {
  const credits = Math.max(0, Math.floor(Number(service.membershipCreditsPerDay ?? 0)));
  if (!credits) return "Member booking credits";
  const period = membershipCreditPeriodLabel(service.membershipCreditLimitPeriod);
  return `${credits} credit${credits === 1 ? "" : "s"} per ${period}`;
}

function membershipRecordCreditLabel(membership: CustomerMembershipRecord) {
  const credits = Math.max(0, Math.floor(Number(membership.creditsPerDay ?? 0)));
  const period = membershipCreditPeriodLabel(membership.creditLimitPeriod);
  return `${credits} credit${credits === 1 ? "" : "s"} per ${period}`;
}

function membershipIsAvailableForDate(membership: CustomerMembershipRecord, date: string) {
  const start = membership.currentPeriodStart?.slice(0, 10);
  const end = membership.currentPeriodEnd?.slice(0, 10);
  if (start && date < start) return false;
  if (end && date >= end) return false;
  return true;
}

function membershipCoversService(membership: CustomerMembershipRecord, service: PublicBookingService, date: string) {
  if (membership.status !== "Active" || membership.creditsPerDay <= 0) return false;
  if (!membershipIsAvailableForDate(membership, date)) return false;
  if (membership.creditScope === "all_services") return true;
  return membership.eligibleServiceIds.includes(service.id);
}

function serviceCardDescription(service: PublicBookingService, data: PublicBookingData) {
  if (service.category === "memberships") {
    return `${membershipCreditLabel(service)} for eligible services.`;
  }
  return `Book ${durationLabel(service.duration).toLowerCase()} of ${
    service.category === "lessons" ? "private instruction" : serviceRooms(service, data.resources).join(", ")
  }.`;
}

function serviceCardBadge(service: PublicBookingService) {
  if (service.category === "memberships") return `${service.membershipBillingPeriod} membership`;
  return durationLabel(service.duration);
}

function compactTimeLabel(value: string) {
  return timeLabel(value).replace(":00", "");
}

function relativeDayLabel(date: string, today: string) {
  if (date === today) return "today";
  if (date === shiftDate(today, 1)) return "tomorrow";
  return parseLocalDate(date).toLocaleDateString("en-US", { weekday: "short" });
}

function facilityHoursStatus(schedules: PublicBookingSchedule[], now: Date) {
  const schedule =
    schedules.find((item) => item.isDefault) ??
    schedules.find((item) => item.slug === "working-hours") ??
    schedules[0] ??
    null;
  if (!schedule) return { isOpen: false, label: "Hours unavailable" };

  const today = isoDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todaySlots = [...scheduleSlotsForDate(schedule, today)].sort(
    (left, right) => timeToMinutes(left.start) - timeToMinutes(right.start)
  );
  const openSlot = todaySlots.find((slot) => currentMinutes >= timeToMinutes(slot.start) && currentMinutes < timeToMinutes(slot.end));
  if (openSlot) {
    return { isOpen: true, label: `Open - Closes ${compactTimeLabel(openSlot.end)} today` };
  }

  const laterSlot = todaySlots.find((slot) => currentMinutes < timeToMinutes(slot.start));
  if (laterSlot) {
    return { isOpen: false, label: `Closed - Opens ${compactTimeLabel(laterSlot.start)} today` };
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const date = shiftDate(today, offset);
    const slots = [...scheduleSlotsForDate(schedule, date)].sort(
      (left, right) => timeToMinutes(left.start) - timeToMinutes(right.start)
    );
    const nextSlot = slots[0];
    if (nextSlot) {
      return {
        isOpen: false,
        label: `Closed - Opens ${compactTimeLabel(nextSlot.start)} ${relativeDayLabel(date, today)}`,
      };
    }
  }

  return { isOpen: false, label: "Closed" };
}

function directionsHref(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function phoneHref(phone: string, mode: "call" | "text") {
  const normalized = phone.replace(/[^\d+]/g, "");
  return `${mode === "call" ? "tel" : "sms"}:${normalized}`;
}

function formatLongDate(value: string) {
  return parseLocalDate(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isConflict(choice: TimeChoice, date: string, bookings: PublicBookingData["bookings"]) {
  return bookings.some(
    (booking) =>
      booking.date === date &&
      booking.resourceId === choice.resourceId &&
      timeToMinutes(choice.start) < timeToMinutes(booking.end) &&
      timeToMinutes(choice.end) > timeToMinutes(booking.start)
  );
}

function isCoachConflict(choice: TimeChoice, date: string, staffId: string, bookings: PublicBookingData["bookings"]) {
  return bookings.some(
    (booking) =>
      booking.staffId === staffId &&
      booking.date === date &&
      timeToMinutes(choice.start) < timeToMinutes(booking.end) &&
      timeToMinutes(choice.end) > timeToMinutes(booking.start)
  );
}

function staffAvailabilityCovers(data: PublicBookingData, choice: TimeChoice, date: string, staffId: string) {
  return data.staffAvailability.some(
    (entry) =>
      entry.staffId === staffId &&
      entry.date === date &&
      timeToMinutes(choice.start) >= timeToMinutes(entry.start) &&
      timeToMinutes(choice.end) <= timeToMinutes(entry.end) &&
      (!entry.resourceNames.length || entry.resourceNames.includes(choice.resourceName))
  );
}

function coachOptionsForService(data: PublicBookingData, service: PublicBookingService | null) {
  if (!service || service.category !== "lessons") return [];
  const assignedNames = new Set(service.instructors.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const staff = assignedNames.size
    ? data.staff.filter((member) => assignedNames.has(member.name.trim().toLowerCase()))
    : data.staff.filter((member) => ["instructor", "owner", "admin"].includes(member.role.trim().toLowerCase()));

  return staff.length
    ? staff
    : service.instructors.map((name) => ({
        id: `coach-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        email: "",
        role: "Instructor",
        calendarColor: "#249b41",
      }));
}

function getAvailableSlots(
  data: PublicBookingData,
  service: PublicBookingService | null,
  date: string,
  staffId?: string
): TimeChoice[] {
  if (!service) return [];
  if (service.category === "lessons" && !staffId) return [];
  const schedulesById = new Map(data.schedules.map((schedule) => [schedule.id, schedule]));
  const resourcesByName = new Map(data.resources.map((resource) => [resource.name, resource]));
  const defaultSchedule = data.schedules.find((schedule) => schedule.isDefault) ?? data.schedules[0];
  const now = new Date();
  const isToday = date === todayIso();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const choices: TimeChoice[] = [];

  for (const roomName of serviceRooms(service, data.resources)) {
    const resource = resourcesByName.get(roomName);
    if (!resource) continue;
    const schedule = schedulesById.get(service.scheduleId || "") ?? schedulesById.get(resource.scheduleId || "") ?? defaultSchedule;
    const openSlots = scheduleSlotsForDate(schedule, date);

    for (const openSlot of openSlots) {
      for (
        let start = timeToMinutes(openSlot.start);
        start + service.duration <= timeToMinutes(openSlot.end);
        start += Math.min(30, service.duration)
      ) {
        const choice = {
          start: minutesToTime(start),
          end: minutesToTime(start + service.duration),
          resourceId: resource.id,
          resourceName: resource.name,
        };
        if (isToday && start <= currentMinutes) continue;
        if (isConflict(choice, date, data.bookings)) continue;
        if (service.category === "lessons" && staffId && !staffAvailabilityCovers(data, choice, date, staffId)) continue;
        if (service.category === "lessons" && staffId && isCoachConflict(choice, date, staffId, data.bookings)) continue;
        choices.push(choice);
      }
    }
  }

  const seen = new Set<string>();
  return choices
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start) || a.resourceName.localeCompare(b.resourceName))
    .filter((choice) => {
      const key = `${choice.start}-${choice.resourceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function nextAvailableDateForCoach(data: PublicBookingData, service: PublicBookingService | null, fromDate: string, staffId: string) {
  if (!service || !staffId) return "";
  for (let offset = 0; offset <= 90; offset += 1) {
    const date = isoDate(new Date(parseLocalDate(fromDate).getTime() + offset * 24 * 60 * 60 * 1000));
    if (getAvailableSlots(data, service, date, staffId).length) return date;
  }
  return "";
}

function MonthCalendar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = parseLocalDate(value);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const blanks = first.getDay();
  const today = todayIso();
  const cells = Array.from({ length: blanks + daysInMonth }, (_, index) => {
    if (index < blanks) return "";
    return String(index - blanks + 1);
  });

  function moveMonth(delta: number) {
    const next = new Date(selected.getFullYear(), selected.getMonth() + delta, Math.min(selected.getDate(), 28));
    onChange(isoDate(next));
  }

  return (
    <div className="w-full max-w-[400px] rounded-[3px] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.22)]">
      <div className="mb-7 flex items-center justify-between text-[18px] font-semibold">
        <button type="button" onClick={() => moveMonth(-1)} className="rounded-full p-1 text-black/45 hover:bg-black/5">
          {"<"}
        </button>
        <span>
          {selected.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button type="button" onClick={() => moveMonth(1)} className="rounded-full p-1 text-black/45 hover:bg-black/5">
          {">"}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-[14px] text-black/45">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <div key={`${day}-${index}`}>{day}</div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[15px]">
        {cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} />;
          const date = isoDate(new Date(selected.getFullYear(), selected.getMonth(), Number(day)));
          const active = date === value;
          const available = date >= today;
          return (
            <button
              key={date}
              type="button"
              disabled={!available}
              onClick={() => onChange(date)}
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${
                active
                  ? "bg-[#221f1f] font-semibold text-white"
                  : available
                    ? "bg-[#91add1] text-white hover:bg-[#789bc4]"
                    : "text-black/25"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogoPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-black ${compact ? "h-full min-h-[108px] px-4" : "min-h-[300px] sm:min-h-[340px]"}`}>
      <Image
        src="/logo.png"
        alt="The Grind Baseball Lab"
        width={compact ? 180 : 620}
        height={compact ? 70 : 241}
        className={`relative ${compact ? "w-[118px] sm:w-[132px]" : "w-[620px] max-w-[78%]"} h-auto`}
        priority={!compact}
      />
    </div>
  );
}

function BookingHero({
  settings,
  schedules,
  onSelectCategory,
  onSignIn,
  showSignIn = false,
}: {
  settings: PublicBookingData["settings"];
  schedules: PublicBookingData["schedules"];
  onSelectCategory: (category: PublicBookingCategory) => void;
  onSignIn: () => void;
  showSignIn?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const hoursStatus = facilityHoursStatus(schedules, now);
  const [statusWord, ...statusDetailParts] = hoursStatus.label.split(" - ");
  const statusDetail = statusDetailParts.join(" - ");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <div className="relative overflow-hidden bg-black">
          <Image
            src="/membership-marketing-banner-layout-v4.png"
            alt="Memberships: More reps. More swings. Monthly credits for cages, lessons, and consistent player development."
            width={1240}
            height={310}
            className="h-auto w-full"
            priority
          />
          <button
            type="button"
            onClick={() => onSelectCategory("memberships")}
            className="absolute bottom-[7%] right-[7%] hidden rounded-[6px] bg-[#1784bd] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:bg-[#0f76aa] md:inline-flex lg:px-5 lg:py-2.5 lg:text-[13px]"
          >
            Become a Member
          </button>
          <div className="border-t border-[#1784bd] bg-black px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => onSelectCategory("memberships")}
              className="w-full rounded-[6px] bg-[#1784bd] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
            >
              Become a Member
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-black/10 px-4 py-4 sm:gap-5 sm:px-7 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1784bd] sm:text-[12px] sm:tracking-[0.16em]">Book Online</div>
            <h2 className="mt-2 text-[25px] font-semibold leading-[1.08] tracking-normal sm:text-[38px]">{settings.facilityName}</h2>
            <div className="mt-4 grid gap-2 text-[13px] font-semibold text-black/65 sm:flex sm:flex-wrap sm:text-[14px]">
              <a
                href={directionsHref(settings.address)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 rounded-full border border-black/10 bg-[#f7f8fa] px-3 py-2 text-center leading-snug transition hover:border-[#1784bd]/35 hover:bg-[#eef8fc] hover:text-[#0b6f9f] sm:px-4 sm:text-left"
              >
                {settings.address}
              </a>
              <span className="inline-flex min-w-0 overflow-hidden rounded-full border border-black/10 bg-[#f7f8fa]">
                <a
                  href={phoneHref(settings.phone, "call")}
                  className="min-w-0 flex-1 px-3 py-2 text-center transition hover:bg-[#eef8fc] hover:text-[#0b6f9f] sm:flex-none sm:px-4"
                >
                  {settings.phone}
                </a>
                <a
                  href={phoneHref(settings.phone, "text")}
                  className="border-l border-black/10 px-3 py-2 text-center transition hover:bg-[#eef8fc] hover:text-[#0b6f9f]"
                >
                  Text
                </a>
              </span>
              <span
                className={[
                  "rounded-full border px-3 py-2 text-center leading-snug sm:px-4 sm:text-left",
                  hoursStatus.isOpen ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50",
                ].join(" ")}
              >
                <span className={hoursStatus.isOpen ? "text-emerald-700" : "text-[#d10018]"}>{statusWord}</span>
                {statusDetail ? ` - ${statusDetail}` : ""}
              </span>
            </div>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3 lg:justify-end">
            {showSignIn ? (
              <button
                type="button"
                onClick={onSignIn}
                className="w-full rounded-[6px] border border-[#1784bd]/25 bg-[#eef8fc] px-4 py-3 text-[14px] font-semibold text-[#0b6f9f] transition hover:-translate-y-0.5 hover:bg-[#e3f3fa] sm:w-auto sm:px-5 sm:text-[15px]"
              >
                Sign in
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onSelectCategory("rentals")}
              className="w-full rounded-[6px] bg-black px-4 py-3 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#1f1f1f] sm:w-auto sm:px-5 sm:text-[15px]"
            >
              Book cage time
            </button>
            <button
              type="button"
              onClick={() => onSelectCategory("lessons")}
              className="w-full rounded-[6px] border border-black/15 bg-white px-4 py-3 text-[14px] font-semibold text-black transition hover:-translate-y-0.5 hover:bg-[#f5f6f7] sm:w-auto sm:px-5 sm:text-[15px]"
            >
              Book a lesson
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModalShell({
  step,
  children,
  footer,
  onBack,
  onClose,
  avatar,
}: {
  step: BookingStep;
  children: ReactNode;
  footer: ReactNode;
  onBack: () => void;
  onClose: () => void;
  avatar?: string;
}) {
  const titles: Record<BookingStep, string> = {
    overview: "Overview",
    player: "Choose Player",
    time: "Choose Times",
    summary: "Summary",
    done: "Done",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 py-10">
      <div className="flex h-[min(83vh,795px)] w-full max-w-[752px] flex-col overflow-hidden rounded-[4px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.34)]">
        <div className="flex h-[90px] shrink-0 items-center border-b border-black/10 px-8">
          <button type="button" onClick={onBack} className="text-[34px] text-black/45 disabled:opacity-25" disabled={step === "overview" || step === "done"}>
            {"<"}
          </button>
          <div className="flex-1 text-center text-[20px] font-semibold">{titles[step]}</div>
          {avatar ? <div className="mr-6 flex h-11 w-11 items-center justify-center rounded-full bg-[#bdbdbd] text-white">{avatar}</div> : null}
          <button type="button" onClick={onClose} className="text-[34px] leading-none text-black/45">
            x
          </button>
        </div>
        <div key={step} className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          {children}
        </div>
        <div className="shrink-0 border-t border-black/10 px-4 py-4">{footer}</div>
      </div>
    </div>
  );
}

function customerBookingStatusLabel(status: string) {
  if (!status || status === "Pending" || status === "Confirmed") return "";
  return status;
}

function BookingSummaryCard({ booking }: { booking: CustomerBookingRecord }) {
  const statusLabel = customerBookingStatusLabel(booking.status);

  return (
    <div className="rounded-[8px] border border-black/10 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-semibold">{booking.serviceName}</div>
          <div className="mt-1 text-[14px] text-black/55">{booking.playerName || "Player"}</div>
        </div>
        {statusLabel ? <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-semibold text-black/65">{statusLabel}</span> : null}
      </div>
      <div className="mt-4 grid gap-2 text-[14px] text-black/65 sm:grid-cols-2">
        <div>{formatLongDate(booking.date)}</div>
        <div>
          {timeLabel(booking.start)} - {timeLabel(booking.end)}
        </div>
        {booking.resourceName ? <div>{booking.resourceName}</div> : null}
        {booking.staffName ? <div>Coach: {booking.staffName}</div> : null}
      </div>
    </div>
  );
}

function MembershipSummaryCard({
  membership,
  onDetails,
  onPrint,
  onRequestCancel,
}: {
  membership: CustomerMembershipRecord;
  onDetails: (membership: CustomerMembershipRecord) => void;
  onPrint: (membership: CustomerMembershipRecord) => void;
  onRequestCancel: (membership: CustomerMembershipRecord) => void;
}) {
  const period = membershipCreditPeriodLabel(membership.creditLimitPeriod);
  const hasPendingCancelRequest = membership.cancelRequest?.status === "Pending";
  const canRequestCancel = !["Cancelled", "Expired"].includes(membership.status) && !hasPendingCancelRequest;
  return (
    <div className="rounded-[8px] border border-black/10 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-semibold">{membership.serviceName}</div>
          <div className="mt-1 text-[14px] text-black/55">
            {money(membership.priceCents / 100)}/{membershipPeriodLabel(membership.billingPeriod)}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${membershipStatusClasses(membership.status)}`}>
          {membership.status}
        </span>
      </div>
      {hasPendingCancelRequest ? (
        <div className="mt-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
          Cancellation request sent to admin
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 text-[14px] text-black/65 sm:grid-cols-2">
        <div>
          {membership.creditsPerDay > 0
            ? `${membership.creditsPerDay} credit${membership.creditsPerDay === 1 ? "" : "s"} per ${period}`
            : "Member booking credits"}
        </div>
        <div>{membership.autoRenew ? "Auto renews" : "Does not auto renew"}</div>
        {membership.currentPeriodEnd ? <div>Renews {formatLongDate(membership.currentPeriodEnd.slice(0, 10))}</div> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDetails(membership)}
          className="rounded-[6px] border border-black/15 px-3 py-2 text-[13px] font-semibold hover:bg-black/[0.04]"
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => onPrint(membership)}
          className="rounded-[6px] border border-black/15 px-3 py-2 text-[13px] font-semibold hover:bg-black/[0.04]"
        >
          Print receipt
        </button>
        <button
          type="button"
          onClick={() => onRequestCancel(membership)}
          disabled={!canRequestCancel}
          className="rounded-[6px] border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasPendingCancelRequest ? "Request pending" : "Request cancellation"}
        </button>
      </div>
    </div>
  );
}

function MembershipHistoryCard({
  membership,
  onDetails,
  onPrint,
}: {
  membership: CustomerMembershipRecord;
  onDetails: (membership: CustomerMembershipRecord) => void;
  onPrint: (membership: CustomerMembershipRecord) => void;
}) {
  const startLabel = membership.startedAt ? formatLongDate(membership.startedAt.slice(0, 10)) : "Start date not set";
  const endLabel =
    membership.cancelledAt || membership.currentPeriodEnd
      ? formatLongDate((membership.cancelledAt || membership.currentPeriodEnd).slice(0, 10))
      : "End date not set";

  return (
    <div className="rounded-[8px] border border-black/10 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold">{membership.serviceName}</div>
          <div className="mt-1 text-[14px] text-black/55">
            {money(membership.priceCents / 100)}/{membershipPeriodLabel(membership.billingPeriod)}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${membershipStatusClasses(membership.status)}`}>
          {membership.status}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-[14px] text-black/65 sm:grid-cols-2">
        <div>Started {startLabel}</div>
        <div>{membership.status === "Cancelled" ? `Cancelled ${endLabel}` : `Ended ${endLabel}`}</div>
        {membership.latestPaymentAmountCents ? (
          <div>Last payment {money(membership.latestPaymentAmountCents / 100)}</div>
        ) : null}
        {membership.latestPaymentDate ? <div>Paid {formatLongDate(membership.latestPaymentDate.slice(0, 10))}</div> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDetails(membership)}
          className="rounded-[6px] border border-black/15 px-3 py-2 text-[13px] font-semibold hover:bg-black/[0.04]"
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => onPrint(membership)}
          className="rounded-[6px] border border-black/15 px-3 py-2 text-[13px] font-semibold hover:bg-black/[0.04]"
        >
          Print receipt
        </button>
      </div>
    </div>
  );
}

function CustomerPortalModal({
  account,
  dashboard,
  busy,
  status,
  onClose,
  onRefresh,
  onAddPlayer,
  onMembershipDetails,
  onPrintMembershipReceipt,
  onRequestMembershipCancel,
}: {
  account: ParentAccount;
  dashboard: CustomerDashboard;
  busy: boolean;
  status: string;
  onClose: () => void;
  onRefresh: () => void;
  onAddPlayer: (member: FamilyMember) => Promise<void>;
  onMembershipDetails: (membership: CustomerMembershipRecord) => void;
  onPrintMembershipReceipt: (membership: CustomerMembershipRecord) => void;
  onRequestMembershipCancel: (membership: CustomerMembershipRecord) => void;
}) {
  const [playerForm, setPlayerForm] = useState<ChildForm>(emptyChildForm);
  const [playerStatus, setPlayerStatus] = useState("");
  const [playerBusy, setPlayerBusy] = useState(false);
  const familyMembers = familyMembersForAccount(account);

  async function submitPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const member = buildFamilyMember(playerForm.firstName, playerForm.lastName, playerForm.birthDate, playerForm.gender);
    if (!member.name) {
      setPlayerStatus("Enter the player's name.");
      return;
    }
    if (!playerForm.birthDate) {
      setPlayerStatus("Enter the player's DOB.");
      return;
    }
    if (!playerForm.gender) {
      setPlayerStatus("Select Male or Female.");
      return;
    }

    setPlayerBusy(true);
    setPlayerStatus("");
    try {
      await onAddPlayer(member);
      setPlayerForm(emptyChildForm);
      setPlayerStatus("Player added.");
    } catch (error) {
      setPlayerStatus(error instanceof Error ? error.message : "Could not add player.");
    } finally {
      setPlayerBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 py-8">
      <div className="flex max-h-[calc(100vh-64px)] w-full max-w-[860px] flex-col overflow-hidden rounded-[5px] bg-[#f6f7f9] shadow-[0_20px_48px_rgba(0,0,0,0.36)]">
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 bg-white px-7">
          <div>
            <div className="text-[22px] font-semibold">My Account</div>
            <div className="mt-1 text-[13px] text-black/55">{account.email}</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-black/10 bg-white px-4 py-4">
            <div>
              <div className="text-[17px] font-semibold">{account.parentName}</div>
              <div className="mt-1 text-[14px] text-black/55">Account holder</div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              className="rounded-[6px] border border-black/15 px-4 py-2 text-[14px] font-semibold disabled:opacity-55"
            >
              {busy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {status ? (
            <div
              className={`mt-4 rounded-[6px] px-4 py-3 text-sm ${
                status.toLowerCase().includes("request") ? "bg-[#eef8fc] text-[#0b6f9f]" : "bg-red-50 text-red-700"
              }`}
            >
              {status}
            </div>
          ) : null}

          <section className="mt-6">
            <div className="text-[20px] font-semibold">Players</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {!familyMembers.length ? (
                <div className="rounded-[8px] border border-dashed border-black/15 bg-white px-4 py-5 text-[14px] text-black/55">
                  No children added yet.
                </div>
              ) : null}
              {familyMembers.map((member) => (
                <div key={member.id} className="rounded-[8px] border border-black/10 bg-white px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#bebebe] text-[14px] font-semibold text-white">
                      {initials(member.name)}
                    </span>
                    <div>
                      <div className="text-[16px] font-semibold">{member.name}</div>
                      {familyDobLabel(member) ? <div className="mt-1 text-[13px] text-black/55">{familyDobLabel(member)}</div> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submitPlayer} className="mt-4 rounded-[8px] border border-dashed border-black/15 bg-white px-4 py-4">
              <div className="text-[15px] font-semibold">Add player</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_140px_auto]">
                <input
                  value={playerForm.firstName}
                  onChange={(event) => setPlayerForm((current) => ({ ...current, firstName: event.target.value }))}
                  placeholder="First name"
                  className="h-11 rounded-[5px] border border-black/15 px-3 text-[15px]"
                />
                <input
                  value={playerForm.lastName}
                  onChange={(event) => setPlayerForm((current) => ({ ...current, lastName: event.target.value }))}
                  placeholder="Last name"
                  className="h-11 rounded-[5px] border border-black/15 px-3 text-[15px]"
                />
                <input
                  type="date"
                  value={playerForm.birthDate}
                  onChange={(event) => setPlayerForm((current) => ({ ...current, birthDate: event.target.value }))}
                  aria-label="Date of birth"
                  className="h-11 rounded-[5px] border border-black/15 px-3 text-[15px]"
                />
                <select
                  value={playerForm.gender}
                  onChange={(event) => setPlayerForm((current) => ({ ...current, gender: event.target.value }))}
                  aria-label="Gender"
                  className="h-11 rounded-[5px] border border-black/15 bg-white px-3 text-[15px]"
                >
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <button type="submit" disabled={playerBusy} className="h-11 rounded-[6px] bg-black px-4 text-[14px] font-semibold text-white disabled:opacity-55">
                  {playerBusy ? "Adding..." : "Add"}
                </button>
              </div>
              {playerStatus ? <div className="mt-3 text-[13px] text-black/55">{playerStatus}</div> : null}
            </form>
          </section>

          <section className="mt-6">
            <div className="text-[20px] font-semibold">Memberships</div>
            <div className="mt-3 grid gap-3">
              {dashboard.memberships.length ? (
                dashboard.memberships.map((membership) => (
                  <MembershipSummaryCard
                    key={membership.id}
                    membership={membership}
                    onDetails={onMembershipDetails}
                    onPrint={onPrintMembershipReceipt}
                    onRequestCancel={onRequestMembershipCancel}
                  />
                ))
              ) : (
                <div className="rounded-[8px] border border-dashed border-black/15 bg-white px-4 py-6 text-center text-[15px] text-black/55">
                  No memberships yet.
                </div>
              )}
            </div>
          </section>

          <section className="mt-7">
            <div className="text-[20px] font-semibold">Membership History</div>
            <div className="mt-3 grid gap-3">
              {dashboard.membershipHistory.length ? (
                dashboard.membershipHistory.map((membership) => (
                  <MembershipHistoryCard
                    key={membership.id}
                    membership={membership}
                    onDetails={onMembershipDetails}
                    onPrint={onPrintMembershipReceipt}
                  />
                ))
              ) : (
                <div className="rounded-[8px] border border-dashed border-black/15 bg-white px-4 py-6 text-center text-[15px] text-black/55">
                  No membership history yet.
                </div>
              )}
            </div>
          </section>

          <section className="mt-7">
            <div className="text-[20px] font-semibold">Upcoming Bookings</div>
            <div className="mt-3 grid gap-3">
              {dashboard.upcomingBookings.length ? (
                dashboard.upcomingBookings.map((booking) => <BookingSummaryCard key={booking.id} booking={booking} />)
              ) : (
                <div className="rounded-[8px] border border-dashed border-black/15 bg-white px-4 py-6 text-center text-[15px] text-black/55">
                  No upcoming bookings.
                </div>
              )}
            </div>
          </section>

          <section className="mt-7">
            <div className="text-[20px] font-semibold">Past Bookings</div>
            <div className="mt-3 grid gap-3">
              {dashboard.pastBookings.length ? (
                dashboard.pastBookings.slice(0, 8).map((booking) => <BookingSummaryCard key={booking.id} booking={booking} />)
              ) : (
                <div className="rounded-[8px] border border-dashed border-black/15 bg-white px-4 py-6 text-center text-[15px] text-black/55">
                  No past bookings.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MembershipDetailsModal({
  membership,
  onClose,
  onPrint,
  onRequestCancel,
}: {
  membership: CustomerMembershipRecord;
  onClose: () => void;
  onPrint: (membership: CustomerMembershipRecord) => void;
  onRequestCancel: (membership: CustomerMembershipRecord) => void;
}) {
  const period = membershipCreditPeriodLabel(membership.creditLimitPeriod);
  const hasPendingCancelRequest = membership.cancelRequest?.status === "Pending";
  const canRequestCancel = !["Cancelled", "Expired"].includes(membership.status) && !hasPendingCancelRequest;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 py-8">
      <div className="flex max-h-[calc(100vh-64px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]">
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-7">
          <div>
            <div className="text-[22px] font-semibold">Membership Details</div>
            <div className="mt-1 text-[13px] text-black/55">{membership.serviceName}</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[20px] font-semibold">{membership.serviceName}</div>
              <div className="mt-1 text-[15px] text-black/55">
                {money(membership.priceCents / 100)}/{membershipPeriodLabel(membership.billingPeriod)}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${membershipStatusClasses(membership.status)}`}>
              {membership.status}
            </span>
          </div>

          {hasPendingCancelRequest ? (
            <div className="mt-5 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
              <div className="font-semibold">Cancellation request pending</div>
              {membership.cancelRequest?.requestedAt ? (
                <div className="mt-1 text-amber-800">Sent {formatLongDate(membership.cancelRequest.requestedAt.slice(0, 10))}</div>
              ) : null}
              {membership.cancelRequest?.message ? <div className="mt-2 text-amber-800">{membership.cancelRequest.message}</div> : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 text-[15px]">
            <div className="flex justify-between gap-6 border-b border-black/10 pb-3">
              <span className="text-black/50">Credits</span>
              <span className="text-right font-semibold">
                {membership.creditsPerDay > 0
                  ? `${membership.creditsPerDay} credit${membership.creditsPerDay === 1 ? "" : "s"} per ${period}`
                  : "Member booking credits"}
              </span>
            </div>
            <div className="flex justify-between gap-6 border-b border-black/10 pb-3">
              <span className="text-black/50">Renewal</span>
              <span className="text-right font-semibold">{membership.autoRenew ? "Auto renews" : "Does not auto renew"}</span>
            </div>
            <div className="flex justify-between gap-6 border-b border-black/10 pb-3">
              <span className="text-black/50">Current period</span>
              <span className="text-right font-semibold">
                {membership.currentPeriodStart ? formatLongDate(membership.currentPeriodStart.slice(0, 10)) : "Not set"} -{" "}
                {membership.currentPeriodEnd ? formatLongDate(membership.currentPeriodEnd.slice(0, 10)) : "Not set"}
              </span>
            </div>
            <div className="flex justify-between gap-6 border-b border-black/10 pb-3">
              <span className="text-black/50">Last payment</span>
              <span className="text-right font-semibold">
                {membership.latestPaymentAmountCents
                  ? `${money(membership.latestPaymentAmountCents / 100)}${membership.latestPaymentDate ? ` on ${formatLongDate(membership.latestPaymentDate.slice(0, 10))}` : ""}`
                  : "No payment on file"}
              </span>
            </div>
            {membership.latestPaymentMethod ? (
              <div className="flex justify-between gap-6 border-b border-black/10 pb-3">
                <span className="text-black/50">Payment method</span>
                <span className="text-right font-semibold">{membership.latestPaymentMethod}</span>
              </div>
            ) : null}
            {membership.latestReceiptUrl ? (
              <a
                href={membership.latestReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#0b6f9f] underline underline-offset-4"
              >
                Open Stripe receipt
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-black/10 px-7 py-5">
          <button type="button" onClick={() => onPrint(membership)} className="rounded-[6px] border border-black/15 px-4 py-2.5 text-[14px] font-semibold">
            Print receipt
          </button>
          <button
            type="button"
            onClick={() => onRequestCancel(membership)}
            disabled={!canRequestCancel}
            className="rounded-[6px] border border-red-200 px-4 py-2.5 text-[14px] font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasPendingCancelRequest ? "Request pending" : "Request cancellation"}
          </button>
          <button type="button" onClick={onClose} className="rounded-[6px] bg-black px-4 py-2.5 text-[14px] font-semibold text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MembershipCancelRequestModal({
  membership,
  message,
  setMessage,
  busy,
  status,
  onClose,
  onSubmit,
}: {
  membership: CustomerMembershipRecord;
  message: string;
  setMessage: (value: string) => void;
  busy: boolean;
  status: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 px-4 py-8">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]">
        <div className="flex items-center border-b border-black/10 px-7 py-5">
          <div>
            <div className="text-[22px] font-semibold">Request Cancellation</div>
            <div className="mt-1 text-[13px] text-black/55">{membership.serviceName}</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="px-7 py-6">
          <div className="rounded-[8px] bg-[#eef8fc] px-4 py-3 text-[14px] leading-6 text-[#0b6f9f]">
            This sends a cancellation request to The Grind Baseball Lab admin. Your membership stays active until the admin reviews it.
          </div>
          <label className="mt-5 grid gap-2 text-[14px] font-semibold">
            Message to admin <span className="font-normal text-black/45">(optional)</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="resize-none rounded-[6px] border border-black/15 px-4 py-3 text-[15px] font-normal outline-none focus:border-black"
              placeholder="Add any details about your cancellation request..."
            />
          </label>
          {status ? <div className="mt-4 rounded-[6px] bg-red-50 px-4 py-3 text-sm text-red-700">{status}</div> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-black/10 px-7 py-5">
          <button type="button" onClick={onClose} className="rounded-[6px] border border-black/15 px-5 py-2.5 text-[14px] font-semibold">
            Keep membership
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="rounded-[6px] bg-black px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-55"
          >
            {busy ? "Sending..." : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ParentAccountModal({
  form,
  setForm,
  busy,
  status,
  waiverSettings,
  onClose,
  onSubmit,
}: {
  form: AccountForm;
  setForm: Dispatch<SetStateAction<AccountForm>>;
  busy: boolean;
  status: string;
  waiverSettings: PublicBookingData["settings"];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 py-8">
      <form
        onSubmit={onSubmit}
        className="flex max-h-[calc(100vh-64px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]"
      >
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-7">
          <div className="text-[22px] font-semibold">Create Account</div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-[14px] font-medium">
              First name
              <input
                value={form.parentFirstName}
                onChange={(event) => setForm((current) => ({ ...current, parentFirstName: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Last name
              <input
                value={form.parentLastName}
                onChange={(event) => setForm((current) => ({ ...current, parentLastName: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Phone
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium sm:col-span-2">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              DOB
              <input
                type="date"
                value={form.playerBirthDate}
                onChange={(event) => setForm((current) => ({ ...current, playerBirthDate: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Gender
              <select
                value={form.gender}
                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 bg-white px-4 text-[16px]"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
          </div>

          <div className="mt-8 border-t border-black/10 pt-6">
            <div className="text-[18px] font-semibold">Emergency Contact</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-[14px] font-medium">
                Name
                <input
                  value={form.emergencyContactName}
                  onChange={(event) => setForm((current) => ({ ...current, emergencyContactName: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium">
                Phone
                <input
                  value={form.emergencyContactPhone}
                  onChange={(event) => setForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium sm:col-span-2">
                Email <span className="text-black/45">(optional)</span>
                <input
                  type="email"
                  value={form.emergencyContactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, emergencyContactEmail: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
            </div>
          </div>

          {waiverSettings.waiverEnabled ? (
            <div className="mt-6 rounded-[8px] border border-[#b9dff2] bg-[#eef8fc] px-4 py-4">
              <div className="text-[15px] font-semibold">Liability Waiver</div>
              <p className="mt-2 text-[14px] leading-6 text-[#245f78]">{waiverSettings.waiverIntro}</p>
              {waiverSettings.waiverDocumentUrl ? (
                <a
                  href={waiverSettings.waiverDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-[14px] font-semibold text-[#0b6f9f] underline underline-offset-4"
                >
                  View {waiverSettings.waiverDocumentName || "liability waiver"}
                </a>
              ) : null}
              <label className="mt-4 flex items-start gap-3 text-[14px] font-semibold text-black">
                <input
                  type="checkbox"
                  checked={form.waiverAgreed}
                  onChange={(event) => setForm((current) => ({ ...current, waiverAgreed: event.target.checked }))}
                  className="mt-1 h-5 w-5 accent-black"
                />
                I have read and agree to the liability waiver for myself and my family.
              </label>
            </div>
          ) : null}

          {status ? <div className="mt-5 rounded-[6px] bg-red-50 px-4 py-3 text-sm text-red-700">{status}</div> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-7 py-5">
          <button type="button" onClick={onClose} className="h-12 rounded-[6px] border border-black/15 px-7 text-[16px] font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="h-12 rounded-[6px] bg-black px-8 text-[16px] font-semibold text-white disabled:opacity-55">
            {busy ? "Creating..." : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChildrenSetupModal({
  step,
  childForm,
  setChildForm,
  busy,
  status,
  onClose,
  onStartChild,
  onSubmitChild,
  onFinish,
}: {
  step: ChildSetupStep;
  childForm: ChildForm;
  setChildForm: Dispatch<SetStateAction<ChildForm>>;
  busy: boolean;
  status: string;
  onClose: () => void;
  onStartChild: () => void;
  onSubmitChild: (event: FormEvent<HTMLFormElement>) => void;
  onFinish: () => void;
}) {
  const title = step === "child" ? "Add Child" : step === "another" ? "Child Added" : "Add Children?";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 py-10">
      <form
        onSubmit={onSubmitChild}
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]"
      >
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-7">
          <div className="text-[22px] font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>

        <div className="px-7 py-6">
          {step === "prompt" ? (
            <>
              <p className="text-[16px] leading-7 text-black/70">Do you need to add children to this account?</p>
              <p className="mt-2 text-[14px] leading-6 text-black/55">
                Choose yes if you will book cages, lessons, or memberships for a child. Choose no if the account holder books for themselves.
              </p>
            </>
          ) : null}

          {step === "another" ? (
            <>
              <p className="text-[16px] leading-7 text-black/70">That child was added to the family account.</p>
              <p className="mt-2 text-[14px] leading-6 text-black/55">Do you have another child to add?</p>
            </>
          ) : null}

          {step === "child" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-[14px] font-medium">
                First name
                <input
                  value={childForm.firstName}
                  onChange={(event) => setChildForm((current) => ({ ...current, firstName: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium">
                Last name
                <input
                  value={childForm.lastName}
                  onChange={(event) => setChildForm((current) => ({ ...current, lastName: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium">
                DOB
                <input
                  type="date"
                  value={childForm.birthDate}
                  onChange={(event) => setChildForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium">
                Gender
                <select
                  value={childForm.gender}
                  onChange={(event) => setChildForm((current) => ({ ...current, gender: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 bg-white px-4 text-[16px]"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>
            </div>
          ) : null}

          {status ? <div className="mt-5 rounded-[6px] bg-red-50 px-4 py-3 text-sm text-red-700">{status}</div> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-7 py-5">
          {step === "child" ? (
            <>
              <button type="button" onClick={onFinish} className="h-12 rounded-[6px] border border-black/15 px-7 text-[16px] font-semibold">
                Skip
              </button>
              <button type="submit" disabled={busy} className="h-12 rounded-[6px] bg-black px-8 text-[16px] font-semibold text-white disabled:opacity-55">
                {busy ? "Adding..." : "Add child"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onFinish} className="h-12 rounded-[6px] border border-black/15 px-7 text-[16px] font-semibold">
                No
              </button>
              <button type="button" onClick={onStartChild} className="h-12 rounded-[6px] bg-black px-8 text-[16px] font-semibold text-white">
                Yes
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function SignInModal({
  form,
  setForm,
  busy,
  resetBusy,
  status,
  onClose,
  onSubmit,
  onResetPassword,
}: {
  form: SignInForm;
  setForm: Dispatch<SetStateAction<SignInForm>>;
  busy: boolean;
  resetBusy: boolean;
  status: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResetPassword: () => void;
}) {
  const isSuccess = status.toLowerCase().includes("sent") || status.toLowerCase().includes("updated");

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-[500px] flex-col overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]"
      >
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-7">
          <div className="text-[22px] font-semibold">Sign In</div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="px-7 py-6">
          <p className="text-[15px] leading-6 text-black/60">Sign in to your family account and continue this booking.</p>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-[14px] font-medium">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <button
              type="button"
              onClick={onResetPassword}
              disabled={busy || resetBusy}
              className="justify-self-start text-[14px] font-semibold text-[#0b6f9f] underline underline-offset-4 disabled:opacity-50"
            >
              {resetBusy ? "Sending reset email..." : "Forgot password?"}
            </button>
          </div>
          {status ? (
            <div className={`mt-5 rounded-[6px] px-4 py-3 text-sm ${isSuccess ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              {status}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-7 py-5">
          <button type="button" onClick={onClose} className="h-12 rounded-[6px] border border-black/15 px-7 text-[16px] font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="h-12 rounded-[6px] bg-black px-8 text-[16px] font-semibold text-white disabled:opacity-55">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordModal({
  form,
  setForm,
  requiresCode,
  busy,
  status,
  onClose,
  onSubmit,
}: {
  form: ResetPasswordForm;
  setForm: Dispatch<SetStateAction<ResetPasswordForm>>;
  requiresCode: boolean;
  busy: boolean;
  status: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isInfo = status.toLowerCase().includes("code") || status.toLowerCase().includes("check");

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-[500px] flex-col overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]"
      >
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-7">
          <div className="text-[22px] font-semibold">Reset Password</div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="px-7 py-6">
          <p className="text-[15px] leading-6 text-black/60">
            {requiresCode ? "Enter the reset code from your email and choose a new password." : "Enter a new password for your family account."}
          </p>
          <div className="mt-6 grid gap-4">
            {requiresCode ? (
              <>
                <label className="grid gap-2 text-[14px] font-medium">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                  />
                </label>
                <label className="grid gap-2 text-[14px] font-medium">
                  Reset code
                  <input
                    inputMode="numeric"
                    value={form.token}
                    onChange={(event) => setForm((current) => ({ ...current, token: event.target.value.replace(/\D/g, "").slice(0, 8) }))}
                    className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px] tracking-[0.2em]"
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-2 text-[14px] font-medium">
              New password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Confirm password
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
          </div>
          {status ? (
            <div className={`mt-5 rounded-[6px] px-4 py-3 text-sm ${isInfo ? "bg-sky-50 text-sky-800" : "bg-red-50 text-red-700"}`}>
              {status}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-7 py-5">
          <button type="button" onClick={onClose} className="h-12 rounded-[6px] border border-black/15 px-7 text-[16px] font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="h-12 rounded-[6px] bg-black px-8 text-[16px] font-semibold text-white disabled:opacity-55">
            {busy ? "Saving..." : "Save password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MembershipCardModal({
  service,
  setup,
  customerName,
  email,
  phone,
  busy,
  status,
  onClose,
  onConfirm,
}: {
  service: PublicBookingService;
  setup: MembershipCardSetup;
  customerName: string;
  email: string;
  phone: string;
  busy: boolean;
  status: string;
  onClose: () => void;
  onConfirm: (setupIntentId: string) => Promise<void>;
}) {
  if (!stripePromise) {
    return (
      <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 py-10">
        <div className="w-full max-w-[520px] rounded-[5px] bg-white p-7 shadow-[0_20px_48px_rgba(0,0,0,0.36)]">
          <div className="text-[22px] font-semibold">Card Payment</div>
          <p className="mt-4 text-[15px] leading-6 text-black/60">Stripe card payments are not configured yet.</p>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-[6px] bg-black px-6 text-[15px] font-semibold text-white">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 py-10">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[5px] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.36)]">
        <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-7">
          <div className="text-[22px] font-semibold">Card Payment</div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <Elements stripe={stripePromise} options={{ clientSecret: setup.clientSecret }} key={setup.clientSecret}>
          <MembershipCardForm
            service={service}
            clientSecret={setup.clientSecret}
            customerName={customerName}
            email={email}
            phone={phone}
            busy={busy}
            status={status}
            onClose={onClose}
            onConfirm={onConfirm}
          />
        </Elements>
      </div>
    </div>
  );
}

function MembershipCardForm({
  service,
  clientSecret,
  customerName,
  email,
  phone,
  busy,
  status,
  onClose,
  onConfirm,
}: {
  service: PublicBookingService;
  clientSecret: string;
  customerName: string;
  email: string;
  phone: string;
  busy: boolean;
  status: string;
  onClose: () => void;
  onConfirm: (setupIntentId: string) => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState(customerName);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || busy) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage("Card form is not ready yet.");
      return;
    }

    setErrorMessage("");
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: cardholderName || customerName || undefined,
          email: email || undefined,
          phone: phone || undefined,
        },
      },
    });

    if (result.error) {
      setErrorMessage(result.error.message || "Could not save card.");
      return;
    }

    if (!result.setupIntent || result.setupIntent.status !== "succeeded") {
      setErrorMessage("Card setup is not complete yet.");
      return;
    }

    await onConfirm(result.setupIntent.id);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-5 px-7 py-6">
        <div className="rounded-[10px] border border-black/10 bg-black/[0.02] px-5 py-4">
          <div className="text-[17px] font-semibold">{service.name}</div>
          <div className="mt-2 text-[15px] text-black/60">
            {money(service.price)}/{membershipPeriodLabel(service.membershipBillingPeriod)} will be charged to this card.
          </div>
        </div>
        <label className="grid gap-2 text-[14px] font-medium">
          Cardholder name
          <input
            value={cardholderName}
            onChange={(event) => setCardholderName(event.target.value)}
            className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
          />
        </label>
        <label className="grid gap-2 text-[14px] font-medium">
          Card information
          <div className="rounded-[5px] border border-black/20 px-4 py-3">
            <CardElement
              options={{
                hidePostalCode: false,
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#111111",
                    "::placeholder": { color: "rgba(17,17,17,0.38)" },
                  },
                },
              }}
            />
          </div>
        </label>
        <div className="rounded-[8px] bg-[#eef8fc] px-4 py-3 text-[13px] leading-5 text-[#0b6f9f]">
          This saves the card and charges it for the membership. It will be the default card for future membership renewals.
        </div>
        {errorMessage || status ? <div className="rounded-[6px] bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage || status}</div> : null}
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-7 py-5">
        <button type="button" onClick={onClose} className="h-12 rounded-[6px] border border-black/15 px-7 text-[16px] font-semibold">
          Cancel
        </button>
        <button type="submit" disabled={!stripe || busy} className="h-12 rounded-[6px] bg-black px-8 text-[16px] font-semibold text-white disabled:opacity-55">
          {busy ? "Charging..." : "Save card & pay"}
        </button>
      </div>
    </form>
  );
}

export default function CustomerBookingApp() {
  const [data, setData] = useState<PublicBookingData>(fallbackPublicBookingData);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<PublicBookingCategory | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>("overview");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedTime, setSelectedTime] = useState<TimeChoice | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("Yourself");
  const [form, setForm] = useState({ parentName: "", playerName: "Yourself", email: "", phone: "" });
  const [parentAccount, setParentAccount] = useState<ParentAccount | null>(null);
  const [transactionWaiverAgreed, setTransactionWaiverAgreed] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountStatus, setAccountStatus] = useState("");
  const [showChildrenSetupModal, setShowChildrenSetupModal] = useState(false);
  const [childrenSetupStep, setChildrenSetupStep] = useState<ChildSetupStep>("prompt");
  const [childForm, setChildForm] = useState<ChildForm>(emptyChildForm);
  const [childSetupBusy, setChildSetupBusy] = useState(false);
  const [childSetupStatus, setChildSetupStatus] = useState("");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInForm, setSignInForm] = useState<SignInForm>({ email: "", password: "" });
  const [signInBusy, setSignInBusy] = useState(false);
  const [passwordResetEmailBusy, setPasswordResetEmailBusy] = useState(false);
  const [signInStatus, setSignInStatus] = useState("");
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetRequiresCode, setPasswordResetRequiresCode] = useState(false);
  const [passwordResetForm, setPasswordResetForm] = useState<ResetPasswordForm>({ email: "", token: "", password: "", confirmPassword: "" });
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [passwordResetStatus, setPasswordResetStatus] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showCustomerPortal, setShowCustomerPortal] = useState(false);
  const [customerDashboard, setCustomerDashboard] = useState<CustomerDashboard>(emptyCustomerDashboard);
  const [customerPortalBusy, setCustomerPortalBusy] = useState(false);
  const [customerPortalStatus, setCustomerPortalStatus] = useState("");
  const [selectedMembershipDetails, setSelectedMembershipDetails] = useState<CustomerMembershipRecord | null>(null);
  const [membershipCancelRequest, setMembershipCancelRequest] = useState<CustomerMembershipRecord | null>(null);
  const [membershipCancelRequestMessage, setMembershipCancelRequestMessage] = useState("");
  const [membershipCancelRequestBusy, setMembershipCancelRequestBusy] = useState(false);
  const [membershipCancelRequestStatus, setMembershipCancelRequestStatus] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [membershipCardSetup, setMembershipCardSetup] = useState<MembershipCardSetup | null>(null);
  const [membershipCardStatus, setMembershipCardStatus] = useState("");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/book/public", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : fallbackPublicBookingData))
      .then((payload: PublicBookingData) => {
        if (mounted) setData(payload.services.length ? payload : fallbackPublicBookingData);
      })
      .catch(() => {
        if (mounted) setData(fallbackPublicBookingData);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;
      if (!token) return;

      const payload = await loadParentAccount(token);
      if (!mounted || !payload?.customer) return;

      applyParentAccount(payload.customer, payload.dashboard);
    }

    void loadAccount();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;

      setShowSignInModal(false);
      setPasswordResetRequiresCode(false);
      setPasswordResetForm({ email: "", token: "", password: "", confirmPassword: "" });
      setPasswordResetStatus("");
      setShowPasswordResetModal(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
    const errorCode = currentUrl.searchParams.get("error_code") || hashParams.get("error_code");
    const errorDescription = currentUrl.searchParams.get("error_description") || hashParams.get("error_description");

    if (!errorCode && !errorDescription) return;

    const isExpiredResetLink = errorCode === "otp_expired" || errorDescription?.toLowerCase().includes("expired");
    const isResetIntent = currentUrl.searchParams.get("reset") === "password" || hashParams.get("reset") === "password";
    setShowPasswordResetModal(false);
    setShowSignInModal(!isResetIntent);
    if (isResetIntent) {
      setPasswordResetRequiresCode(true);
      setPasswordResetForm((current) => ({ ...current, email: signInForm.email }));
      setPasswordResetStatus("Enter the reset code from your email to finish changing your password.");
      setShowPasswordResetModal(true);
    }
    setSignInStatus(
      isExpiredResetLink
        ? "That password reset link is invalid or expired. Enter your email and tap Forgot password to send a fresh link."
        : errorDescription || "We could not complete that sign-in link. Please try again."
    );
    window.history.replaceState(null, "", currentUrl.pathname);
  }, [signInForm.email]);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("reset") !== "password") return;

    setShowSignInModal(false);
    setPasswordResetRequiresCode(true);
    setPasswordResetForm((current) => ({ ...current, email: signInForm.email }));
    setPasswordResetStatus("Enter the reset code from your email to finish changing your password.");
    setShowPasswordResetModal(true);
    window.history.replaceState(null, "", currentUrl.pathname);
  }, [signInForm.email]);

  const selectedService = useMemo(
    () => data.services.find((service) => service.id === selectedServiceId) ?? null,
    [data.services, selectedServiceId]
  );
  const visibleCategories = categoryOrder.filter((category) => data.services.some((service) => service.category === category));
  const servicesForCategory = selectedCategory ? data.services.filter((service) => service.category === selectedCategory) : [];
  const coachOptions = useMemo(() => coachOptionsForService(data, selectedService), [data, selectedService]);
  const selectedCoach = coachOptions.find((coach) => coach.id === selectedCoachId) ?? null;
  const selectedCoachName = selectedCoach?.name ?? "";
  const needsCoach = selectedService?.category === "lessons";
  const isMembership = selectedService?.category === "memberships";
  const availableTimes = useMemo(
    () => getAvailableSlots(data, selectedService, selectedDate, needsCoach ? selectedCoachId : undefined),
    [data, needsCoach, selectedCoachId, selectedDate, selectedService]
  );
  const membershipCredit = useMemo(() => {
    if (!selectedService || selectedService.category === "memberships") return null;
    return customerDashboard.memberships.find((membership) => membershipCoversService(membership, selectedService, selectedDate)) ?? null;
  }, [customerDashboard.memberships, selectedDate, selectedService]);
  const memberCreditServiceIds = useMemo(() => {
    const covered = new Set<string>();
    customerDashboard.memberships.forEach((membership) => {
      if (membership.status !== "Active" || membership.creditsPerDay <= 0 || !membershipIsAvailableForDate(membership, selectedDate)) return;
      data.services.forEach((service) => {
        if (service.category !== "memberships" && membershipCoversService(membership, service, selectedDate)) {
          covered.add(service.id);
        }
      });
    });
    return covered;
  }, [customerDashboard.memberships, data.services, selectedDate]);
  const orderedServicesForCategory = useMemo(
    () =>
      servicesForCategory
        .map((service, index) => ({ service, index }))
        .sort((left, right) => {
          const leftCovered = memberCreditServiceIds.has(left.service.id);
          const rightCovered = memberCreditServiceIds.has(right.service.id);
          if (leftCovered !== rightCovered) return leftCovered ? -1 : 1;
          return left.index - right.index;
        })
        .map((item) => item.service),
    [memberCreditServiceIds, servicesForCategory]
  );
  const onlineTotals = selectedService ? calculatePublicTotals(selectedService, data.settings, "online") : null;
  const inPersonTotals = selectedService ? calculatePublicTotals(selectedService, data.settings, "in-person") : null;
  const familyMembers = useMemo(() => familyMembersForAccount(parentAccount), [parentAccount]);
  const accountHolderPlayerName = parentAccount?.playerName || parentAccount?.parentName || "Yourself";
  const waiverRequiredForCheckout = Boolean(data.settings.waiverEnabled && !parentAccount?.waiverAgreed);
  const waiverAcceptedForCheckout = !waiverRequiredForCheckout || transactionWaiverAgreed;

  useEffect(() => {
    if (!needsCoach) {
      if (selectedCoachId) setSelectedCoachId("");
      return;
    }
    if (selectedCoachId && !coachOptions.some((coach) => coach.id === selectedCoachId)) {
      setSelectedCoachId("");
    }
  }, [coachOptions, needsCoach, selectedCoachId]);

  useEffect(() => {
    setTransactionWaiverAgreed(false);
  }, [selectedServiceId, parentAccount?.id, parentAccount?.waiverAgreed]);

  useEffect(() => {
    function closeAccountMenu(event: MouseEvent) {
      if (!accountMenuOpen) return;
      if (accountMenuRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, [accountMenuOpen]);

  function openService(service: PublicBookingService) {
    setSelectedServiceId(service.id);
    setSelectedTime(null);
    setSelectedCoachId("");
    setStep("overview");
  }

  function closeModal() {
    setSelectedServiceId(null);
    setStep("overview");
    setSubmitError("");
    setMembershipCardSetup(null);
    setMembershipCardStatus("");
  }

  function goBack() {
    if (step === "player") setStep("overview");
    if (step === "time") setStep("player");
    if (step === "summary") setStep(isMembership ? "player" : "time");
  }

  function openAccountModal() {
    setAccountStatus("");
    setAccountForm((current) => ({
      ...current,
      parentFirstName: current.parentFirstName || form.parentName.split(" ")[0] || "",
      parentLastName: current.parentLastName || form.parentName.split(" ").slice(1).join(" "),
      email: current.email || form.email,
      phone: current.phone || form.phone,
    }));
    setShowAccountModal(true);
  }

  function openSignInModal() {
    setSignInStatus("");
    setSignInForm((current) => ({
      email: current.email || form.email || accountForm.email,
      password: "",
    }));
    setShowSignInModal(true);
  }

  async function loadParentAccount(token: string): Promise<CustomerAccountPayload | null> {
    const response = await fetch("/api/book/customers", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;

    const payload = await response.json();
    return {
      customer: (payload.customer as ParentAccount | null) ?? null,
      dashboard: normalizeCustomerDashboard(payload.dashboard as Partial<CustomerDashboard> | undefined),
    };
  }

  function applyParentAccount(account: ParentAccount, dashboard?: CustomerDashboard) {
    const playerName = account.playerName || account.parentName || "Yourself";
    setParentAccount(account);
    if (dashboard) setCustomerDashboard(dashboard);
    setSelectedPlayer(playerName);
    setForm({
      parentName: account.parentName,
      playerName,
      email: account.email,
      phone: account.phone,
    });
  }

  async function saveFamilyMembers(nextFamilyMembers: FamilyMember[], selectMember?: FamilyMember) {
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data.session?.access_token;
    if (!token) throw new Error("Please sign in again.");

    const response = await fetch("/api/book/customers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ familyMembers: nextFamilyMembers }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save player.");

    const account = payload.customer as ParentAccount;
    applyParentAccount(account, customerDashboard);
    if (selectMember) {
      setSelectedPlayer(selectMember.name);
      setForm({
        parentName: account.parentName,
        playerName: selectMember.name,
        email: account.email,
        phone: account.phone,
      });
    }
  }

  function finishChildrenSetup() {
    setShowChildrenSetupModal(false);
    setChildrenSetupStep("prompt");
    setChildForm(emptyChildForm);
    setChildSetupStatus("");
  }

  function startChildEntry() {
    setChildSetupStatus("");
    setChildForm(emptyChildForm);
    setChildrenSetupStep("child");
  }

  async function submitSignupChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const member = buildFamilyMember(childForm.firstName, childForm.lastName, childForm.birthDate, childForm.gender);
    if (!member.name) {
      setChildSetupStatus("Enter the child's name.");
      return;
    }
    if (!childForm.birthDate) {
      setChildSetupStatus("Enter the child's DOB.");
      return;
    }
    if (!childForm.gender) {
      setChildSetupStatus("Select Male or Female.");
      return;
    }

    setChildSetupBusy(true);
    setChildSetupStatus("");
    try {
      const existingChildren = familyMembersForAccount(parentAccount);
      await saveFamilyMembers([...existingChildren, member], member);
      setChildForm(emptyChildForm);
      setChildrenSetupStep("another");
    } catch (error) {
      setChildSetupStatus(error instanceof Error ? error.message : "Could not add child.");
    } finally {
      setChildSetupBusy(false);
    }
  }

  async function saveWaiverAgreement() {
    if (!parentAccount || parentAccount.waiverAgreed || !transactionWaiverAgreed) return;
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/book/customers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ waiverAgreed: true }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.customer) setParentAccount(payload.customer as ParentAccount);
  }

  async function signOut() {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    setParentAccount(null);
    setShowCustomerPortal(false);
    setCustomerDashboard(emptyCustomerDashboard());
    setSelectedPlayer("Yourself");
    setForm({ parentName: "", playerName: "Yourself", email: "", phone: "" });
  }

  async function refreshCustomerAccount() {
    setCustomerPortalBusy(true);
    setCustomerPortalStatus("");
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const payload = await loadParentAccount(token);
      if (!payload?.customer) throw new Error("Could not load your account.");
      applyParentAccount(payload.customer, payload.dashboard);
    } catch (error) {
      setCustomerPortalStatus(error instanceof Error ? error.message : "Could not refresh account.");
    } finally {
      setCustomerPortalBusy(false);
    }
  }

  function openCustomerPortal() {
    setAccountMenuOpen(false);
    setCustomerPortalStatus("");
    setShowCustomerPortal(true);
    void refreshCustomerAccount();
  }

  function printMembershipReceipt(membership: CustomerMembershipRecord) {
    const receiptWindow = window.open("", "_blank", "width=760,height=900");
    if (!receiptWindow) {
      setCustomerPortalStatus("Pop-up blocked. Please allow pop-ups to print your receipt.");
      return;
    }

    const account = parentAccount;
    const paymentDate = membership.latestPaymentDate ? formatLongDate(membership.latestPaymentDate.slice(0, 10)) : "Not available";
    const periodStart = membership.currentPeriodStart ? formatLongDate(membership.currentPeriodStart.slice(0, 10)) : "Not set";
    const periodEnd = membership.currentPeriodEnd ? formatLongDate(membership.currentPeriodEnd.slice(0, 10)) : "Not set";
    const paidAmount = membership.latestPaymentAmountCents ? money(membership.latestPaymentAmountCents / 100) : money(membership.priceCents / 100);
    const safe = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safe(membership.serviceName)} Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
            .receipt { max-width: 680px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; }
            .header { background: #050505; color: white; padding: 28px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 8px 0 0; color: rgba(255,255,255,.72); }
            .content { padding: 28px; }
            .row { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #eee; padding: 13px 0; }
            .label { color: #666; }
            .value { font-weight: 700; text-align: right; }
            .total { font-size: 22px; }
            .footer { padding: 20px 28px; color: #666; font-size: 13px; border-top: 1px solid #eee; }
            @media print { button { display: none; } body { margin: 0; } .receipt { border: 0; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>The Grind Baseball Lab</h1>
              <p>Membership receipt</p>
            </div>
            <div class="content">
              <div class="row"><span class="label">Membership</span><span class="value">${safe(membership.serviceName)}</span></div>
              <div class="row"><span class="label">Parent</span><span class="value">${safe(account?.parentName || "")}</span></div>
              <div class="row"><span class="label">Player</span><span class="value">${safe(account?.playerName || "")}</span></div>
              <div class="row"><span class="label">Email</span><span class="value">${safe(account?.email || "")}</span></div>
              <div class="row"><span class="label">Billing</span><span class="value">${safe(membership.billingPeriod)}</span></div>
              <div class="row"><span class="label">Current period</span><span class="value">${safe(periodStart)} - ${safe(periodEnd)}</span></div>
              <div class="row"><span class="label">Payment date</span><span class="value">${safe(paymentDate)}</span></div>
              <div class="row"><span class="label">Payment method</span><span class="value">${safe(membership.latestPaymentMethod || "Card on file")}</span></div>
              <div class="row total"><span class="label">Amount</span><span class="value">${safe(paidAmount)}</span></div>
            </div>
            <div class="footer">Generated from your Grind Baseball Lab account.</div>
          </div>
          <script>window.addEventListener("load", () => { window.print(); });</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  }

  function openMembershipCancelRequest(membership: CustomerMembershipRecord) {
    setMembershipCancelRequest(membership);
    setMembershipCancelRequestMessage("");
    setMembershipCancelRequestStatus("");
  }

  async function sendMembershipCancelRequest() {
    if (!membershipCancelRequest || membershipCancelRequestBusy) return;

    setMembershipCancelRequestBusy(true);
    setMembershipCancelRequestStatus("");
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const response = await fetch("/api/book/memberships/cancel-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          membershipRecordId: membershipCancelRequest.id,
          message: membershipCancelRequestMessage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not send cancellation request.");

      await refreshCustomerAccount();
      setMembershipCancelRequest(null);
      setMembershipCancelRequestMessage("");
      setSelectedMembershipDetails(null);
      setCustomerPortalStatus(payload.alreadyPending ? "Cancellation request is already pending with the admin." : "Cancellation request sent to admin.");
    } catch (error) {
      setMembershipCancelRequestStatus(error instanceof Error ? error.message : "Could not send cancellation request.");
    } finally {
      setMembershipCancelRequestBusy(false);
    }
  }

  async function signInParentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signInBusy) return;

    const email = signInForm.email.trim().toLowerCase();
    if (!email || !signInForm.password) {
      setSignInStatus("Please enter your email and password.");
      return;
    }

    setSignInBusy(true);
    setSignInStatus("");
    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email,
        password: signInForm.password,
      });
      if (signInResult.error) throw signInResult.error;

      const token = signInResult.data.session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Could not load your account session.");

      const payload = await loadParentAccount(token);
      if (!payload?.customer) throw new Error("Signed in, but could not load your family account.");

      applyParentAccount(payload.customer, payload.dashboard);
      setSignInForm({ email: payload.customer.email || email, password: "" });
      setShowSignInModal(false);
    } catch (error) {
      setSignInStatus(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setSignInBusy(false);
    }
  }

  async function sendPasswordResetEmail() {
    if (passwordResetEmailBusy || signInBusy) return;

    const email = signInForm.email.trim().toLowerCase();
    if (!email) {
      setSignInStatus("Enter your email first, then tap Forgot password.");
      return;
    }

    setPasswordResetEmailBusy(true);
    setSignInStatus("");
    try {
      const redirectTo = "https://www.grindbaseballlab.com/book";
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setPasswordResetRequiresCode(true);
      setPasswordResetForm({ email, token: "", password: "", confirmPassword: "" });
      setPasswordResetStatus("Check your email for the reset code, then enter it here.");
      setShowSignInModal(false);
      setShowPasswordResetModal(true);
    } catch (error) {
      setSignInStatus(error instanceof Error ? error.message : "Could not send password reset email.");
    } finally {
      setPasswordResetEmailBusy(false);
    }
  }

  async function updateCustomerPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordResetBusy) return;

    const password = passwordResetForm.password;
    const email = passwordResetForm.email.trim().toLowerCase();
    const resetCode = passwordResetForm.token.trim();
    if (passwordResetRequiresCode && (!email || !resetCode)) {
      setPasswordResetStatus("Enter your email and the reset code from the email.");
      return;
    }
    if (password.length < 6) {
      setPasswordResetStatus("Password must be at least 6 characters.");
      return;
    }
    if (password !== passwordResetForm.confirmPassword) {
      setPasswordResetStatus("Passwords do not match.");
      return;
    }

    setPasswordResetBusy(true);
    setPasswordResetStatus("");
    try {
      if (passwordResetRequiresCode) {
        const verifyResult = await supabase.auth.verifyOtp({
          email,
          token: resetCode,
          type: "recovery",
        });
        if (verifyResult.error) throw verifyResult.error;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) {
        const payload = await loadParentAccount(token);
        if (payload?.customer) applyParentAccount(payload.customer, payload.dashboard);
      }

      setPasswordResetRequiresCode(false);
      setPasswordResetForm({ email: "", token: "", password: "", confirmPassword: "" });
      setShowPasswordResetModal(false);
      setSignInStatus("Password updated. You are signed in.");
    } catch (error) {
      setPasswordResetStatus(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setPasswordResetBusy(false);
    }
  }

  async function createParentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accountBusy) return;

    setAccountBusy(true);
    setAccountStatus("");
    try {
      const parentName = fullName(accountForm.parentFirstName, accountForm.parentLastName);
      if (!accountForm.playerBirthDate) {
        setAccountStatus("Enter the DOB.");
        return;
      }
      if (!accountForm.gender) {
        setAccountStatus("Select Male or Female.");
        return;
      }
      if (!accountForm.emergencyContactName.trim() || !accountForm.emergencyContactPhone.trim()) {
        setAccountStatus("Enter an emergency contact name and phone.");
        return;
      }
      if (data.settings.waiverEnabled && !accountForm.waiverAgreed) {
        setAccountStatus("Please agree to the liability waiver before creating an account.");
        return;
      }
      const response = await fetch("/api/book/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...accountForm,
          parentName,
          playerName: parentName,
          playerFirstName: accountForm.parentFirstName.trim(),
          playerLastName: accountForm.parentLastName.trim(),
          playerBirthDate: accountForm.playerBirthDate ? isoDateToUs(accountForm.playerBirthDate) : "",
          familyMembers: [],
          waiverAgreed: accountForm.waiverAgreed,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create parent account.");

      const account = payload.customer as ParentAccount;
      const signInResult = await supabase.auth.signInWithPassword({
        email: account.email,
        password: accountForm.password,
      });
      if (signInResult.error) {
        setAccountStatus(`Account created, but sign in failed: ${signInResult.error.message}`);
        return;
      }

      setCustomerDashboard(emptyCustomerDashboard());
      applyParentAccount(account, emptyCustomerDashboard());
      setAccountForm((current) => ({ ...current, password: "" }));
      setShowAccountModal(false);
      setChildSetupStatus("");
      setChildForm(emptyChildForm);
      setChildrenSetupStep("prompt");
      setShowChildrenSetupModal(true);
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : "Could not create parent account.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function submitBooking(paymentMethod: "online" | "in-person" | "membership-credit") {
    if (!selectedService || !selectedTime) return;
    if (!waiverAcceptedForCheckout) {
      setSubmitError("Please agree to the liability waiver before completing this booking.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/book/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: selectedDate,
          start: selectedTime.start,
          resourceId: selectedTime.resourceId,
          staffMemberId: needsCoach ? selectedCoachId : undefined,
          customerId: parentAccount?.id,
          parentName: form.parentName,
          playerName: form.playerName || selectedPlayer,
          email: form.email,
          phone: form.phone,
          paymentMethod,
          waiverAgreed: parentAccount?.waiverAgreed || transactionWaiverAgreed,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create booking.");
      setData((current) => ({
        ...current,
        bookings: [
          ...current.bookings,
          {
            id: payload.bookingId,
            date: selectedDate,
            start: selectedTime.start,
            end: selectedTime.end,
            resourceId: selectedTime.resourceId,
            staffId: needsCoach ? selectedCoachId : null,
          },
        ],
      }));
      void saveWaiverAgreement();
      setStep("done");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMembershipPurchase(setupIntentId?: string) {
    if (!selectedService || selectedService.category !== "memberships") return;
    if (!waiverAcceptedForCheckout) {
      setSubmitError("Please agree to the liability waiver before purchasing this membership.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setMembershipCardStatus("");
    try {
      const response = await fetch("/api/book/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          customerId: parentAccount?.id,
          parentName: form.parentName,
          playerName: form.playerName || selectedPlayer,
          email: form.email,
          phone: form.phone,
          setupIntentId,
          waiverAgreed: parentAccount?.waiverAgreed || transactionWaiverAgreed,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start membership purchase.");

      if (payload.customerId && !parentAccount?.id) {
        setParentAccount({
          id: payload.customerId,
          parentName: form.parentName,
          playerName: form.playerName || selectedPlayer,
          email: form.email,
          phone: form.phone,
        });
      }

      if (payload.requiresCard && payload.clientSecret && payload.setupIntentId && payload.customerId) {
        setMembershipCardSetup({
          clientSecret: payload.clientSecret,
          setupIntentId: payload.setupIntentId,
          customerId: payload.customerId,
        });
        return;
      }

      if (selectedService.price > 0 && !setupIntentId) {
        throw new Error("Card payment is required before this membership can be started.");
      }

      setMembershipCardSetup(null);
      void saveWaiverAgreement();
      setStep("done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start membership purchase.";
      if (setupIntentId) {
        setMembershipCardStatus(message);
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="mx-auto grid min-h-[220px] max-w-[1240px] grid-cols-1 items-end gap-4 px-5 pb-4 pt-5 sm:grid-cols-[1fr_auto_1fr] sm:gap-5 lg:px-8">
          <div className="hidden sm:block" />
          <span className="inline-flex items-center justify-self-center">
            <Image src="/booking-header-logo.png" alt="The Grind Baseball Lab" width={920} height={408} className="h-40 w-auto sm:h-48" priority />
          </span>
          <div className="flex items-center justify-center gap-2 justify-self-center pb-1 sm:justify-self-end sm:gap-3">
            {parentAccount ? (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((current) => !current)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                  aria-label="Account menu"
                >
                  <span className="relative block h-7 w-7">
                    <span className="absolute left-1/2 top-[3px] h-[10px] w-[10px] -translate-x-1/2 rounded-full border-2 border-white" />
                    <span className="absolute bottom-[2px] left-1/2 h-[13px] w-[21px] -translate-x-1/2 rounded-t-full border-2 border-white border-b-0" />
                  </span>
                </button>

                {accountMenuOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-3 w-64 overflow-hidden rounded-[6px] border border-black/10 bg-white text-black shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
                    <div className="border-b border-black/10 px-4 py-3">
                      <div className="text-[15px] font-semibold">{parentAccount.parentName}</div>
                      <div className="mt-1 truncate text-[13px] text-black/55">{parentAccount.email}</div>
                    </div>
                    {parentAccount.isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          window.location.assign("/admin/home");
                        }}
                        className="block w-full border-b border-black/10 px-4 py-3 text-left text-[15px] font-semibold hover:bg-black/[0.04]"
                      >
                        Admin Dashboard
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={openCustomerPortal}
                      className="block w-full border-b border-black/10 px-4 py-3 text-left text-[15px] font-semibold hover:bg-black/[0.04]"
                    >
                      My Bookings & Memberships
                    </button>
                    <button
                      type="button"
                      onClick={signOut}
                      className="block w-full px-4 py-3 text-left text-[15px] font-semibold hover:bg-black/[0.04]"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <button type="button" onClick={openSignInModal} className="whitespace-nowrap rounded-[6px] px-2 py-1.5 text-[14px] font-semibold transition hover:bg-black/[0.04]">
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="whitespace-nowrap rounded-[6px] bg-[#1f1b1b] px-3 py-2 text-[14px] font-semibold text-white shadow-[0_6px_14px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black"
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <BookingHero
        settings={data.settings}
        schedules={data.schedules}
        onSelectCategory={setSelectedCategory}
        onSignIn={openSignInModal}
        showSignIn={!parentAccount}
      />

      <section className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {selectedCategory ? (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-[26px] text-black/55 shadow-sm transition hover:border-black/25 hover:text-black"
                aria-label="Back to services"
              >
                {"<"}
              </button>
            ) : null}
            <div>
              <h2 className="text-[28px] font-semibold leading-tight">
                {selectedCategory ? publicBookingCategoryLabels[selectedCategory].title : "Services"}
              </h2>
              <p className="mt-1 text-[15px] text-black/55">
                {selectedCategory
                  ? publicBookingCategoryLabels[selectedCategory].description
                  : "Choose what you want to book."}
              </p>
            </div>
          </div>

          {selectedCategory ? (
            <div className="mt-6 grid gap-4">
              <div className="flex justify-end">
                <button type="button" className="rounded-full border border-black/10 bg-white px-5 py-2 text-[14px] font-semibold text-black/60 shadow-sm transition hover:border-black/25 hover:text-black">
                  Filter
                </button>
              </div>
              {loading
                ? [1, 2, 3].map((item) => (
                    <div key={item} className="h-[152px] rounded-[10px] border border-black/10 bg-white p-6 shadow-sm">
                      <div className="h-8 w-40 rounded bg-black/5" />
                      <div className="mt-5 h-5 w-2/3 rounded bg-black/5" />
                    </div>
                  ))
                : orderedServicesForCategory.map((service) => {
                    const isCoveredByMembership = memberCreditServiceIds.has(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => openService(service)}
                        className="grid min-h-[150px] overflow-hidden rounded-[10px] border border-black/10 bg-white text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_34px_rgba(15,23,42,0.11)] sm:grid-cols-[150px_1fr_auto]"
                      >
                        <LogoPanel compact />
                        <div className="px-5 py-6 sm:px-6">
                          <div className="text-[20px] font-semibold leading-tight">{service.name}</div>
                          <div className="mt-3 text-[15px] leading-6 text-black/60">
                            {serviceCardDescription(service, data)}
                          </div>
                          <span className="mt-5 inline-flex rounded-full bg-[#eef4fb] px-4 py-1.5 text-[13px] font-semibold text-[#315f90]">
                            {serviceCardBadge(service)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-black/10 px-5 py-4 sm:block sm:border-l sm:border-t-0 sm:px-7 sm:py-6">
                          <div className={isCoveredByMembership ? "text-[24px] font-semibold text-[#087238]" : "text-[24px] font-semibold"}>
                            {isCoveredByMembership ? (
                              <>
                                Credit
                                <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#087238]/70">Member</div>
                              </>
                            ) : (
                              <>
                                {money(service.price)}
                                {service.category === "memberships" ? (
                                  <span className="text-[14px] font-medium text-black/45">/{membershipPeriodLabel(service.membershipBillingPeriod)}</span>
                                ) : null}
                              </>
                            )}
                          </div>
                          <div className="mt-0 text-[13px] font-semibold text-[#1784bd] sm:mt-8">{service.category === "memberships" ? "Join now" : "Book now"}</div>
                        </div>
                      </button>
                    );
                  })}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {visibleCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className="group rounded-[10px] border border-black/10 bg-white px-6 py-7 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[20px] font-semibold">{publicBookingCategoryLabels[category].title}</div>
                      <div className="mt-3 text-[15px] leading-6 text-black/60">{publicBookingCategoryLabels[category].description}</div>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef4fb] text-[18px] font-semibold text-[#315f90] transition group-hover:bg-[#1784bd] group-hover:text-white">
                      {">"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </section>

      <footer className="mt-6 border-t border-white/10 bg-black text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 items-center rounded-[6px] bg-black px-4">
              <Image src="/logo.png" alt="The Grind Baseball Lab" width={118} height={46} className="h-8 w-auto" />
            </span>
            <div>
              <div className="text-[17px] font-semibold">{data.settings.facilityName}</div>
              <div className="mt-1 text-[13px] text-white/55">Baseball and softball training in Venice, Florida</div>
            </div>
          </div>
          <div className="grid gap-1 text-[14px] text-white/65 sm:text-right">
            <a href={directionsHref(data.settings.address)} target="_blank" rel="noreferrer" className="hover:text-white">
              {data.settings.address}
            </a>
            <div className="flex gap-3 sm:justify-end">
              <a href={phoneHref(data.settings.phone, "call")} className="hover:text-white">
                {data.settings.phone}
              </a>
              <a href={phoneHref(data.settings.phone, "text")} className="hover:text-white">
                Text
              </a>
            </div>
            <div className="text-white/40">Copyright {new Date().getFullYear()} {data.settings.facilityName}</div>
          </div>
        </div>
      </footer>

      {selectedService ? (
        <ModalShell
          step={step}
          onBack={goBack}
          onClose={closeModal}
          avatar={step === "overview" ? undefined : initials(selectedPlayer)}
          footer={
            step === "overview" ? (
              <button type="button" onClick={() => setStep("player")} className="w-full rounded-[10px] bg-[#272322] py-4 text-[18px] font-semibold text-white shadow-lg">
                {isMembership ? "Join now" : "Book now"}
              </button>
            ) : step === "player" ? (
              <button
                type="button"
                disabled={!parentAccount || !form.parentName || !form.playerName || !form.email || (needsCoach && !selectedCoachId)}
                onClick={() => setStep(isMembership ? "summary" : "time")}
                className="w-full rounded-[10px] bg-[#272322] py-4 text-[18px] font-semibold text-white disabled:bg-black/12 disabled:text-black/30"
              >
                Next
              </button>
            ) : step === "time" ? (
              <button
                type="button"
                disabled={!selectedTime}
                onClick={() => setStep("summary")}
                className="w-full rounded-[10px] bg-[#272322] py-4 text-[18px] font-semibold text-white disabled:bg-black/12 disabled:text-black/30"
              >
                Next
              </button>
            ) : step === "summary" ? (
              isMembership ? (
                <button
                  type="button"
                  disabled={submitting || !waiverAcceptedForCheckout}
                  onClick={() => submitMembershipPurchase()}
                  className="w-full rounded-[10px] bg-[#3a3432] py-4 text-[18px] font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Saving..." : selectedService.price > 0 ? "Pay with credit card" : "Start membership"}
                </button>
              ) : (
                <div className="grid gap-3">
                  {membershipCredit ? (
                    <button
                      type="button"
                      disabled={submitting || !waiverAcceptedForCheckout}
                      onClick={() => submitBooking("membership-credit")}
                      className="w-full rounded-[10px] bg-[#1889c4] py-4 text-[18px] font-semibold text-white disabled:opacity-60"
                    >
                      {submitting ? "Saving..." : "Use Membership Credit"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={submitting || !waiverAcceptedForCheckout}
                    onClick={() => submitBooking("online")}
                    className="w-full rounded-[10px] bg-[#3a3432] py-4 text-[18px] font-semibold text-white disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Pay Online"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !waiverAcceptedForCheckout}
                    onClick={() => submitBooking("in-person")}
                    className="w-full rounded-[10px] border border-black/20 py-4 text-[18px] font-semibold disabled:opacity-60"
                  >
                    Pay In-Person
                  </button>
                </div>
              )
            ) : (
              <button type="button" onClick={closeModal} className="w-full rounded-[10px] bg-[#272322] py-4 text-[18px] font-semibold text-white">
                Done
              </button>
            )
          }
        >
          {step === "overview" ? (
            <div>
              <LogoPanel />
              <div className="mt-10">
                <h3 className="text-[28px] font-normal">{selectedService.name}</h3>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-[14px] text-black/70">
                  {(needsCoach ? coachOptions : selectedService.instructors.map((name) => ({ id: name, name, calendarColor: "#000000" }))).map((coach) => (
                    <span key={coach.id} className="inline-flex items-center gap-2 rounded-full bg-black/6 px-3 py-1">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-white"
                        style={{ backgroundColor: coach.calendarColor }}
                      >
                        {initials(coach.name)}
                      </span>
                      {coach.name}
                    </span>
                  ))}
                </div>
                <div className="mt-7 flex items-center gap-3 text-[16px] text-black/55">No age restrictions</div>
                <div className="mt-9 border-t border-black/10 pt-5">
                  <div className="text-[15px] font-semibold uppercase tracking-[0.12em] text-black/45">Pricing</div>
                  <div className="mt-3 text-[20px]">{money(selectedService.price)}</div>
                </div>
              </div>
            </div>
          ) : null}

          {step === "player" ? (
            <div>
              {!parentAccount ? (
                <div className="flex flex-col gap-3 rounded-[4px] bg-[#dfe8fb] px-6 py-4 text-[16px] text-[#365b97] sm:flex-row sm:items-center sm:justify-between">
                  <span>Account: create a parent account or sign in to use saved family details.</span>
                  <button type="button" onClick={openSignInModal} className="shrink-0 font-semibold text-[#244b86] underline underline-offset-4">
                    Sign in
                  </button>
                </div>
              ) : null}
              {needsCoach ? (
                <div className="mt-8">
                  <div className="text-[15px]">Hitting Coach</div>
                  <div className="mt-4 text-[16px]">Who would you like to schedule this lesson with?</div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {coachOptions.length ? (
                      coachOptions.map((coach) => (
                        <button
                          key={coach.id}
                          type="button"
                          onClick={() => {
                            setSelectedCoachId(coach.id);
                            const nextDate = nextAvailableDateForCoach(data, selectedService, selectedDate, coach.id);
                            if (nextDate && nextDate !== selectedDate) setSelectedDate(nextDate);
                            setSelectedTime(null);
                          }}
                          className={`flex items-center gap-4 rounded-[8px] border px-5 py-4 text-left ${
                            selectedCoachId === coach.id ? "border-black shadow-[inset_0_0_0_1px_black]" : "border-black/15"
                          }`}
                        >
                          <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                            style={{ backgroundColor: coach.calendarColor }}
                          >
                            {initials(coach.name)}
                          </span>
                          <span>
                            <span className="block text-[17px] font-semibold">{coach.name}</span>
                            <span className="mt-1 block text-[14px] text-black/55">{coach.role || "Instructor"}</span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[8px] bg-black/5 px-5 py-4 text-black/55">No hitting coaches are assigned to this lesson yet.</div>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="mt-6 text-[15px]">Players in Family Account</div>
              <div className="mt-3 text-[16px]">
                {isMembership ? "Who is this membership for?" : "Who is the player attending this booking?"}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,170px))]">
                {parentAccount ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlayer(accountHolderPlayerName);
                        setForm({
                          parentName: parentAccount.parentName,
                          playerName: accountHolderPlayerName,
                          email: parentAccount.email,
                          phone: parentAccount.phone,
                        });
                      }}
                      className={`min-h-[184px] rounded-[8px] border px-4 py-5 text-center ${
                        selectedPlayer === accountHolderPlayerName ? "border-black shadow-[inset_0_0_0_1px_black]" : "border-black/15"
                      }`}
                    >
                      <span className="mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-full bg-[#1f1b1b] text-[22px] text-white sm:h-[96px] sm:w-[96px]">
                        {initials(accountHolderPlayerName)}
                      </span>
                      <span className="mt-4 block text-[16px] font-semibold leading-tight">{accountHolderPlayerName}</span>
                      <span className="mt-3 block text-[13px] text-black/60">Account holder</span>
                    </button>
                    {familyMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlayer(member.name);
                          setForm({
                            parentName: parentAccount.parentName,
                            playerName: member.name,
                            email: parentAccount.email,
                            phone: parentAccount.phone,
                          });
                        }}
                        className={`min-h-[184px] rounded-[8px] border px-4 py-5 text-center ${
                          selectedPlayer === member.name ? "border-black shadow-[inset_0_0_0_1px_black]" : "border-black/15"
                        }`}
                      >
                        <span className="mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-full bg-[#bebebe] text-[22px] text-white sm:h-[96px] sm:w-[96px]">
                          {initials(member.name)}
                        </span>
                        <span className="mt-4 block text-[16px] font-semibold leading-tight">{member.name}</span>
                        {familyDobLabel(member) ? <span className="mt-3 block text-[13px] text-black/60">{familyDobLabel(member)}</span> : null}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={openCustomerPortal}
                      className="flex min-h-[184px] flex-col items-center justify-center rounded-[8px] border border-dashed border-black/25 px-4 py-5 text-center hover:border-black"
                    >
                      <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-black text-[30px] text-white">+</span>
                      <span className="mt-4 block text-[16px] font-semibold">Add player</span>
                      <span className="mt-2 block text-[13px] leading-5 text-black/55">Add another child.</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={openSignInModal}
                      className="flex min-h-[184px] flex-col items-center justify-center rounded-[8px] border border-black/15 bg-white px-4 py-5 text-center transition hover:border-black hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)]"
                    >
                      <span className="relative flex h-[66px] w-[66px] items-center justify-center rounded-full bg-[#1f1b1b]">
                        <span className="absolute left-1/2 top-[16px] h-[15px] w-[15px] -translate-x-1/2 rounded-full border-[3px] border-white" />
                        <span className="absolute bottom-[14px] left-1/2 h-[19px] w-[32px] -translate-x-1/2 rounded-t-full border-[3px] border-white border-b-0" />
                      </span>
                      <span className="mt-4 block text-[16px] font-semibold">Sign in</span>
                      <span className="mt-2 block text-[13px] leading-5 text-black/55">Use your family account.</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAccountModal}
                      className="flex min-h-[184px] flex-col items-center justify-center rounded-[8px] border border-dashed border-black/25 px-4 py-5 text-center hover:border-black"
                    >
                      <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-black text-[30px] text-white">+</span>
                      <span className="mt-4 block text-[16px] font-semibold">Create account</span>
                      <span className="mt-2 block text-[13px] leading-5 text-black/55">Save family details.</span>
                    </button>
                  </>
                )}
              </div>
              {parentAccount ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-[14px] font-medium">
                    Parent name
                    <input
                      readOnly
                      className="h-12 cursor-default rounded-[5px] border border-black/10 bg-black/[0.035] px-4 text-[16px] text-black/70"
                      value={form.parentName}
                    />
                  </label>
                  <label className="grid gap-2 text-[14px] font-medium">
                    {isMembership ? "Membership for" : "Player name"}
                    <input
                      readOnly
                      className="h-12 cursor-default rounded-[5px] border border-black/10 bg-black/[0.035] px-4 text-[16px] text-black/70"
                      value={form.playerName}
                    />
                  </label>
                  <label className="grid gap-2 text-[14px] font-medium">
                    Email
                    <input
                      readOnly
                      className="h-12 cursor-default rounded-[5px] border border-black/10 bg-black/[0.035] px-4 text-[16px] text-black/70"
                      value={form.email}
                    />
                  </label>
                  <label className="grid gap-2 text-[14px] font-medium">
                    Phone
                    <input
                      readOnly
                      className="h-12 cursor-default rounded-[5px] border border-black/10 bg-black/[0.035] px-4 text-[16px] text-black/70"
                      value={form.phone}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-8 rounded-[8px] border border-dashed border-black/15 bg-black/[0.03] px-5 py-5 text-[15px] leading-6 text-black/60">
                  Sign in or create a parent account to auto-fill these booking details.
                </div>
              )}
            </div>
          ) : null}

          {step === "time" ? (
            <div>
              <label className="grid gap-3 text-[14px] font-medium">
                Date
                <input
                  type="date"
                  value={selectedDate}
                  min={todayIso()}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedTime(null);
                  }}
                  className="h-[66px] rounded-[4px] border border-black px-5 text-[20px] font-normal"
                />
              </label>
              <div className="mt-1 grid items-start gap-8 lg:grid-cols-[400px_1fr]">
                <MonthCalendar
                  value={selectedDate}
                  onChange={(value) => {
                    setSelectedDate(value);
                    setSelectedTime(null);
                  }}
                />
                <div className="flex flex-wrap gap-4 pt-16">
                  {availableTimes.length ? (
                    availableTimes.slice(0, 18).map((choice) => (
                      <button
                        key={`${choice.resourceId}-${choice.start}`}
                        type="button"
                        onClick={() => setSelectedTime(choice)}
                        className={`rounded-full px-6 py-3 text-[15px] ${
                          selectedTime?.resourceId === choice.resourceId && selectedTime.start === choice.start
                            ? "bg-[#252121] text-white"
                            : "bg-black/8 text-black/75 hover:bg-black/12"
                        }`}
                      >
                        {timeLabel(choice.start)} - {timeLabel(choice.end)}
                      </button>
                    ))
                  ) : needsCoach && !selectedCoachId ? (
                    <div className="rounded-[8px] bg-black/5 px-5 py-4 text-black/55">Choose a hitting coach before selecting a time.</div>
                  ) : (
                    <div className="rounded-[8px] bg-black/5 px-5 py-4 text-black/55">
                      No times are available for {selectedCoachName || "this coach"} on this date.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {step === "summary" && (isMembership || selectedTime) && onlineTotals && inPersonTotals ? (
            <div>
              <div className="grid grid-cols-[126px_1fr] gap-5">
                <div className="overflow-hidden rounded-[16px] border border-black/15">
                  <LogoPanel compact />
                </div>
                <div>
                  <div className="text-[13px] text-black/45">{selectedService.category.slice(0, -1) || "Booking"}</div>
                  <div className="mt-2 text-[18px]">{selectedService.name}</div>
                  {selectedCoachName ? (
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/7 px-3 py-1 text-[12px]">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: selectedCoach?.calendarColor ?? "#000000" }}
                      >
                        {initials(selectedCoachName)}
                      </span>
                      {selectedCoachName}
                    </span>
                  ) : null}
                </div>
              </div>
              {isMembership ? (
                <div className="mt-8 border-t border-black/10 pt-7">
                  <div className="text-[20px] font-semibold">Membership For</div>
                  <div className="mt-6 rounded-[10px] border border-black/10 bg-black/[0.02] px-5 py-4">
                    <div className="text-[18px] font-semibold">{form.playerName || selectedPlayer}</div>
                    <div className="mt-2 text-[15px] text-black/55">Parent: {form.parentName}</div>
                    <div className="mt-1 text-[15px] text-black/55">{form.email}</div>
                  </div>
                  <div className="mt-5 grid gap-3 text-[15px] text-black/65">
                    <div className="flex justify-between gap-6">
                      <span>Billing</span>
                      <span className="text-right text-black">{selectedService.membershipBillingPeriod}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span>Credits</span>
                      <span className="text-right text-black">{membershipCreditLabel(selectedService)}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span>Renewal</span>
                      <span className="text-right text-black">{selectedService.price > 0 ? "Auto renews after card purchase" : "No card payment required"}</span>
                    </div>
                  </div>
                </div>
              ) : selectedTime ? (
                <div className="mt-8 border-t border-black/10 pt-7">
                  <div className="text-[20px] font-semibold">Timing & Location</div>
                  <div className="mt-6 flex justify-between gap-8">
                    <div>
                      <div>{formatLongDate(selectedDate)}</div>
                      <div className="mt-2">
                        {timeLabel(selectedTime.start)} - {timeLabel(selectedTime.end)}
                      </div>
                      <div className="mt-2 text-black/55">{selectedTime.resourceName}</div>
                      {selectedCoachName ? <div className="mt-2 text-black/55">Coach: {selectedCoachName}</div> : null}
                    </div>
                    <button type="button" onClick={() => setStep("time")} className="font-semibold underline">
                      Edit
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mt-7 border-t border-black/10 pt-7">
                <div className="text-[18px] font-semibold">{isMembership ? "Purchase Details" : "Payment Details"}</div>
                {isMembership ? (
                  <div className="mt-5 grid gap-3 text-[16px] text-black/65">
                    <div className="flex justify-between">
                      <span>{selectedService.membershipBillingPeriod} membership</span>
                      <span>{money(selectedService.price)}/{membershipPeriodLabel(selectedService.membershipBillingPeriod)}</span>
                    </div>
                    <div className="flex justify-between text-[20px] font-semibold text-black">
                      <span>{selectedService.price > 0 ? "Due by card today" : "Due today"}</span>
                      <span>{money(selectedService.price)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid gap-3 text-[16px] text-black/65">
                      <div className="flex justify-between"><span>Price</span><span>{money(selectedService.price)}</span></div>
                      <div className="flex justify-between"><span>Subtotal</span><span>{money(onlineTotals.subtotal)}</span></div>
                      {onlineTotals.tax > 0 ? <div className="flex justify-between"><span>{onlineTotals.taxName}</span><span>{money(onlineTotals.tax)}</span></div> : null}
                      {onlineTotals.serviceFee > 0 ? <div className="flex justify-between"><span>{onlineTotals.feeName}</span><span>{money(onlineTotals.serviceFee)}</span></div> : null}
                      <div className="flex justify-between text-[20px] font-semibold text-black"><span>Total</span><span>{money(onlineTotals.total)}</span></div>
                    </div>
                    <div className="mt-6 flex gap-5">
                      <input
                        value={discountCode}
                        onChange={(event) => setDiscountCode(event.target.value)}
                        placeholder="Discount code"
                        className="h-[54px] flex-1 rounded-[5px] border border-black/20 px-5 text-[17px]"
                      />
                      <button type="button" className="rounded-[5px] bg-black/12 px-7 text-[17px] font-semibold text-black/25">
                        Apply
                      </button>
                    </div>
                    <div className="mt-4 text-[13px] text-black/45">Pay in-person total: {money(inPersonTotals.total)}</div>
                    {membershipCredit ? (
                      <div className="mt-5 rounded-[8px] border border-[#b9dff2] bg-[#eef8fc] px-4 py-4 text-[14px] leading-6 text-[#245f78]">
                        <span className="font-semibold text-black">Membership credit available:</span>{" "}
                        {membershipCredit.serviceName} includes {membershipRecordCreditLabel(membershipCredit)} for this service. Use a credit to complete this booking without payment.
                      </div>
                    ) : parentAccount ? (
                      <div className="mt-5 rounded-[8px] bg-black/[0.04] px-4 py-4 text-[14px] leading-6 text-black/55">
                        No membership credits are available for this service or date. Choose a payment option below.
                      </div>
                    ) : null}
                  </>
                )}
                {data.settings.waiverEnabled ? (
                  <div className="mt-6 rounded-[8px] border border-[#b9dff2] bg-[#eef8fc] px-4 py-4">
                    <div className="text-[15px] font-semibold">Liability Waiver</div>
                    {parentAccount?.waiverAgreed ? (
                      <div className="mt-2 text-[14px] text-[#245f78]">Waiver already agreed for this family account.</div>
                    ) : (
                      <>
                        <p className="mt-2 text-[14px] leading-6 text-[#245f78]">{data.settings.waiverIntro}</p>
                        {data.settings.waiverDocumentUrl ? (
                          <a
                            href={data.settings.waiverDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-[14px] font-semibold text-[#0b6f9f] underline underline-offset-4"
                          >
                            View {data.settings.waiverDocumentName || "liability waiver"}
                          </a>
                        ) : null}
                        <label className="mt-4 flex items-start gap-3 text-[14px] font-semibold text-black">
                          <input
                            type="checkbox"
                            checked={transactionWaiverAgreed}
                            onChange={(event) => setTransactionWaiverAgreed(event.target.checked)}
                            className="mt-1 h-5 w-5 accent-black"
                          />
                          I have read and agree to the liability waiver for this purchase.
                        </label>
                      </>
                    )}
                  </div>
                ) : null}
                {submitError ? <div className="mt-4 rounded-[6px] bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
              </div>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex min-h-full flex-col items-center justify-center py-5 text-center">
              <div className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-[#7ad33d] text-[26px] font-semibold text-white">Done</div>
              <div className="mt-7 text-[20px] font-semibold leading-tight">{selectedService.name} - {isMembership ? "Membership Started" : "Booking Confirmed"}</div>
              <p className="mt-4 max-w-[560px] text-[17px] leading-[1.45] text-black/70">
                {isMembership
                  ? "Your membership is ready to use for eligible services at The Grind Baseball Lab."
                  : "Looking forward to seeing you at The Grind Baseball Lab! You will receive a confirmation email with your booking details shortly."}
              </p>
            </div>
          ) : null}
        </ModalShell>
      ) : null}

      {showAccountModal ? (
        <ParentAccountModal
          form={accountForm}
          setForm={setAccountForm}
          busy={accountBusy}
          status={accountStatus}
          waiverSettings={data.settings}
          onClose={() => setShowAccountModal(false)}
          onSubmit={createParentAccount}
        />
      ) : null}

      {showChildrenSetupModal ? (
        <ChildrenSetupModal
          step={childrenSetupStep}
          childForm={childForm}
          setChildForm={setChildForm}
          busy={childSetupBusy}
          status={childSetupStatus}
          onClose={finishChildrenSetup}
          onStartChild={startChildEntry}
          onSubmitChild={submitSignupChild}
          onFinish={finishChildrenSetup}
        />
      ) : null}

      {showSignInModal ? (
        <SignInModal
          form={signInForm}
          setForm={setSignInForm}
          busy={signInBusy}
          resetBusy={passwordResetEmailBusy}
          status={signInStatus}
          onClose={() => setShowSignInModal(false)}
          onSubmit={signInParentAccount}
          onResetPassword={sendPasswordResetEmail}
        />
      ) : null}

      {showPasswordResetModal ? (
        <ResetPasswordModal
          form={passwordResetForm}
          setForm={setPasswordResetForm}
          requiresCode={passwordResetRequiresCode}
          busy={passwordResetBusy}
          status={passwordResetStatus}
          onClose={() => setShowPasswordResetModal(false)}
          onSubmit={updateCustomerPassword}
        />
      ) : null}

      {showCustomerPortal && parentAccount ? (
        <CustomerPortalModal
          account={parentAccount}
          dashboard={customerDashboard}
          busy={customerPortalBusy}
          status={customerPortalStatus}
          onClose={() => setShowCustomerPortal(false)}
          onRefresh={refreshCustomerAccount}
          onAddPlayer={(member) => saveFamilyMembers([...familyMembers, member], member)}
          onMembershipDetails={setSelectedMembershipDetails}
          onPrintMembershipReceipt={printMembershipReceipt}
          onRequestMembershipCancel={openMembershipCancelRequest}
        />
      ) : null}

      {selectedMembershipDetails ? (
        <MembershipDetailsModal
          membership={selectedMembershipDetails}
          onClose={() => setSelectedMembershipDetails(null)}
          onPrint={printMembershipReceipt}
          onRequestCancel={openMembershipCancelRequest}
        />
      ) : null}

      {membershipCancelRequest ? (
        <MembershipCancelRequestModal
          membership={membershipCancelRequest}
          message={membershipCancelRequestMessage}
          setMessage={setMembershipCancelRequestMessage}
          busy={membershipCancelRequestBusy}
          status={membershipCancelRequestStatus}
          onClose={() => setMembershipCancelRequest(null)}
          onSubmit={sendMembershipCancelRequest}
        />
      ) : null}

      {membershipCardSetup && selectedService?.category === "memberships" ? (
        <MembershipCardModal
          service={selectedService}
          setup={membershipCardSetup}
          customerName={form.parentName}
          email={form.email}
          phone={form.phone}
          busy={submitting}
          status={membershipCardStatus}
          onClose={() => {
            setMembershipCardSetup(null);
            setMembershipCardStatus("");
          }}
          onConfirm={(setupIntentId) => submitMembershipPurchase(setupIntentId)}
        />
      ) : null}
    </main>
  );
}
