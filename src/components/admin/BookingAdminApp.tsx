"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

type View =
  | "home"
  | "services"
  | "calendar"
  | "availability"
  | "customers"
  | "marketing"
  | "retail"
  | "reports"
  | "settings";

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
  resource: string;
  status: "Active" | "Draft" | "Off";
};

type Customer = {
  id: string;
  name: string;
  player: string;
  email: string;
  phone: string;
  age: number | "";
  memberships: string[];
  notes: string;
  createdAt: string;
};

type Booking = {
  id: string;
  date: string;
  start: string;
  end: string;
  customerId: string;
  serviceId: string;
  resource: string;
  status: "Confirmed" | "Pending" | "Cancelled";
  paid: boolean;
};

type Campaign = {
  id: string;
  name: string;
  audience: string;
  status: "Draft" | "Active" | "Off";
  sent: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
};

type FacilitySettings = AppState["facility"];

type ModalSaveChange =
  | { type: "service"; item: Service }
  | { type: "booking"; item: Booking }
  | { type: "customer"; item: Customer }
  | { type: "campaign"; item: Campaign }
  | { type: "product"; item: Product };

type BookingResourceRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type BookingSettingsRow = {
  facility_name: string;
  public_url: string;
  timezone: string;
  address: string | null;
};

type BookingServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | string;
  resource_id: string | null;
  status: Service["status"];
  sort_order: number;
};

type BookingCustomerRow = {
  id: string;
  parent_name: string;
  player_name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  memberships: string[] | null;
  notes: string | null;
  created_at: string;
};

type BookingBookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_id: string | null;
  service_id: string | null;
  resource_id: string | null;
  status: Booking["status"];
  paid: boolean;
};

type BookingAvailabilityRow = {
  weekday: number;
  day_name: string;
  is_open: boolean;
  start_time: string;
  end_time: string;
};

type BookingCampaignRow = {
  id: string;
  name: string;
  audience: string;
  status: Campaign["status"];
  sent: number;
};

type BookingProductRow = {
  id: string;
  name: string;
  sku: string | null;
  price: number | string;
  stock: number;
};

type AppState = {
  facility: {
    name: string;
    publicUrl: string;
    timezone: string;
    address: string;
  };
  resources: string[];
  services: Service[];
  customers: Customer[];
  bookings: Booking[];
  availability: [string, boolean, string, string][];
  campaigns: Campaign[];
  products: Product[];
};

type ModalState =
  | { type: "service"; id?: string }
  | { type: "booking"; id?: string }
  | { type: "customer"; id?: string }
  | { type: "campaign"; id?: string }
  | { type: "product"; id?: string }
  | null;

const storageKey = "grind_booking_admin_v1";

const navItems: { key: View; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "services", label: "Services", icon: "link" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "availability", label: "Availability", icon: "clock" },
  { key: "customers", label: "Customers", icon: "user" },
  { key: "marketing", label: "Marketing", icon: "send" },
  { key: "retail", label: "Retail", icon: "bag" },
  { key: "reports", label: "Reports", icon: "bar" },
  { key: "settings", label: "Settings", icon: "gear" },
];

const defaultState: AppState = {
  facility: {
    name: "The Grind Baseball Lab",
    publicUrl: "https://www.grindbaseballlab.com/book",
    timezone: "America/New_York",
    address: "Venice, FL",
  },
  resources: ["Cage 1", "Cage 2", "Pitching Lane", "HitTrax"],
  services: [
    {
      id: "svc-private-hitting",
      name: "Private Hitting Lesson",
      duration: 60,
      price: 85,
      resource: "Cage 1",
      status: "Active",
    },
    {
      id: "svc-pitching",
      name: "Pitching Lesson",
      duration: 45,
      price: 75,
      resource: "Pitching Lane",
      status: "Active",
    },
    {
      id: "svc-cage-rental",
      name: "Cage Rental",
      duration: 30,
      price: 35,
      resource: "Cage 2",
      status: "Active",
    },
  ],
  customers: [
    {
      id: "cust-mason",
      name: "Mason Reed",
      player: "Mason Reed",
      email: "mason.reed@example.com",
      phone: "(407) 555-0148",
      age: "",
      memberships: [],
      notes: "Varsity middle infielder",
      createdAt: "2026-07-01",
    },
    {
      id: "cust-jackson",
      name: "Avery Johnson",
      player: "Jackson Johnson",
      email: "avery.johnson@example.com",
      phone: "(407) 555-0192",
      age: "",
      memberships: ["Pitching package"],
      notes: "Pitching package",
      createdAt: "2026-07-01",
    },
  ],
  bookings: [
    {
      id: "bk-1",
      date: "2026-07-01",
      start: "09:00",
      end: "10:00",
      customerId: "cust-mason",
      serviceId: "svc-private-hitting",
      resource: "Cage 1",
      status: "Confirmed",
      paid: true,
    },
    {
      id: "bk-2",
      date: "2026-07-01",
      start: "10:30",
      end: "11:15",
      customerId: "cust-jackson",
      serviceId: "svc-pitching",
      resource: "Pitching Lane",
      status: "Confirmed",
      paid: false,
    },
  ],
  availability: [
    ["Monday", true, "09:00", "20:00"],
    ["Tuesday", true, "09:00", "20:00"],
    ["Wednesday", true, "09:00", "20:00"],
    ["Thursday", true, "09:00", "20:00"],
    ["Friday", true, "09:00", "18:00"],
    ["Saturday", true, "09:00", "15:00"],
    ["Sunday", false, "10:00", "14:00"],
  ],
  campaigns: [
    {
      id: "cmp-1",
      name: "July Hitting Openings",
      audience: "Active customers",
      status: "Draft",
      sent: 0,
    },
  ],
  products: [
    { id: "prd-1", name: "Facility T-Shirt", sku: "GRIND-TEE", price: 28, stock: 24 },
    { id: "prd-2", name: "Grip Tape", sku: "GRIP-TAPE", price: 12, stock: 8 },
  ],
};

type IconName =
  | "home"
  | "link"
  | "calendar"
  | "clock"
  | "user"
  | "send"
  | "bag"
  | "bar"
  | "gear"
  | "message"
  | "help"
  | "copy"
  | "plus"
  | "edit"
  | "trash"
  | "download"
  | "search"
  | "x";

const iconPaths: Record<IconName, string[]> = {
  home: ["m3 11 9-8 9 8", "M5 10v10h14V10", "M10 20v-6h4v6"],
  link: [
    "M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1",
    "M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1",
  ],
  calendar: ["M8 2v4M16 2v4", "M3 10h18", "M5 5h14a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"],
  clock: ["M12 7v5l3 2", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  bag: ["M6 7h12l-1 14H7Z", "M9 7a3 3 0 0 1 6 0", "M9 11h.01M15 11h.01"],
  bar: ["M5 20V10", "M12 20V4", "M19 20v-7"],
  gear: [
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z",
  ],
  message: ["M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-4.1-1L3 20l1.1-4.1a8.5 8.5 0 1 1 16.9-4.4Z"],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.5 9a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4", "M12 17h.01"],
  copy: ["M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2Z", "M4 16V5a2 2 0 0 1 2-2h11"],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M12 20h9", "m16.5 3.5 4 4L7 21H3v-4Z"],
  trash: ["M3 6h18", "M8 6V4h8v2", "m19 6-1 15H6L5 6", "M10 11v6M14 11v6"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  x: ["M18 6 6 18", "M6 6l12 12"],
};

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {iconPaths[name].map((d) => (
        <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeTime(value: string | null | undefined) {
  return (value ?? "09:00").slice(0, 5);
}

function stateToStorage(next: AppState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }
}

function resourceLookup(resources: BookingResourceRow[]) {
  return {
    idsByName: Object.fromEntries(resources.map((resource) => [resource.name, resource.id])),
    namesById: new Map(resources.map((resource) => [resource.id, resource.name])),
  };
}

async function upsertFacilitySettings(facility: FacilitySettings) {
  const { error } = await supabase.from("booking_settings").upsert({
    key: "default",
    facility_name: facility.name,
    public_url: facility.publicUrl,
    timezone: facility.timezone,
    address: facility.address,
  });

  if (error) throw error;
}

async function upsertResources(resourceNames: string[]) {
  const names = resourceNames.map((name) => name.trim()).filter(Boolean);
  const current = await supabase.from("booking_resources").select("id,name,sort_order,is_active");
  if (current.error) throw current.error;

  const currentRows = (current.data ?? []) as BookingResourceRow[];
  const currentByName = new Map(currentRows.map((resource) => [resource.name, resource]));
  const activeRows = names.map((name, index) => {
    const existing = currentByName.get(name);
    return {
      ...(existing?.id ? { id: existing.id } : {}),
      name,
      sort_order: index + 1,
      is_active: true,
    };
  });

  if (activeRows.length) {
    const upserted = await supabase
      .from("booking_resources")
      .upsert(activeRows)
      .select("id,name,sort_order,is_active")
      .order("sort_order");
    if (upserted.error) throw upserted.error;
  }

  const removedIds = currentRows
    .filter((resource) => resource.is_active && !names.includes(resource.name))
    .map((resource) => resource.id);

  if (removedIds.length) {
    const removed = await supabase.from("booking_resources").update({ is_active: false }).in("id", removedIds);
    if (removed.error) throw removed.error;
  }

  const refreshed = await supabase
    .from("booking_resources")
    .select("id,name,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order");

  if (refreshed.error) throw refreshed.error;

  return (refreshed.data ?? []) as BookingResourceRow[];
}

async function upsertModalChange(change: ModalSaveChange, resourceIdsByName: Record<string, string>) {
  if (change.type === "service") {
    const item = change.item;
    const { error } = await supabase.from("booking_services").upsert({
      id: item.id,
      name: item.name,
      duration_minutes: item.duration,
      price: item.price,
      resource_id: resourceIdsByName[item.resource] || null,
      status: item.status,
    });
    if (error) throw error;
  }

  if (change.type === "booking") {
    const item = change.item;
    const { error } = await supabase.from("booking_bookings").upsert({
      id: item.id,
      booking_date: item.date,
      start_time: item.start,
      end_time: item.end,
      customer_id: item.customerId || null,
      service_id: item.serviceId || null,
      resource_id: resourceIdsByName[item.resource] || null,
      status: item.status,
      paid: item.paid,
    });
    if (error) throw error;
  }

  if (change.type === "customer") {
    const item = change.item;
    const { error } = await supabase.from("booking_customers").upsert({
      id: item.id,
      parent_name: item.name,
      player_name: item.player,
      email: item.email,
      phone: item.phone,
      age: item.age === "" ? null : item.age,
      memberships: item.memberships,
      notes: item.notes,
    });
    if (error) throw error;
  }

  if (change.type === "campaign") {
    const item = change.item;
    const { error } = await supabase.from("booking_campaigns").upsert({
      id: item.id,
      name: item.name,
      audience: item.audience,
      status: item.status,
      sent: item.sent,
    });
    if (error) throw error;
  }

  if (change.type === "product") {
    const item = change.item;
    const { error } = await supabase.from("booking_products").upsert({
      id: item.id,
      name: item.name,
      sku: item.sku,
      price: item.price,
      stock: item.stock,
    });
    if (error) throw error;
  }
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function timeLabel(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateLabel(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function membershipText(memberships: string[]) {
  return memberships.join(", ");
}

function parseMemberships(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function pillClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes("active") || value.includes("confirm") || value.includes("paid")) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (value.includes("pending") || value.includes("draft") || value.includes("low")) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-red-50 text-red-700";
}

function loadInitialState() {
  if (typeof window === "undefined") return defaultState;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) } as AppState;
  } catch {
    return defaultState;
  }
}

export default function BookingAdminApp() {
  const [view, setView] = useState<View>("home");
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeDate, setActiveDate] = useState("2026-07-01");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");
  const [resourceIdsByName, setResourceIdsByName] = useState<Record<string, string>>({});

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadFromSupabase = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setDataSource("local");
      return;
    }

    try {
      const [
        settingsResult,
        resourcesResult,
        servicesResult,
        customersResult,
        bookingsResult,
        availabilityResult,
        campaignsResult,
        productsResult,
      ] = await Promise.all([
        supabase.from("booking_settings").select("*").eq("key", "default").maybeSingle(),
        supabase.from("booking_resources").select("*").order("sort_order"),
        supabase.from("booking_services").select("*").order("sort_order"),
        supabase.from("booking_customers").select("*").order("created_at"),
        supabase.from("booking_bookings").select("*").order("booking_date").order("start_time"),
        supabase.from("booking_availability").select("*").order("weekday"),
        supabase.from("booking_campaigns").select("*").order("created_at"),
        supabase.from("booking_products").select("*").order("created_at"),
      ]);

      const error = [
        settingsResult.error,
        resourcesResult.error,
        servicesResult.error,
        customersResult.error,
        bookingsResult.error,
        availabilityResult.error,
        campaignsResult.error,
        productsResult.error,
      ].find(Boolean);

      if (error) throw error;

      const settings = settingsResult.data as BookingSettingsRow | null;
      const resourceRows = (resourcesResult.data ?? []) as BookingResourceRow[];
      const serviceRows = (servicesResult.data ?? []) as BookingServiceRow[];
      const customerRows = (customersResult.data ?? []) as BookingCustomerRow[];
      const bookingRows = (bookingsResult.data ?? []) as BookingBookingRow[];
      const availabilityRows = (availabilityResult.data ?? []) as BookingAvailabilityRow[];
      const campaignRows = (campaignsResult.data ?? []) as BookingCampaignRow[];
      const productRows = (productsResult.data ?? []) as BookingProductRow[];
      const activeResourceRows = resourceRows.filter((resource) => resource.is_active);
      const resources = activeResourceRows.length ? activeResourceRows : defaultState.resources.map((name, index) => ({
        id: "",
        name,
        sort_order: index + 1,
        is_active: true,
      }));
      const { idsByName, namesById } = resourceLookup(resourceRows.length ? resourceRows : resources);
      const availabilityOrder = new Map(defaultState.availability.map(([day], index) => [day, index]));

      setResourceIdsByName(idsByName);
      setState({
        facility: {
          name: settings?.facility_name ?? defaultState.facility.name,
          publicUrl: settings?.public_url ?? defaultState.facility.publicUrl,
          timezone: settings?.timezone ?? defaultState.facility.timezone,
          address: settings?.address ?? defaultState.facility.address,
        },
        resources: resources.map((resource) => resource.name),
        services: serviceRows.map((service) => ({
          id: service.id,
          name: service.name,
          duration: service.duration_minutes,
          price: Number(service.price),
          resource: service.resource_id ? namesById.get(service.resource_id) ?? "" : "",
          status: service.status,
        })),
        customers: customerRows.map((customer) => ({
          id: customer.id,
          name: customer.parent_name,
          player: customer.player_name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          age: customer.age ?? "",
          memberships: customer.memberships ?? [],
          notes: customer.notes ?? "",
          createdAt: customer.created_at,
        })),
        bookings: bookingRows.map((booking) => ({
          id: booking.id,
          date: booking.booking_date,
          start: normalizeTime(booking.start_time),
          end: normalizeTime(booking.end_time),
          customerId: booking.customer_id ?? "",
          serviceId: booking.service_id ?? "",
          resource: booking.resource_id ? namesById.get(booking.resource_id) ?? "" : "",
          status: booking.status,
          paid: booking.paid,
        })),
        availability: availabilityRows.length
          ? availabilityRows
              .map((row): [string, boolean, string, string] => [
                row.day_name,
                row.is_open,
                normalizeTime(row.start_time),
                normalizeTime(row.end_time),
              ])
              .sort((a, b) => (availabilityOrder.get(a[0]) ?? 99) - (availabilityOrder.get(b[0]) ?? 99))
          : defaultState.availability,
        campaigns: campaignRows.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          audience: campaign.audience,
          status: campaign.status,
          sent: campaign.sent,
        })),
        products: productRows.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku ?? "",
          price: Number(product.price),
          stock: product.stock,
        })),
      });
      setDataSource("supabase");
    } catch (error) {
      console.error(error);
      setDataSource("local");
      showToast("Could not load Supabase data. Using local draft data.");
    }
  }, [showToast]);

  useEffect(() => {
    void loadFromSupabase();
  }, [loadFromSupabase]);

  function saveLocal(next: AppState, message: string) {
    setState(next);
    stateToStorage(next);
    showToast(message);
  }

  async function saveSettings(next: AppState) {
    if (dataSource === "local") {
      saveLocal(next, "Settings saved.");
      return;
    }

    setState(next);

    try {
      await upsertFacilitySettings(next.facility);
      const resources = await upsertResources(next.resources);
      setResourceIdsByName(resourceLookup(resources).idsByName);
      showToast("Settings saved.");
    } catch (error) {
      console.error(error);
      showToast("Settings could not be saved.");
    }
  }

  async function saveAvailability(rows: AppState["availability"]) {
    const next = { ...state, availability: rows };

    if (dataSource === "local") {
      saveLocal(next, "Availability saved.");
      return;
    }

    setState(next);

    try {
      await supabase.from("booking_availability").upsert(
        rows.map(([day, open, start, end], index) => ({
          weekday: day === "Sunday" ? 0 : index + 1,
          day_name: day,
          is_open: open,
          start_time: start,
          end_time: end,
        })),
        { onConflict: "weekday" }
      );
      showToast("Availability saved.");
    } catch (error) {
      console.error(error);
      showToast("Availability could not be saved.");
    }
  }

  async function saveModalChange(next: AppState, message: string, change: ModalSaveChange) {
    if (dataSource === "local") {
      saveLocal(next, message);
      setModal(null);
      return;
    }

    setState(next);
    setModal(null);

    try {
      await upsertModalChange(change, resourceIdsByName);
      showToast(message);
    } catch (error) {
      console.error(error);
      showToast("That change could not be saved.");
    }
  }

  async function deleteService(id: string) {
    const next = { ...state, services: state.services.filter((service) => service.id !== id) };

    if (dataSource === "local") {
      saveLocal(next, "Service deleted.");
      return;
    }

    setState(next);
    const { error } = await supabase.from("booking_services").delete().eq("id", id);
    showToast(error ? "Service could not be deleted." : "Service deleted.");
  }

  async function deleteCustomer(id: string) {
    const next = {
      ...state,
      customers: state.customers.filter((customer) => customer.id !== id),
      bookings: state.bookings.filter((booking) => booking.customerId !== id),
    };

    if (dataSource === "local") {
      saveLocal(next, "Customer deleted.");
      return;
    }

    setState(next);
    const bookingDelete = await supabase.from("booking_bookings").delete().eq("customer_id", id);
    const customerDelete = await supabase.from("booking_customers").delete().eq("id", id);
    showToast(bookingDelete.error || customerDelete.error ? "Customer could not be deleted." : "Customer deleted.");
  }

  const customersById = useMemo(
    () => new Map(state.customers.map((customer) => [customer.id, customer])),
    [state.customers]
  );

  const servicesById = useMemo(
    () => new Map(state.services.map((service) => [service.id, service])),
    [state.services]
  );

  const dayBookings = state.bookings.filter((booking) => booking.date === activeDate);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="grid min-h-screen grid-cols-1 bg-white md:grid-cols-[284px_minmax(0,1fr)]">
        <aside className="flex bg-[#f5f5f5] p-3 md:min-h-screen md:flex-col md:px-6 md:py-6">
          <div className="hidden items-center justify-between md:flex">
            <div className="flex items-center gap-2 text-2xl font-extrabold">
              <span className="block h-6 w-4 -skew-x-12 rounded-sm bg-black" />
              Swift
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white">
              <Icon name="user" className="h-5 w-5" />
            </div>
          </div>

          <nav className="flex w-full gap-1 overflow-x-auto md:mt-8 md:grid md:overflow-visible">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                title={item.label}
                className={[
                  "flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-lg transition md:w-full",
                  view === item.key ? "bg-[#eeeeee] font-bold" : "hover:bg-black/5",
                ].join(" ")}
              >
                <Icon name={item.icon} />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto hidden space-y-1 md:block">
            {[
              ["message", "Contact Us"],
              ["help", "Help Center"],
              ["copy", "Copy public page link"],
            ].map(([icon, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label.startsWith("Copy")) {
                    void navigator.clipboard?.writeText(state.facility.publicUrl);
                    showToast("Public page link copied.");
                  } else {
                    showToast(`${label} is ready for the next pass.`);
                  }
                }}
                className="flex h-10 w-full items-center gap-3 rounded-lg text-left text-lg hover:bg-black/5"
              >
                <Icon name={icon as IconName} />
                {label}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          {view === "home" ? (
            <HomeView facilityName={state.facility.name} />
          ) : null}
          {view === "services" ? (
            <ServicesView
              services={state.services}
              onNew={() => setModal({ type: "service" })}
              onEdit={(id) => setModal({ type: "service", id })}
              onDelete={(id) => void deleteService(id)}
            />
          ) : null}
          {view === "calendar" ? (
            <CalendarView
              activeDate={activeDate}
              bookings={dayBookings}
              customersById={customersById}
              resources={state.resources}
              servicesById={servicesById}
              onDateChange={setActiveDate}
              onNew={() => setModal({ type: "booking" })}
              onEdit={(id) => setModal({ type: "booking", id })}
            />
          ) : null}
          {view === "availability" ? (
            <AvailabilityView
              rows={state.availability}
              onChange={(rows) => setState((current) => ({ ...current, availability: rows }))}
              onSave={() => void saveAvailability(state.availability)}
            />
          ) : null}
          {view === "customers" ? (
            <CustomersView
              customers={state.customers}
              bookings={state.bookings}
              search={customerSearch}
              onSearch={setCustomerSearch}
              onImport={() => showToast("Customer import is ready for the next pass.")}
              onNew={() => setModal({ type: "customer" })}
              onEdit={(id) => setModal({ type: "customer", id })}
              onDelete={(id) => void deleteCustomer(id)}
            />
          ) : null}
          {view === "marketing" ? (
            <SimpleTableView
              title="Marketing"
              subtitle="Campaigns for openings, packages, and memberships."
              actionLabel="New campaign"
              onAction={() => setModal({ type: "campaign" })}
              headers={["Campaign", "Audience", "Sent", "Status", ""]}
              rows={state.campaigns.map((campaign) => [
                <strong key="name">{campaign.name}</strong>,
                campaign.audience,
                campaign.sent,
                <Pill key="status" label={campaign.status} />,
                <RowAction key="edit" icon="edit" label="Edit campaign" onClick={() => setModal({ type: "campaign", id: campaign.id })} />,
              ])}
            />
          ) : null}
          {view === "retail" ? (
            <SimpleTableView
              title="Retail"
              subtitle="Products, memberships, and facility add-ons."
              actionLabel="New item"
              onAction={() => setModal({ type: "product" })}
              headers={["Item", "SKU", "Price", "Stock", "Status", ""]}
              rows={state.products.map((product) => [
                <strong key="name">{product.name}</strong>,
                product.sku,
                money(product.price),
                product.stock,
                <Pill key="status" label={product.stock < 10 ? "Low" : "In stock"} />,
                <RowAction key="edit" icon="edit" label="Edit item" onClick={() => setModal({ type: "product", id: product.id })} />,
              ])}
            />
          ) : null}
          {view === "reports" ? (
            <ReportsView bookings={state.bookings} services={state.services} onExport={() => exportReport(state, showToast)} />
          ) : null}
          {view === "settings" ? (
            <SettingsView
              state={state}
              onSave={(next) => void saveSettings(next)}
            />
          ) : null}
        </main>
      </div>

      {modal ? (
        <EditorModal
          modal={modal}
          state={state}
          activeDate={activeDate}
          onClose={() => setModal(null)}
          onSave={(next, message, change) => void saveModalChange(next, message, change)}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function HomeView({ facilityName }: { facilityName: string }) {
  return (
    <section className="min-h-screen px-8 py-8">
      <div className="flex items-center gap-5">
        <div className="grid h-[98px] w-[98px] place-items-center rounded-full border-[3px] border-[#526f9a] text-center font-extrabold uppercase leading-none text-[#2f4e78]">
          <div>
            <div className="text-[9px]">The</div>
            <div className="text-lg italic">Grind</div>
            <div className="text-[7px] text-sky-700">Baseball Lab</div>
          </div>
        </div>
        <h1 className="text-[23px] font-medium">{facilityName}</h1>
      </div>
    </section>
  );
}

function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: IconName;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
    >
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function RowAction({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white hover:bg-black/[0.03]"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${pillClass(label)}`}>
      {label}
    </span>
  );
}

function ServicesView({
  services,
  onNew,
  onEdit,
  onDelete,
}: {
  services: Service[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Services" subtitle="Manage bookable lessons, rentals, and facility offers.">
        <PrimaryButton icon="plus" onClick={onNew}>
          New service
        </PrimaryButton>
      </PageHeader>

      <DataTable headers={["Service", "Duration", "Price", "Resource", "Status", ""]}>
        {services.map((service) => (
          <tr key={service.id}>
            <Td><strong>{service.name}</strong></Td>
            <Td>{service.duration} min</Td>
            <Td>{money(service.price)}</Td>
            <Td>{service.resource}</Td>
            <Td><Pill label={service.status} /></Td>
            <Td align="right">
              <div className="flex justify-end gap-2">
                <RowAction icon="edit" label="Edit service" onClick={() => onEdit(service.id)} />
                <RowAction icon="trash" label="Delete service" onClick={() => onDelete(service.id)} />
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function CalendarView({
  activeDate,
  bookings,
  customersById,
  resources,
  servicesById,
  onDateChange,
  onNew,
  onEdit,
}: {
  activeDate: string;
  bookings: Booking[];
  customersById: Map<string, Customer>;
  resources: string[];
  servicesById: Map<string, Service>;
  onDateChange: (date: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Calendar" subtitle={activeDate}>
        <input
          type="date"
          value={activeDate}
          onChange={(event) => onDateChange(event.target.value)}
          className="min-h-10 rounded-lg border border-black/10 px-3 text-sm"
          aria-label="Calendar date"
        />
        <PrimaryButton icon="plus" onClick={onNew}>
          New booking
        </PrimaryButton>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="overflow-auto rounded-lg border border-black/10 bg-white shadow-sm">
          <div
            className="grid min-w-[780px]"
            style={{ gridTemplateColumns: `75px repeat(${resources.length}, minmax(150px, 1fr))` }}
          >
            <div className="border-b border-r border-black/10 bg-black/[0.02] p-3" />
            {resources.map((resource) => (
              <div key={resource} className="border-b border-r border-black/10 bg-black/[0.02] p-3 text-sm font-bold">
                {resource}
              </div>
            ))}

            {hours.map((hour) => (
              <CalendarRow
                key={hour}
                hour={hour}
                resources={resources}
                bookings={bookings}
                customersById={customersById}
                servicesById={servicesById}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
            <h2 className="font-semibold">Today&apos;s Bookings</h2>
            <Pill label={String(bookings.length)} />
          </div>
          <div className="divide-y divide-black/10">
            {bookings.length ? (
              bookings.map((booking) => {
                const customer = customersById.get(booking.customerId);
                const service = servicesById.get(booking.serviceId);

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onEdit(booking.id)}
                    className="block w-full px-4 py-3 text-left hover:bg-black/[0.02]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong>{timeLabel(booking.start)}</strong>
                      <Pill label={booking.status} />
                    </div>
                    <div className="mt-1">{customer?.player || customer?.name || "Customer"}</div>
                    <div className="mt-1 text-sm text-black/60">
                      {service?.name || "Service"} | {booking.resource}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-sm text-black/60">No bookings on this date.</div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function CalendarRow({
  hour,
  resources,
  bookings,
  customersById,
  servicesById,
  onEdit,
}: {
  hour: string;
  resources: string[];
  bookings: Booking[];
  customersById: Map<string, Customer>;
  servicesById: Map<string, Service>;
  onEdit: (id: string) => void;
}) {
  return (
    <>
      <div className="min-h-[68px] border-b border-r border-black/10 bg-black/[0.02] p-2 text-xs font-semibold text-black/60">
        {timeLabel(hour)}
      </div>
      {resources.map((resource) => {
        const slotBookings = bookings.filter(
          (booking) => booking.resource === resource && booking.start.slice(0, 2) === hour.slice(0, 2)
        );

        return (
          <div key={`${hour}-${resource}`} className="min-h-[68px] border-b border-r border-black/10 p-2">
            {slotBookings.map((booking) => {
              const customer = customersById.get(booking.customerId);
              const service = servicesById.get(booking.serviceId);

              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onEdit(booking.id)}
                  className="grid w-full gap-1 rounded-lg border-l-[3px] border-[#526f9a] bg-[#eef3f8] px-2 py-2 text-left text-sm text-[#10243e]"
                >
                  <strong className="truncate">{customer?.player || customer?.name || "Customer"}</strong>
                  <span className="truncate text-xs text-[#506174]">
                    {service?.name || "Service"} | {timeLabel(booking.start)}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function AvailabilityView({
  rows,
  onChange,
  onSave,
}: {
  rows: AppState["availability"];
  onChange: (rows: AppState["availability"]) => void;
  onSave: () => void;
}) {
  function update(index: number, next: [string, boolean, string, string]) {
    onChange(rows.map((row, i) => (i === index ? next : row)));
  }

  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Availability" subtitle="Set facility hours for public booking.">
        <PrimaryButton icon="clock" onClick={onSave}>
          Save hours
        </PrimaryButton>
      </PageHeader>

      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        {rows.map(([day, open, start, end], index) => (
          <div key={day} className="grid gap-3 border-b border-black/10 py-3 last:border-0 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-center">
            <strong>{day}</strong>
            <input
              type="time"
              value={start}
              disabled={!open}
              onChange={(event) => update(index, [day, open, event.target.value, end])}
              className="min-h-10 rounded-lg border border-black/10 px-3 disabled:bg-black/[0.03]"
            />
            <input
              type="time"
              value={end}
              disabled={!open}
              onChange={(event) => update(index, [day, open, start, event.target.value])}
              className="min-h-10 rounded-lg border border-black/10 px-3 disabled:bg-black/[0.03]"
            />
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={open}
                onChange={(event) => update(index, [day, event.target.checked, start, end])}
                className="h-5 w-5 accent-black"
              />
              Open
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomersView({
  customers,
  bookings,
  search,
  onSearch,
  onImport,
  onNew,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  bookings: Booking[];
  search: string;
  onSearch: (value: string) => void;
  onImport: () => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = customers.filter((customer) =>
    [customer.name, customer.player, customer.email, customer.phone]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const bookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((booking) => {
      counts.set(booking.customerId, (counts.get(booking.customerId) ?? 0) + 1);
    });
    return counts;
  }, [bookings]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((customer) => selected.includes(customer.id));

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((current) => current.filter((id) => !filtered.some((customer) => customer.id === id)));
      return;
    }

    setSelected((current) => Array.from(new Set([...current, ...filtered.map((customer) => customer.id)])));
  }

  function toggleCustomer(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Customers" subtitle="Customers includes anyone that has made a booking at your facility in the past.">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
        >
          <Icon name="download" className="h-4 w-4" />
          Import
        </button>
        <PrimaryButton icon="plus" onClick={onNew}>
          New
        </PrimaryButton>
      </PageHeader>

      <div className="mb-4 max-w-xl">
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search customers by name, email, or phone"
            className="min-h-11 w-full rounded-lg border border-black/10 pl-10 pr-3 text-sm outline-none focus:border-black/30"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="h-16 border-b border-black/10 bg-white" />
        <div className="flex min-h-12 items-center gap-5 border-b border-black/10 px-4 text-sm font-semibold text-black/60">
          <button type="button" className="inline-flex items-center gap-2 hover:text-black">
            <Icon name="bar" className="h-4 w-4" />
            Columns
          </button>
          <button type="button" className="inline-flex items-center gap-2 hover:text-black">
            <Icon name="gear" className="h-4 w-4" />
            Filters
          </button>
          {selected.length ? <span className="ml-auto text-black">{selected.length} selected</span> : null}
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-black/[0.03]">
              <tr>
                <th className="w-12 border-b border-black/10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all customers"
                    className="h-5 w-5 accent-black"
                  />
                </th>
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Name</th>
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Created At ↓</th>
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Email</th>
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Phone Number</th>
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Age</th>
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Memberships</th>
                <th className="w-24 border-b border-black/10 px-4 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {filtered.map((customer) => {
                const isSelected = selected.includes(customer.id);
                const bookingCount = bookingCounts.get(customer.id) ?? 0;

                return (
                  <tr key={customer.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCustomer(customer.id)}
                        aria-label={`Select ${customer.name}`}
                        className="h-5 w-5 accent-black"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onEdit(customer.id)}
                        title={`${bookingCount} bookings`}
                        className="inline-flex items-center gap-3 text-left font-semibold hover:underline"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white">
                          <Icon name="user" className="h-5 w-5" />
                        </span>
                        {customer.name || customer.player || "Customer"}
                      </button>
                    </td>
                    <td className="px-4 py-3">{dateLabel(customer.createdAt)}</td>
                    <td className="px-4 py-3">{customer.email}</td>
                    <td className="px-4 py-3">{customer.phone}</td>
                    <td className="px-4 py-3">{customer.age}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {customer.memberships.map((membership) => (
                          <span key={membership} className="rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-semibold">
                            {membership}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <RowAction icon="edit" label="Edit customer" onClick={() => onEdit(customer.id)} />
                        <RowAction icon="trash" label="Delete customer" onClick={() => onDelete(customer.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SimpleTableView({
  title,
  subtitle,
  actionLabel,
  onAction,
  headers,
  rows,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title={title} subtitle={subtitle}>
        <PrimaryButton icon="plus" onClick={onAction}>
          {actionLabel}
        </PrimaryButton>
      </PageHeader>
      <DataTable headers={headers}>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <Td key={cellIndex} align={cellIndex === row.length - 1 ? "right" : "left"}>
                {cell}
              </Td>
            ))}
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function ReportsView({
  bookings,
  services,
  onExport,
}: {
  bookings: Booking[];
  services: Service[];
  onExport: () => void;
}) {
  const paid = bookings.filter((booking) => booking.paid).length;
  const revenue = bookings.reduce((sum, booking) => {
    const service = services.find((item) => item.id === booking.serviceId);
    return sum + (booking.paid ? service?.price ?? 0 : 0);
  }, 0);

  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Reports" subtitle="Booking and revenue snapshots.">
        <PrimaryButton icon="download" onClick={onExport}>
          Export
        </PrimaryButton>
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-2">
        <MetricPanel
          title="Summary"
          rows={[
            ["Total bookings", bookings.length],
            ["Paid bookings", paid],
            ["Pending payment", bookings.length - paid],
            ["Collected revenue", money(revenue)],
          ]}
        />
        <MetricPanel
          title="Service Mix"
          rows={services.map((service) => [
            service.name,
            bookings.filter((booking) => booking.serviceId === service.id).length,
          ])}
        />
      </div>
    </section>
  );
}

function MetricPanel({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/10 px-4 py-4 font-semibold">{title}</div>
      <div className="divide-y divide-black/10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-4">
            <span className="text-black/60">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (next: AppState) => void;
}) {
  const [draft, setDraft] = useState(state);

  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Settings" subtitle="Facility profile and public booking page.">
        <PrimaryButton icon="gear" onClick={() => onSave(draft)}>
          Save settings
        </PrimaryButton>
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <div className="font-semibold">Facility</div>
          <div className="mt-4 grid gap-4">
            <TextField label="Facility name" value={draft.facility.name} onChange={(value) => setDraft({ ...draft, facility: { ...draft.facility, name: value } })} />
            <TextField label="Public page link" value={draft.facility.publicUrl} onChange={(value) => setDraft({ ...draft, facility: { ...draft.facility, publicUrl: value } })} />
            <TextField label="Timezone" value={draft.facility.timezone} onChange={(value) => setDraft({ ...draft, facility: { ...draft.facility, timezone: value } })} />
            <TextField label="Address" value={draft.facility.address} onChange={(value) => setDraft({ ...draft, facility: { ...draft.facility, address: value } })} />
          </div>
        </div>
        <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Resources</div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, resources: [...draft.resources, `Resource ${draft.resources.length + 1}`] })}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold"
            >
              <Icon name="plus" className="h-4 w-4" />
              Add
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {draft.resources.map((resource, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={resource}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      resources: draft.resources.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                    })
                  }
                  className="min-h-10 flex-1 rounded-lg border border-black/10 px-3"
                />
                <RowAction
                  icon="trash"
                  label="Delete resource"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      resources: draft.resources.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-lg border border-black/10 bg-white shadow-sm">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-black/10 px-4 py-3 text-left text-xs font-extrabold uppercase text-black/60">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10">{children}</tbody>
      </table>
    </div>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className={`px-4 py-4 ${align === "right" ? "text-right" : "text-left"} align-middle`}>
      {children}
    </td>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-black/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[] | Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-black/70">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
      >
        {options.map((option) => {
          const item = Array.isArray(option) ? option : [option, option];
          return (
            <option key={item[0]} value={item[0]}>
              {item[1]}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function EditorModal({
  modal,
  state,
  activeDate,
  onClose,
  onSave,
}: {
  modal: NonNullable<ModalState>;
  state: AppState;
  activeDate: string;
  onClose: () => void;
  onSave: (next: AppState, message: string, change: ModalSaveChange) => void;
}) {
  const service =
    modal.type === "service"
      ? state.services.find((item) => item.id === modal.id) ?? {
          id: "",
          name: "",
          duration: 60,
          price: 0,
          resource: state.resources[0] ?? "",
          status: "Active" as const,
        }
      : null;

  const booking =
    modal.type === "booking"
      ? state.bookings.find((item) => item.id === modal.id) ?? {
          id: "",
          date: activeDate,
          start: "09:00",
          end: "10:00",
          customerId: state.customers[0]?.id ?? "",
          serviceId: state.services[0]?.id ?? "",
          resource: state.resources[0] ?? "",
          status: "Confirmed" as const,
          paid: false,
        }
      : null;

  const customer =
    modal.type === "customer"
      ? state.customers.find((item) => item.id === modal.id) ?? {
          id: "",
          name: "",
          player: "",
          email: "",
          phone: "",
          age: "",
          memberships: [],
          notes: "",
          createdAt: new Date().toISOString(),
        }
      : null;

  const campaign =
    modal.type === "campaign"
      ? state.campaigns.find((item) => item.id === modal.id) ?? {
          id: "",
          name: "",
          audience: "All customers",
          status: "Draft" as const,
          sent: 0,
        }
      : null;

  const product =
    modal.type === "product"
      ? state.products.find((item) => item.id === modal.id) ?? {
          id: "",
          name: "",
          sku: "",
          price: 0,
          stock: 0,
        }
      : null;

  const [draft, setDraft] = useState<Service | Booking | Customer | Campaign | Product>(
    service ?? booking ?? customer ?? campaign ?? product!
  );

  const title = `${modal.id ? "Edit" : "New"} ${modal.type}`;

  function save() {
    if (modal.type === "service") {
      const item = { ...(draft as Service), id: draft.id || makeId("svc") };
      onSave({ ...state, services: upsert(state.services, item) }, "Service saved.", { type: "service", item });
    }
    if (modal.type === "booking") {
      const item = { ...(draft as Booking), id: draft.id || makeId("bk") };
      onSave({ ...state, bookings: upsert(state.bookings, item) }, "Booking saved.", { type: "booking", item });
    }
    if (modal.type === "customer") {
      const item = { ...(draft as Customer), id: draft.id || makeId("cust") };
      onSave({ ...state, customers: upsert(state.customers, item) }, "Customer saved.", { type: "customer", item });
    }
    if (modal.type === "campaign") {
      const item = { ...(draft as Campaign), id: draft.id || makeId("cmp") };
      onSave({ ...state, campaigns: upsert(state.campaigns, item) }, "Campaign saved.", { type: "campaign", item });
    }
    if (modal.type === "product") {
      const item = { ...(draft as Product), id: draft.id || makeId("prd") };
      onSave({ ...state, products: upsert(state.products, item) }, "Item saved.", { type: "product", item });
    }
  }

  function patch(next: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...next }) as typeof draft);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-semibold capitalize">{title}</h2>
          <RowAction icon="x" label="Close" onClick={onClose} />
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {modal.type === "service" ? (
            <>
              <div className="sm:col-span-2">
                <TextField label="Service name" value={(draft as Service).name} onChange={(value) => patch({ name: value })} />
              </div>
              <TextField label="Duration" type="number" value={(draft as Service).duration} onChange={(value) => patch({ duration: Number(value) })} />
              <TextField label="Price" type="number" value={(draft as Service).price} onChange={(value) => patch({ price: Number(value) })} />
              <SelectField label="Resource" value={(draft as Service).resource} onChange={(value) => patch({ resource: value })} options={state.resources} />
              <SelectField label="Status" value={(draft as Service).status} onChange={(value) => patch({ status: value as Service["status"] })} options={["Active", "Draft", "Off"]} />
            </>
          ) : null}

          {modal.type === "booking" ? (
            <>
              <TextField label="Date" type="date" value={(draft as Booking).date} onChange={(value) => patch({ date: value })} />
              <SelectField label="Status" value={(draft as Booking).status} onChange={(value) => patch({ status: value as Booking["status"] })} options={["Confirmed", "Pending", "Cancelled"]} />
              <TextField label="Start" type="time" value={(draft as Booking).start} onChange={(value) => patch({ start: value })} />
              <TextField label="End" type="time" value={(draft as Booking).end} onChange={(value) => patch({ end: value })} />
              <SelectField
                label="Customer"
                value={(draft as Booking).customerId}
                onChange={(value) => patch({ customerId: value })}
                options={state.customers.map((item): [string, string] => [item.id, `${item.player} (${item.name})`])}
              />
              <SelectField
                label="Service"
                value={(draft as Booking).serviceId}
                onChange={(value) => patch({ serviceId: value })}
                options={state.services.map((item): [string, string] => [item.id, item.name])}
              />
              <SelectField label="Resource" value={(draft as Booking).resource} onChange={(value) => patch({ resource: value })} options={state.resources} />
              <SelectField
                label="Payment"
                value={String((draft as Booking).paid)}
                onChange={(value) => patch({ paid: value === "true" })}
                options={[
                  ["true", "Paid"],
                  ["false", "Unpaid"],
                ]}
              />
            </>
          ) : null}

          {modal.type === "customer" ? (
            <>
              <TextField label="Parent name" value={(draft as Customer).name} onChange={(value) => patch({ name: value })} />
              <TextField label="Player name" value={(draft as Customer).player} onChange={(value) => patch({ player: value })} />
              <TextField label="Email" type="email" value={(draft as Customer).email} onChange={(value) => patch({ email: value })} />
              <TextField label="Phone" value={(draft as Customer).phone} onChange={(value) => patch({ phone: value })} />
              <TextField
                label="Age"
                type="number"
                value={(draft as Customer).age}
                onChange={(value) => patch({ age: value ? Number(value) : "" })}
              />
              <TextField
                label="Memberships"
                value={membershipText((draft as Customer).memberships)}
                onChange={(value) => patch({ memberships: parseMemberships(value) })}
              />
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-black/70">Notes</span>
                <textarea
                  value={(draft as Customer).notes}
                  onChange={(event) => patch({ notes: event.target.value })}
                  className="min-h-24 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                />
              </label>
            </>
          ) : null}

          {modal.type === "campaign" ? (
            <>
              <div className="sm:col-span-2">
                <TextField label="Campaign name" value={(draft as Campaign).name} onChange={(value) => patch({ name: value })} />
              </div>
              <SelectField label="Audience" value={(draft as Campaign).audience} onChange={(value) => patch({ audience: value })} options={["All customers", "Active customers", "Members", "Recent bookings"]} />
              <SelectField label="Status" value={(draft as Campaign).status} onChange={(value) => patch({ status: value as Campaign["status"] })} options={["Draft", "Active", "Off"]} />
            </>
          ) : null}

          {modal.type === "product" ? (
            <>
              <div className="sm:col-span-2">
                <TextField label="Item name" value={(draft as Product).name} onChange={(value) => patch({ name: value })} />
              </div>
              <TextField label="SKU" value={(draft as Product).sku} onChange={(value) => patch({ sku: value })} />
              <TextField label="Price" type="number" value={(draft as Product).price} onChange={(value) => patch({ price: Number(value) })} />
              <TextField label="Stock" type="number" value={(draft as Product).stock} onChange={(value) => patch({ stock: Number(value) })} />
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((current) => current.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((current, itemIndex) => (itemIndex === index ? item : current));
}

function exportReport(state: AppState, showToast: (message: string) => void) {
  const rows = [
    ["Date", "Start", "Customer", "Player", "Service", "Resource", "Status", "Paid"],
    ...state.bookings.map((booking) => {
      const customer = state.customers.find((item) => item.id === booking.customerId);
      const service = state.services.find((item) => item.id === booking.serviceId);
      return [
        booking.date,
        booking.start,
        customer?.name ?? "",
        customer?.player ?? "",
        service?.name ?? "",
        booking.resource,
        booking.status,
        booking.paid ? "Yes" : "No",
      ];
    }),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "booking-report.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Report exported.");
}
