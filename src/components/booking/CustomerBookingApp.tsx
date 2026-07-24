"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import Image from "next/image";

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
  timeLabel,
  timeToMinutes,
  type PublicBookingCategory,
  type PublicBookingData,
  type PublicBookingService,
} from "@/lib/publicBooking";
import { supabase } from "@/lib/supabaseClient";

type BookingStep = "overview" | "player" | "time" | "summary" | "done";
type TimeChoice = { start: string; end: string; resourceId: string; resourceName: string };
type ParentAccount = {
  id?: string;
  parentName: string;
  playerName: string;
  playerAge?: string;
  email: string;
  phone: string;
};
type AccountForm = {
  parentFirstName: string;
  parentLastName: string;
  email: string;
  phone: string;
  password: string;
  playerFirstName: string;
  playerLastName: string;
  playerAge: string;
};

const categoryOrder: PublicBookingCategory[] = ["rentals", "lessons", "camps", "classes", "memberships", "packages"];
const emptyAccountForm: AccountForm = {
  parentFirstName: "",
  parentLastName: "",
  email: "",
  phone: "",
  password: "",
  playerFirstName: "",
  playerLastName: "",
  playerAge: "",
};

function todayIso() {
  return isoDate(new Date());
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].map((value) => value.trim()).filter(Boolean).join(" ");
}

function durationLabel(minutes: number) {
  return `${minutes} mins`;
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
    <div className={`relative flex items-center justify-center overflow-hidden bg-black ${compact ? "h-full min-h-[108px]" : "min-h-[300px] sm:min-h-[340px]"}`}>
      <Image
        src="/logo.png"
        alt="The Grind Baseball Lab"
        width={compact ? 180 : 620}
        height={compact ? 70 : 241}
        className={`relative ${compact ? "w-[142px] sm:w-[160px]" : "w-[620px] max-w-[78%]"} h-auto`}
        priority={!compact}
      />
    </div>
  );
}

function InfoCard({ settings }: { settings: PublicBookingData["settings"] }) {
  const iconClass = "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-[14px] font-bold text-[#1784bd]";
  return (
    <aside className="h-fit rounded-[10px] border border-black/10 bg-white p-6 text-[14px] leading-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:sticky lg:top-[110px]">
      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-black/40">Facility Info</div>
      <div className="mt-5 grid gap-5">
        <div className="flex gap-4">
          <span className={iconClass}>A</span>
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-black/40">Address</div>
            <div className="mt-1 text-[15px] text-black/75">{settings.address}</div>
          </div>
        </div>
        <div className="flex gap-4">
          <span className={iconClass}>P</span>
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-black/40">Phone</div>
            <div className="mt-1 text-[15px] text-black/75">{settings.phone}</div>
          </div>
        </div>
        <div className="flex gap-4 rounded-[8px] border border-red-100 bg-red-50/70 px-4 py-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[14px] font-bold text-[#d10018]">H</span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-black/40">Today</div>
            <div className="mt-1 text-[15px] text-black/75">
              <span className="font-semibold text-[#d10018]">Closed</span> - Opens 4PM today
            </div>
          </div>
          <span className="ml-auto text-black/45">v</span>
        </div>
      </div>
      <div className="mt-7 border-t border-black/10 pt-6">
        <div className="font-semibold">Follow us</div>
        <div className="mt-4 flex gap-3 text-[15px] font-semibold text-black/60">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-[#f7f8fa]">W</span>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-[#f7f8fa]">F</span>
        </div>
      </div>
    </aside>
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

function ParentAccountModal({
  form,
  setForm,
  busy,
  status,
  onClose,
  onSubmit,
}: {
  form: AccountForm;
  setForm: Dispatch<SetStateAction<AccountForm>>;
  busy: boolean;
  status: string;
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
          <div className="text-[22px] font-semibold">Create Parent Account</div>
          <button type="button" onClick={onClose} className="ml-auto text-[32px] leading-none text-black/45">
            x
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-[14px] font-medium">
              Parent first name
              <input
                value={form.parentFirstName}
                onChange={(event) => setForm((current) => ({ ...current, parentFirstName: event.target.value }))}
                className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
              />
            </label>
            <label className="grid gap-2 text-[14px] font-medium">
              Parent last name
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
          </div>

          <div className="mt-8 border-t border-black/10 pt-6">
            <div className="text-[18px] font-semibold">Player</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
              <label className="grid gap-2 text-[14px] font-medium">
                First name
                <input
                  value={form.playerFirstName}
                  onChange={(event) => setForm((current) => ({ ...current, playerFirstName: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium">
                Last name
                <input
                  value={form.playerLastName}
                  onChange={(event) => setForm((current) => ({ ...current, playerLastName: event.target.value }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
              <label className="grid gap-2 text-[14px] font-medium">
                Age
                <input
                  inputMode="numeric"
                  value={form.playerAge}
                  onChange={(event) => setForm((current) => ({ ...current, playerAge: event.target.value.replace(/\D/g, "") }))}
                  className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]"
                />
              </label>
            </div>
          </div>

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
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountStatus, setAccountStatus] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
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

      const response = await fetch("/api/book/customers", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const payload = await response.json();
      const account = payload.customer as ParentAccount | null;
      if (!mounted || !account) return;

      setParentAccount(account);
      setSelectedPlayer(account.playerName || "Yourself");
      setForm({
        parentName: account.parentName,
        playerName: account.playerName || "",
        email: account.email,
        phone: account.phone,
      });
    }

    void loadAccount();

    return () => {
      mounted = false;
    };
  }, []);

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
  const availableTimes = useMemo(
    () => getAvailableSlots(data, selectedService, selectedDate, needsCoach ? selectedCoachId : undefined),
    [data, needsCoach, selectedCoachId, selectedDate, selectedService]
  );
  const onlineTotals = selectedService ? calculatePublicTotals(selectedService, data.settings, "online") : null;
  const inPersonTotals = selectedService ? calculatePublicTotals(selectedService, data.settings, "in-person") : null;

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
  }

  function goBack() {
    if (step === "player") setStep("overview");
    if (step === "time") setStep("player");
    if (step === "summary") setStep("time");
  }

  function openAccountModal() {
    setAccountStatus("");
    const playerName = form.playerName === "Yourself" ? "" : form.playerName;
    setAccountForm((current) => ({
      ...current,
      parentFirstName: current.parentFirstName || form.parentName.split(" ")[0] || "",
      parentLastName: current.parentLastName || form.parentName.split(" ").slice(1).join(" "),
      email: current.email || form.email,
      phone: current.phone || form.phone,
      playerFirstName: current.playerFirstName || playerName.split(" ")[0] || "",
      playerLastName: current.playerLastName || playerName.split(" ").slice(1).join(" "),
    }));
    setShowAccountModal(true);
  }

  async function signOut() {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    setParentAccount(null);
    setSelectedPlayer("Yourself");
    setForm({ parentName: "", playerName: "Yourself", email: "", phone: "" });
  }

  async function createParentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accountBusy) return;

    setAccountBusy(true);
    setAccountStatus("");
    try {
      const parentName = fullName(accountForm.parentFirstName, accountForm.parentLastName);
      const playerName = fullName(accountForm.playerFirstName, accountForm.playerLastName);
      const response = await fetch("/api/book/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...accountForm,
          parentName,
          playerName,
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

      setParentAccount(account);
      setSelectedPlayer(account.playerName);
      setForm({
        parentName: account.parentName,
        playerName: account.playerName,
        email: account.email,
        phone: account.phone,
      });
      setAccountForm((current) => ({ ...current, password: "" }));
      setShowAccountModal(false);
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : "Could not create parent account.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function submitBooking(paymentMethod: "online" | "in-person") {
    if (!selectedService || !selectedTime) return;
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
      setStep("done");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[86px] max-w-[1240px] items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <span className="inline-flex h-12 items-center rounded-[6px] bg-black px-4 shadow-sm">
            <Image src="/logo.png" alt="The Grind Baseball Lab" width={118} height={46} className="h-8 w-auto" priority />
          </span>
          <div className="flex items-center gap-3 sm:gap-5">
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
                <a href="/login?next=/book" className="rounded-[6px] px-3 py-2 text-[16px] font-semibold transition hover:bg-black/[0.04]">
                  Sign In
                </a>
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="rounded-[6px] bg-[#1f1b1b] px-5 py-3 text-[16px] font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-black"
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[10px] border border-black/10 bg-black shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
          <LogoPanel />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_370px] lg:px-8">
        <div className="min-w-0">
          <div className="rounded-[10px] border border-black/10 bg-white px-5 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:px-8 sm:py-8">
            <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1784bd]">Book Online</div>
            <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-normal sm:text-[42px]">{data.settings.facilityName}</h1>
            <p className="mt-5 max-w-[850px] text-[17px] leading-8 text-black/65">
              Reserve cage time, lessons, camps, and memberships with a smoother booking experience built for baseball and softball families.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-[14px] font-semibold text-black/70">
              <span className="rounded-full bg-[#e9f6fd] px-4 py-2 text-[#176d99]">Indoor training</span>
              <span className="rounded-full bg-[#eef8ef] px-4 py-2 text-[#26723a]">Private lessons</span>
              <span className="rounded-full bg-[#f3f4f6] px-4 py-2">Easy scheduling</span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
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
                : servicesForCategory.map((service) => (
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
                          Book {durationLabel(service.duration).toLowerCase()} of{" "}
                          {service.category === "lessons" ? "private instruction" : serviceRooms(service, data.resources).join(", ")}.
                        </div>
                        <span className="mt-5 inline-flex rounded-full bg-[#eef4fb] px-4 py-1.5 text-[13px] font-semibold text-[#315f90]">
                          {durationLabel(service.duration)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-black/10 px-5 py-4 sm:block sm:border-l sm:border-t-0 sm:px-7 sm:py-6">
                        <div className="text-[24px] font-semibold">{money(service.price)}</div>
                        <div className="mt-0 text-[13px] font-semibold text-[#1784bd] sm:mt-8">Book now</div>
                      </div>
                    </button>
                  ))}
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

        <InfoCard settings={data.settings} />
      </section>

      <footer className="mt-6 border-t border-white/10 bg-black text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 items-center rounded-[6px] bg-white px-4">
              <Image src="/logo.png" alt="The Grind Baseball Lab" width={118} height={46} className="h-8 w-auto" />
            </span>
            <div>
              <div className="text-[17px] font-semibold">{data.settings.facilityName}</div>
              <div className="mt-1 text-[13px] text-white/55">Baseball and softball training in Venice, Florida</div>
            </div>
          </div>
          <div className="grid gap-1 text-[14px] text-white/65 sm:text-right">
            <div>{data.settings.address}</div>
            <div>{data.settings.phone}</div>
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
                Book now
              </button>
            ) : step === "player" ? (
              <button
                type="button"
                disabled={!form.parentName || !form.playerName || !form.email || (needsCoach && !selectedCoachId)}
                onClick={() => setStep("time")}
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
              <div className="grid gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitBooking("online")}
                  className="w-full rounded-[10px] bg-[#3a3432] py-4 text-[18px] font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Pay Online"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitBooking("in-person")}
                  className="w-full rounded-[10px] border border-black/20 py-4 text-[18px] font-semibold disabled:opacity-60"
                >
                  Pay In-Person
                </button>
              </div>
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
              <div className="rounded-[4px] bg-[#dfe8fb] px-6 py-4 text-[16px] text-[#365b97]">
                Account: create a parent account to save family details for future bookings.
              </div>
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
              <div className="mt-8 text-[15px]">Players in Family Account</div>
              <div className="mt-4 text-[16px]">Who is the player attending this booking?</div>
              <div className="mt-6 flex flex-wrap gap-4">
                {parentAccount ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayer(parentAccount.playerName);
                      setForm((current) => ({ ...current, playerName: parentAccount.playerName }));
                    }}
                    className={`h-[310px] w-[190px] rounded-[8px] border px-5 py-7 text-center ${
                      selectedPlayer === parentAccount.playerName ? "border-black shadow-[inset_0_0_0_1px_black]" : "border-black/15"
                    }`}
                  >
                    <span className="mx-auto flex h-[126px] w-[126px] items-center justify-center rounded-full bg-[#bebebe] text-[26px] text-white">
                      {initials(parentAccount.playerName)}
                    </span>
                    <span className="mt-5 block text-[18px]">{parentAccount.playerName}</span>
                    {parentAccount.playerAge ? <span className="mt-6 block text-[14px]">{parentAccount.playerAge} years old</span> : null}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className="flex h-[310px] w-[190px] flex-col items-center justify-center rounded-[8px] border border-dashed border-black/25 px-5 py-7 text-center hover:border-black"
                  >
                    <span className="flex h-[80px] w-[80px] items-center justify-center rounded-full bg-black text-[34px] text-white">+</span>
                    <span className="mt-5 block text-[18px] font-semibold">Create account</span>
                    <span className="mt-4 block text-[14px] leading-5 text-black/55">Save parent and player details.</span>
                  </button>
                )}
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-[14px] font-medium">
                  Parent name
                  <input className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]" value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} />
                </label>
                <label className="grid gap-2 text-[14px] font-medium">
                  Player name
                  <input className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]" value={form.playerName} onChange={(event) => setForm({ ...form, playerName: event.target.value })} />
                </label>
                <label className="grid gap-2 text-[14px] font-medium">
                  Email
                  <input className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </label>
                <label className="grid gap-2 text-[14px] font-medium">
                  Phone
                  <input className="h-12 rounded-[5px] border border-black/20 px-4 text-[16px]" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </label>
              </div>
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

          {step === "summary" && selectedTime && onlineTotals && inPersonTotals ? (
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
              <div className="mt-7 border-t border-black/10 pt-7">
                <div className="text-[18px] font-semibold">Payment Details</div>
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
                {submitError ? <div className="mt-4 rounded-[6px] bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
              </div>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
              <div className="flex h-[122px] w-[122px] items-center justify-center rounded-full bg-[#7ad33d] text-[32px] font-semibold text-white">Done</div>
              <div className="mt-12 text-[22px] font-semibold">{selectedService.name} - Booking Confirmed</div>
              <p className="mt-5 max-w-[630px] text-[20px] leading-[1.55]">
                Looking forward to seeing you at The Grind Baseball Lab! You will receive a confirmation email with your booking details shortly.
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
          onClose={() => setShowAccountModal(false)}
          onSubmit={createParentAccount}
        />
      ) : null}
    </main>
  );
}
