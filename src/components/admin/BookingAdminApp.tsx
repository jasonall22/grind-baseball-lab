"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type BookingAdminView,
  bookingAdminRouteByView,
} from "@/components/admin/bookingAdminRoutes";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
  resource: string;
  status: "Active" | "Draft" | "Off";
};

type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  gender: string;
  birthDate: string;
};

type Customer = {
  id: string;
  name: string;
  player: string;
  email: string;
  address: string;
  phone: string;
  phoneCountry: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: string;
  age: number | "";
  memberships: string[];
  waiverAgreed: boolean;
  emergencyContactName: string;
  emergencyContactEmail: string;
  emergencyContactPhone: string;
  familyMembers: FamilyMember[];
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

type BookingPolicies = AppState["policies"];

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
  waiver_enabled: boolean | null;
  waiver_document_url: string | null;
  waiver_document_name: string | null;
  waiver_intro: string | null;
  waiver_allow_in_person: boolean | null;
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
  address: string | null;
  phone: string | null;
  phone_country: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  gender: string | null;
  age: number | null;
  memberships: string[] | null;
  waiver_agreed: boolean | null;
  emergency_contact_name: string | null;
  emergency_contact_email: string | null;
  emergency_contact_phone: string | null;
  family_members: FamilyMember[] | null;
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
  policies: {
    waiverEnabled: boolean;
    waiverDocumentUrl: string;
    waiverDocumentName: string;
    waiverIntro: string;
    waiverAllowInPerson: boolean;
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

type CustomerImportField =
  | "name"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "birthDate"
  | "birthYear"
  | "birthMonth"
  | "birthDay"
  | "gender"
  | "emergencyContactName"
  | "emergencyContactEmail"
  | "emergencyContactPhone"
  | "notes";

type ParsedCsvFile = {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
};

const storageKey = "grind_booking_admin_v1";
const lastAppRouteKey = "grind_booking_admin_last_app_route";
type SettingsSection = "basics" | "policies";

const navItems: { key: BookingAdminView; label: string; icon: IconName }[] = [
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

const WAIVER_BUCKET_PRIMARY =
  (process.env.NEXT_PUBLIC_BOOKING_WAIVER_BUCKET &&
    process.env.NEXT_PUBLIC_BOOKING_WAIVER_BUCKET.trim()) ||
  "booking-waivers";
const WAIVER_BUCKET_CANDIDATES = Array.from(
  new Set([WAIVER_BUCKET_PRIMARY, "booking-waivers", "booking-waiver", "waivers"].filter(Boolean))
);
const MAX_WAIVER_FILE_BYTES = 2 * 1024 * 1024;

const settingsNavGroups: {
  title: string;
  items: Array<{
    label: string;
    icon: IconName;
    href?: string;
    section?: SettingsSection;
  }>;
}[] = [
  {
    title: "Facility",
    items: [
      {
        label: "Basics",
        icon: "gear",
        href: bookingAdminRouteByView["settings-basics"],
        section: "basics",
      },
      { label: "Rooms", icon: "home" },
      { label: "Equipment", icon: "bag" },
      { label: "Schedules", icon: "calendar" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Checkout", icon: "copy" },
      { label: "Taxes & Fees", icon: "bar" },
    ],
  },
  {
    title: "Booking",
    items: [
      { label: "Booking Page", icon: "link" },
      {
        label: "Policies",
        icon: "copy",
        href: bookingAdminRouteByView["settings-policies"],
        section: "policies",
      },
      { label: "Registration", icon: "user" },
      { label: "Custom Fields", icon: "edit" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Profile", icon: "user" },
      { label: "Staff", icon: "user" },
      { label: "Roles & Permissions", icon: "gear" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Plan & Billing", icon: "bar" },
      { label: "Payouts", icon: "bag" },
      { label: "Integrations", icon: "link" },
      { label: "Automations", icon: "send" },
      { label: "Senders", icon: "message" },
    ],
  },
];

const defaultState: AppState = {
  facility: {
    name: "The Grind Baseball Lab",
    publicUrl: "https://www.grindbaseballlab.com/book",
    timezone: "America/New_York",
    address: "Venice, FL",
  },
  policies: {
    waiverEnabled: false,
    waiverDocumentUrl: "",
    waiverDocumentName: "Liability Waiver",
    waiverIntro:
      "By clicking Agree & Continue, you confirm that the customer has had the opportunity to review this waiver and has agreed to its terms with full consent.",
    waiverAllowInPerson: true,
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
      address: "",
      phone: "(407) 555-0148",
      phoneCountry: "US",
      birthYear: "",
      birthMonth: "",
      birthDay: "",
      gender: "",
      age: "",
      memberships: [],
      waiverAgreed: false,
      emergencyContactName: "",
      emergencyContactEmail: "",
      emergencyContactPhone: "",
      familyMembers: [],
      notes: "Varsity middle infielder",
      createdAt: "2026-07-01",
    },
    {
      id: "cust-jackson",
      name: "Avery Johnson",
      player: "Jackson Johnson",
      email: "avery.johnson@example.com",
      address: "",
      phone: "(407) 555-0192",
      phoneCountry: "US",
      birthYear: "",
      birthMonth: "",
      birthDay: "",
      gender: "",
      age: "",
      memberships: ["Pitching package"],
      waiverAgreed: false,
      emergencyContactName: "",
      emergencyContactEmail: "",
      emergencyContactPhone: "",
      familyMembers: [],
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
  | "phone"
  | "help"
  | "copy"
  | "plus"
  | "edit"
  | "trash"
  | "download"
  | "upload"
  | "file"
  | "table"
  | "check"
  | "camera"
  | "search"
  | "chevron"
  | "x"
  | "arrow-left";

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
  phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 5.2 12.8 19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 3a2 2 0 0 1-.6 1.8L7.1 10.3a16 16 0 0 0 6.6 6.6l1.8-1.8a2 2 0 0 1 1.8-.6l3 .4A2 2 0 0 1 22 16.9Z"],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.5 9a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4", "M12 17h.01"],
  copy: ["M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2Z", "M4 16V5a2 2 0 0 1 2-2h11"],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M12 20h9", "m16.5 3.5 4 4L7 21H3v-4Z"],
  trash: ["M3 6h18", "M8 6V4h8v2", "m19 6-1 15H6L5 6", "M10 11v6M14 11v6"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  upload: ["M12 21V9", "m7 14 5-5 5 5", "M5 3h14"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6"],
  table: ["M4 6h16", "M4 12h16", "M4 18h16", "M8 4v16", "M16 4v16"],
  check: ["M5 12.5 10 17l9-10"],
  camera: ["M4 7h3l1.4-2h7.2L17 7h3v12H4Z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  chevron: ["m9 18 6-6-6-6"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  "arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
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

function PhotoUploadAvatar({
  preview,
  onPick,
  size = "regular",
}: {
  preview: string;
  onPick: () => void;
  size?: "regular" | "compact";
}) {
  const isCompact = size === "compact";
  return (
    <button type="button" onClick={onPick} className="group flex flex-col items-center">
      <div className={isCompact ? "relative h-[72px] w-[72px]" : "relative h-[106px] w-[106px]"}>
        <div
          className={[
            "grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-[#cfd4df] bg-[#eceff5] transition",
            preview ? "bg-cover bg-center" : "",
          ].join(" ")}
          style={preview ? { backgroundImage: `url(${preview})` } : undefined}
        >
          {!preview ? (
            <svg
              viewBox="0 0 64 64"
              className={isCompact ? "h-[38px] w-[38px] text-[#4a4d57]" : "h-[54px] w-[54px] text-[#4a4d57]"}
              aria-hidden="true"
            >
              <circle cx="32" cy="21" r="10" fill="currentColor" />
              <path
                d="M14 49c0-8.8 8-14 18-14s18 5.2 18 14v3H14Z"
                fill="currentColor"
              />
            </svg>
          ) : null}
        </div>
        <span
          className={[
            "absolute grid place-items-center rounded-full border border-[#d3d7e1] bg-white text-[#6a6d77] shadow-sm",
            isCompact ? "bottom-[-1px] right-[-2px] h-6 w-6" : "bottom-[2px] right-[-2px] h-8 w-8",
          ].join(" ")}
        >
          <Icon name="camera" className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
      </div>
      <span
        className={[
          "text-[#737784] group-hover:text-[#4f5563]",
          isCompact ? "mt-1 text-[11px]" : "mt-2 text-[14px]",
        ].join(" ")}
      >
        Add photo
      </span>
    </button>
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function slugifyFileNameStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const slug = stem
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "waiver";
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

async function uploadWaiverPdf(file: File) {
  if (!hasSupabaseEnv) {
    throw new Error("Supabase is not configured for file uploads.");
  }

  const path = `waivers/${Date.now()}-${slugifyFileNameStem(file.name)}.pdf`;
  let lastError: unknown = null;

  for (const bucket of WAIVER_BUCKET_CANDIDATES) {
    const upload = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });

    if (!upload.error) {
      const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl || "";

      if (!publicUrl) {
        throw new Error(
          `Upload succeeded but public URL was empty. Make the "${bucket}" bucket Public in Supabase Storage.`
        );
      }

      return {
        publicUrl,
        fileName: file.name,
      };
    }

    lastError = upload.error;
  }

  const message = getErrorMessage(lastError, "Upload failed");
  if (message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not found")) {
    throw new Error(
      `Bucket not found. Create a Storage bucket named "${WAIVER_BUCKET_PRIMARY}" and set it to Public.`
    );
  }

  throw new Error(message);
}

async function upsertFacilitySettings(
  facility: FacilitySettings,
  policies: BookingPolicies
) {
  const { error } = await supabase.from("booking_settings").upsert({
    key: "default",
    facility_name: facility.name,
    public_url: facility.publicUrl,
    timezone: facility.timezone,
    address: facility.address,
    waiver_enabled: policies.waiverEnabled,
    waiver_document_url: policies.waiverDocumentUrl || null,
    waiver_document_name: policies.waiverDocumentName || null,
    waiver_intro: policies.waiverIntro,
    waiver_allow_in_person: policies.waiverAllowInPerson,
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
      address: item.address || null,
      phone: item.phone,
      phone_country: item.phoneCountry || "US",
      birth_year: item.birthYear ? Number(item.birthYear) : null,
      birth_month: item.birthMonth ? Number(item.birthMonth) : null,
      birth_day: item.birthDay ? Number(item.birthDay) : null,
      gender: item.gender || null,
      age:
        calculateAge(item.birthYear, item.birthMonth, item.birthDay) === ""
          ? item.age === "" ? null : item.age
          : calculateAge(item.birthYear, item.birthMonth, item.birthDay),
      memberships: item.memberships,
      waiver_agreed: item.waiverAgreed,
      emergency_contact_name: item.emergencyContactName,
      emergency_contact_email: item.emergencyContactEmail || null,
      emergency_contact_phone: item.emergencyContactPhone,
      family_members: item.familyMembers,
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

function birthPart(value: number | null | undefined, width: number) {
  if (!value) return "";
  return String(value).padStart(width, "0");
}

function calculateAge(
  birthYear: string,
  birthMonth: string,
  birthDay: string
): number | "" {
  const year = Number(birthYear);
  const month = Number(birthMonth);
  const day = Number(birthDay);

  if (!year || !month || !day) return "";

  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day);

  if (beforeBirthday) age -= 1;

  return age >= 0 ? age : "";
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] ?? "",
    last: parts.slice(1).join(" "),
  };
}

function joinName(first: string, last: string) {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}

function normalizeCsvHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  const normalizedRows = rows
    .map((row) => row.map((cell) => cell.replace(/^\uFEFF/, "").trim()))
    .filter((row) => row.some((cell) => cell !== ""));

  const headers = normalizedRows[0] ?? [];
  const dataRows = normalizedRows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );

  return { headers, rows: dataRows };
}

const customerImportHeaderAliases: Record<CustomerImportField, string[]> = {
  name: ["name", "fullname", "customername", "parentname", "full name"],
  firstName: ["firstname", "first name", "parentfirstname"],
  lastName: ["lastname", "last name", "parentlastname"],
  email: ["email", "emailaddress", "email address"],
  phone: ["phone", "phonenumber", "phone number", "mobile", "mobilephone"],
  address: ["address", "streetaddress", "location"],
  city: ["city"],
  state: ["state", "province", "region"],
  zip: ["zip", "zipcode", "zip code", "postalcode", "postal code"],
  birthDate: ["birthdate", "birth date", "dob", "dateofbirth", "date of birth"],
  birthYear: ["birthyear", "year", "dobyear", "birth year"],
  birthMonth: ["birthmonth", "month", "dobmonth", "birth month"],
  birthDay: ["birthday", "day", "dobday", "birth day"],
  gender: ["gender", "sex"],
  emergencyContactName: ["emergencycontactname", "emergency name", "guardianname", "parentcontactname"],
  emergencyContactEmail: ["emergencycontactemail", "emergency email", "guardianemail", "parentcontactemail"],
  emergencyContactPhone: [
    "emergencycontactphone",
    "emergency contact phone",
    "emergencycontactnumber",
    "emergency contact number",
    "emergency phone",
    "guardianphone",
    "parentcontactphone",
  ],
  notes: ["notes", "note", "customernotes"],
};

function parseBirthDateParts(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { birthYear: "", birthMonth: "", birthDay: "" };
  }

  const matched = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (matched) {
    return {
      birthYear: matched[1],
      birthMonth: matched[2].padStart(2, "0"),
      birthDay: matched[3].padStart(2, "0"),
    };
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return {
      birthYear: String(date.getFullYear()),
      birthMonth: String(date.getMonth() + 1).padStart(2, "0"),
      birthDay: String(date.getDate()).padStart(2, "0"),
    };
  }

  return { birthYear: "", birthMonth: "", birthDay: "" };
}

function suggestCustomerImportMapping(headers: string[]) {
  const mapping: Partial<Record<CustomerImportField, string>> = {};
  const unusedHeaders = new Set(headers);

  for (const [field, aliases] of Object.entries(customerImportHeaderAliases) as Array<
    [CustomerImportField, string[]]
  >) {
    const match = headers.find((header) => {
      if (!unusedHeaders.has(header)) return false;
      const normalized = normalizeCsvHeader(header);
      return aliases.some((alias) => normalizeCsvHeader(alias) === normalized);
    });

    if (match) {
      mapping[field] = match;
      unusedHeaders.delete(match);
    }
  }

  return mapping;
}

function buildImportedCustomers(
  rows: Record<string, string>[],
  mapping: Partial<Record<CustomerImportField, string>>
) {
  return rows
    .map((row) => {
      const readValue = (field: CustomerImportField) => {
        const header = mapping[field];
        return header ? (row[header] ?? "").trim() : "";
      };

      const explicitName = readValue("name");
      const firstName = readValue("firstName");
      const lastName = readValue("lastName");
      const name = explicitName || joinName(firstName, lastName);
      const email = readValue("email");
      const phone = readValue("phone");
      const streetAddress = readValue("address");
      const city = readValue("city");
      const state = readValue("state");
      const zip = readValue("zip");
      const cityState = [city, state].filter(Boolean).join(", ");
      const locationLine = [cityState, zip].filter(Boolean).join(" ");
      const address = [streetAddress, locationLine].filter(Boolean).join(", ").trim();
      const parsedBirthDate = parseBirthDateParts(readValue("birthDate"));
      const birthYear = readValue("birthYear") || parsedBirthDate.birthYear;
      const birthMonth = readValue("birthMonth") || parsedBirthDate.birthMonth;
      const birthDay = readValue("birthDay") || parsedBirthDate.birthDay;
      const gender = readValue("gender");
      const emergencyContactName = readValue("emergencyContactName");
      const emergencyContactEmail = readValue("emergencyContactEmail");
      const emergencyContactPhone = readValue("emergencyContactPhone");
      const notes = readValue("notes");

      if (!name && !email && !phone) {
        return null;
      }

      const customer: Customer = {
        id: makeId("customer"),
        name,
        player: "",
        email,
        address,
        phone,
        phoneCountry: "US",
        birthYear,
        birthMonth,
        birthDay,
        gender,
        age: calculateAge(birthYear, birthMonth, birthDay),
        memberships: [],
        waiverAgreed: false,
        emergencyContactName,
        emergencyContactEmail,
        emergencyContactPhone,
        familyMembers: [],
        notes,
        createdAt: new Date().toISOString().slice(0, 10),
      };

      return customer;
    })
    .filter((customer): customer is Customer => customer !== null);
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

export default function BookingAdminApp({
  view = "home",
  selectedCustomerId,
}: {
  view?: BookingAdminView;
  selectedCustomerId?: string;
}) {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeDate, setActiveDate] = useState("2026-07-01");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");
  const [isRemoteLoading, setIsRemoteLoading] = useState(hasSupabaseEnv);
  const [resourceIdsByName, setResourceIdsByName] = useState<Record<string, string>>({});
  const [backToAppHref, setBackToAppHref] = useState(bookingAdminRouteByView.home);
  const [showCustomerImport, setShowCustomerImport] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadFromSupabase = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setDataSource("local");
      setIsRemoteLoading(false);
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
        policies: {
          waiverEnabled:
            settings?.waiver_enabled ?? defaultState.policies.waiverEnabled,
          waiverDocumentUrl:
            settings?.waiver_document_url ??
            defaultState.policies.waiverDocumentUrl,
          waiverDocumentName:
            settings?.waiver_document_name ??
            defaultState.policies.waiverDocumentName,
          waiverIntro:
            settings?.waiver_intro ?? defaultState.policies.waiverIntro,
          waiverAllowInPerson:
            settings?.waiver_allow_in_person ??
            defaultState.policies.waiverAllowInPerson,
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
          address: customer.address ?? "",
          phone: customer.phone ?? "",
          phoneCountry: customer.phone_country ?? "US",
          birthYear: birthPart(customer.birth_year, 4),
          birthMonth: birthPart(customer.birth_month, 2),
          birthDay: birthPart(customer.birth_day, 2),
          gender: customer.gender ?? "",
          age: (() => {
            const derivedAge = calculateAge(
              birthPart(customer.birth_year, 4),
              birthPart(customer.birth_month, 2),
              birthPart(customer.birth_day, 2)
            );
            return derivedAge === "" ? customer.age ?? "" : derivedAge;
          })(),
          memberships: customer.memberships ?? [],
          waiverAgreed: customer.waiver_agreed ?? false,
          emergencyContactName: customer.emergency_contact_name ?? "",
          emergencyContactEmail: customer.emergency_contact_email ?? "",
          emergencyContactPhone: customer.emergency_contact_phone ?? "",
          familyMembers: customer.family_members ?? [],
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
    } finally {
      setIsRemoteLoading(false);
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
      await upsertFacilitySettings(next.facility, next.policies);
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

  async function saveCustomerDetail(item: Customer, message: string) {
    const next = { ...state, customers: upsert(state.customers, item) };

    if (dataSource === "local") {
      saveLocal(next, message);
      return;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "customer", item }, resourceIdsByName);
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

  async function importCustomers(customersToImport: Customer[]) {
    if (!customersToImport.length) {
      showToast("No customers found to import.");
      return;
    }

    if (dataSource === "local") {
      const next = { ...state, customers: [...customersToImport, ...state.customers] };
      saveLocal(next, `${customersToImport.length} customer${customersToImport.length === 1 ? "" : "s"} imported.`);
      setShowCustomerImport(false);
      return;
    }

    try {
      const { error } = await supabase.from("booking_customers").upsert(
        customersToImport.map((item) => ({
          id: item.id,
          parent_name: item.name,
          player_name: item.player,
          email: item.email,
          address: item.address || null,
          phone: item.phone,
          phone_country: item.phoneCountry || "US",
          birth_year: item.birthYear ? Number(item.birthYear) : null,
          birth_month: item.birthMonth ? Number(item.birthMonth) : null,
          birth_day: item.birthDay ? Number(item.birthDay) : null,
          gender: item.gender || null,
          age:
            calculateAge(item.birthYear, item.birthMonth, item.birthDay) === ""
              ? item.age === "" ? null : item.age
              : calculateAge(item.birthYear, item.birthMonth, item.birthDay),
          memberships: item.memberships,
          waiver_agreed: item.waiverAgreed,
          emergency_contact_name: item.emergencyContactName,
          emergency_contact_email: item.emergencyContactEmail || null,
          emergency_contact_phone: item.emergencyContactPhone,
          family_members: item.familyMembers,
          notes: item.notes,
        }))
      );

      if (error) throw error;

      await loadFromSupabase();
      setShowCustomerImport(false);
      showToast(`${customersToImport.length} customer${customersToImport.length === 1 ? "" : "s"} imported.`);
    } catch (error) {
      console.error(error);
      showToast("Customer import failed.");
    }
  }

  const customersById = useMemo(
    () => new Map(state.customers.map((customer) => [customer.id, customer])),
    [state.customers]
  );
  const selectedCustomer =
    selectedCustomerId ? state.customers.find((customer) => customer.id === selectedCustomerId) ?? null : null;

  const servicesById = useMemo(
    () => new Map(state.services.map((service) => [service.id, service])),
    [state.services]
  );

  const dayBookings = state.bookings.filter((booking) => booking.date === activeDate);
  const activeMainView = view.startsWith("settings") ? "settings" : view;
  const isSettingsView = activeMainView === "settings";

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isSettingsView) {
      const href = bookingAdminRouteByView[view];
      window.localStorage.setItem(lastAppRouteKey, href);
      setBackToAppHref(href);
      return;
    }

    const saved = window.localStorage.getItem(lastAppRouteKey);
    setBackToAppHref(saved || bookingAdminRouteByView.home);
  }, [isSettingsView, view]);

  return (
    <div className="min-h-screen bg-white text-black">
      <div
        className={[
          "grid min-h-screen grid-cols-1 bg-white",
          isSettingsView ? "" : "md:grid-cols-[284px_minmax(0,1fr)]",
        ].join(" ")}
      >
        {!isSettingsView ? (
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
                <Link
                  key={item.key}
                  href={bookingAdminRouteByView[item.key]}
                  title={item.label}
                  className={[
                    "flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-lg transition md:w-full",
                    activeMainView === item.key ? "bg-[#eeeeee] font-bold" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  <Icon name={item.icon} />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
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
        ) : null}

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
            selectedCustomerId ? (
              <CustomerDetailView
                key={[
                  selectedCustomer?.id ?? "none",
                  selectedCustomer?.emergencyContactName ?? "",
                  selectedCustomer?.emergencyContactEmail ?? "",
                  selectedCustomer?.emergencyContactPhone ?? "",
                  JSON.stringify(selectedCustomer?.familyMembers ?? []),
                ].join(":")}
                customer={selectedCustomer}
                onEdit={(id) => setModal({ type: "customer", id })}
                onSaveCustomer={(item) => void saveCustomerDetail(item, "Customer updated.")}
              />
            ) : (
              <CustomersView
                customers={state.customers}
                bookings={state.bookings}
                loading={isRemoteLoading}
                search={customerSearch}
                onSearch={setCustomerSearch}
                onImport={() => setShowCustomerImport(true)}
                onNew={() => setModal({ type: "customer" })}
                onEdit={(id) => setModal({ type: "customer", id })}
                onDelete={(id) => void deleteCustomer(id)}
              />
            )
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
          {view === "settings" || view === "settings-basics" || view === "settings-policies" ? (
            <SettingsView
              backHref={backToAppHref}
              section={view === "settings-policies" ? "policies" : "basics"}
              state={state}
              showToast={showToast}
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

      {showCustomerImport ? (
        <CustomerImportModal
          onClose={() => setShowCustomerImport(false)}
          onImport={(customersToImport) => void importCustomers(customersToImport)}
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

function HoverIconButton({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          tone === "danger"
            ? "text-black/40 hover:bg-red-50 hover:text-[#ff3b30]"
            : "text-black/40 hover:bg-black/[0.04] hover:text-black/60",
        ].join(" ")}
      >
        <Icon name={icon} className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#707070] px-3 py-2 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {label}
        <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#707070]" />
      </div>
    </div>
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
  loading,
  search,
  onSearch,
  onImport,
  onNew,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  bookings: Booking[];
  loading: boolean;
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-black/55">
                    Loading customers...
                  </td>
                </tr>
              ) : null}
              {!loading ? filtered.map((customer) => {
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
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        title={`${bookingCount} bookings`}
                        className="inline-flex items-center gap-3 text-left font-semibold hover:underline"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white">
                          <Icon name="user" className="h-5 w-5" />
                        </span>
                        {customer.name || customer.player || "Customer"}
                      </Link>
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
              }) : null}
              {!loading && !filtered.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-black/55">
                    No customers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function customerInitials(customer: Customer) {
  const source = customer.name || customer.player || "";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CU";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function customerBirthDate(customer: Customer) {
  if (!customer.birthYear || !customer.birthMonth || !customer.birthDay) return "";
  return `${customer.birthMonth.padStart(2, "0")}/${customer.birthDay.padStart(2, "0")}/${customer.birthYear}`;
}

function formatUsDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatUsPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function parseUsDateInput(value: string) {
  const matched = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!matched) return null;

  const year = Number(matched[3]);
  const monthIndex = Number(matched[1]) - 1;
  const day = Number(matched[2]);
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateToUs(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarDays(monthDate: Date) {
  const firstOfMonth = startOfMonth(monthDate);
  const start = new Date(firstOfMonth);
  start.setDate(1 - firstOfMonth.getDay());

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      date,
      label: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function customerJoinedLabel(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function DetailPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="flex min-h-10 items-center justify-between border-b border-black/10 bg-black/[0.02] px-4">
        <h3 className="text-[14px] font-medium text-black/85">{title}</h3>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

function ProfileField({
  label,
  value,
  rightLabel,
  trailing,
}: {
  label: string;
  value: string;
  rightLabel?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-black/85">{label}</span>
        {rightLabel ? <span className="text-[13px] text-black/45">{rightLabel}</span> : null}
      </div>
      <div className="relative">
        <input
          defaultValue={value}
          className="min-h-10 w-full rounded-md border border-black/15 px-4 text-[14px] outline-none"
        />
        {trailing ? <div className="absolute inset-y-0 right-3 flex items-center gap-2 text-black/45">{trailing}</div> : null}
      </div>
    </label>
  );
}

function FamilyMemberModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState("Unspecified");
  const [gender, setGender] = useState("Unspecified");
  const [birthDate, setBirthDate] = useState("");
  const [showBirthCalendar, setShowBirthCalendar] = useState(false);
  const [showBirthMonthYearPicker, setShowBirthMonthYearPicker] = useState(false);
  const [visibleBirthMonth, setVisibleBirthMonth] = useState(() => startOfMonth(new Date()));
  const [photoPreview, setPhotoPreview] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const birthCalendarRef = useRef<HTMLDivElement | null>(null);

  const canSave = firstName.trim().length > 0 || lastName.trim().length > 0;
  const selectedBirthDate = parseUsDateInput(birthDate);
  const birthCalendarDays = useMemo(() => buildCalendarDays(visibleBirthMonth), [visibleBirthMonth]);
  const birthYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index);
  }, []);

  async function handlePhotoFile(file: File) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    const preview = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    setPhotoPreview(preview);
  }

  useEffect(() => {
    if (!showBirthCalendar) return;

    function handlePointerDown(event: MouseEvent) {
      if (birthCalendarRef.current?.contains(event.target as Node)) return;
      setShowBirthCalendar(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showBirthCalendar]);

  function toggleBirthCalendar() {
    setVisibleBirthMonth(startOfMonth(selectedBirthDate ?? new Date()));
    setShowBirthMonthYearPicker(false);
    setShowBirthCalendar((current) => !current);
  }

  function chooseBirthDate(date: Date) {
    setBirthDate(formatDateToUs(date));
    setVisibleBirthMonth(startOfMonth(date));
    setShowBirthMonthYearPicker(false);
    setShowBirthCalendar(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[604px] overflow-visible rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
          <h3 className="text-[18px] font-medium text-black">Add Member</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-black/45 hover:bg-black/[0.03]"
            aria-label="Close"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="flex flex-col items-center pb-4">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handlePhotoFile(file);
                event.currentTarget.value = "";
              }}
            />
            <PhotoUploadAvatar preview={photoPreview} onPick={() => photoInputRef.current?.click()} />
          </div>

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-black/85">First Name</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="min-h-11 rounded-md border border-black/15 px-4 text-[15px] outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-black/85">Last Name</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="min-h-11 rounded-md border border-black/15 px-4 text-[15px] outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-black/85">Relationship</span>
              <select
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                className="min-h-11 rounded-md border border-black/15 px-4 text-[15px] outline-none"
              >
                {["Unspecified", "Child", "Parent", "Sibling", "Spouse", "Guardian", "Relative"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-black/85">Gender</span>
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                className="min-h-11 rounded-md border border-black/15 px-4 text-[15px] outline-none"
              >
                {["Unspecified", "Male", "Female", "Non-binary"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-black/85">Date of Birth</span>
              <div ref={birthCalendarRef} className="relative">
                <input
                  value={birthDate}
                  onChange={(event) => setBirthDate(formatUsDateInput(event.target.value))}
                  placeholder="MM/DD/YYYY"
                  inputMode="numeric"
                  maxLength={10}
                  className="min-h-11 w-full rounded-md border border-black/15 px-4 pr-11 text-[15px] outline-none"
                />
                <button
                  type="button"
                  onClick={toggleBirthCalendar}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-black/45"
                  aria-label="Open date picker"
                >
                  <Icon name="calendar" className="h-4 w-4" />
                </button>

                {showBirthCalendar ? (
                  <div
                    className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[284px] max-w-[calc(100vw-72px)] rounded-xl border border-black/10 bg-white p-4 shadow-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowBirthMonthYearPicker((current) => !current)}
                        className="flex items-center gap-2 text-left text-[15px] font-medium text-black"
                        aria-label="Choose month and year"
                      >
                        <span>
                          {visibleBirthMonth.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <Icon
                          name="chevron"
                          className={[
                            "h-4 w-4 text-black/50 transition-transform",
                            showBirthMonthYearPicker ? "rotate-180" : "rotate-0",
                          ].join(" ")}
                        />
                      </button>
                      <div className="flex items-center gap-2 text-black/55">
                        <button
                          type="button"
                          onClick={() => setVisibleBirthMonth((current) => addMonths(current, -1))}
                          className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/[0.04]"
                          aria-label="Previous month"
                        >
                          <Icon name="chevron" className="h-4 w-4 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibleBirthMonth((current) => addMonths(current, 1))}
                          className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/[0.04]"
                          aria-label="Next month"
                        >
                          <Icon name="chevron" className="h-4 w-4 -rotate-90" />
                        </button>
                      </div>
                    </div>

                    {showBirthMonthYearPicker ? (
                      <div className="mb-4 grid grid-cols-[1fr_106px] gap-2">
                        <select
                          value={visibleBirthMonth.getMonth()}
                          onChange={(event) =>
                            setVisibleBirthMonth(
                              new Date(
                                visibleBirthMonth.getFullYear(),
                                Number(event.target.value),
                                1,
                              ),
                            )
                          }
                          className="min-h-9 rounded-md border border-black/15 bg-white px-3 text-[13px] text-black outline-none"
                        >
                          {Array.from({ length: 12 }, (_, index) => (
                            <option key={index} value={index}>
                              {new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long" })}
                            </option>
                          ))}
                        </select>
                        <select
                          value={visibleBirthMonth.getFullYear()}
                          onChange={(event) =>
                            setVisibleBirthMonth(
                              new Date(
                                Number(event.target.value),
                                visibleBirthMonth.getMonth(),
                                1,
                              ),
                            )
                          }
                          className="min-h-9 rounded-md border border-black/15 bg-white px-3 text-[13px] text-black outline-none"
                        >
                          {birthYearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-7 gap-y-2 text-center text-[12px] text-black/55">
                      {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                        <div key={day}>{day}</div>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-7 gap-y-2 text-center">
                      {birthCalendarDays.map((day) => {
                        const isSelected =
                          !!selectedBirthDate &&
                          day.date.getFullYear() === selectedBirthDate.getFullYear() &&
                          day.date.getMonth() === selectedBirthDate.getMonth() &&
                          day.date.getDate() === selectedBirthDate.getDate();

                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => chooseBirthDate(day.date)}
                            className={[
                              "mx-auto grid h-8 w-8 place-items-center rounded-full text-[14px]",
                              day.isCurrentMonth ? "text-black/75" : "text-black/25",
                              isSelected ? "border border-black/35 text-black" : "hover:bg-black/[0.04]",
                            ].join(" ")}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-black/10 px-6 py-4">
          <button type="button" onClick={onClose} className="text-[15px] font-medium text-black/65">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                id: makeId("family"),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                relationship,
                gender,
                birthDate,
              })
            }
            className="rounded-md bg-black px-5 py-2.5 text-[15px] font-medium text-white disabled:bg-black/10 disabled:text-black/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailView({
  customer,
  onEdit,
  onSaveCustomer,
}: {
  customer: Customer | null;
  onEdit: (id: string) => void;
  onSaveCustomer: (item: Customer) => void;
}) {
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [profilePhone, setProfilePhone] = useState(customer?.phone ?? "");
  const [emergencyDeleted, setEmergencyDeleted] = useState(false);

  if (!customer) {
    return (
      <section className="min-h-screen px-6 py-8">
        <div className="rounded-xl border border-black/10 bg-white p-8 text-sm text-black/55">
          Customer not found.
        </div>
      </section>
    );
  }

  const currentCustomer: Customer = customer;
  const { first, last } = splitName(customer.name);
  const joinedLabel = customerJoinedLabel(customer.createdAt);
  const initials = customerInitials(customer);
  const birthDate = customerBirthDate(customer);
  const age = calculateAge(customer.birthYear, customer.birthMonth, customer.birthDay);
  const familyMembers = customer.familyMembers;
  const hasEmergencyContact = !emergencyDeleted && Boolean(
    customer.emergencyContactName.trim() ||
    customer.emergencyContactEmail.trim() ||
    customer.emergencyContactPhone.trim()
  );

  function clearEmergencyContact() {
    setEmergencyDeleted(true);
  }

  function saveEmergencyContact() {
    onSaveCustomer({
      ...currentCustomer,
      emergencyContactName: "",
      emergencyContactEmail: "",
      emergencyContactPhone: "",
    });
    setEmergencyDeleted(false);
  }

  function saveFamilyMembers(nextFamilyMembers: FamilyMember[]) {
    onSaveCustomer({
      ...currentCustomer,
      familyMembers: nextFamilyMembers,
    });
  }

  return (
    <section className="min-h-screen px-5 py-6">
      <div className="flex flex-wrap items-center gap-2 text-[14px] text-black/55">
        <Link href="/admin/customers" className="font-medium text-black/75 hover:text-black">
          Customers
        </Link>
        <span>/</span>
        <span className="font-medium text-black">{customer.name || "Customer"}</span>
      </div>

      <div className="mt-3 flex flex-col gap-4 border-b border-black/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-[48px] w-[48px] place-items-center rounded-full border border-black/12 bg-black/[0.04] text-[16px] font-medium text-black/65">
            {initials}
          </div>
          <div>
            <h1 className="text-[22px] font-medium text-black">{customer.name || "Customer"}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-black/55">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="message" className="h-3.5 w-3.5" />
                {customer.email || "No email"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="phone" className="h-3.5 w-3.5" />
                {customer.phone || "No phone"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" className="h-3.5 w-3.5" />
                {joinedLabel ? `Joined ${joinedLabel}` : "Recently joined"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 lg:justify-end">
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/12 bg-white px-4 text-[14px] font-medium">
            <Icon name="message" className="h-3.5 w-3.5" />
            Email
          </button>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/12 bg-white px-4 text-[14px] font-medium">
            <Icon name="plus" className="h-3.5 w-3.5" />
            Add note
          </button>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-black/12 bg-white text-lg leading-none">
            ...
          </button>
        </div>
      </div>

      <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-black/[0.05] p-1 text-[14px]">
        {["Profile", "Billing", "Memberships", "Packages", "Activity", "Invoices", "Credits"].map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={[
              "rounded-lg px-3.5 py-1.5 font-medium",
              index === 0 ? "bg-white text-black shadow-sm" : "text-black/55",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_30rem]">
        <DetailPanel title="About">
          <div className="grid gap-5 p-5">
            <div className="grid gap-4 md:grid-cols-[104px_minmax(0,1fr)]">
              <div className="grid place-items-start pt-1">
                <div className="grid h-[82px] w-[82px] place-items-center rounded-full border border-black/12 bg-black/[0.05] text-black/35">
                  <Icon name="user" className="h-11 w-11" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium text-black/85">Name</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    defaultValue={first}
                    className="min-h-10 w-full rounded-md border border-black/15 px-4 text-[14px] outline-none"
                  />
                  <input
                    defaultValue={last}
                    className="min-h-10 w-full rounded-md border border-black/15 px-4 text-[14px] outline-none"
                  />
                </div>
              </div>
            </div>

            <ProfileField
              label="Date of Birth"
              value={birthDate}
              rightLabel={age === "" ? undefined : `Age: ${age}`}
              trailing={<Icon name="calendar" className="h-4 w-4" />}
            />

            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium text-black/85">Gender</span>
              <select defaultValue={customer.gender || ""} className="min-h-10 rounded-md border border-black/15 px-4 text-[14px] outline-none">
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </label>

            <div className="overflow-hidden rounded-md border border-black/10">
              <div className="flex min-h-10 items-center justify-between bg-black/[0.02] px-4 text-[14px] text-black/55">
                <span>Contact Information</span>
                <Icon name="chevron" className="h-4 w-4 -rotate-90" />
              </div>
              <div className="grid gap-4 p-4">
                <ProfileField
                  label="Email"
                  value={customer.email}
                  trailing={
                    <>
                      <Icon name="edit" className="h-4 w-4" />
                      <Icon name="copy" className="h-4 w-4" />
                    </>
                  }
                />

                <label className="grid gap-1.5">
                  <span className="text-[13px] font-medium text-black/85">Phone</span>
                  <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
                    <div className="grid min-h-10 place-items-center rounded-md border border-black/15 text-lg">🇺🇸</div>
                    <input
                      value={profilePhone}
                      onChange={(event) => setProfilePhone(formatUsPhoneInput(event.target.value))}
                      inputMode="numeric"
                      maxLength={14}
                      className="min-h-10 rounded-md border border-black/15 px-4 text-[14px] outline-none"
                    />
                  </div>
                </label>

                <ProfileField label="Address" value={customer.address} />
              </div>
            </div>
          </div>
        </DetailPanel>

        <div className="grid gap-4">
          <DetailPanel
            title="Emergency Contact"
            action={
              !hasEmergencyContact ? (
                <button type="button" onClick={() => onEdit(customer.id)} className="text-2xl leading-none text-black/45">
                  +
                </button>
              ) : undefined
            }
          >
            {hasEmergencyContact ? (
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-[14px] font-medium text-black">{customer.emergencyContactName}</div>
                  <div className="mt-1 text-[13px] text-black/55">
                    {[customer.emergencyContactEmail, customer.emergencyContactPhone].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex gap-3 text-black/45">
                  <HoverIconButton icon="edit" label="Edit Contact" onClick={() => onEdit(customer.id)} />
                  <HoverIconButton icon="trash" label="Delete" onClick={clearEmergencyContact} tone="danger" />
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-10 text-center text-[14px] text-black/45">No emergency contact added.</div>
                {emergencyDeleted ? (
                  <div className="flex items-center justify-end gap-6 border-t border-black/10 bg-black/[0.02] px-4 py-3">
                    <span className="text-[14px] font-medium text-[#d4571d]">Changes made</span>
                    <button
                      type="button"
                      onClick={saveEmergencyContact}
                      className="inline-flex min-h-10 items-center rounded-lg bg-black px-6 text-[14px] font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </DetailPanel>

          <DetailPanel title="Custom Fields" action={<button type="button" className="text-2xl leading-none text-black/45">+</button>}>
            <div className="flex items-center justify-between gap-4 p-4 text-[14px]">
              <div className="flex items-center gap-3 text-black/65">
                <Icon name="send" className="h-4 w-4" />
                <span>Referral</span>
              </div>
              <div className="ml-auto text-black/85">{customer.notes ? "From notes" : "-"}</div>
              <div className="flex gap-3 text-black/45">
                <button type="button"><Icon name="edit" className="h-4 w-4" /></button>
                <button type="button" className="text-xl leading-none">...</button>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Family Members"
            action={
              <button
                type="button"
                onClick={() => setShowFamilyModal(true)}
                className="text-2xl leading-none text-black/45"
              >
                +
              </button>
            }
          >
            {familyMembers.length ? (
              <div className="divide-y divide-black/10">
                {familyMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-black/[0.04] text-[13px] font-medium text-black/60">
                        {`${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[14px] font-medium text-black">
                          {[member.firstName, member.lastName].filter(Boolean).join(" ")}
                        </div>
                        <div className="mt-0.5 text-[13px] text-black/55">
                          {[member.gender !== "Unspecified" ? member.gender : "", member.relationship !== "Unspecified" ? member.relationship : ""]
                            .filter(Boolean)
                            .join(" · ") || "Member"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 text-black/45">
                      <HoverIconButton icon="edit" label="Edit Member" onClick={() => {}} />
                      <HoverIconButton
                        icon="trash"
                        label="Delete"
                        onClick={() => saveFamilyMembers(familyMembers.filter((item) => item.id !== member.id))}
                        tone="danger"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-black/45">No family members yet.</div>
            )}
          </DetailPanel>

          <DetailPanel title="Preferences">
            <div className="grid gap-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium text-black">Liability Waiver</div>
                  <div className="mt-1 text-[13px] text-black/55">
                    {customer.waiverAgreed ? "Agreed" : "Not yet agreed"}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${customer.waiverAgreed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {customer.waiverAgreed ? "Agreed" : "Pending"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium text-black">Email marketing</div>
                  <div className="mt-1 text-[13px] text-black/55">Opted in to receive marketing emails</div>
                </div>
                <button type="button" className="relative h-6 w-11 rounded-full bg-black">
                  <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white" />
                </button>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title="Notes" action={<button type="button" className="text-2xl leading-none text-black/45">+</button>}>
            <div className="p-7 text-center text-[14px] text-black/45">
              {customer.notes ? customer.notes : "No notes yet. Click + to add the first note."}
            </div>
          </DetailPanel>
        </div>
      </div>

      {showFamilyModal ? (
        <FamilyMemberModal
          onClose={() => setShowFamilyModal(false)}
          onSave={(member) => {
            saveFamilyMembers([...familyMembers, member]);
            setShowFamilyModal(false);
          }}
        />
      ) : null}
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
  backHref,
  section,
  state,
  showToast,
  onSave,
}: {
  backHref: string;
  section: SettingsSection;
  state: AppState;
  showToast: (message: string) => void;
  onSave: (next: AppState) => void;
}) {
  const [draft, setDraft] = useState(state);
  const isBasics = section === "basics";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingWaiver, setIsUploadingWaiver] = useState(false);
  const [waiverUploadError, setWaiverUploadError] = useState("");

  useEffect(() => {
    setDraft(state);
  }, [state]);

  async function handleWaiverFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setWaiverUploadError("File must be a PDF.");
      return;
    }

    if (file.size > MAX_WAIVER_FILE_BYTES) {
      setWaiverUploadError("File must be 2MB or smaller.");
      return;
    }

    setIsUploadingWaiver(true);
    setWaiverUploadError("");

    try {
      const uploaded = await uploadWaiverPdf(file);
      setDraft((current) => ({
        ...current,
        policies: {
          ...current.policies,
          waiverDocumentUrl: uploaded.publicUrl,
          waiverDocumentName: uploaded.fileName,
        },
      }));
      showToast("Waiver PDF uploaded. Click Save to publish it.");
    } catch (error) {
      setWaiverUploadError(getErrorMessage(error, "Upload failed."));
    } finally {
      setIsUploadingWaiver(false);
    }
  }

  return (
    <section className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-black/10 bg-[#f7f7f7] px-4 py-5 lg:border-b-0 lg:border-r">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-black/70 transition hover:text-black"
          >
            <Icon name="arrow-left" className="h-4 w-4" />
            Back to app
          </Link>

          <div className="mt-6 space-y-6">
            {settingsNavGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-sm font-medium text-black/45">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item.section === section;
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive ? "bg-[#e9e9e9] font-semibold" : "text-black/75 hover:bg-black/5",
                    ].join(" ");

                    if (item.href) {
                      return (
                        <Link key={item.label} href={item.href} className={className}>
                          <Icon name={item.icon} className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => showToast(`${item.label} is next in the Settings build-out.`)}
                        className={className}
                      >
                        <Icon name={item.icon} className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="px-6 py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <PageHeader
              title={isBasics ? "Basics" : "Policies"}
              subtitle={
                isBasics
                  ? "Manage your facility settings."
                  : "Configure booking policies and rules for your facility."
              }
            />

            <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
              <div className="border-t-4 border-t-[#4866b0]" />

              {isBasics ? (
                <>
                  <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Facility Details</div>
                  <div className="divide-y divide-black/10">
                    <div className="grid gap-6 px-5 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                      <div>
                        <div className="text-[18px] font-semibold">Basics</div>
                        <p className="mt-2 text-sm leading-relaxed text-black/65">
                          Set the facility name, booking page URL, and operating timezone.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <TextField
                          label="Facility name"
                          value={draft.facility.name}
                          onChange={(value) =>
                            setDraft({ ...draft, facility: { ...draft.facility, name: value } })
                          }
                        />
                        <TextField
                          label="Facility booking page"
                          value={draft.facility.publicUrl}
                          onChange={(value) =>
                            setDraft({ ...draft, facility: { ...draft.facility, publicUrl: value } })
                          }
                        />
                        <TextField
                          label="Timezone"
                          value={draft.facility.timezone}
                          onChange={(value) =>
                            setDraft({ ...draft, facility: { ...draft.facility, timezone: value } })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-6 px-5 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                      <div>
                        <div className="text-[18px] font-semibold">Contact Info</div>
                        <p className="mt-2 text-sm leading-relaxed text-black/65">
                          Add the facility location details used across your booking flow.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <TextField
                          label="Address"
                          value={draft.facility.address}
                          onChange={(value) =>
                            setDraft({ ...draft, facility: { ...draft.facility, address: value } })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-6 px-5 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                      <div>
                        <div className="text-[18px] font-semibold">Rooms & Equipment</div>
                        <p className="mt-2 text-sm leading-relaxed text-black/65">
                          Manage the spaces that appear on your calendar and booking pages.
                        </p>
                      </div>
                      <div>
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-black/70">Resources</div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                resources: [...draft.resources, `Resource ${draft.resources.length + 1}`],
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold"
                          >
                            <Icon name="plus" className="h-4 w-4" />
                            Add
                          </button>
                        </div>
                        <div className="grid gap-3">
                          {draft.resources.map((resource, index) => (
                            <div key={`${resource}-${index}`} className="flex gap-2">
                              <input
                                value={resource}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    resources: draft.resources.map((item, itemIndex) =>
                                      itemIndex === index ? event.target.value : item
                                    ),
                                  })
                                }
                                className="min-h-10 flex-1 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
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
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Booking Policies</div>
                  <div className="grid gap-6 px-5 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div>
                      <div className="text-[18px] font-semibold">Liability Waiver</div>
                      <p className="mt-2 text-sm leading-relaxed text-black/65">
                        Display and require customers to agree to your liability waiver before they are
                        allowed to make any booking.
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div className="flex flex-wrap items-center gap-6">
                        <span className="text-[15px] font-medium text-black">Off</span>
                        <ToggleSwitch
                          checked={draft.policies.waiverEnabled}
                          onChange={(checked) =>
                            setDraft({
                              ...draft,
                              policies: {
                                ...draft.policies,
                                waiverEnabled: checked,
                              },
                            })
                          }
                          label="Toggle liability waiver"
                        />
                        <span className="text-[15px] font-medium text-black">On</span>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleWaiverFile(file);
                          }
                          event.currentTarget.value = "";
                        }}
                        className="hidden"
                      />

                      <div className="grid gap-3 lg:grid-cols-[36px_minmax(0,1fr)] lg:items-start">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingWaiver}
                          className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-black/70 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Upload waiver PDF"
                          aria-label="Upload waiver PDF"
                        >
                          <Icon name="upload" className="h-4 w-4" />
                        </button>
                        <div className="min-w-0">
                          {draft.policies.waiverDocumentUrl ? (
                            <a
                              href={draft.policies.waiverDocumentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-sm font-medium text-[#3558a8] underline"
                            >
                              {draft.policies.waiverDocumentName || "Liability waiver.pdf"}
                            </a>
                          ) : (
                            <div className="text-sm text-black/55">No PDF attached yet.</div>
                          )}
                          <div className="mt-1 text-xs text-black/45">
                            File must be a PDF with max upload size of 2MB.
                          </div>
                          {isUploadingWaiver ? (
                            <div className="mt-2 text-sm font-medium text-black/60">Uploading waiver PDF...</div>
                          ) : null}
                          {waiverUploadError ? (
                            <div className="mt-2 text-sm text-red-600">{waiverUploadError}</div>
                          ) : null}
                        </div>
                      </div>

                      <label className="grid gap-1.5">
                        <span className="text-sm font-semibold text-black/70">Waiver confirmation text</span>
                        <textarea
                          value={draft.policies.waiverIntro}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              policies: {
                                ...draft.policies,
                                waiverIntro: event.target.value,
                              },
                            })
                          }
                          className="min-h-28 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                        />
                      </label>
                      <label className="inline-flex items-center gap-3 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={draft.policies.waiverAllowInPerson}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              policies: {
                                ...draft.policies,
                                waiverAllowInPerson: event.target.checked,
                              },
                            })
                          }
                          className="h-5 w-5 accent-[#4866b0]"
                        />
                        Allow staff to collect waiver signatures in person
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end border-t border-black/10 px-5 py-4">
                <PrimaryButton icon="gear" onClick={() => onSave(draft)}>
                  Save
                </PrimaryButton>
              </div>
            </div>
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
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-black/70">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
      />
    </label>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-14 items-center rounded-full border border-black/5 px-[3px] transition-colors duration-200",
        checked ? "bg-[#afc0d8]" : "bg-[#d9dee6]",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-6 w-6 rounded-full shadow-sm transition-transform duration-200",
          checked
            ? "translate-x-7 bg-[#5f7ea6]"
            : "translate-x-0 bg-white",
        ].join(" ")}
      />
    </button>
  );
}

function NotesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const toolbarButtons = ["↶", "↷", "≡", "B", "I", "U", "S", "<>", "↔", "☰", "☷"];

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-black/10">
      <div className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 border-b border-black/10 px-3 py-2 text-black/55">
        {toolbarButtons.map((item, index) => (
          <button
            key={`${item}-${index}`}
            type="button"
            className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-lg transition hover:bg-black/[0.03]"
          >
            {item}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add notes..."
        className="min-h-[220px] w-full resize-none px-4 py-4 text-base outline-none"
      />
    </div>
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

function CustomerSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sm:col-span-2 border-t border-black/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between text-left text-xs font-extrabold uppercase text-black/45"
      >
        {title}
        <Icon name="chevron" className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? <div className="grid gap-4 pb-4 sm:grid-cols-2">{children}</div> : null}
    </div>
  );
}

const customerImportFieldLabels: Record<CustomerImportField, string> = {
  name: "Name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone number",
  address: "Address",
  city: "City",
  state: "State",
  zip: "Zip code",
  birthDate: "Date of birth",
  birthYear: "Birth year",
  birthMonth: "Birth month",
  birthDay: "Birth day",
  gender: "Gender",
  emergencyContactName: "Emergency contact name",
  emergencyContactEmail: "Emergency contact email",
  emergencyContactPhone: "Emergency contact phone",
  notes: "Notes",
};

const customerImportFieldOptions = Object.entries(customerImportFieldLabels) as Array<
  [CustomerImportField, string]
>;

function ImportCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-checked={checked}
      aria-label={label}
      role="checkbox"
      className={[
        "grid h-7 w-7 place-items-center rounded-[4px] border transition",
        checked ? "border-black bg-black text-white" : "border-black/30 bg-white text-transparent hover:border-black/45",
      ].join(" ")}
    >
      <Icon name="check" className="h-4 w-4" />
    </button>
  );
}

function CustomerImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (customers: Customer[]) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsedFile, setParsedFile] = useState<ParsedCsvFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CustomerImportField, string>>>({});
  const [excludedHeaders, setExcludedHeaders] = useState<string[]>([]);
  const [optInMarketing, setOptInMarketing] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const enabledHeaders = useMemo(
    () => new Set((parsedFile?.headers ?? []).filter((header) => !excludedHeaders.includes(header))),
    [excludedHeaders, parsedFile]
  );

  const effectiveMapping = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(mapping).filter((entry): entry is [string, string] => {
          const header = entry[1];
          return Boolean(header && enabledHeaders.has(header));
        })
      ) as Partial<Record<CustomerImportField, string>>,
    [enabledHeaders, mapping]
  );

  const mappedFieldByHeader = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(effectiveMapping).map(([field, header]) => [header, field])
      ) as Partial<Record<string, CustomerImportField>>,
    [effectiveMapping]
  );

  const previewCustomers = useMemo(() => {
    if (!parsedFile) return [];
    return buildImportedCustomers(parsedFile.rows, effectiveMapping);
  }, [effectiveMapping, parsedFile]);

  function downloadSampleFile() {
    const rows = [
      [
        "Email",
        "First Name",
        "Last Name",
        "Phone",
        "Address",
        "City",
        "State",
        "Zip",
        "Birth Date",
        "Gender",
        "Notes",
        "Emergency Contact Name",
        "Emergency Contact Number",
        "Emergency Contact Email",
        "Dependent 1 First Name",
        "Dependent 1 Last Name",
        "Dependent 1 Birth Date",
        "Dependent 1 Gender",
        "Dependent 1 Relationship",
        "Dependent 2 First Name",
        "Dependent 2 Last Name",
        "Dependent 2 Birth Date",
        "Dependent 2 Gender",
        "Dependent 2 Relationship",
        "Dependent 3 First Name",
        "Dependent 3 Last Name",
        "Dependent 3 Birth Date",
        "Dependent 3 Gender",
        "Dependent 3 Relationship",
        "Dependent 4 First Name",
        "Dependent 4 Last Name",
        "Dependent 4 Birth Date",
        "Dependent 4 Gender",
        "Dependent 4 Relationship",
      ],
      [
        "mason.reed@example.com",
        "Mason",
        "Reed",
        "941-555-0181",
        "613 Cypress Ave",
        "Venice",
        "FL",
        "34285",
        "2010-07-28",
        "Male",
        "Varsity middle infielder",
        "Allison Reed",
        "941-555-0101",
        "allison@example.com",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "customers-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function acceptFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        throw new Error("The CSV file is empty.");
      }

      const rows = parsed.rows.filter((row) =>
        Object.values(row).some((value) => value.trim() !== "")
      );
      const nextParsed: ParsedCsvFile = {
        fileName: file.name,
        fileSize: file.size,
        headers: parsed.headers,
        rows,
      };

      setParsedFile(nextParsed);
      setMapping(suggestCustomerImportMapping(parsed.headers));
      setExcludedHeaders([]);
      setOptInMarketing(false);
      setError("");
      setStep(1);
    } catch (importError) {
      setError(getErrorMessage(importError, "Could not read that CSV file."));
    }
  }

  function clearFile() {
    setParsedFile(null);
    setMapping({});
    setExcludedHeaders([]);
    setOptInMarketing(false);
    setError("");
    setStep(1);
  }

  function setFieldForHeader(header: string, nextField: string) {
    setMapping((current) => {
      const next = { ...current };

      for (const [field, mappedHeader] of Object.entries(next)) {
        if (mappedHeader === header) {
          delete next[field as CustomerImportField];
        }
      }

      if (!nextField) {
        return next;
      }

      delete next[nextField as CustomerImportField];
      next[nextField as CustomerImportField] = header;
      return next;
    });
  }

  function toggleHeaderIncluded(header: string) {
    setExcludedHeaders((current) =>
      current.includes(header) ? current.filter((item) => item !== header) : [...current, header]
    );
  }

  function canProceedToReview() {
    return Boolean(
      effectiveMapping.name ||
        (effectiveMapping.firstName && effectiveMapping.lastName) ||
        (effectiveMapping.email && effectiveMapping.phone)
    );
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[780px] overflow-hidden rounded-[18px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
          <div>
            <h3 className="text-[18px] font-semibold">Import Your Customers</h3>
            <div className="mt-3 flex items-center gap-3 text-sm">
              {[
                [1, "Upload file"],
                [2, "Map columns"],
                [3, "Review import"],
              ].map(([index, label]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span
                    className={[
                      "grid h-6 w-6 place-items-center rounded-md text-xs font-bold",
                      step === index
                        ? "bg-[#221e1f] text-white"
                        : step > (index as number)
                          ? "bg-black/10 text-black/70"
                          : "bg-black/[0.05] text-black/35",
                    ].join(" ")}
                  >
                    {index}
                  </span>
                  <span className={step >= (index as number) ? "text-black/80" : "text-black/30"}>
                    {label}
                  </span>
                  {index !== 3 ? <span className="text-black/25">{">"}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-black/55 hover:bg-black/[0.03]"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="px-6 py-5">
            <p className="max-w-md text-[15px] leading-7 text-black/70">
              Upload a CSV spreadsheet of your customers to quickly add them into your account.
            </p>
            <button
              type="button"
              onClick={downloadSampleFile}
              className="mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-black/75 hover:text-black"
            >
              <Icon name="download" className="h-4 w-4" />
              Download a sample file
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void acceptFile(file);
                event.currentTarget.value = "";
              }}
            />

            {parsedFile ? (
              <div className="mt-6 rounded-2xl border border-black/12 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-xl border border-black/10 text-black/55">
                      <Icon name="file" className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[16px] font-medium text-black">{parsedFile.fileName}</div>
                      <div className="mt-1 text-sm text-black/45">{formatFileSize(parsedFile.fileSize)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-black/55">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="transition hover:text-black"
                      aria-label="Replace file"
                      title="Replace file"
                    >
                      <Icon name="upload" className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="transition hover:text-black"
                      aria-label="Remove file"
                      title="Remove file"
                    >
                      <Icon name="trash" className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 px-6 py-5">
                    <div className="flex items-center gap-3 text-black/55">
                      <Icon name="table" className="h-5 w-5" />
                      <span className="text-sm">Columns found</span>
                    </div>
                    <div className="mt-5 text-[20px] font-semibold text-black">{parsedFile.headers.length}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 px-6 py-5">
                    <div className="flex items-center gap-3 text-black/55">
                      <Icon name="table" className="h-5 w-5" />
                      <span className="text-sm">Rows found</span>
                    </div>
                    <div className="mt-5 text-[20px] font-semibold text-black">{parsedFile.rows.length}</div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void acceptFile(file);
                }}
                className={[
                  "mt-5 flex min-h-[132px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition",
                  isDragging ? "border-black/35 bg-black/[0.03]" : "border-black/15 hover:bg-black/[0.02]",
                ].join(" ")}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.05] text-black/65">
                  <Icon name="upload" className="h-5 w-5" />
                </span>
                <div className="mt-5 text-base">
                  <strong>Click to upload</strong> or drag and drop
                </div>
                <div className="mt-1 text-sm text-black/45">.CSV file</div>
              </button>
            )}

            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
          </div>
        ) : null}

        {step === 2 && parsedFile ? (
          <div className="px-6 py-5">
            <h4 className="text-[18px] font-semibold text-black">
              {parsedFile.headers.filter((header) => !excludedHeaders.includes(header)).length} columns will be imported
            </h4>
            <p className="mt-2 max-w-[620px] text-[15px] leading-7 text-black/65">
              Upload your customer data by mapping each file column to an equivalent field in Swift.
            </p>

            <div className="mt-6 overflow-auto rounded-2xl border border-black/12">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[1.3fr_64px_1.4fr_64px] border-b border-black/10 bg-white px-6 py-5 text-[15px] font-semibold">
                  <div>File Column</div>
                  <div />
                  <div>Swift Field</div>
                  <div />
                </div>
                <div className="max-h-[440px] overflow-auto">
                  {parsedFile.headers.map((header) => {
                    const checked = !excludedHeaders.includes(header);
                    const selectedField = mappedFieldByHeader[header] ?? "";
                    return (
                      <div
                        key={header}
                        className="grid grid-cols-[1.3fr_64px_1.4fr_64px] items-center gap-0 border-b border-black/10 px-6 py-6 last:border-b-0"
                      >
                        <div className={`truncate pr-4 text-[15px] ${checked ? "text-black/75" : "text-black/30 line-through"}`}>
                          {header}
                        </div>
                        <div className="flex justify-center text-[30px] leading-none text-black/55">
                          <span aria-hidden="true">→</span>
                        </div>
                        <div className="pr-4">
                          <select
                            value={selectedField}
                            onChange={(event) => setFieldForHeader(header, event.target.value)}
                            disabled={!checked}
                            className={[
                              "min-h-12 w-full rounded-lg border border-black/15 px-5 text-[15px] outline-none focus:border-black/30 disabled:bg-black/[0.03] disabled:text-black/35",
                              selectedField ? "text-black not-italic" : "text-black/65 italic",
                            ].join(" ")}
                          >
                            <option value="">Select field...</option>
                            {customerImportFieldOptions.map(([field, label]) => (
                              <option key={field} value={field}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex justify-center">
                          <ImportCheckbox
                            checked={checked}
                            onToggle={() => toggleHeaderIncluded(header)}
                            label={`Include ${header}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="mt-6 flex items-start gap-3 text-[15px] text-black/85">
              <span className="mt-0.5">
                <ImportCheckbox
                  checked={optInMarketing}
                  onToggle={() => setOptInMarketing((current) => !current)}
                  label="Automatically opt-in all customers to receive marketing emails"
                />
              </span>
              <span>Automatically opt-in all customers to receive marketing emails</span>
            </label>
            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
          </div>
        ) : null}

        {step === 3 && parsedFile ? (
          <div className="px-6 py-5">
            <div className="text-[15px] text-black/70">
              Ready to import <strong className="text-black">{previewCustomers.length}</strong> customer
              {previewCustomers.length === 1 ? "" : "s"} from <strong className="text-black">{parsedFile.fileName}</strong>.
            </div>
            <div className="mt-5 rounded-lg border border-black/10">
              <div className="border-b border-black/10 px-4 py-3 text-sm font-semibold">Preview</div>
              <div className="divide-y divide-black/10">
                {previewCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="grid gap-1 px-4 py-3 text-sm">
                    <strong>{customer.name || "Unnamed customer"}</strong>
                    <div className="text-black/60">
                      {[customer.email, customer.phone].filter(Boolean).join(" | ") || "No contact info"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {!previewCustomers.length ? (
              <div className="mt-4 text-sm text-red-600">No importable rows were found with the current mapping.</div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-black/10 bg-black/[0.02] px-6 py-4">
          <button type="button" className="inline-flex items-center gap-3 text-sm font-medium text-black/55 hover:text-black">
            <Icon name="help" className="h-5 w-5" />
            Need help with your import?
          </button>
          <div className="flex gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((current) => (current === 3 ? 2 : 1))}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (step === 1) {
                  if (!parsedFile) {
                    setError("Upload a CSV file to continue.");
                    return;
                  }
                  setStep(2);
                  return;
                }

                if (step === 2) {
                  if (!canProceedToReview()) {
                    setError("Map at least a Name column, or both Email and Phone.");
                    return;
                  }
                  setError("");
                  setStep(3);
                  return;
                }

                onImport(previewCustomers);
              }}
              disabled={(step === 1 && !parsedFile) || (step === 3 && !previewCustomers.length)}
              className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
            >
              {step === 3 ? "Import" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
          address: "",
          phone: "",
          phoneCountry: "US",
          birthYear: "",
          birthMonth: "",
          birthDay: "",
          gender: "",
          age: "",
          memberships: [],
          waiverAgreed: false,
          emergencyContactName: "",
          emergencyContactEmail: "",
          emergencyContactPhone: "",
          familyMembers: [],
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
  const [openCustomerSections, setOpenCustomerSections] = useState<string[]>([]);
  const [showWaiverDialog, setShowWaiverDialog] = useState(false);

  const title = `${modal.id ? "Edit" : "New"} ${modal.type}`;
  const customerDraft = draft as Customer;
  const customerName = modal.type === "customer" ? splitName(customerDraft.name) : { first: "", last: "" };
  const canSave =
    modal.type !== "customer" ||
    Boolean(customerName.first.trim() && customerName.last.trim() && customerDraft.email.trim());

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

  function toggleCustomerSection(section: string) {
    setOpenCustomerSections((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section]
    );
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
              <div className="sm:col-span-2 grid gap-5 sm:grid-cols-[72px_minmax(0,1fr)]">
                <div className="mt-5 grid h-20 w-20 place-items-center rounded-full bg-black/25 text-white">
                  <Icon name="user" className="h-10 w-10" />
                </div>
                <div className="grid gap-4">
                  <div>
                    <div className="mb-2 text-sm font-semibold text-black/70">Name</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={customerName.first}
                        onChange={(event) =>
                          patch({
                            name: joinName(event.target.value, customerName.last),
                            player: joinName(event.target.value, customerName.last),
                          })
                        }
                        placeholder="First name"
                        className="min-h-10 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
                      />
                      <input
                        value={customerName.last}
                        onChange={(event) =>
                          patch({
                            name: joinName(customerName.first, event.target.value),
                            player: joinName(customerName.first, event.target.value),
                          })
                        }
                        placeholder="Last name"
                        className="min-h-10 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
                      />
                    </div>
                  </div>
                  <TextField label="Email" type="email" value={customerDraft.email} onChange={(value) => patch({ email: value })} />
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold">Liability Waiver</div>
                  <div className="text-sm text-black/55">{customerDraft.waiverAgreed ? "Agreed" : "Not agreed"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold",
                      customerDraft.waiverAgreed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {customerDraft.waiverAgreed ? "Agreed" : "Not agreed"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowWaiverDialog(true)}
                    className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/[0.03]"
                  >
                    Agree to Waiver
                  </button>
                </div>
              </div>

              <CustomerSection
                title="Personal Information"
                open={openCustomerSections.includes("personal")}
                onToggle={() => toggleCustomerSection("personal")}
              >
                <div className="sm:col-span-2">
                  <div className="mb-3 text-sm font-semibold text-black/75">Date of Birth</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField
                      label="Year"
                      value={customerDraft.birthYear}
                      placeholder="ex: 1994"
                      onChange={(value) =>
                        patch({
                          birthYear: value.replace(/\D/g, "").slice(0, 4),
                          age:
                            calculateAge(
                              value.replace(/\D/g, "").slice(0, 4),
                              customerDraft.birthMonth,
                              customerDraft.birthDay
                            ) || "",
                        })
                      }
                    />
                    <TextField
                      label="Month"
                      value={customerDraft.birthMonth}
                      placeholder="ex: 07"
                      onChange={(value) =>
                        patch({
                          birthMonth: value.replace(/\D/g, "").slice(0, 2),
                          age:
                            calculateAge(
                              customerDraft.birthYear,
                              value.replace(/\D/g, "").slice(0, 2),
                              customerDraft.birthDay
                            ) || "",
                        })
                      }
                    />
                    <TextField
                      label="Day"
                      value={customerDraft.birthDay}
                      placeholder="ex: 28"
                      onChange={(value) =>
                        patch({
                          birthDay: value.replace(/\D/g, "").slice(0, 2),
                          age:
                            calculateAge(
                              customerDraft.birthYear,
                              customerDraft.birthMonth,
                              value.replace(/\D/g, "").slice(0, 2)
                            ) || "",
                        })
                      }
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-black/70">Gender</span>
                    <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-medium text-black/60">
                      Optional
                    </span>
                  </div>
                  <select
                    value={customerDraft.gender}
                    onChange={(event) => patch({ gender: event.target.value })}
                    className="min-h-12 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
                  >
                    <option value=""></option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-sm font-semibold text-black/70">Notes</span>
                  <NotesEditor
                    value={customerDraft.notes}
                    onChange={(value) => patch({ notes: value })}
                  />
                </div>
              </CustomerSection>

              <CustomerSection
                title="Contact Information"
                open={openCustomerSections.includes("contact")}
                onToggle={() => toggleCustomerSection("contact")}
              >
                <div className="sm:col-span-2 grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-black/70">Address</span>
                    <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-medium text-black/60">
                      Optional
                    </span>
                  </div>
                  <input
                    value={customerDraft.address}
                    onChange={(event) => patch({ address: event.target.value })}
                    placeholder="Enter a location"
                    className="min-h-12 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
                  />
                </div>

                <div className="sm:col-span-2 grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-black/70">Phone</span>
                    <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-medium text-black/60">
                      Optional
                    </span>
                  </div>
                  <input
                    value={customerDraft.phone}
                    onChange={(event) => patch({ phone: event.target.value })}
                    placeholder="123-456-7890"
                    className="min-h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-black/30"
                  />
                </div>
              </CustomerSection>

              <CustomerSection
                title="Emergency Contact"
                open={openCustomerSections.includes("emergency")}
                onToggle={() => toggleCustomerSection("emergency")}
              >
                <TextField
                  label="Name"
                  value={customerDraft.emergencyContactName}
                  onChange={(value) => patch({ emergencyContactName: value })}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={customerDraft.emergencyContactEmail}
                  onChange={(value) => patch({ emergencyContactEmail: value })}
                />
                <TextField
                  label="Phone"
                  value={customerDraft.emergencyContactPhone}
                  onChange={(value) => patch({ emergencyContactPhone: value })}
                  placeholder="123-456-7890"
                />
              </CustomerSection>
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
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
          >
            Save
          </button>
        </div>
      </div>

      {modal.type === "customer" && showWaiverDialog ? (
        <WaiverDialog
          title={`Agree to our liability waiver`}
          intro={state.policies.waiverIntro}
          documentName={state.policies.waiverDocumentName}
          documentUrl={state.policies.waiverDocumentUrl}
          onClose={() => setShowWaiverDialog(false)}
          onAgree={() => {
            patch({ waiverAgreed: true });
            setShowWaiverDialog(false);
          }}
        />
      ) : null}
    </div>
  );
}

function WaiverDialog({
  title,
  intro,
  documentName,
  documentUrl,
  onClose,
  onAgree,
}: {
  title: string;
  intro: string;
  documentName: string;
  documentUrl: string;
  onClose: () => void;
  onAgree: () => void;
}) {
  const previewUrl = documentUrl
    ? documentUrl.includes("#")
      ? documentUrl
      : `${documentUrl}#toolbar=0&navpanes=0&scrollbar=1`
    : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[660px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between border-b border-black/10 px-8 py-7">
          <div className="pr-6">
            <h3 className="text-[26px] font-medium leading-none">{title}</h3>
            <p className="mt-6 max-w-[520px] text-[15px] leading-8 text-black/80">{intro}</p>
            {documentUrl ? (
              <a
                href={documentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex text-[15px] font-medium text-black/75 underline underline-offset-2"
              >
                Open waiver in new tab
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-black/10 text-black/55 transition hover:bg-black/[0.03] hover:text-black"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-[500px] flex-1 overflow-hidden border-b border-black/10 bg-white">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title={documentName || "Liability waiver"}
              className="h-full min-h-[500px] w-full"
            />
          ) : (
            <div className="flex h-full min-h-[500px] items-center justify-center px-8 text-center text-sm text-black/55">
              Add a waiver document URL in Settings &gt; Booking &gt; Policies to preview it here.
            </div>
          )}
        </div>

        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onAgree}
            className="w-full rounded-md bg-[#221e1f] px-4 py-4 text-[16px] font-semibold text-white shadow-sm"
          >
            Agree & Continue
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
