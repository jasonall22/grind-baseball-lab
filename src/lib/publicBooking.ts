export type PublicBookingCategory = "rentals" | "lessons" | "camps" | "classes" | "memberships" | "packages";

export type PublicBookingSettings = {
  facilityName: string;
  address: string;
  phone: string;
  taxRates: Array<{ id: string; name: string; percentage: string | number }>;
  customFees: Array<{ id: string; name: string; amount: string | number }>;
};

export type PublicBookingResource = {
  id: string;
  name: string;
  sortOrder: number;
  scheduleId: string | null;
};

export type PublicBookingService = {
  id: string;
  name: string;
  category: PublicBookingCategory;
  duration: number;
  price: number;
  rooms: string[];
  resourceId: string | null;
  instructors: string[];
  scheduleId: string | null;
  collectTax: boolean;
  collectFee: boolean;
};

export type PublicBookingScheduleSlot = {
  id: string;
  start: string;
  end: string;
  sortOrder: number;
};

export type PublicBookingSchedule = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  slotsByWeekday: Record<string, PublicBookingScheduleSlot[]>;
  overridesByDate: Record<string, { isClosed: boolean; slots: PublicBookingScheduleSlot[] }>;
};

export type PublicBookingExisting = {
  id: string;
  date: string;
  start: string;
  end: string;
  resourceId: string | null;
  staffId: string | null;
};

export type PublicBookingStaff = {
  id: string;
  name: string;
  email: string;
  role: string;
  calendarColor: string;
};

export type PublicBookingStaffAvailability = {
  id: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  resourceNames: string[];
};

export type PublicBookingData = {
  settings: PublicBookingSettings;
  resources: PublicBookingResource[];
  services: PublicBookingService[];
  schedules: PublicBookingSchedule[];
  bookings: PublicBookingExisting[];
  staff: PublicBookingStaff[];
  staffAvailability: PublicBookingStaffAvailability[];
};

export const publicBookingCategoryLabels: Record<PublicBookingCategory, { title: string; description: string }> = {
  rentals: {
    title: "Rentals",
    description: "Rent a space and practice your own way.",
  },
  lessons: {
    title: "Lessons",
    description: "Book a private lesson with our top instructors.",
  },
  camps: {
    title: "Camps",
    description: "Register for one of our popular seasonal camps.",
  },
  classes: {
    title: "Classes",
    description: "Join group training and skill development sessions.",
  },
  memberships: {
    title: "Memberships",
    description: "Unlock member benefits and booking credits.",
  },
  packages: {
    title: "Packages",
    description: "Save with bundles for repeat training.",
  },
};

export const fallbackPublicBookingData: PublicBookingData = {
  settings: {
    facilityName: "The Grind Baseball Lab",
    address: "613 Cypress Ave, Venice, FL 34285 US",
    phone: "+19415250880",
    taxRates: [{ id: "tax-state", name: "State Tax", percentage: "7" }],
    customFees: [{ id: "fee-service", name: "Service Fee", amount: "3.5" }],
  },
  resources: [
    { id: "cage-1", name: "Cage 1", sortOrder: 1, scheduleId: "working-hours" },
    { id: "cage-2", name: "Cage 2", sortOrder: 2, scheduleId: "working-hours" },
    { id: "pitching-lane", name: "Pitching Lane", sortOrder: 3, scheduleId: "working-hours" },
  ],
  services: [
    {
      id: "rental-30",
      name: "30 Minute Batting Cage with Machine",
      category: "rentals",
      duration: 30,
      price: 45,
      rooms: ["Cage 1", "Cage 2"],
      resourceId: "cage-1",
      instructors: [],
      scheduleId: "working-hours",
      collectTax: false,
      collectFee: true,
    },
    {
      id: "lesson-30",
      name: "30 Minute Hitting Lessons",
      category: "lessons",
      duration: 30,
      price: 60,
      rooms: ["Cage 1", "Cage 2"],
      resourceId: "cage-1",
      instructors: ["Jason Allaire", "Jr. Jason Allaire", "August Backman"],
      scheduleId: "working-hours",
      collectTax: false,
      collectFee: true,
    },
    {
      id: "pitching-rental-30",
      name: "30 Minute Pitching Lane Rental",
      category: "rentals",
      duration: 30,
      price: 30,
      rooms: ["Pitching Lane"],
      resourceId: "pitching-lane",
      instructors: [],
      scheduleId: "working-hours",
      collectTax: false,
      collectFee: true,
    },
  ],
  schedules: [
    {
      id: "working-hours",
      name: "Working Hours",
      slug: "working-hours",
      isDefault: true,
      slotsByWeekday: {
        "1": [{ id: "mon", start: "16:00", end: "20:00", sortOrder: 1 }],
        "2": [{ id: "tue", start: "16:00", end: "20:00", sortOrder: 1 }],
        "3": [{ id: "wed", start: "16:00", end: "20:00", sortOrder: 1 }],
        "4": [{ id: "thu", start: "16:00", end: "20:00", sortOrder: 1 }],
        "5": [{ id: "fri", start: "16:00", end: "18:00", sortOrder: 1 }],
      },
      overridesByDate: {},
    },
  ],
  bookings: [],
  staff: [
    { id: "staff-jason", name: "Jason Allaire", email: "info@grindbaseballlab.com", role: "Owner", calendarColor: "#249b41" },
    { id: "staff-august", name: "August Backman", email: "august.baseball19@gmail.com", role: "Instructor", calendarColor: "#e89bef" },
  ],
  staffAvailability: [],
};

export function normalizeClock(value: string | null | undefined) {
  return String(value ?? "00:00").slice(0, 5);
}

export function timeToMinutes(value: string) {
  const [hour, minute] = normalizeClock(value).split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function minutesToTime(totalMinutes: number) {
  const minutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDate(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function timeLabel(value: string) {
  const [hour, minute] = normalizeClock(value).split(":").map(Number);
  return new Date(2026, 0, 1, hour || 0, minute || 0).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "G").toUpperCase() + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "").toUpperCase() : "");
}

export function weekdayForDate(value: string) {
  return parseLocalDate(value).getDay();
}

export function scheduleSlotsForDate(schedule: PublicBookingSchedule | null | undefined, date: string) {
  const override = schedule?.overridesByDate[date];
  if (override) return override.isClosed ? [] : override.slots;
  return schedule?.slotsByWeekday[String(weekdayForDate(date))] ?? [];
}

export function serviceRooms(service: PublicBookingService, resources: PublicBookingResource[]) {
  const activeNames = new Set(resources.map((resource) => resource.name));
  const namedRooms = service.rooms.filter((room) => activeNames.has(room));
  if (namedRooms.length) return namedRooms;
  const resource = resources.find((item) => item.id === service.resourceId);
  return resource ? [resource.name] : resources.map((item) => item.name);
}

export function calculatePublicTotals(
  service: PublicBookingService,
  settings: PublicBookingSettings,
  paymentMethod: "online" | "in-person"
) {
  const subtotal = service.price;
  const taxRate = settings.taxRates[0];
  const feeRate = settings.customFees[0];
  const taxPercent = service.collectTax ? Number(taxRate?.percentage ?? 0) : 0;
  const feePercent = paymentMethod === "online" && service.collectFee ? Number(feeRate?.amount ?? 0) : 0;
  const tax = Number.isFinite(taxPercent) ? (subtotal * taxPercent) / 100 : 0;
  const serviceFee = Number.isFinite(feePercent) ? (subtotal * feePercent) / 100 : 0;
  return {
    subtotal,
    tax,
    serviceFee,
    total: subtotal + tax + serviceFee,
    taxName: taxRate?.name ?? "Tax",
    feeName: feeRate?.name ?? "Service Fee",
  };
}
