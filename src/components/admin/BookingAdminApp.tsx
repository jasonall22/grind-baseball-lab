"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  rooms: string[];
  category: ServiceSection;
  status: "Active" | "Draft" | "Off";
  previewText?: string;
  description?: string;
  mediaUrl?: string;
  calendarColor: string;
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
  serviceName?: string;
  calendarColor?: string;
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

type ServiceSection =
  | "rentals"
  | "lessons"
  | "camps"
  | "classes"
  | "memberships"
  | "packages";

type RentalPriceRow = {
  id: string;
  duration: string;
  price: string;
};

type RentalDraft = {
  name: string;
  previewText: string;
  description: string;
  mediaUrl: string;
  defaultPricing: RentalPriceRow[];
  membershipPricing: RentalPriceRow[];
  selectedRooms: string[];
  reserveOnPurchase: "any" | "all";
  reserveEquipment: boolean;
  collectTax: boolean;
  collectFee: boolean;
  slotRestrictionSummary: string;
  serviceScheduleEnabled: boolean;
  emergencyContactInfo: boolean;
  customFieldsSummary: string;
  private: boolean;
  calendarColor: string;
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
  organization_name: string | null;
  country_region: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  phone: string | null;
  public_calendar_enabled: boolean | null;
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
  resource_names: string[] | null;
  service_type: ServiceSection | null;
  status: Service["status"];
  sort_order: number;
  calendar_color: string | null;
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
    organizationName: string;
    country: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateRegion: string;
    postalCode: string;
    phone: string;
    publicFacingCalendar: boolean;
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
  | { type: "booking"; id?: string; seed?: Partial<Booking> }
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
type SettingsSection = "basics" | "rooms" | "policies";

type RoomEditorDraft = {
  name: string;
  schedule: string;
  parentRoom: string;
};

type PreviewDevice = "mobile" | "tablet" | "desktop";

const previewDevicePresets: Record<
  PreviewDevice,
  { label: string; width: number; height: number }
> = {
  mobile: { label: "Mobile", width: 430, height: 932 },
  tablet: { label: "Tablet", width: 820, height: 1180 },
  desktop: { label: "Desktop", width: 1366, height: 900 },
};

const rentalDurationOptions = Array.from({ length: 32 }, (_, index) => String((index + 1) * 15));
const DEFAULT_SERVICE_CALENDAR_COLOR = "#4e7cb5";
const serviceCalendarColorOptions = [
  "#4e7cb5",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#111827",
  "#eab308",
  "#ec4899",
];

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

const serviceSectionItems: { key: ServiceSection; label: string; icon: IconName }[] = [
  { key: "rentals", label: "Rentals", icon: "clock" },
  { key: "lessons", label: "Lessons", icon: "user" },
  { key: "camps", label: "Camps", icon: "calendar" },
  { key: "classes", label: "Classes", icon: "user" },
  { key: "memberships", label: "Memberships", icon: "table" },
  { key: "packages", label: "Packages", icon: "bag" },
];

const WAIVER_BUCKET_PRIMARY =
  (process.env.NEXT_PUBLIC_BOOKING_WAIVER_BUCKET &&
    process.env.NEXT_PUBLIC_BOOKING_WAIVER_BUCKET.trim()) ||
  "booking-waivers";
const WAIVER_BUCKET_CANDIDATES = Array.from(
  new Set([WAIVER_BUCKET_PRIMARY, "booking-waivers", "booking-waiver", "waivers"].filter(Boolean))
);
const MAX_WAIVER_FILE_BYTES = 2 * 1024 * 1024;
const countryRegionOptions = ["United States"];
const usStateOptions = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

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
      {
        label: "Rooms",
        icon: "home",
        href: bookingAdminRouteByView["settings-rooms"],
        section: "rooms",
      },
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
    address: "613 Cypress Ave, Venice, FL 34285",
    organizationName: "The Grind Baseball Lab",
    country: "United States",
    addressLine1: "613 Cypress Ave",
    addressLine2: "",
    city: "Venice",
    stateRegion: "Florida",
    postalCode: "34285",
    phone: "(941) 525-0880",
    publicFacingCalendar: false,
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
      rooms: ["Cage 1"],
      category: "lessons",
      status: "Active",
      calendarColor: "#f97316",
    },
    {
      id: "svc-pitching",
      name: "Pitching Lesson",
      duration: 45,
      price: 75,
      resource: "Pitching Lane",
      rooms: ["Pitching Lane"],
      category: "lessons",
      status: "Active",
      calendarColor: "#10b981",
    },
    {
      id: "svc-cage-rental",
      name: "Cage Rental",
      duration: 30,
      price: 35,
      resource: "Cage 2",
      rooms: ["Cage 2"],
      category: "rentals",
      status: "Active",
      calendarColor: DEFAULT_SERVICE_CALENDAR_COLOR,
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
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function normalizeCalendarColor(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return DEFAULT_SERVICE_CALENDAR_COLOR;
}

function isLightCalendarColor(value: string) {
  const normalized = normalizeCalendarColor(value);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.65;
}

function normalizeService(service: Service): Service {
  return {
    ...service,
    calendarColor: normalizeCalendarColor(service.calendarColor),
  };
}

function normalizeServices(services: Service[]) {
  return services.map(normalizeService);
}

function normalizeBookings(bookings: Booking[], services: Service[]) {
  const servicesById = new Map(normalizeServices(services).map((service) => [service.id, service]));
  return bookings.map((booking) => {
    const service = servicesById.get(booking.serviceId);
    return {
      ...booking,
      serviceName: service?.name ?? booking.serviceName ?? "",
      calendarColor: normalizeCalendarColor(service?.calendarColor ?? booking.calendarColor),
    };
  });
}

function slugifyFileNameStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const slug = stem
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "waiver";
}

function composeFacilityAddress(facility: AppState["facility"]) {
  const cityLine = [facility.city, facility.stateRegion].filter(Boolean).join(", ");
  const finalLine = [cityLine, facility.postalCode].filter(Boolean).join(" ").trim();

  return [facility.addressLine1, facility.addressLine2, finalLine]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function parseLegacyFacilityAddress(address: string) {
  const trimmed = address.trim();
  if (!trimmed) {
    return {
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateRegion: "",
      postalCode: "",
    };
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const addressLine1 = parts[0] ?? "";
  const addressLine2 = parts.length > 3 ? parts[1] ?? "" : "";
  const locationPart = parts[parts.length > 2 ? parts.length - 2 : 1] ?? "";
  const city = parts.length > 1 ? locationPart : "";
  const stateZipPart = parts[parts.length - 1] ?? "";
  const stateZipMatch = stateZipPart.match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/);

  return {
    addressLine1,
    addressLine2,
    city,
    stateRegion: stateZipMatch ? stateZipMatch[1].trim() : stateZipPart,
    postalCode: stateZipMatch ? stateZipMatch[2].trim() : "",
  };
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

function getRoomEditorHref(roomName: string, resourceIdsByName: Record<string, string>) {
  const roomId = resourceIdsByName[roomName];
  return `/admin/settings/rooms/${roomId ?? encodeURIComponent(roomName)}`;
}

function renameRoomReferences(state: AppState, currentName: string, nextName: string): AppState {
  if (currentName === nextName) return state;

  return {
    ...state,
    resources: state.resources.map((resource) => (resource === currentName ? nextName : resource)),
    services: state.services.map((service) => ({
      ...service,
      resource: service.resource === currentName ? nextName : service.resource,
      rooms: service.rooms.map((room) => (room === currentName ? nextName : room)),
    })),
    bookings: state.bookings.map((booking) => ({
      ...booking,
      resource: booking.resource === currentName ? nextName : booking.resource,
    })),
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
    address: composeFacilityAddress(facility),
    organization_name: facility.organizationName,
    country_region: facility.country,
    address_line_1: facility.addressLine1,
    address_line_2: facility.addressLine2 || null,
    city: facility.city,
    state_region: facility.stateRegion,
    postal_code: facility.postalCode,
    phone: facility.phone,
    public_calendar_enabled: facility.publicFacingCalendar,
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
    const roomNames = item.rooms?.length ? item.rooms : item.resource ? [item.resource] : [];
    const { error } = await supabase.from("booking_services").upsert({
      id: item.id,
      name: item.name,
      duration_minutes: item.duration,
      price: item.price,
      resource_id: resourceIdsByName[roomNames[0] ?? item.resource] || null,
      resource_names: roomNames,
      service_type: item.category,
      status: item.status,
      calendar_color: normalizeCalendarColor(item.calendarColor),
    });
    if (error) throw error;
  }

  if (change.type === "booking") {
    const item = change.item;
    const resourceId = resourceIdsByName[item.resource] || null;

    if (resourceId && item.status !== "Cancelled") {
      const existingBookings = await supabase
        .from("booking_bookings")
        .select("id,start_time,end_time,status")
        .eq("booking_date", item.date)
        .eq("resource_id", resourceId)
        .neq("status", "Cancelled");

      if (existingBookings.error) throw existingBookings.error;

      const overlappingBooking = (existingBookings.data ?? []).some((booking) => {
        if (booking.id === item.id) return false;

        return bookingTimesOverlap(
          normalizeTime(booking.start_time),
          normalizeTime(booking.end_time),
          item.start,
          item.end
        );
      });

      if (overlappingBooking) {
        throw new Error("This room is already booked for that time.");
      }
    }

    const { error } = await supabase.from("booking_bookings").upsert({
      id: item.id,
      booking_date: item.date,
      start_time: item.start,
      end_time: item.end,
      customer_id: item.customerId || null,
      service_id: item.serviceId || null,
      resource_id: resourceId,
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

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function formatCalendarHeading(value: string) {
  const date = parseLocalDate(value);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "2-digit",
  });
}

function weekdayName(value: string) {
  return parseLocalDate(value).toLocaleDateString("en-US", { weekday: "long" });
}

function weekDates(value: string) {
  const date = parseLocalDate(value);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return isoDate(next);
  });
}

function availabilityForDate(availability: AppState["availability"], value: string) {
  const dayName = weekdayName(value);
  return availability.find(([name]) => name === dayName) ?? [dayName, false, "00:00", "23:59"];
}

function closedBlocksForDate(availability: AppState["availability"], value: string) {
  const [, isOpen, openStart, openEnd] = availabilityForDate(availability, value);

  if (!isOpen) {
    return [{ start: 0, end: 1439 }];
  }

  const blocks: Array<{ start: number; end: number }> = [];
  const startMinutes = timeToMinutes(openStart);
  const endMinutes = Math.min(1439, timeToMinutes(openEnd));

  if (startMinutes > 0) blocks.push({ start: 0, end: startMinutes });
  if (endMinutes < 1439) blocks.push({ start: endMinutes, end: 1439 });
  return blocks;
}

function calendarScrollOffsetForTime(now: Date, slotHeight: number) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rawOffset = (minutes / 30) * slotHeight - slotHeight * 2;
  return Math.max(0, rawOffset);
}

function calendarScrollOffsetForAvailabilityStart(
  availability: AppState["availability"],
  date: string,
  slotHeight: number
) {
  const [, isOpen, openStart] = availabilityForDate(availability, date);
  if (!isOpen) return 0;

  const openStartMinutes = timeToMinutes(openStart);
  const rawOffset = (openStartMinutes / 30) * slotHeight - slotHeight;
  return Math.max(0, rawOffset);
}

function bookingTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  const startAMinutes = timeToMinutes(startA);
  const endAMinutes = timeToMinutes(endA);
  const startBMinutes = timeToMinutes(startB);
  const endBMinutes = timeToMinutes(endB);

  return startAMinutes < endBMinutes && startBMinutes < endAMinutes;
}

function hasRoomBookingConflict(bookings: Booking[], candidate: Booking) {
  if (!candidate.resource || candidate.status === "Cancelled") return false;

  return bookings.some((booking) => {
    if (booking.id === candidate.id) return false;
    if (booking.status === "Cancelled") return false;
    if (booking.date !== candidate.date) return false;
    if (booking.resource !== candidate.resource) return false;

    return bookingTimesOverlap(booking.start, booking.end, candidate.start, candidate.end);
  });
}

function isBookingConflictMessage(message: string) {
  return message.toLowerCase().includes("already booked");
}

function bookingTonePresentation(booking: Booking, service?: Service | null) {
  if (booking.status === "Cancelled") {
    return {
      containerClass: "bg-[#6b7280] text-white",
      timeClass: "text-white/80",
      subClass: "text-white/85",
      borderClass: "border-black/20",
      style: undefined,
    };
  }

  if (booking.status === "Pending") {
    return {
      containerClass: "bg-[#d97706] text-white",
      timeClass: "text-white/80",
      subClass: "text-white/85",
      borderClass: "border-black/20",
      style: undefined,
    };
  }

  const backgroundColor = normalizeCalendarColor(service?.calendarColor ?? booking.calendarColor);
  const isLight = isLightCalendarColor(backgroundColor);

  return {
    containerClass: isLight ? "text-black" : "text-white",
    timeClass: isLight ? "text-black/65" : "text-white/80",
    subClass: isLight ? "text-black/72" : "text-white/85",
    borderClass: isLight ? "border-black/12" : "border-black/20",
    style: { backgroundColor },
  };
}

function bookingStatusBadge(booking: Booking) {
  if (booking.status === "Cancelled") {
    return {
      label: "Cancelled",
      className: "bg-white/15 text-white ring-1 ring-white/20",
    };
  }

  if (booking.status === "Pending") {
    return {
      label: "Pending",
      className: "bg-white/15 text-white ring-1 ring-white/20",
    };
  }

  return null;
}

function findServiceForCalendarSlot(services: Service[], resource: string, durationMinutes: number) {
  const normalizedResource = resource.trim().toLowerCase();
  const activeServices = services.filter((service) => service.status === "Active");
  const exactRentalMatch = activeServices.find((service) => {
    const rooms = service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [];
    return (
      service.category === "rentals" &&
      service.duration === durationMinutes &&
      rooms.some((room) => room.trim().toLowerCase() === normalizedResource)
    );
  });

  if (exactRentalMatch) return exactRentalMatch;

  const exactAnyMatch = activeServices.find((service) => {
    const rooms = service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [];
    return (
      service.duration === durationMinutes &&
      rooms.some((room) => room.trim().toLowerCase() === normalizedResource)
    );
  });

  if (exactAnyMatch) return exactAnyMatch;

  return activeServices.find((service) => {
    const rooms = service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [];
    return rooms.some((room) => room.trim().toLowerCase() === normalizedResource);
  });
}

function bookingDurationMinutes(booking: Pick<Booking, "start" | "end">) {
  return Math.max(30, timeToMinutes(booking.end) - timeToMinutes(booking.start));
}

type MobileCalendarTimelineSegment =
  | { type: "closed"; start: number; end: number }
  | { type: "available"; start: number; end: number }
  | { type: "booking"; start: number; end: number; booking: Booking };

function buildMobileCalendarTimeline(
  bookings: Booking[],
  availability: AppState["availability"],
  date: string
): MobileCalendarTimelineSegment[] {
  function pushAvailableBlocks(segments: MobileCalendarTimelineSegment[], start: number, end: number) {
    let nextStart = start;
    while (nextStart < end) {
      const nextEnd = Math.min(end, nextStart + 30);
      segments.push({ type: "available", start: nextStart, end: nextEnd });
      nextStart = nextEnd;
    }
  }

  const [, isOpen, openStart, openEnd] = availabilityForDate(availability, date);

  if (!isOpen) {
    return [{ type: "closed", start: 0, end: 1439 }];
  }

  const startMinutes = Math.max(0, timeToMinutes(openStart));
  const endMinutes = Math.min(1439, timeToMinutes(openEnd));
  const segments: MobileCalendarTimelineSegment[] = [];
  const sortedBookings = [...bookings].sort(
    (a, b) =>
      timeToMinutes(a.start) - timeToMinutes(b.start) ||
      timeToMinutes(a.end) - timeToMinutes(b.end)
  );

  if (startMinutes > 0) {
    segments.push({ type: "closed", start: 0, end: startMinutes });
  }

  let cursor = startMinutes;

  for (const booking of sortedBookings) {
    const bookingStart = Math.max(startMinutes, timeToMinutes(booking.start));
    const bookingEnd = Math.min(endMinutes, Math.max(bookingStart + 30, timeToMinutes(booking.end)));

    if (bookingEnd <= startMinutes || bookingStart >= endMinutes) {
      continue;
    }

    if (bookingStart > cursor) {
      pushAvailableBlocks(segments, cursor, bookingStart);
    }

    segments.push({
      type: "booking",
      start: Math.max(cursor, bookingStart),
      end: bookingEnd,
      booking,
    });

    cursor = Math.max(cursor, bookingEnd);
  }

  if (cursor < endMinutes) {
    pushAvailableBlocks(segments, cursor, endMinutes);
  }

  if (endMinutes < 1439) {
    segments.push({ type: "closed", start: endMinutes, end: 1439 });
  }

  return segments.filter((segment) => segment.end > segment.start);
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
    const parsed = { ...defaultState, ...JSON.parse(raw) } as AppState;
    const services = normalizeServices(parsed.services ?? defaultState.services);
    return {
      ...parsed,
      services,
      bookings: normalizeBookings(parsed.bookings ?? defaultState.bookings, services),
    };
  } catch {
    return defaultState;
  }
}

function createRentalDraft(resources: string[]): RentalDraft {
  return {
    name: "",
    previewText: "",
    description: "",
    mediaUrl: "",
    defaultPricing: [{ id: makeId("price"), duration: "", price: "" }],
    membershipPricing: [],
    selectedRooms: resources,
    reserveOnPurchase: "any",
    reserveEquipment: false,
    collectTax: false,
    collectFee: false,
    slotRestrictionSummary: "No slot restrictions",
    serviceScheduleEnabled: false,
    emergencyContactInfo: false,
    customFieldsSummary: "No custom fields",
    private: false,
    calendarColor: DEFAULT_SERVICE_CALENDAR_COLOR,
  };
}

function createRentalDraftFromService(service: Service): RentalDraft {
  return {
    name: service.name,
    previewText: service.previewText ?? "",
    description: service.description ?? "",
    mediaUrl: service.mediaUrl ?? "",
    defaultPricing: [{ id: makeId("price"), duration: String(service.duration || 30), price: String(service.price || 0) }],
    membershipPricing: [],
    selectedRooms: service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [],
    reserveOnPurchase: "any",
    reserveEquipment: false,
    collectTax: false,
    collectFee: false,
    slotRestrictionSummary: "No slot restrictions",
    serviceScheduleEnabled: false,
    emergencyContactInfo: false,
    customFieldsSummary: "No custom fields",
    private: service.status !== "Active",
    calendarColor: normalizeCalendarColor(service.calendarColor),
  };
}

function getRentalDeleteGuard(service: Service, state: AppState) {
  const hasBookings = state.bookings.some(
    (booking) => booking.serviceId === service.id && booking.status !== "Cancelled"
  );
  if (hasBookings) {
    return "This rental can't be deleted because it's tied to existing bookings.";
  }

  const normalizedName = service.name.trim().toLowerCase();
  const hasAvailableCredits = state.customers.some((customer) =>
    customer.memberships.some((membership) => membership.trim().toLowerCase() === normalizedName)
  );
  if (hasAvailableCredits) {
    return "This rental can't be deleted because it's tied to available credits.";
  }

  return null;
}

function inferServiceCategory(name: string): ServiceSection {
  const value = name.toLowerCase();
  if (value.includes("lesson")) return "lessons";
  if (value.includes("camp")) return "camps";
  if (value.includes("class")) return "classes";
  if (value.includes("membership")) return "memberships";
  if (value.includes("package")) return "packages";
  return "rentals";
}

function reorderServicesByVisibleList(
  services: Service[],
  visibleServiceIds: string[],
  serviceId: string,
  direction: "up" | "down"
) {
  const currentIndex = visibleServiceIds.indexOf(serviceId);
  const targetIndex = currentIndex + (direction === "up" ? -1 : 1);

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visibleServiceIds.length) {
    return services;
  }

  const nextVisibleIds = [...visibleServiceIds];
  [nextVisibleIds[currentIndex], nextVisibleIds[targetIndex]] = [
    nextVisibleIds[targetIndex],
    nextVisibleIds[currentIndex],
  ];

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const visibleSet = new Set(visibleServiceIds);
  let visibleIndex = 0;

  return services.map((service) => {
    if (!visibleSet.has(service.id)) return service;
    const nextService = servicesById.get(nextVisibleIds[visibleIndex]);
    visibleIndex += 1;
    return nextService ?? service;
  });
}

function moveListItem<T>(items: T[], index: number, direction: "up" | "down") {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export default function BookingAdminApp({
  view = "home",
  selectedCustomerId,
  selectedServiceId,
  selectedRoomId,
}: {
  view?: BookingAdminView;
  selectedCustomerId?: string;
  selectedServiceId?: string;
  selectedRoomId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeDate, setActiveDate] = useState(() => isoDate(new Date()));
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [serviceSection, setServiceSection] = useState<ServiceSection>("rentals");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice | null>(null);
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");
  const [isRemoteLoading, setIsRemoteLoading] = useState(hasSupabaseEnv);
  const [resourceIdsByName, setResourceIdsByName] = useState<Record<string, string>>({});
  const [backToAppHref, setBackToAppHref] = useState(bookingAdminRouteByView.home);
  const [showCustomerImport, setShowCustomerImport] = useState(false);
  const [bookingConflictDialog, setBookingConflictDialog] = useState<string | null>(null);
  const isRentalAddPage = pathname === "/admin/services/rentals/add";
  const isRentalEditPage = Boolean(selectedServiceId && /^\/admin\/services\/rentals\/[^/]+$/.test(pathname));
  const isRoomEditPage = Boolean(selectedRoomId && /^\/admin\/settings\/rooms\/[^/]+$/.test(pathname) && !pathname.endsWith("/add"));

  const roomNamesById = useMemo(
    () => new Map(Object.entries(resourceIdsByName).map(([name, id]) => [id, name])),
    [resourceIdsByName]
  );
  const selectedRoomName = useMemo(() => {
    if (!selectedRoomId) return null;

    const matchedById = roomNamesById.get(selectedRoomId);
    if (matchedById) return matchedById;

    const decodedId = decodeURIComponent(selectedRoomId);
    return state.resources.find((resource) => resource === decodedId) ?? null;
  }, [roomNamesById, selectedRoomId, state.resources]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const showBookingConflictDialog = useCallback((message?: string) => {
    setBookingConflictDialog(
      message?.trim() || "This room is already booked for that time. Please choose another time or another room."
    );
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/admin/services")) return;
    if (pathname.startsWith("/admin/services/rentals")) {
      setServiceSection("rentals");
    }
  }, [pathname]);

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
      const serviceMetaById = new Map(
        serviceRows.map((service) => [
          service.id,
          {
            name: service.name,
            calendarColor: normalizeCalendarColor(service.calendar_color),
          },
        ])
      );
      const availabilityOrder = new Map(defaultState.availability.map(([day], index) => [day, index]));

      setResourceIdsByName(idsByName);
      const legacyAddress = parseLegacyFacilityAddress(settings?.address ?? defaultState.facility.address);
      const fallbackAddressLine1 = legacyAddress.addressLine1 || defaultState.facility.addressLine1;
      const fallbackAddressLine2 = legacyAddress.addressLine2 || defaultState.facility.addressLine2;
      const fallbackCity = legacyAddress.city || defaultState.facility.city;
      const fallbackStateRegion = legacyAddress.stateRegion || defaultState.facility.stateRegion;
      const fallbackPostalCode = legacyAddress.postalCode || defaultState.facility.postalCode;

      setState({
        facility: {
          name: settings?.facility_name ?? defaultState.facility.name,
          publicUrl: settings?.public_url ?? defaultState.facility.publicUrl,
          timezone: settings?.timezone ?? defaultState.facility.timezone,
          address: settings?.address ?? defaultState.facility.address,
          organizationName: settings?.organization_name ?? defaultState.facility.organizationName,
          country: settings?.country_region ?? defaultState.facility.country,
          addressLine1: settings?.address_line_1 ?? fallbackAddressLine1,
          addressLine2: settings?.address_line_2 ?? fallbackAddressLine2,
          city: settings?.city ?? fallbackCity,
          stateRegion: settings?.state_region ?? fallbackStateRegion,
          postalCode: settings?.postal_code ?? fallbackPostalCode,
          phone: settings?.phone ? formatUsPhoneInput(settings.phone) : defaultState.facility.phone,
          publicFacingCalendar: settings?.public_calendar_enabled ?? defaultState.facility.publicFacingCalendar,
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
          resource:
            (service.resource_names && service.resource_names[0]) ||
            (service.resource_id ? namesById.get(service.resource_id) ?? "" : ""),
          rooms:
            service.resource_names && service.resource_names.length
              ? service.resource_names
              : service.resource_id
                ? [namesById.get(service.resource_id) ?? ""].filter(Boolean)
              : [],
          category: service.service_type ?? inferServiceCategory(service.name),
          status: service.status,
          calendarColor: normalizeCalendarColor(service.calendar_color),
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
          serviceName: booking.service_id ? serviceMetaById.get(booking.service_id)?.name ?? "" : "",
          calendarColor: booking.service_id
            ? serviceMetaById.get(booking.service_id)?.calendarColor ?? DEFAULT_SERVICE_CALENDAR_COLOR
            : DEFAULT_SERVICE_CALENDAR_COLOR,
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
    const normalizedNext = {
      ...next,
      facility: {
        ...next.facility,
        address: composeFacilityAddress(next.facility),
      },
    };

    if (dataSource === "local") {
      saveLocal(normalizedNext, "Settings saved.");
      return;
    }

    setState(normalizedNext);

    try {
      await upsertFacilitySettings(normalizedNext.facility, normalizedNext.policies);
      const resources = await upsertResources(normalizedNext.resources);
      setResourceIdsByName(resourceLookup(resources).idsByName);
      showToast("Settings saved.");
    } catch (error) {
      console.error(error);
      showToast("Settings could not be saved.");
    }
  }

  async function renameRoomInSupabase(currentName: string, nextName: string) {
    const resourceId = resourceIdsByName[currentName];
    if (!resourceId) {
      throw new Error("Could not find the selected room in Supabase.");
    }

    const renamedResource = await supabase
      .from("booking_resources")
      .update({ name: nextName })
      .eq("id", resourceId);

    if (renamedResource.error) throw renamedResource.error;

    const servicesResult = await supabase
      .from("booking_services")
      .select("id,resource_names")
      .contains("resource_names", [currentName]);

    if (servicesResult.error) throw servicesResult.error;

    const changedRows = ((servicesResult.data ?? []) as Array<{ id: string; resource_names: string[] | null }>)
      .filter((row) => row.resource_names?.includes(currentName))
      .map((row) => ({
        id: row.id,
        resource_names: (row.resource_names ?? []).map((name) => (name === currentName ? nextName : name)),
      }));

    if (changedRows.length) {
      const updateResults = await Promise.all(
        changedRows.map((row) =>
          supabase.from("booking_services").update({ resource_names: row.resource_names }).eq("id", row.id)
        )
      );

      const failedUpdate = updateResults.find((result) => result.error);
      if (failedUpdate?.error) throw failedUpdate.error;
    }

    setResourceIdsByName((current) => {
      const next = { ...current };
      delete next[currentName];
      next[nextName] = resourceId;
      return next;
    });
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

    const previousState = state;
    setState(next);

    try {
      await upsertModalChange(change, resourceIdsByName);
      setModal(null);
      showToast(message);
    } catch (error) {
      console.error(error);
      setState(previousState);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      if (change.type === "booking" && isBookingConflictMessage(errorMessage)) {
        showBookingConflictDialog(errorMessage);
        return;
      }
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function saveCustomerDetail(item: Customer, message: string) {
    const previousState = state;
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
      setState(previousState);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function saveRentalDraft(rentalDraft: RentalDraft, existingService?: Service | null) {
    const firstDefaultPrice = rentalDraft.defaultPricing[0];
    const item: Service = {
      id: existingService?.id ?? makeId("svc"),
      name: rentalDraft.name.trim(),
      duration: Number(firstDefaultPrice?.duration || 30),
      price: Number(firstDefaultPrice?.price || 0),
      resource: rentalDraft.selectedRooms[0] ?? "",
      rooms: rentalDraft.selectedRooms,
      category: existingService?.category ?? "rentals",
      status: rentalDraft.private ? "Off" : existingService?.status === "Draft" ? "Draft" : "Active",
      previewText: rentalDraft.previewText,
      description: rentalDraft.description,
      mediaUrl: rentalDraft.mediaUrl,
      calendarColor: normalizeCalendarColor(rentalDraft.calendarColor),
    };
    const next = { ...state, services: upsert(state.services, item) };
    const successMessage = existingService ? "Rental updated." : "Rental saved.";

    if (dataSource === "local") {
      saveLocal(next, successMessage);
      router.push("/admin/services/rentals");
      return;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "service", item }, resourceIdsByName);
      showToast(successMessage);
      router.push("/admin/services/rentals");
    } catch (error) {
      console.error(error);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function duplicateRental(service: Service) {
    const duplicate: Service = {
      ...service,
      id: makeId("svc"),
      name: `${service.name} Copy`,
    };
    const next = { ...state, services: upsert(state.services, duplicate) };

    if (dataSource === "local") {
      saveLocal(next, "Rental duplicated.");
      router.push(`/admin/services/rentals/${duplicate.id}`);
      return;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "service", item: duplicate }, resourceIdsByName);
      showToast("Rental duplicated.");
      router.push(`/admin/services/rentals/${duplicate.id}`);
    } catch (error) {
      console.error(error);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function deleteRental(service: Service) {
    const guardMessage = getRentalDeleteGuard(service, state);
    if (guardMessage) {
      showToast(guardMessage);
      return;
    }

    const confirmed = window.confirm("Delete this rental? This cannot be undone.");
    if (!confirmed) return;

    const previousState = state;
    const next = {
      ...state,
      services: state.services.filter((item) => item.id !== service.id),
    };

    if (dataSource === "local") {
      saveLocal(next, "Rental deleted.");
      router.push("/admin/services/rentals");
      return;
    }

    setState(next);

    try {
      const { error } = await supabase.from("booking_services").delete().eq("id", service.id);
      if (error) throw error;
      showToast("Rental deleted.");
      router.push("/admin/services/rentals");
    } catch (error) {
      console.error(error);
      setState(previousState);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function copyRentalBookingLink() {
    try {
      await navigator.clipboard.writeText(state.facility.publicUrl);
      showToast("Booking link copied.");
    } catch (error) {
      console.error(error);
      showToast("Booking link could not be copied.");
    }
  }

  async function reorderServices(
    visibleServiceIds: string[],
    serviceId: string,
    direction: "up" | "down"
  ) {
    const nextServices = reorderServicesByVisibleList(state.services, visibleServiceIds, serviceId, direction);
    if (nextServices === state.services) return;

    const previousState = state;
    const next = { ...state, services: nextServices };

    if (dataSource === "local") {
      saveLocal(next, "Service order updated.");
      return;
    }

    setState(next);

    try {
      const results = await Promise.all(
        nextServices.map((service, index) =>
          supabase.from("booking_services").update({ sort_order: index + 1 }).eq("id", service.id)
        )
      );
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      showToast("Service order updated.");
    } catch (error) {
      console.error(error);
      setState(previousState);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
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
  const selectedService =
    selectedServiceId ? state.services.find((service) => service.id === selectedServiceId) ?? null : null;

  const servicesById = useMemo(
    () => new Map(state.services.map((service) => [service.id, service])),
    [state.services]
  );

  const dayBookings = state.bookings.filter((booking) => booking.date === activeDate);
  const activeMainView = view === "more" || view.startsWith("settings") ? "settings" : view;
  const isSettingsView = activeMainView === "settings";
  const searchParamsKey = searchParams.toString();
  const isPreviewEmbed = searchParams.get("preview-embed") === "1";
  const previewHref = useMemo(() => {
    if (!previewDevice || typeof window === "undefined") return null;

    const url = new URL(window.location.href);
    url.searchParams.set("preview-embed", "1");
    url.searchParams.set("preview-device", previewDevice);
    return url.toString();
  }, [previewDevice, pathname, searchParamsKey]);

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

  useEffect(() => {
    if (!isPreviewEmbed) return;
    setPreviewDevice(null);
  }, [isPreviewEmbed]);

  return (
    <div className="min-h-screen bg-white text-black">
      <MobileAdminHeader variant={view === "more" ? "light" : "dark"} />
      <div
        className={[
          "grid min-h-screen grid-cols-1 bg-white",
          "pb-[76px] xl:pb-0",
          isSettingsView ? "" : "xl:grid-cols-[284px_minmax(0,1fr)]",
        ].join(" ")}
      >
        {!isSettingsView ? (
          <aside className="hidden bg-[#f5f5f5] p-3 xl:flex xl:min-h-screen xl:flex-col xl:px-6 xl:py-6">
            <div className="hidden items-center justify-between xl:flex">
              <AdminBrandLogo size="desktop" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white">
                <Icon name="user" className="h-5 w-5" />
              </div>
            </div>

            <nav className="flex w-full gap-1 overflow-x-auto xl:mt-8 xl:grid xl:overflow-visible">
              {navItems.map((item) => (
                <div key={item.key} className="shrink-0 xl:w-full">
                  <Link
                    href={bookingAdminRouteByView[item.key]}
                    title={item.label}
                    className={[
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-left text-lg transition xl:w-full",
                      activeMainView === item.key ? "bg-[#eeeeee] font-bold" : "hover:bg-black/5",
                    ].join(" ")}
                  >
                    <Icon name={item.icon} />
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>

                  {item.key === "services" && activeMainView === "services" ? (
                    <div className="mt-1 hidden space-y-1 pl-5 pr-2 xl:block">
                      {serviceSectionItems.map((sectionItem) => (
                        sectionItem.key === "rentals" ? (
                        <Link
                          key={sectionItem.key}
                          href="/admin/services/rentals"
                          className={[
                            "flex h-10 w-full items-center gap-3 rounded-lg px-4 text-left text-[18px] leading-none transition",
                            serviceSection === sectionItem.key ? "bg-[#eeeeee] font-semibold text-black" : "text-black hover:bg-black/5",
                          ].join(" ")}
                        >
                          <Icon name={sectionItem.icon} className="h-[18px] w-[18px] shrink-0" />
                          <span>{sectionItem.label}</span>
                        </Link>
                        ) : (
                        <button
                          key={sectionItem.key}
                          type="button"
                          onClick={() => {
                            setServiceSection(sectionItem.key);
                            router.push("/admin/services");
                          }}
                          className={[
                            "flex h-10 w-full items-center gap-3 rounded-lg px-4 text-left text-[18px] leading-none transition",
                            serviceSection === sectionItem.key ? "bg-[#eeeeee] font-semibold text-black" : "text-black hover:bg-black/5",
                          ].join(" ")}
                        >
                          <Icon name={sectionItem.icon} className="h-[18px] w-[18px] shrink-0" />
                          <span>{sectionItem.label}</span>
                        </button>
                        )
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>

            <div className="mt-auto hidden space-y-1 xl:block">
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
            isRentalAddPage || isRentalEditPage ? (
              <RentalEditorView
                key={selectedService?.id ?? "new-rental"}
                mode={isRentalEditPage ? "edit" : "add"}
                facilityName={state.facility.name}
                resources={state.resources}
                onCancel={() => router.push("/admin/services/rentals")}
                activeSection={serviceSection}
                onSectionChange={(section) => {
                  setServiceSection(section);
                  if (section !== "rentals" || isRentalEditPage) {
                    router.push("/admin/services");
                  }
                }}
                service={selectedService}
                deleteGuardMessage={selectedService ? getRentalDeleteGuard(selectedService, state) : null}
                onCopyBookingLink={() => void copyRentalBookingLink()}
                onDuplicate={() => {
                  if (selectedService) {
                    void duplicateRental(selectedService);
                  }
                }}
                onDelete={() => {
                  if (selectedService) {
                    void deleteRental(selectedService);
                  }
                }}
                onSave={(rentalDraft) => void saveRentalDraft(rentalDraft, selectedService)}
              />
            ) : (
              <ServicesView
                services={state.services}
                activeSection={serviceSection}
                onSectionChange={setServiceSection}
                onReorder={(visibleServiceIds, serviceId, direction) =>
                  void reorderServices(visibleServiceIds, serviceId, direction)
                }
                onNew={() => {
                  if (serviceSection === "rentals") {
                    router.push("/admin/services/rentals/add");
                    return;
                  }
                  setModal({ type: "service" });
                }}
                onEdit={(id) => {
                  if (serviceSection === "rentals") {
                    router.push(`/admin/services/rentals/${id}`);
                    return;
                  }
                  setModal({ type: "service", id });
                }}
              />
            )
          ) : null}
          {view === "calendar" ? (
            <CalendarView
              activeDate={activeDate}
              bookings={state.bookings}
              availability={state.availability}
              customersById={customersById}
              resources={state.resources}
              servicesById={servicesById}
              onDateChange={setActiveDate}
              onNew={(seed) => setModal({ type: "booking", seed })}
              onEdit={(id) => setModal({ type: "booking", id })}
              showToast={showToast}
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
                  selectedCustomer?.phone ?? "",
                  selectedCustomer?.emergencyContactName ?? "",
                  selectedCustomer?.emergencyContactEmail ?? "",
                  selectedCustomer?.emergencyContactPhone ?? "",
                  JSON.stringify(selectedCustomer?.familyMembers ?? []),
                ].join(":")}
                customer={selectedCustomer}
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
          {view === "settings-rooms-add" ? (
            <RoomEditorView
              backHref={backToAppHref}
              state={state}
              showToast={showToast}
              onCancel={() => router.push("/admin/settings/rooms")}
              onSave={async (draft) => {
                const name = draft.name.trim();
                if (!name) {
                  showToast("Room name is required.");
                  return;
                }

                if (state.resources.some((item) => item.trim().toLowerCase() === name.toLowerCase())) {
                  showToast("That room already exists.");
                  return;
                }

                const next = {
                  ...state,
                  resources: [...state.resources, name],
                };

                await saveSettings(next);
                router.push("/admin/settings/rooms");
              }}
            />
          ) : null}
          {isRoomEditPage ? (
            selectedRoomName ? (
              <RoomEditorView
                backHref={backToAppHref}
                state={state}
                showToast={showToast}
                roomName={selectedRoomName}
                canDelete={
                  !state.services.some((service) =>
                    [service.resource, ...(service.rooms ?? [])].includes(selectedRoomName)
                  ) && !state.bookings.some((booking) => booking.resource === selectedRoomName)
                }
                onCancel={() => router.push("/admin/settings/rooms")}
                onDelete={async () => {
                  const next = {
                    ...state,
                    resources: state.resources.filter((resource) => resource !== selectedRoomName),
                  };

                  await saveSettings(next);
                  router.push("/admin/settings/rooms");
                }}
                onSave={async (draft) => {
                  const name = draft.name.trim();
                  if (!name) {
                    showToast("Room name is required.");
                    return;
                  }

                  if (
                    state.resources.some(
                      (item) => item.trim().toLowerCase() === name.toLowerCase() && item !== selectedRoomName
                    )
                  ) {
                    showToast("That room already exists.");
                    return;
                  }

                  const next = renameRoomReferences(state, selectedRoomName, name);

                  if (dataSource === "local") {
                    setState(next);
                    stateToStorage(next);
                    showToast("Settings saved.");
                    router.replace(getRoomEditorHref(name, resourceIdsByName));
                    return;
                  }

                  setState(next);
                  stateToStorage(next);

                  try {
                    if (name !== selectedRoomName) {
                      await renameRoomInSupabase(selectedRoomName, name);
                    }

                    showToast("Settings saved.");
                    router.replace(getRoomEditorHref(name, resourceIdsByName));
                  } catch (error) {
                    console.error(error);
                    showToast("Settings could not be saved.");
                    void loadFromSupabase();
                  }
                }}
              />
            ) : (
              <section className="min-h-screen px-6 py-8 text-[16px] text-black/60">Loading room...</section>
            )
          ) : null}
          {!isRoomEditPage && (view === "more" || view === "settings" || view === "settings-basics" || view === "settings-rooms" || view === "settings-policies") ? (
            <SettingsView
              backHref={backToAppHref}
              section={view === "settings-policies" ? "policies" : view === "settings-rooms" ? "rooms" : "basics"}
              showMobileMenu={view === "more"}
              showMobileSettingsIndex={view === "settings"}
              state={state}
              showToast={showToast}
              onSave={(next) => void saveSettings(next)}
              resourceIdsByName={resourceIdsByName}
            />
          ) : null}
        </main>
      </div>

      {modal ? (
        <EditorModal
          modal={modal}
          state={state}
          activeDate={activeDate}
          showToast={showToast}
          showBookingConflictDialog={showBookingConflictDialog}
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

      {bookingConflictDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-black/10 px-6 py-5">
              <h2 className="text-xl font-semibold text-black">Room already booked</h2>
            </div>
            <div className="px-6 py-5 text-[15px] leading-7 text-black/75">
              {bookingConflictDialog}
            </div>
            <div className="flex justify-end border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={() => setBookingConflictDialog(null)}
                className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MobileBottomNav activeView={activeMainView} />
      {!isPreviewEmbed ? (
        <AdminViewportPreview
          previewDevice={previewDevice}
          previewHref={previewHref}
          onSelect={setPreviewDevice}
          onClose={() => setPreviewDevice(null)}
        />
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

function AdminBrandLogo({ size = "desktop" }: { size?: "desktop" | "mobile" }) {
  return (
    <div className={size === "mobile" ? "w-[146px]" : "w-[126px]"}>
      <Image
        src="/logo.png"
        alt="The Grind Baseball Lab"
        width={305}
        height={119}
        priority
        className="h-auto w-full object-contain"
      />
    </div>
  );
}

function MobileAdminHeader({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isLight = variant === "light";

  return (
    <header
      className={[
        "sticky top-0 z-30 flex h-[84px] items-center justify-between px-7 xl:hidden",
        isLight
          ? "border-b border-black/10 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.16)]"
          : "border-b border-white/10 bg-black shadow-[0_1px_4px_rgba(0,0,0,0.28)]",
      ].join(" ")}
    >
      <AdminBrandLogo size="mobile" />
      <div className="grid h-12 w-12 place-items-center rounded-full bg-black/20 text-white">
        <Icon name="user" className="h-7 w-7" />
      </div>
    </header>
  );
}

function MobileBottomNav({ activeView }: { activeView: BookingAdminView }) {
  const items: Array<{ key: BookingAdminView; label: string; icon: IconName; href: string }> = [
    { key: "services", label: "Services", icon: "link", href: "/admin/services/rentals" },
    { key: "calendar", label: "Calendar", icon: "calendar", href: bookingAdminRouteByView.calendar },
    { key: "availability", label: "Availability", icon: "clock", href: bookingAdminRouteByView.availability },
    { key: "customers", label: "Customers", icon: "user", href: bookingAdminRouteByView.customers },
    { key: "settings", label: "More", icon: "bar", href: bookingAdminRouteByView.more },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-5 border-t border-black/10 bg-white/95 px-1 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur xl:hidden">
      {items.map((item) => {
        const active = activeView === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={[
              "grid place-items-center gap-1 py-2 text-[12px] leading-none",
              active ? "font-semibold text-black" : "text-black/55",
            ].join(" ")}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminViewportPreview({
  previewDevice,
  previewHref,
  onSelect,
  onClose,
}: {
  previewDevice: PreviewDevice | null;
  previewHref: string | null;
  onSelect: (device: PreviewDevice | null) => void;
  onClose: () => void;
}) {
  const devices: PreviewDevice[] = ["mobile", "tablet", "desktop"];

  return (
    <>
      <div className="fixed bottom-24 right-4 z-40 hidden items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur md:flex">
        <span className="pr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">
          Preview
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={[
            "rounded-full px-3 py-1.5 text-sm font-medium transition",
            previewDevice === null ? "bg-black text-white" : "text-black/65 hover:bg-black/5",
          ].join(" ")}
        >
          Auto
        </button>
        {devices.map((device) => (
          <button
            key={device}
            type="button"
            onClick={() => onSelect(device)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              previewDevice === device ? "bg-black text-white" : "text-black/65 hover:bg-black/5",
            ].join(" ")}
          >
            {previewDevicePresets[device].label}
          </button>
        ))}
      </div>

      {previewDevice && previewHref ? (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm font-medium text-white">
                {previewDevicePresets[previewDevice].label} preview · {previewDevicePresets[previewDevice].width} x{" "}
                {previewDevicePresets[previewDevice].height}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {devices.map((device) => (
                  <button
                    key={device}
                    type="button"
                    onClick={() => onSelect(device)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      previewDevice === device
                        ? "border-white/50 bg-white text-black"
                        : "border-white/20 bg-black/40 text-white hover:bg-black/55",
                    ].join(" ")}
                  >
                    {previewDevicePresets[device].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/55"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 pb-6 md:px-6">
              <div className="mx-auto w-fit rounded-[28px] border border-black/15 bg-[#dfe4eb] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.26)]">
                <iframe
                  title={`${previewDevicePresets[previewDevice].label} admin preview`}
                  src={previewHref}
                  className="block rounded-[18px] border border-black/10 bg-white"
                  style={{
                    width: previewDevicePresets[previewDevice].width,
                    height: previewDevicePresets[previewDevice].height,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
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
  activeSection,
  onSectionChange,
  services,
  onReorder,
  onNew,
  onEdit,
}: {
  activeSection: ServiceSection;
  onSectionChange: (section: ServiceSection) => void;
  services: Service[];
  onReorder: (visibleServiceIds: string[], serviceId: string, direction: "up" | "down") => void;
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const sectionCopy: Record<ServiceSection, { title: string; subtitle: string }> = {
    rentals: {
      title: "Rentals",
      subtitle: "Let customers rent rooms at your facility.",
    },
    lessons: {
      title: "Lessons",
      subtitle: "Offer one-on-one and small-group instruction.",
    },
    camps: {
      title: "Camps",
      subtitle: "Set up camp offerings and seasonal training programs.",
    },
    classes: {
      title: "Classes",
      subtitle: "Create recurring class offerings for your athletes.",
    },
    memberships: {
      title: "Memberships",
      subtitle: "Manage membership-based access and recurring offers.",
    },
    packages: {
      title: "Packages",
      subtitle: "Bundle services together into bookable packages.",
    },
  };

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const sectionServices = services.filter((service) => {
      return (service.category ?? inferServiceCategory(service.name)) === activeSection;
    });

    if (!normalizedSearch) return sectionServices;

    return sectionServices.filter((service) => {
      const rooms = (service.rooms?.length ? service.rooms : [service.resource]).map((item) => item.trim().toLowerCase());
      return service.name.toLowerCase().includes(normalizedSearch) || rooms.some((room) => room.includes(normalizedSearch));
    });
  }, [activeSection, search, services]);

  const visibleServiceIds = useMemo(() => filteredServices.map((service) => service.id), [filteredServices]);
  const currentCopy = sectionCopy[activeSection];

  return (
    <section className="min-h-screen px-[18px] py-6 xl:px-6 xl:py-8">
      <div className="-mx-[18px] -mt-6 mb-7 flex h-16 items-center border-b border-black/15 bg-white px-4 xl:hidden">
        <button type="button" className="grid h-10 w-8 shrink-0 place-items-center text-black/35" aria-label="Previous service type">
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <div className="flex h-full min-w-0 flex-1 gap-1 overflow-x-auto">
          {serviceSectionItems.map((sectionItem) => (
            <button
              key={sectionItem.key}
              type="button"
              onClick={() => onSectionChange(sectionItem.key)}
              className={[
                "inline-flex h-full shrink-0 items-center gap-2 border-b-2 px-4 text-[15px] font-medium",
                activeSection === sectionItem.key
                  ? "border-black text-black"
                  : "border-transparent text-black/60",
              ].join(" ")}
            >
              <Icon name={sectionItem.icon} className="h-4 w-4 shrink-0" />
              {sectionItem.label}
            </button>
          ))}
        </div>
        <button type="button" className="grid h-10 w-8 shrink-0 place-items-center text-black/55" aria-label="Next service type">
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-black">{currentCopy.title}</h1>
          <p className="mt-1 text-[13px] text-black/75">{currentCopy.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-black/12 bg-white text-black/55"
            onClick={() => onSectionChange(activeSection)}
            aria-label="Service settings"
          >
            <Icon name="gear" className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1f1b1b] px-5 text-[15px] font-medium text-white"
          >
            <Icon name="plus" className="h-[18px] w-[18px]" />
            New
          </button>
        </div>
      </div>

      <div className="mt-7">
        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-black/10 bg-white px-4">
          <Icon name="search" className="h-5 w-5 text-black/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${activeSection}...`}
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-black/35"
          />
        </label>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-black/10 bg-white">
        <div>
          <div className="grid grid-cols-[minmax(0,1.2fr)_86px_88px_40px] gap-2 bg-[#f5f6f8] px-4 py-5 text-[14px] font-semibold text-black md:grid-cols-[minmax(150px,1.35fr)_120px_minmax(140px,1fr)_48px] md:gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_240px_76px] xl:gap-4">
            <div>Name</div>
            <div>Visibility</div>
            <div>Rooms</div>
            <div />
          </div>

          {filteredServices.length ? (
            filteredServices.map((service, index) => {
              const rooms = (service.rooms?.length ? service.rooms : [service.resource]).map((item) => item.trim()).filter(Boolean);
              const visibility = service.status === "Active" ? "Everyone" : "Private";

              return (
                <div
                  key={service.id}
                  className="grid grid-cols-[minmax(0,1.2fr)_86px_88px_40px] items-start gap-2 border-t border-black/10 px-4 py-6 md:grid-cols-[minmax(150px,1.35fr)_120px_minmax(140px,1fr)_48px] md:gap-3 md:py-7 xl:grid-cols-[minmax(0,1.6fr)_180px_240px_76px] xl:gap-4 xl:px-5 xl:py-8"
                >
                  <button
                    type="button"
                    onClick={() => onEdit(service.id)}
                    className="min-w-0 text-left text-[14px] font-medium leading-7 text-black md:text-[16px] md:leading-6 xl:text-[17px]"
                  >
                    <span className="block break-words">{service.name}</span>
                  </button>

                  <div className="min-w-0 pt-1">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-1 text-[11px] font-medium md:px-2.5 md:py-1.5 md:text-[13px] xl:px-3.5",
                        visibility === "Everyone" ? "bg-emerald-50 text-emerald-700" : "bg-[#f3f4f6] text-[#667085]",
                      ].join(" ")}
                    >
                      {visibility}
                    </span>
                  </div>

                  <div className="min-w-0 pt-1">
                    <div className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:gap-2">
                      {rooms.length ? (
                        rooms.map((room, roomIndex) => (
                          <span
                            key={room}
                            className={[
                              "rounded-full bg-[#f1efef] px-2.5 py-1 text-[11px] font-medium text-black md:px-3.5 md:py-1.5 md:text-[13px]",
                              roomIndex > 1 ? "hidden xl:inline-flex" : "inline-flex",
                            ].join(" ")}
                          >
                            {room}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-black/40 md:text-[13px]">No rooms</span>
                      )}
                      {rooms.length > 2 ? (
                        <span className="inline-flex rounded-full bg-[#f1efef] px-2.5 py-1 text-[11px] font-medium text-black md:px-3.5 md:py-1.5 md:text-[13px] xl:hidden">
                          +{rooms.length - 2} more
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => onReorder(visibleServiceIds, service.id, "up")}
                      disabled={index === 0}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-black/12 text-black/45 disabled:opacity-40 md:h-10 md:w-10"
                      aria-label="Move service up"
                    >
                      <Icon name="chevron" className="h-[18px] w-[18px] -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorder(visibleServiceIds, service.id, "down")}
                      disabled={index === filteredServices.length - 1}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-black/12 text-black/45 disabled:opacity-40 md:h-10 md:w-10"
                      aria-label="Move service down"
                    >
                      <Icon name="chevron" className="h-[18px] w-[18px] rotate-90" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-5 py-12 text-[14px] text-black/45">
              No {activeSection} yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RentalEditorView({
  mode,
  facilityName,
  resources,
  activeSection,
  onSectionChange,
  service,
  deleteGuardMessage,
  onCopyBookingLink,
  onDuplicate,
  onDelete,
  onCancel,
  onSave,
}: {
  mode: "add" | "edit";
  facilityName: string;
  resources: string[];
  activeSection: ServiceSection;
  onSectionChange: (section: ServiceSection) => void;
  service?: Service | null;
  deleteGuardMessage: string | null;
  onCopyBookingLink: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: (draft: RentalDraft) => void;
}) {
  const [draft, setDraft] = useState<RentalDraft>(() =>
    service ? createRentalDraftFromService(service) : createRentalDraft(resources)
  );
  const [activePriceTab, setActivePriceTab] = useState<"default" | "membership">("default");
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const calendarColorInputRef = useRef<HTMLInputElement | null>(null);
  const isEditMode = mode === "edit";
  const rentalName = service?.name || draft.name.trim() || "Rental";

  const priceRows = activePriceTab === "default" ? draft.defaultPricing : draft.membershipPricing;
  const canSave = Boolean(draft.name.trim());

  function patch(next: Partial<RentalDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function updatePriceRow(targetId: string, key: "duration" | "price", value: string) {
    const groupKey = activePriceTab === "default" ? "defaultPricing" : "membershipPricing";
    patch({
      [groupKey]: priceRows.map((row) =>
        row.id === targetId
          ? { ...row, [key]: key === "duration" ? value.replace(/[^\d]/g, "") : value.replace(/[^\d.]/g, "") }
          : row
      ),
    } as Partial<RentalDraft>);
  }

  function addPriceRow() {
    const groupKey = activePriceTab === "default" ? "defaultPricing" : "membershipPricing";
    patch({
      [groupKey]: [...priceRows, { id: makeId("price"), duration: "", price: "" }],
    } as Partial<RentalDraft>);
  }

  function removePriceRow(targetId: string) {
    const groupKey = activePriceTab === "default" ? "defaultPricing" : "membershipPricing";
    const nextRows = priceRows.filter((row) => row.id !== targetId);
    patch({
      [groupKey]: nextRows.length ? nextRows : [{ id: makeId("price"), duration: "", price: "" }],
    } as Partial<RentalDraft>);
  }

  function toggleRoom(room: string) {
    patch({
      selectedRooms: draft.selectedRooms.includes(room)
        ? draft.selectedRooms.filter((item) => item !== room)
        : [...draft.selectedRooms, room],
    });
  }

  function onMediaPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        patch({ mediaUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="min-h-screen px-5 py-5 xl:px-6 xl:py-6">
      <div className="-mx-5 -mt-5 mb-7 flex h-16 items-center border-b border-black/15 bg-white px-4 xl:hidden">
        <button type="button" className="grid h-10 w-8 shrink-0 place-items-center text-black/35" aria-label="Previous service type">
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <div className="flex h-full min-w-0 flex-1 gap-1 overflow-x-auto">
          {serviceSectionItems.map((sectionItem) => (
            <button
              key={sectionItem.key}
              type="button"
              onClick={() => onSectionChange(sectionItem.key)}
              className={[
                "inline-flex h-full shrink-0 items-center gap-2 border-b-2 px-4 text-[15px] font-medium",
                activeSection === sectionItem.key
                  ? "border-black text-black"
                  : "border-transparent text-black/60",
              ].join(" ")}
            >
              <Icon name={sectionItem.icon} className="h-4 w-4 shrink-0" />
              {sectionItem.label}
            </button>
          ))}
        </div>
        <button type="button" className="grid h-10 w-8 shrink-0 place-items-center text-black/55" aria-label="Next service type">
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[14px] text-black/55">
        <Link href="/admin/services/rentals" className="font-medium text-black/75 hover:text-black">
          Rentals
        </Link>
        <span>/</span>
        <span className="font-medium text-black">{isEditMode ? rentalName : "Add Rental"}</span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-medium leading-8 text-black md:text-[26px]">
            {isEditMode ? rentalName : "Add Rental"}
          </h1>
        </div>
        <div className="relative shrink-0">
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={() => setShowActions((current) => !current)}
                className="grid h-12 w-12 place-items-center rounded-xl bg-[#efeff5] text-black/75"
                aria-label="Rental actions"
              >
                <span className="text-[24px] leading-none">...</span>
              </button>
              {showActions ? (
                <div className="absolute right-0 top-[56px] z-20 min-w-[220px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowActions(false);
                      onCopyBookingLink();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] font-medium text-black hover:bg-black/[0.03]"
                  >
                    <Icon name="link" className="h-5 w-5" />
                    Copy booking link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActions(false);
                      onDuplicate();
                    }}
                    className="flex w-full items-center gap-3 border-t border-black/8 px-4 py-4 text-left text-[15px] font-medium text-black hover:bg-black/[0.03]"
                  >
                    <Icon name="copy" className="h-5 w-5" />
                    Duplicate rental
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-black/12 bg-white">
        <div className="border-t-4 border-t-[#446fbb] px-4 py-4 text-[20px] font-medium text-black">
          Rental Details
        </div>

        <div className="border-t border-black/10">
          <RentalSettingRow
            title="Basics"
            description="Set the name and description"
          >
            <div className="grid gap-6">
              <label className="grid gap-1.5">
                <span className="text-[14px] font-medium text-black/85">Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  className="min-h-[38px] rounded-[4px] border border-black/15 px-3 text-[14px] outline-none"
                />
              </label>

              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-black/85">Preview Text</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">Optional</span>
                </div>
                <textarea
                  value={draft.previewText}
                  onChange={(event) => patch({ previewText: event.target.value.slice(0, 150) })}
                  className="min-h-[56px] rounded-[4px] border border-black/15 px-3 py-2 text-[14px] outline-none"
                />
                <div className="flex items-center justify-between text-[12px] text-black/45">
                  <span>This text will be displayed on the booking page.</span>
                  <span>{draft.previewText.length} / 150 characters</span>
                </div>
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-black/85">Description</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">Optional</span>
                </div>
                <ServiceDescriptionEditor
                  value={draft.description}
                  onChange={(value) => patch({ description: value })}
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-black/85">Media</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">Optional</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="grid min-h-[190px] place-items-center rounded-[10px] border border-black/12 bg-[#fafafa] p-6 text-center"
                >
                  {draft.mediaUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.mediaUrl} alt="Rental media preview" className="max-h-[170px] rounded-md object-contain" />
                    </>
                  ) : (
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-black/[0.08] text-black/45">
                        <Icon name="camera" className="h-6 w-6" />
                      </div>
                      <div className="mt-4 text-[17px] font-medium text-black/85">Click to upload or drag and drop</div>
                      <div className="mt-2 text-[13px] text-black/45">JPG, PNG, GIF, WEBP, SVG (max: 2MB, 16:9 ratio recommended)</div>
                    </div>
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onMediaPicked} className="hidden" />
              </div>
            </div>
          </RentalSettingRow>

          <RentalSettingRow
            title="Pricing"
            description="Choose the price that your customers will see for this service"
          >
            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex gap-5 border-b border-black/10 text-[14px]">
                  {[
                    ["default", "Default Pricing"],
                    ["membership", "Membership Pricing"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivePriceTab(key as "default" | "membership")}
                      className={[
                        "border-b-2 px-3 py-2",
                        activePriceTab === key ? "border-black text-black" : "border-transparent text-black/55",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={addPriceRow} className="inline-flex min-h-10 items-center gap-2 rounded bg-[#5c7eae] px-4 text-[14px] font-semibold text-white">
                  <Icon name="plus" className="h-4 w-4" />
                  Add Price
                </button>
              </div>

              <div className="overflow-hidden rounded-[4px] border border-black/12">
                <div className="grid grid-cols-[1fr_1fr_90px] gap-4 bg-[#f6f7f9] px-4 py-3 text-[14px] font-medium text-black/75">
                  <div>Duration</div>
                  <div>Price</div>
                  <div className="text-right">Actions</div>
                </div>
                {priceRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_90px] gap-4 border-t border-black/10 px-4 py-3">
                    <div className="relative">
                      <select
                        value={row.duration}
                        onChange={(event) => updatePriceRow(row.id, "duration", event.target.value)}
                        className="min-h-[38px] w-full appearance-none rounded-[4px] border border-black/15 bg-white px-3 pr-10 text-[14px] outline-none"
                      >
                        <option value="">Select</option>
                        {row.duration && !rentalDurationOptions.includes(row.duration) ? (
                          <option value={row.duration}>{row.duration} min</option>
                        ) : null}
                        {rentalDurationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} min
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-black/45">
                        <Icon name="chevron" className="h-4 w-4 rotate-90" />
                      </span>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-black/55">
                        $
                      </span>
                      <input
                        value={row.price}
                        onChange={(event) => updatePriceRow(row.id, "price", event.target.value)}
                        placeholder="45"
                        className="min-h-[38px] w-full rounded-[4px] border border-black/15 pl-8 pr-3 text-[14px] outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removePriceRow(row.id)} className="grid h-10 w-10 place-items-center rounded border border-black/12 text-black/45">
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </RentalSettingRow>

          <RentalSettingRow
            title="Rooms"
            description="Indicate which rooms the service can take place in, and how those rooms are reserved on purchase"
          >
            <div className="grid gap-5">
              <div>
                <div className="mb-2 text-[14px] font-medium text-black/85">Rooms</div>
                <div className="grid gap-3 text-[14px]">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={false} readOnly className="h-5 w-5 rounded border-black/20" />
                    <span>{facilityName}</span>
                  </label>
                  {resources.map((room) => (
                    <label key={room} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={draft.selectedRooms.includes(room)}
                        onChange={() => toggleRoom(room)}
                        className="h-5 w-5 rounded border-black/20"
                      />
                      <span>{room}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
                <div>
                  <div className="mb-2 text-[14px] font-medium text-black/85">Reserve On Purchase</div>
                  <select
                    value={draft.reserveOnPurchase}
                    onChange={(event) => patch({ reserveOnPurchase: event.target.value as "any" | "all" })}
                    className="min-h-[42px] w-full rounded-[4px] border border-black/15 px-3 text-[14px] outline-none"
                  >
                    <option value="any">Any selected room</option>
                    <option value="all">All selected rooms</option>
                  </select>
                </div>
                <p className="pt-8 text-[14px] text-black/70">
                  When a customer buys this rental, Swift will reserve <strong>{draft.reserveOnPurchase === "all" ? "ALL" : "any ONE"}</strong>{" "}
                  of {draft.selectedRooms.join(", ") || "the selected rooms"} as long as it is available
                </p>
              </div>
            </div>
          </RentalSettingRow>

          <RentalSettingRow
            title="Equipment"
            description="Decide which equipment gets reserved when this rental is booked"
          >
            <div className="flex items-center gap-4 pt-1">
              <ToggleSwitch checked={draft.reserveEquipment} onChange={(checked) => patch({ reserveEquipment: checked })} label="Reserve equipment" />
              <span className="text-[15px] text-black/85">Reserve equipment</span>
            </div>
          </RentalSettingRow>

          <div className="border-t border-black/10 px-4 py-7">
            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-[18px] font-medium text-black">Advanced Settings</div>
                <div className="mt-1 text-[14px] text-black/65">
                  Add additional requirements like restrictions on time slots and t-shirt size, or hide the service on your booking page
                </div>
              </div>
              <Icon name="chevron" className={`h-5 w-5 transition ${advancedOpen ? "-rotate-90" : "rotate-90"}`} />
            </button>

            {advancedOpen ? (
              <div className="mt-6 border-t border-black/10">
                <AdvancedSettingsRow
                  title="Tax Rates"
                  description="Choose the tax rate that applies to this service."
                >
                  <InlineToggleChoice checked={draft.collectTax} onChange={(checked) => patch({ collectTax: checked })} label="Collect tax" />
                </AdvancedSettingsRow>

                <AdvancedSettingsRow
                  title="Custom Fees"
                  description="Choose the custom fee that applies to this service."
                >
                  <InlineToggleChoice checked={draft.collectFee} onChange={(checked) => patch({ collectFee: checked })} label="Collect fee" />
                </AdvancedSettingsRow>

                <AdvancedSettingsRow
                  title="Time Slot Restrictions"
                  description="Set start & end limits on the time slots shown to clients when booking this service"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[15px] text-black">{draft.slotRestrictionSummary}</span>
                    <button type="button" className="rounded bg-[#5c7eae] px-4 py-2 text-[14px] font-semibold text-white">
                      Add restriction
                    </button>
                  </div>
                </AdvancedSettingsRow>

                <AdvancedSettingsRow
                  title="Schedule"
                  description="Choose to offer this service only on certain days or times."
                >
                  <div>
                    <div className="flex items-center gap-4">
                      <ToggleSwitch checked={draft.serviceScheduleEnabled} onChange={(checked) => patch({ serviceScheduleEnabled: checked })} label="Set service schedule" />
                      <span className="text-[15px] text-black/85">Set service schedule</span>
                    </div>
                    <div className="mt-2 text-[14px] text-black/65">Enable this to only allow this service to be booked on certain days or times.</div>
                  </div>
                </AdvancedSettingsRow>

                <AdvancedSettingsRow
                  title="Additional Checkout Details"
                  description="Request the client to fill out additional details during checkout, like emergency contact information"
                >
                  <div className="grid gap-5">
                    <div className="flex items-center gap-5 text-[15px]">
                      <span>Emergency Contact Info</span>
                      <InlineOnOff checked={draft.emergencyContactInfo} onChange={(checked) => patch({ emergencyContactInfo: checked })} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[15px] text-black">{draft.customFieldsSummary}</span>
                      <button type="button" className="rounded bg-[#5c7eae] px-4 py-2 text-[14px] font-semibold text-white">
                        Add Custom Field
                      </button>
                    </div>
                  </div>
                </AdvancedSettingsRow>

                <AdvancedSettingsRow
                  title="Private"
                  description="Hide this service from clients on your booking page"
                >
                  <InlineOnOff checked={draft.private} onChange={(checked) => patch({ private: checked })} />
                </AdvancedSettingsRow>

                <AdvancedSettingsRow
                  title="Calendar Color"
                  description="The color used to display bookings for this service on the calendar."
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => calendarColorInputRef.current?.click()}
                      className="inline-flex h-[44px] items-center gap-3 rounded-[10px] border border-black/12 px-4 transition hover:bg-black/[0.03]"
                    >
                      <span
                        className="h-8 w-8 rounded-full border border-black/10"
                        style={{ backgroundColor: draft.calendarColor }}
                      />
                      <span className="text-[14px] font-medium text-black/70">
                        {draft.calendarColor.toUpperCase()}
                      </span>
                      <Icon name="chevron" className="h-4 w-4 -rotate-90 text-black/45" />
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {serviceCalendarColorOptions.map((option) => {
                        const isActive = normalizeCalendarColor(draft.calendarColor) === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => patch({ calendarColor: option })}
                            className={`h-8 w-8 rounded-full border-2 transition ${
                              isActive ? "border-black shadow-sm" : "border-black/10"
                            }`}
                            style={{ backgroundColor: option }}
                            aria-label={`Choose ${option} as the calendar color`}
                          />
                        );
                      })}
                    </div>
                    <input
                      ref={calendarColorInputRef}
                      type="color"
                      value={normalizeCalendarColor(draft.calendarColor)}
                      onChange={(event) => patch({ calendarColor: normalizeCalendarColor(event.target.value) })}
                      className="sr-only"
                    />
                  </div>
                </AdvancedSettingsRow>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-[#f6f7f9] px-5 py-5">
          <div>
            {isEditMode ? (
              deleteGuardMessage ? (
                <div className="group relative inline-flex items-center gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-black/10 bg-white px-5 py-2.5 text-[14px] font-semibold text-black/25"
                  >
                    Delete
                  </button>
                  <div className="pointer-events-none absolute left-[calc(100%+16px)] top-1/2 z-20 w-max max-w-[340px] -translate-y-1/2 rounded-md bg-[#707070] px-3 py-2 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    {deleteGuardMessage}
                    <div className="absolute right-full top-1/2 h-0 w-0 -translate-y-1/2 border-b-[7px] border-r-[7px] border-t-[7px] border-b-transparent border-r-[#707070] border-t-transparent" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg border border-[#e7c3bf] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#b33a30] transition hover:bg-[#fff3f1]"
                >
                  Delete
                </button>
              )
            ) : (
              <div />
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onCancel} className="rounded-lg border border-black/10 bg-white px-5 py-2.5 text-[14px] font-semibold text-black">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onSave(draft)}
              className="rounded-lg bg-black px-6 py-2.5 text-[14px] font-semibold text-white disabled:bg-black/10 disabled:text-black/35"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RentalSettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 border-t border-black/10 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div>
        <div className="text-[18px] font-medium text-black">{title}</div>
        <div className="mt-1 text-[14px] leading-8 text-black/75">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function AdvancedSettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 border-b border-black/10 py-8 last:border-b-0 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div>
        <div className="text-[18px] font-medium text-black">{title}</div>
        <div className="mt-1 text-[14px] leading-8 text-black/75">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ServiceDescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const toolbar = ["↺", "↻", "Normal", "B", "I", "U", "S", "<>", "↗", "≡", "☰", "☷"];

  return (
    <div className="overflow-hidden rounded-[4px] border border-black/15">
      <div className="flex min-h-[42px] flex-wrap items-center gap-2 border-b border-black/10 px-3 py-2 text-black/55">
        {toolbar.map((item) => (
          <button key={item} type="button" className="rounded px-2 py-1 text-[14px] hover:bg-black/[0.03]">
            {item}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter a description..."
        className="min-h-[180px] w-full resize-none px-3 py-3 text-[14px] outline-none"
      />
    </div>
  );
}

function InlineToggleChoice({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <ToggleSwitch checked={checked} onChange={onChange} label={label} />
      <span className="text-[15px] text-black">{label}</span>
    </div>
  );
}

function InlineOnOff({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 text-[15px] text-black">
      <span className={!checked ? "text-black" : "text-black/45"}>Off</span>
      <ToggleSwitch checked={checked} onChange={onChange} label="toggle" />
      <span className={checked ? "text-black" : "text-black/45"}>On</span>
    </div>
  );
}

function CalendarView({
  activeDate,
  bookings,
  availability,
  customersById,
  resources,
  servicesById,
  onDateChange,
  onNew,
  onEdit,
  showToast,
}: {
  activeDate: string;
  bookings: Booking[];
  availability: AppState["availability"];
  customersById: Map<string, Customer>;
  resources: string[];
  servicesById: Map<string, Service>;
  onDateChange: (date: string) => void;
  onNew: (seed?: Partial<Booking>) => void;
  onEdit: (id: string) => void;
  showToast: (message: string) => void;
}) {
  const allMobileResourcesValue = "__all__";
  const [resourceMode, setResourceMode] = useState<"rooms" | "staff" | "equipment">("rooms");
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("day");
  const [mobileResource, setMobileResource] = useState<string>(allMobileResourcesValue);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const mobileDayScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopDayScrollRef = useRef<HTMLDivElement | null>(null);
  const dayName = weekdayName(activeDate);
  const availabilityRow = availabilityForDate(availability, activeDate);
  const [, isOpen, openStart, openEnd] = availabilityRow;
  const slots = useMemo(() => Array.from({ length: 48 }, (_, index) => minutesToTime(index * 30)), []);
  const slotHeight = 50;
  const mobileSlotHeight = 46;
  const columnHeight = slots.length * slotHeight;
  const activeCalendarBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "Cancelled"),
    [bookings]
  );
  const visibleDayBookings = useMemo(
    () =>
      activeCalendarBookings
        .filter((booking) => booking.date === activeDate)
        .sort(
        (a, b) =>
          timeToMinutes(a.start) - timeToMinutes(b.start) ||
          timeToMinutes(a.end) - timeToMinutes(b.end)
      ),
    [activeDate, activeCalendarBookings]
  );
  const closedBlocks = useMemo(() => closedBlocksForDate(availability, activeDate), [availability, activeDate]);
  const week = useMemo(() => weekDates(activeDate), [activeDate]);
  const weekBookings = useMemo(() => {
    return week.map((date) => ({
      date,
      items: activeCalendarBookings
        .filter((booking) => booking.date === date)
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
    }));
  }, [activeCalendarBookings, week]);
  const mobileWeekBookings = useMemo(
    () =>
      week.map((date) => ({
        date,
        items: activeCalendarBookings
          .filter(
            (booking) =>
              booking.date === date &&
              (mobileResource === allMobileResourcesValue || booking.resource === mobileResource)
          )
          .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
      })),
    [activeCalendarBookings, mobileResource, week]
  );
  const mobileDayResourceViews = useMemo(
    () =>
      resources.map((resource) => {
        const resourceBookings = visibleDayBookings.filter((booking) => booking.resource === resource);
        const timeline = buildMobileCalendarTimeline(resourceBookings, availability, activeDate);
        const availableBlocks = timeline.filter((segment) => segment.type === "available");
        return {
          resource,
          bookings: resourceBookings,
          timeline,
          availableBlocks,
        };
      }),
    [activeDate, availability, resources, visibleDayBookings]
  );
  const mobileVisibleDayResourceViews = useMemo(
    () =>
      mobileResource === allMobileResourcesValue
        ? mobileDayResourceViews
        : mobileDayResourceViews.filter((item) => item.resource === mobileResource),
    [mobileDayResourceViews, mobileResource]
  );

  useEffect(() => {
    if (!resources.length) {
      setMobileResource(allMobileResourcesValue);
      return;
    }

    if (mobileResource !== allMobileResourcesValue && !resources.includes(mobileResource)) {
      setMobileResource(allMobileResourcesValue);
    }
  }, [allMobileResourcesValue, mobileResource, resources]);

  useEffect(() => {
    if (resourceMode !== "rooms" || calendarMode !== "day") return;

    const mobileNode = mobileDayScrollRef.current;
    const desktopNode = desktopDayScrollRef.current;
    const isToday = activeDate === isoDate(new Date());
    const mobileOffset = isToday
      ? calendarScrollOffsetForTime(new Date(), mobileSlotHeight)
      : calendarScrollOffsetForAvailabilityStart(availability, activeDate, mobileSlotHeight);
    const desktopOffset = isToday
      ? calendarScrollOffsetForTime(new Date(), slotHeight)
      : calendarScrollOffsetForAvailabilityStart(availability, activeDate, slotHeight);

    const frame = window.requestAnimationFrame(() => {
      if (mobileNode) {
        mobileNode.scrollTop = mobileOffset;
      }

      if (desktopNode) {
        desktopNode.scrollTop = desktopOffset;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeDate, availability, calendarMode, mobileSlotHeight, resourceMode, slotHeight]);

  function openDatePicker() {
    const input = dateInputRef.current as HTMLInputElement | null;
    if (!input) return;
    (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  }

  function changeMode(next: "rooms" | "staff" | "equipment") {
    setResourceMode(next);
    if (next !== "rooms") {
      showToast(`${next[0].toUpperCase()}${next.slice(1)} calendar is next.`);
    }
  }

  function createBookingFromSlot(resource: string, startMinutes: number, endMinutes: number) {
    const durationMinutes = Math.max(30, endMinutes - startMinutes);
    const matchedService = findServiceForCalendarSlot(
      Array.from(servicesById.values()),
      resource,
      durationMinutes
    );
    onNew({
      date: activeDate,
      resource,
      start: minutesToTime(startMinutes),
      end: minutesToTime(endMinutes),
      serviceId: matchedService?.id,
      serviceName: matchedService?.name,
      calendarColor: matchedService?.calendarColor ?? DEFAULT_SERVICE_CALENDAR_COLOR,
    });
  }

  return (
    <section className="min-h-screen px-6 py-8 xl:px-7">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarToolbarButton label="Today" onClick={() => onDateChange(isoDate(new Date()))} />
          <CalendarToolbarButton label="Back" onClick={() => onDateChange(shiftDate(activeDate, calendarMode === "week" ? -7 : -1))} />
          <CalendarToolbarButton label="Next" onClick={() => onDateChange(shiftDate(activeDate, calendarMode === "week" ? 7 : 1))} />
        </div>

        <div className="flex items-center gap-4">
          <input
            ref={dateInputRef}
            type="date"
            value={activeDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="sr-only"
            aria-label="Calendar date"
          />
          <button
            type="button"
            onClick={openDatePicker}
            className="inline-flex min-h-12 items-center gap-3 rounded-lg border border-black/15 bg-[#f3f3f3] px-5 text-[16px] font-semibold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          >
            <span>{formatCalendarHeading(activeDate)}</span>
            <Icon name="chevron" className="h-4 w-4 rotate-90 text-black/60" />
          </button>

          <div className="hidden items-center gap-2 xl:flex">
            <CalendarSegmentButton active={resourceMode === "rooms"} onClick={() => changeMode("rooms")}>
              Rooms
            </CalendarSegmentButton>
            <CalendarSegmentButton active={resourceMode === "staff"} onClick={() => changeMode("staff")}>
              Staff
            </CalendarSegmentButton>
            <CalendarSegmentButton active={resourceMode === "equipment"} onClick={() => changeMode("equipment")}>
              Equipment
            </CalendarSegmentButton>
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <CalendarSegmentButton active={calendarMode === "day"} onClick={() => setCalendarMode("day")}>
              Day
            </CalendarSegmentButton>
            <CalendarSegmentButton active={calendarMode === "week"} onClick={() => setCalendarMode("week")}>
              Week
            </CalendarSegmentButton>
          </div>

          <CalendarToolbarButton
            label="Filter View"
            icon="table"
            onClick={() => showToast("Filter View is next.")}
            className="hidden xl:inline-flex"
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 xl:hidden">
        <CalendarSegmentButton active={resourceMode === "rooms"} onClick={() => changeMode("rooms")}>
          Rooms
        </CalendarSegmentButton>
        <CalendarSegmentButton active={resourceMode === "staff"} onClick={() => changeMode("staff")}>
          Staff
        </CalendarSegmentButton>
        <CalendarSegmentButton active={resourceMode === "equipment"} onClick={() => changeMode("equipment")}>
          Equipment
        </CalendarSegmentButton>
        <CalendarSegmentButton active={calendarMode === "day"} onClick={() => setCalendarMode("day")}>
          Day
        </CalendarSegmentButton>
        <CalendarSegmentButton active={calendarMode === "week"} onClick={() => setCalendarMode("week")}>
          Week
        </CalendarSegmentButton>
        <CalendarToolbarButton label="Filter" icon="table" onClick={() => showToast("Filter View is next.")} />
      </div>

      {resourceMode === "rooms" ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
          <button
            type="button"
            onClick={() => setMobileResource(allMobileResourcesValue)}
            className={[
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
              mobileResource === allMobileResourcesValue
                ? "border-black bg-black text-white"
                : "border-black/10 bg-white text-black/70",
            ].join(" ")}
          >
            All Lanes
          </button>
          {resources.map((resource) => (
            <button
              key={resource}
              type="button"
              onClick={() => setMobileResource(resource)}
              className={[
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                mobileResource === resource
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white text-black/70",
              ].join(" ")}
            >
              {resource}
            </button>
          ))}
        </div>
      ) : null}

      {resourceMode === "rooms" ? (
        calendarMode === "day" ? (
          <>
            <div className="space-y-3 xl:hidden">
              <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-black/45">
                      {formatCalendarHeading(activeDate)}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-black">
                      {mobileResource === allMobileResourcesValue ? "All Lanes" : mobileResource || "Room"}
                    </div>
                    <div className="mt-2 text-sm font-medium text-black/55">
                      {isOpen ? `Open ${timeLabel(openStart)} - ${timeLabel(openEnd)}` : "Closed all day"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Pill
                      label={`${mobileVisibleDayResourceViews.reduce((count, item) => count + item.bookings.length, 0)} Booking${
                        mobileVisibleDayResourceViews.reduce((count, item) => count + item.bookings.length, 0) === 1 ? "" : "s"
                      }`}
                    />
                    <span className="rounded-full bg-[#e8faf0] px-3 py-1 text-[12px] font-semibold text-[#15835d]">
                      {mobileVisibleDayResourceViews.reduce((count, item) => count + item.availableBlocks.length, 0)} Open Slot
                      {mobileVisibleDayResourceViews.reduce((count, item) => count + item.availableBlocks.length, 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                <div ref={mobileDayScrollRef} className="overflow-auto">
                  <div
                    className="grid border-b border-black/10 bg-[#f6f7f9]"
                    style={{
                      gridTemplateColumns: `76px repeat(${Math.max(mobileVisibleDayResourceViews.length, 1)}, minmax(132px, 1fr))`,
                      minWidth: `${76 + Math.max(mobileVisibleDayResourceViews.length, 1) * 132}px`,
                    }}
                  >
                    <div className="sticky left-0 z-20 border-r border-black/10 bg-[#f6f7f9] px-3 py-3" />
                    {mobileVisibleDayResourceViews.map(({ resource }) => (
                      <div
                        key={`mobile-day-header-${resource}`}
                        className="border-r border-black/10 px-2 py-3 text-center text-[14px] font-bold last:border-r-0"
                      >
                        {resource}
                      </div>
                    ))}
                  </div>

                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `76px repeat(${Math.max(mobileVisibleDayResourceViews.length, 1)}, minmax(132px, 1fr))`,
                      minWidth: `${76 + Math.max(mobileVisibleDayResourceViews.length, 1) * 132}px`,
                    }}
                  >
                    <div className="sticky left-0 z-10 border-r border-black/10 bg-white">
                      {slots.map((slot, index) => (
                        <div
                          key={`mobile-time-${slot}`}
                          className="flex items-start justify-end border-b border-black/10 px-2 text-right text-[12px] font-medium text-black/90"
                          style={{ height: mobileSlotHeight }}
                        >
                          <div className={`w-full ${index === 0 ? "pt-1" : "pt-0.5"}`}>{timeLabel(slot)}</div>
                        </div>
                      ))}
                    </div>

                    {mobileVisibleDayResourceViews.map(({ resource, timeline }) => (
                      <div
                        key={`mobile-day-column-${resource}`}
                        className="relative border-r border-black/10 last:border-r-0"
                        style={{ height: slots.length * mobileSlotHeight }}
                      >
                        {slots.map((slot) => (
                          <div
                            key={`${resource}-mobile-slot-${slot}`}
                            className="border-b border-black/10"
                            style={{ height: mobileSlotHeight }}
                          />
                        ))}

                        {timeline.map((segment, index) => {
                          const top = (segment.start / 30) * mobileSlotHeight + 1;
                          const height = Math.max(mobileSlotHeight - 2, ((segment.end - segment.start) / 30) * mobileSlotHeight - 2);

                          if (segment.type === "closed") {
                            return (
                              <div
                                key={`${resource}-mobile-closed-block-${index}`}
                                className="absolute left-[2px] right-[2px] overflow-hidden rounded-md border border-[#6f86a0] bg-[#8a8f98] px-2 py-1 text-white"
                                style={{ top, height }}
                              >
                                <div className="text-[9px] font-semibold leading-none text-white/80">
                                  {timeLabel(minutesToTime(segment.start))} - {timeLabel(minutesToTime(segment.end))}
                                </div>
                                <div className="mt-1 text-[18px] font-semibold leading-none">Closed</div>
                              </div>
                            );
                          }

                          if (segment.type === "available") {
                            return (
                              <button
                                key={`${resource}-mobile-open-block-${index}`}
                                type="button"
                                onClick={() => createBookingFromSlot(resource, segment.start, segment.end)}
                                className="absolute left-[2px] right-[2px] overflow-hidden rounded-md border border-[#caefdd] bg-[#f3fcf7] px-2 py-1 text-left text-[#166443] shadow-sm"
                                style={{ top, height }}
                              >
                                <div className="text-[9px] font-semibold leading-none text-[#15835d]/75">
                                  {timeLabel(minutesToTime(segment.start))}
                                </div>
                                <div className="mt-1 text-[16px] font-semibold leading-none">Open</div>
                              </button>
                            );
                          }

                          const booking = segment.booking;
                          const customer = customersById.get(booking.customerId);
                          const service = servicesById.get(booking.serviceId);
                          const tone = bookingTonePresentation(booking, service);
                          const durationMinutes = Math.max(30, segment.end - segment.start);
                          const isCompactBooking = durationMinutes <= 30;

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              onClick={() => onEdit(booking.id)}
                              className={`absolute left-[2px] right-[2px] overflow-hidden rounded-md border text-left shadow-sm ${tone.borderClass} ${tone.containerClass} ${
                                isCompactBooking ? "px-2 py-1" : "px-2 py-1.5"
                              }`}
                              style={{ top, height, ...tone.style }}
                            >
                              <div className={`${isCompactBooking ? "text-[8px]" : "text-[9px]"} ${tone.timeClass} font-semibold leading-none`}>
                                {timeLabel(minutesToTime(segment.start))}
                              </div>
                              <div className={`truncate font-semibold leading-[1.05] ${isCompactBooking ? "mt-0.5 text-[11px]" : "mt-1 text-[12px]"}`}>
                                {customer?.player || customer?.name || "Customer"}
                              </div>
                              <div
                                className={`line-clamp-2 font-medium leading-[1.05] ${tone.subClass} ${
                                  isCompactBooking ? "mt-0.5 text-[9px]" : "mt-0.5 text-[10px]"
                                }`}
                              >
                                {service?.name || booking.serviceName || "Service"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm xl:block">
          <div
            className="grid min-w-[980px] border-b border-black/10 bg-[#f6f7f9]"
            style={{ gridTemplateColumns: `96px repeat(${resources.length}, minmax(220px, 1fr))` }}
          >
              <div className="border-r border-black/10 px-4 py-4" />
              {resources.map((resource) => (
                <div key={resource} className="border-r border-black/10 px-4 py-4 text-center text-[15px] font-bold last:border-r-0">
                  {resource}
                </div>
              ))}
            </div>

            <div ref={desktopDayScrollRef} className="overflow-auto">
              <div
                className="grid min-w-[980px]"
                style={{ gridTemplateColumns: `96px repeat(${resources.length}, minmax(220px, 1fr))` }}
              >
                <div className="relative border-r border-black/10 bg-white">
                  {slots.map((slot, index) => (
                      <div
                        key={slot}
                        className="flex items-start justify-end border-b border-black/10 px-4 text-right text-[15px] font-medium text-black/90"
                        style={{ height: slotHeight }}
                      >
                        <div className={`w-full ${index === 0 ? "pt-1" : "pt-0.5"}`}>{timeLabel(slot)}</div>
                      </div>
                  ))}
                </div>

                {resources.map((resource) => {
                  const resourceBookings = visibleDayBookings.filter((booking) => booking.resource === resource);

                  return (
                    <div key={resource} className="relative border-r border-black/10 last:border-r-0" style={{ height: columnHeight }}>
                      {slots.map((slot) => (
                        <div key={`${resource}-${slot}`} className="border-b border-black/10" style={{ height: slotHeight }} />
                      ))}

                      {closedBlocks.map((block, index) => {
                        const top = (block.start / 30) * slotHeight;
                        const height = Math.max(slotHeight, ((block.end - block.start) / 30) * slotHeight);
                        return (
                          <div
                            key={`${resource}-closed-${index}`}
                            className="absolute left-[5px] right-[5px] rounded-md border border-[#6f86a0] bg-[#7f848d]/70 text-white"
                            style={{ top, height }}
                          >
                            <div className="flex h-full items-center justify-center px-3 text-center text-[12px] font-medium">
                              <span className="rounded-sm border border-black/45 bg-white px-3 py-1 text-black shadow-sm">
                                {timeLabel(minutesToTime(block.start))} - {timeLabel(minutesToTime(block.end))}: Closed
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {resourceBookings.map((booking) => {
                        const customer = customersById.get(booking.customerId);
                        const service = servicesById.get(booking.serviceId);
                        const statusBadge = bookingStatusBadge(booking);
                        const tone = bookingTonePresentation(booking, service);
                        const top = (timeToMinutes(booking.start) / 30) * slotHeight + 1;
                        const durationMinutes = Math.max(30, timeToMinutes(booking.end) - timeToMinutes(booking.start));
                        const height = Math.max(slotHeight - 2, (durationMinutes / 30) * slotHeight - 2);
                        const isCompactBooking = durationMinutes <= 30;

                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => onEdit(booking.id)}
                            className={`absolute left-[1px] right-[1px] overflow-hidden rounded-[4px] border text-left shadow-sm ${tone.borderClass} ${tone.containerClass} ${
                              isCompactBooking ? "px-2 py-1" : "px-2.5 py-1.5"
                            }`}
                            style={{ top, height, ...tone.style }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className={`${isCompactBooking ? "text-[9px]" : "text-[10px]"} ${tone.timeClass} font-semibold leading-none`}>
                                {timeLabel(booking.start)} - {timeLabel(booking.end)}
                              </div>
                              {statusBadge ? (
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${statusBadge.className}`}
                                >
                                  {statusBadge.label}
                                </span>
                              ) : null}
                            </div>
                            <div className={`truncate font-semibold leading-[1.05] ${isCompactBooking ? "mt-0.5 text-[13px]" : "mt-1 text-[15px]"}`}>
                              {customer?.player || customer?.name || "Customer"}
                            </div>
                            <div className={`truncate font-medium leading-[1.05] ${tone.subClass} ${isCompactBooking ? "mt-0.5 text-[10px]" : "mt-0.5 text-[11px]"}`}>
                              {service?.name || booking.serviceName || "Service"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 xl:hidden">
              {mobileWeekBookings.map(({ date, items }) => (
                <div key={date} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/45">
                        {parseLocalDate(date).toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className="mt-1 text-[20px] font-semibold">
                        {parseLocalDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <Pill label={`${items.length}`} />
                  </div>

                  <div className="mt-4 space-y-3">
                    {closedBlocksForDate(availability, date).map((block, index) => (
                      <div key={`${date}-closed-${index}`} className="rounded-lg border border-black/10 bg-[#8a8f98] px-4 py-3 text-white">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">
                          {timeLabel(minutesToTime(block.start))} - {timeLabel(minutesToTime(block.end))}
                        </div>
                        <div className="mt-1 text-base font-semibold">Closed</div>
                      </div>
                    ))}

                    {items.length ? (
                      items.map((booking) => {
                        const customer = customersById.get(booking.customerId);
                        const service = servicesById.get(booking.serviceId);
                        const statusBadge = bookingStatusBadge(booking);
                        const tone = bookingTonePresentation(booking, service);
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => onEdit(booking.id)}
                            className={`block w-full rounded-lg px-4 py-3 text-left shadow-sm ${tone.containerClass}`}
                            style={tone.style}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${tone.timeClass}`}>
                                {timeLabel(booking.start)} - {timeLabel(booking.end)}
                              </div>
                              {statusBadge ? (
                                <span
                                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${statusBadge.className}`}
                                >
                                  {statusBadge.label}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[18px] font-semibold leading-tight">
                              {customer?.player || customer?.name || "Customer"}
                            </div>
                            <div className={`mt-1 text-[13px] ${tone.subClass}`}>{service?.name || booking.serviceName || "Service"}</div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/50">
                        No bookings
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden rounded-xl border border-black/10 bg-white shadow-sm xl:block">
            <div className="grid gap-0 border-b border-black/10 bg-[#f6f7f9] md:grid-cols-7">
              {week.map((date) => (
                <div key={date} className="border-r border-black/10 px-4 py-4 text-center last:border-r-0">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/45">
                    {parseLocalDate(date).toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="mt-1 text-[15px] font-bold">{parseLocalDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-0 md:grid-cols-7">
              {weekBookings.map(({ date, items }) => (
                <div key={date} className="min-h-[320px] border-r border-black/10 p-3 last:border-r-0">
                  {items.length ? (
                    <div className="space-y-2">
                      {items.map((booking) => {
                        const customer = customersById.get(booking.customerId);
                        const service = servicesById.get(booking.serviceId);
                        const statusBadge = bookingStatusBadge(booking);
                        const tone = bookingTonePresentation(booking, service);
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => onEdit(booking.id)}
                            className={`block w-full rounded-lg border px-3 py-3 text-left shadow-sm ${tone.borderClass} ${tone.containerClass}`}
                            style={tone.style}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className={`text-[11px] font-semibold ${tone.timeClass}`}>
                                {timeLabel(booking.start)} - {timeLabel(booking.end)}
                              </div>
                              {statusBadge ? (
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${statusBadge.className}`}
                                >
                                  {statusBadge.label}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 truncate text-[14px] font-semibold">
                              {customer?.player || customer?.name || "Customer"}
                            </div>
                            <div className={`mt-1 text-[12px] ${tone.subClass}`}>
                              {(service?.name || booking.serviceName || "Service")} · {booking.resource}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center text-center text-sm text-black/45">
                      No bookings
                    </div>
                  )}
                </div>
              ))}
            </div>
            </div>
          </>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-black/15 bg-white px-6 py-16 text-center text-black/55 shadow-sm">
          {resourceMode === "staff" ? "Staff calendar is next." : "Equipment calendar is next."}
        </div>
      )}

      <button
        type="button"
        onClick={() => onNew()}
        className="fixed bottom-[90px] right-5 z-20 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#1f1a1a] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] xl:bottom-6"
      >
        <Icon name="plus" className="h-5 w-5" />
        <span>New Booking</span>
      </button>
    </section>
  );
}

function CalendarToolbarButton({
  label,
  onClick,
  icon,
  className = "",
}: {
  label: string;
  onClick: () => void;
  icon?: IconName;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/15 bg-white px-4 text-[15px] font-medium text-black shadow-[0_1px_0_rgba(255,255,255,0.9)] hover:bg-black/[0.02] ${className}`.trim()}
    >
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      <span>{label}</span>
    </button>
  );
}

function CalendarSegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex min-h-10 items-center rounded-lg border px-4 text-[15px] font-medium shadow-[0_1px_0_rgba(255,255,255,0.9)]",
        active
          ? "border-black/15 bg-[#ececec] text-black"
          : "border-black/15 bg-white text-black/75 hover:bg-black/[0.02]",
      ].join(" ")}
    >
      {children}
    </button>
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
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">Created At ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬Å“</th>
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

function familyMemberAgeLabel(member: FamilyMember) {
  const date = parseUsDateInput(member.birthDate);
  if (!date) return "";

  const age = calculateAge(
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  );

  if (age === "") return "";
  return `${age} ${age === 1 ? "year" : "years"} old`;
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
  initialMember,
  onClose,
  onSave,
}: {
  initialMember?: FamilyMember | null;
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
}) {
  const [firstName, setFirstName] = useState(initialMember?.firstName ?? "");
  const [lastName, setLastName] = useState(initialMember?.lastName ?? "");
  const [relationship, setRelationship] = useState(initialMember?.relationship ?? "Unspecified");
  const [gender, setGender] = useState(initialMember?.gender ?? "Unspecified");
  const [birthDate, setBirthDate] = useState(initialMember?.birthDate ?? "");
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
          <h3 className="text-[18px] font-medium text-black">{initialMember ? "Edit Member" : "Add Member"}</h3>
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
                id: initialMember?.id ?? makeId("family"),
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

function EmergencyContactModal({
  initialEmail,
  initialName,
  initialPhone,
  onClose,
  onSave,
}: {
  initialEmail: string;
  initialName: string;
  initialPhone: string;
  onClose: () => void;
  onSave: (contact: { name: string; email: string; phone: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(formatUsPhoneInput(initialPhone));

  const canSave = Boolean(name.trim() || email.trim() || phone.trim());

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[900px] overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-8 py-7">
          <h3 className="text-[18px] font-medium text-black">
            {initialName || initialEmail || initialPhone ? "Edit Emergency Contact" : "Add Emergency Contact"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-black/45 hover:bg-black/[0.03]"
            aria-label="Close"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-9 px-8 py-9">
          <label className="grid gap-2.5">
            <span className="text-[13px] font-medium text-black/85">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-12 rounded-md border border-black/15 px-4 text-[15px] outline-none"
            />
          </label>

          <label className="grid gap-2.5">
            <span className="text-[13px] font-medium text-black/85">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 rounded-md border border-black/15 px-4 text-[15px] outline-none"
            />
          </label>

          <label className="grid gap-2.5">
            <span className="text-[13px] font-medium text-black/85">Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(formatUsPhoneInput(event.target.value))}
              inputMode="numeric"
              maxLength={14}
              className="min-h-12 rounded-md border border-black/15 px-4 text-[15px] outline-none"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-6 border-t border-black/10 px-8 py-5">
          <button type="button" onClick={onClose} className="text-[15px] font-medium text-black/65">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
              })
            }
            className="rounded-md bg-black px-6 py-3 text-[15px] font-medium text-white disabled:bg-black/10 disabled:text-black/30"
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
  onSaveCustomer,
}: {
  customer: Customer | null;
  onSaveCustomer: (item: Customer) => void;
}) {
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false);
  const [editingFamilyMember, setEditingFamilyMember] = useState<FamilyMember | null>(null);
  const [profilePhone, setProfilePhone] = useState(formatUsPhoneInput(customer?.phone ?? ""));
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

  function saveEmergencyContactValues(contact: { name: string; email: string; phone: string }) {
    onSaveCustomer({
      ...currentCustomer,
      emergencyContactName: contact.name,
      emergencyContactEmail: contact.email,
      emergencyContactPhone: contact.phone,
    });
    setEmergencyDeleted(false);
    setShowEmergencyContactModal(false);
  }

  function saveFamilyMembers(nextFamilyMembers: FamilyMember[]) {
    onSaveCustomer({
      ...currentCustomer,
      familyMembers: nextFamilyMembers,
    });
  }

  function openNewFamilyMemberModal() {
    setEditingFamilyMember(null);
    setShowFamilyModal(true);
  }

  function openEditFamilyMemberModal(member: FamilyMember) {
    setEditingFamilyMember(member);
    setShowFamilyModal(true);
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
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
                  <input
                    value={profilePhone}
                    onChange={(event) => setProfilePhone(formatUsPhoneInput(event.target.value))}
                    inputMode="numeric"
                    maxLength={14}
                    className="min-h-10 rounded-md border border-black/15 px-4 text-[14px] outline-none"
                  />
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
                <button
                  type="button"
                  onClick={() => setShowEmergencyContactModal(true)}
                  className="text-2xl leading-none text-black/45"
                >
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
                    {[
                      customer.emergencyContactEmail,
                      customer.emergencyContactPhone ? formatUsPhoneInput(customer.emergencyContactPhone) : "",
                    ]
                      .filter(Boolean)
                      .join(" \u00B7 ")}
                  </div>
                </div>
                <div className="flex gap-3 text-black/45">
                  <HoverIconButton
                    icon="edit"
                    label="Edit Contact"
                    onClick={() => setShowEmergencyContactModal(true)}
                  />
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
                onClick={openNewFamilyMemberModal}
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
                          {[
                            member.gender !== "Unspecified" ? member.gender : "",
                            familyMemberAgeLabel(member),
                          ]
                            .filter(Boolean)
                            .join(" Ã‚Â· ") || "Member"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 text-black/45">
                      <HoverIconButton
                        icon="edit"
                        label="Edit Member"
                        onClick={() => openEditFamilyMemberModal(member)}
                      />
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
          initialMember={editingFamilyMember}
          onClose={() => {
            setShowFamilyModal(false);
            setEditingFamilyMember(null);
          }}
          onSave={(member) => {
            const nextFamilyMembers = editingFamilyMember
              ? familyMembers.map((item) => (item.id === member.id ? member : item))
              : [...familyMembers, member];
            saveFamilyMembers(nextFamilyMembers);
            setShowFamilyModal(false);
            setEditingFamilyMember(null);
          }}
        />
      ) : null}

      {showEmergencyContactModal ? (
        <EmergencyContactModal
          initialName={customer.emergencyContactName}
          initialEmail={customer.emergencyContactEmail}
          initialPhone={customer.emergencyContactPhone}
          onClose={() => setShowEmergencyContactModal(false)}
          onSave={saveEmergencyContactValues}
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
  showMobileMenu = false,
  showMobileSettingsIndex = false,
  state,
  showToast,
  onSave,
  resourceIdsByName,
}: {
  backHref: string;
  section: SettingsSection;
  showMobileMenu?: boolean;
  showMobileSettingsIndex?: boolean;
  state: AppState;
  showToast: (message: string) => void;
  onSave: (next: AppState) => void;
  resourceIdsByName: Record<string, string>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(state);
  const isBasics = section === "basics";
  const isRooms = section === "rooms";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingWaiver, setIsUploadingWaiver] = useState(false);
  const [waiverUploadError, setWaiverUploadError] = useState("");
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [roomSearch, setRoomSearch] = useState("");

  useEffect(() => {
    setDraft(state);
  }, [state]);

  function updateFacility(next: Partial<AppState["facility"]>) {
    setDraft((current) => {
      const facility = {
        ...current.facility,
        ...next,
      };

      return {
        ...current,
        facility: {
          ...facility,
          address: composeFacilityAddress(facility),
        },
      };
    });
  }

  function updatePolicies(next: Partial<AppState["policies"]>) {
    setDraft((current) => ({
      ...current,
      policies: {
        ...current.policies,
        ...next,
      },
    }));
  }

  function persistResources(resourceNames: string[]) {
    const next = {
      ...draft,
      resources: resourceNames,
    };

    setDraft(next);
    onSave(next);
  }

  function moveRoom(index: number, direction: "up" | "down") {
    persistResources(moveListItem(draft.resources, index, direction));
  }

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

  const sectionTitle = isBasics ? "Basics" : isRooms ? "Rooms" : "Policies";
  const filteredRooms = draft.resources.filter((resource) =>
    resource.toLowerCase().includes(roomSearch.trim().toLowerCase())
  );
  const mobileMoreItems: Array<{
    label: string;
    icon: IconName;
    href?: string;
    action?: () => void;
  }> = [
    { label: "Marketing", icon: "send", href: bookingAdminRouteByView.marketing },
    { label: "Retail", icon: "bag", href: bookingAdminRouteByView.retail },
    { label: "Reports", icon: "bar", href: bookingAdminRouteByView.reports },
    { label: "Settings", icon: "gear", href: bookingAdminRouteByView.settings },
    { label: "Help Center", icon: "help", action: () => showToast("Help Center is ready for the next pass.") },
    { label: "Contact Us", icon: "message", action: () => showToast("Contact Us is ready for the next pass.") },
  ];

  return (
    <section className="min-h-screen bg-white">
      <div className={`px-5 py-4 xl:hidden ${showMobileMenu || showMobileSettingsIndex ? "hidden" : ""}`}>
        <Link href={backHref} className="inline-flex items-center gap-2 text-[15px] font-medium text-black">
          <Icon name="arrow-left" className="h-4 w-4" />
          {sectionTitle}
        </Link>
      </div>

      <div className="hidden min-h-screen xl:grid xl:grid-cols-[284px_minmax(0,1fr)]">
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

        <div className="px-7 py-8 lg:px-8">
          <div className="max-w-[1084px]">
            <PageHeader
              title={isBasics ? "Basics" : isRooms ? "Rooms" : "Policies"}
              subtitle={
                isBasics
                  ? "Manage your facility settings."
                  : isRooms
                    ? "Rooms are bookable spaces within your facility."
                  : "Configure booking policies and rules for your facility."
              }
            >
              {isRooms ? (
                <PrimaryButton icon="plus" onClick={() => router.push("/admin/settings/rooms/add")}>
                  New
                </PrimaryButton>
              ) : null}
            </PageHeader>

            <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-sm">
              <div className="border-t-4 border-t-[#4866b0]" />

              {isBasics ? (
                <>
                  <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Facility Details</div>
                  <div className="divide-y divide-black/10">
                    <div className="grid gap-6 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                      <div>
                        <div className="text-[18px] font-semibold">Basics</div>
                        <p className="mt-2 text-sm leading-relaxed text-black/65">
                          Set the facility name and booking page URL
                        </p>
                      </div>
                      <div className="grid gap-6">
                        <label className="grid max-w-[360px] gap-1.5">
                          <span className="text-[13px] font-semibold text-black/70">Facility Name</span>
                          <input
                            value={draft.facility.name}
                            onChange={(event) =>
                              updateFacility({
                                name: event.target.value,
                                organizationName: event.target.value,
                              })
                            }
                            className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                          />
                        </label>

                        <div className="grid gap-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-black/70">Facility Booking Page</span>
                            <button type="button" className="text-[13px] font-medium text-[#6379a5]">
                              Change
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              value={draft.facility.publicUrl}
                              onChange={(event) => updateFacility({ publicUrl: event.target.value })}
                              className="min-h-12 w-full rounded-lg border border-black/10 px-4 pr-12 text-[15px] outline-none focus:border-black/30"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(draft.facility.publicUrl);
                                showToast("Booking link copied.");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/45"
                              aria-label="Copy booking page URL"
                            >
                              <Icon name="copy" className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-4">
                            <ToggleSwitch
                              checked={draft.facility.publicFacingCalendar}
                              onChange={(checked) => updateFacility({ publicFacingCalendar: checked })}
                              label="Public facing calendar"
                            />
                            <span className="text-[16px] font-medium text-black">Public Facing Calendar</span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-black/65">
                            Get a public shareable link to the facility calendar
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                      <div>
                        <div className="text-[18px] font-semibold">Contact Info</div>
                        <p className="mt-2 text-sm leading-relaxed text-black/65">
                          Add the facility&apos;s location and phone number
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <TextField
                          label="Organization name"
                          value={draft.facility.organizationName}
                          onChange={(value) => updateFacility({ organizationName: value })}
                        />
                        <SelectField
                          label="Country or region"
                          value={draft.facility.country}
                          onChange={(value) => updateFacility({ country: value })}
                          options={countryRegionOptions}
                        />
                        <TextField
                          label="Address line 1"
                          value={draft.facility.addressLine1}
                          onChange={(value) => updateFacility({ addressLine1: value })}
                        />
                        <TextField
                          label="Address line 2"
                          value={draft.facility.addressLine2}
                          placeholder="Apt., suite, unit number, etc. (optional)"
                          onChange={(value) => updateFacility({ addressLine2: value })}
                        />
                        <TextField
                          label="City"
                          value={draft.facility.city}
                          onChange={(value) => updateFacility({ city: value })}
                        />
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_340px]">
                          <SelectField
                            label="State"
                            value={draft.facility.stateRegion}
                            onChange={(value) => updateFacility({ stateRegion: value })}
                            options={usStateOptions}
                          />
                          <TextField
                            label="ZIP code"
                            value={draft.facility.postalCode}
                            onChange={(value) =>
                              updateFacility({ postalCode: value.replace(/[^\d-]/g, "").slice(0, 10) })
                            }
                          />
                        </div>
                        <label className="grid gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-black/70">Phone</span>
                            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">
                              Optional
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="inline-flex min-h-10 min-w-[52px] items-center justify-center gap-1 rounded-lg border border-black/10 px-2 text-[13px] font-medium text-black/70">
                              <span aria-hidden="true" className="text-[18px] leading-none">
                                {"\uD83C\uDDFA\uD83C\uDDF8"}
                              </span>
                              <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90 text-black/45" />
                            </div>
                            <input
                              value={draft.facility.phone}
                              onChange={(event) => updateFacility({ phone: formatUsPhoneInput(event.target.value) })}
                              inputMode="numeric"
                              maxLength={14}
                              className="min-h-10 flex-1 rounded-lg border border-black/10 px-3 outline-none focus:border-black/30"
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              ) : isRooms ? (
                <>
                  <div className="border-b border-black/10 px-5 py-4">
                    <div className="max-w-full">
                      <div className="relative">
                        <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
                        <input
                          value={roomSearch}
                          onChange={(event) => setRoomSearch(event.target.value)}
                          placeholder="Search rooms..."
                          className="min-h-12 w-full rounded-lg border border-black/10 bg-white pl-14 pr-4 text-[15px] outline-none focus:border-black/30"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#f3f6fa]">
                          <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Name</th>
                          <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Schedule</th>
                          <th className="px-5 py-5 text-right text-[15px] font-semibold text-black">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        <tr className="bg-white">
                          <td className="px-5 py-5 align-middle">
                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                onClick={() => setRoomsExpanded((current) => !current)}
                                className="text-black/55"
                                aria-label={roomsExpanded ? "Collapse rooms" : "Expand rooms"}
                              >
                                <Icon
                                  name="chevron"
                                  className={`h-5 w-5 transition ${roomsExpanded ? "rotate-90" : ""}`}
                                />
                              </button>
                              <span className="text-[18px] font-semibold text-black">{draft.facility.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-5 align-middle">
                            <span className="inline-flex rounded-full bg-black/[0.06] px-4 py-1.5 text-[14px] font-medium text-black/80">
                              Working Hours
                            </span>
                          </td>
                          <td className="px-5 py-5 align-middle">
                            <div className="flex items-center justify-end gap-6 text-black/45">
                              <button
                                type="button"
                                onClick={() => showToast("Facility details are edited in Basics.")}
                                aria-label="Edit facility"
                              >
                                <Icon name="edit" className="h-5 w-5" />
                              </button>
                              <span className="text-black/20">
                                <Icon name="chevron" className="h-5 w-5 rotate-90" />
                              </span>
                              <span className="text-black/20">
                                <Icon name="chevron" className="h-5 w-5 -rotate-90" />
                              </span>
                            </div>
                          </td>
                        </tr>

                        {roomsExpanded
                          ? filteredRooms.map((room) => {
                              const sourceIndex = draft.resources.findIndex((item) => item === room);
                              const isFirst = sourceIndex === 0;
                              const isLast = sourceIndex === draft.resources.length - 1;

                              return (
                                <tr key={`${room}-${sourceIndex}`} className="bg-white">
                                  <td className="px-5 py-5 align-middle">
                                    <div className="pl-[88px] text-[18px] font-medium text-black">{room}</div>
                                  </td>
                                  <td className="px-5 py-5 align-middle">
                                    <span className="inline-flex rounded-full bg-black/[0.06] px-4 py-1.5 text-[14px] font-medium text-black/80">
                                      Working Hours
                                    </span>
                                  </td>
                                  <td className="px-5 py-5 align-middle">
                                    <div className="flex items-center justify-end gap-6">
                                      <button
                                        type="button"
                                        onClick={() => router.push(getRoomEditorHref(room, resourceIdsByName))}
                                        className="text-black/45 transition hover:text-black"
                                        aria-label={`Edit ${room}`}
                                      >
                                        <Icon name="edit" className="h-5 w-5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveRoom(sourceIndex, "up")}
                                        disabled={isFirst}
                                        className="text-black/45 transition hover:text-black disabled:text-black/20"
                                        aria-label={`Move ${room} up`}
                                      >
                                        <Icon name="chevron" className="h-5 w-5 rotate-90" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveRoom(sourceIndex, "down")}
                                        disabled={isLast}
                                        className="text-black/45 transition hover:text-black disabled:text-black/20"
                                        aria-label={`Move ${room} down`}
                                      >
                                        <Icon name="chevron" className="h-5 w-5 -rotate-90" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          : null}

                        {roomsExpanded && filteredRooms.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-5 py-10 text-center text-[15px] text-black/45">
                              No rooms found.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
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
                          onChange={(checked) => updatePolicies({ waiverEnabled: checked })}
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
                          onChange={(event) => updatePolicies({ waiverIntro: event.target.value })}
                          className="min-h-28 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                        />
                      </label>
                      <label className="inline-flex items-center gap-3 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={draft.policies.waiverAllowInPerson}
                          onChange={(event) => updatePolicies({ waiverAllowInPerson: event.target.checked })}
                          className="h-5 w-5 accent-[#4866b0]"
                        />
                        Allow staff to collect waiver signatures in person
                      </label>
                    </div>
                  </div>
                </>
              )}

              {!isRooms ? (
                <div className="flex justify-end border-t border-black/10 bg-[#f7f8fb] px-5 py-4">
                  <PrimaryButton icon="gear" onClick={() => onSave(draft)}>
                    Save
                  </PrimaryButton>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 xl:hidden">
        {showMobileMenu ? (
          <div className="space-y-3 pt-4">
            {mobileMoreItems.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex min-h-[78px] items-center justify-between rounded-[16px] border border-black/12 bg-white px-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-center gap-5">
                    <Icon name={item.icon} className="h-5 w-5 text-black" />
                    <span className="text-[17px] font-medium text-black">{item.label}</span>
                  </div>
                  <Icon name="chevron" className="h-5 w-5 rotate-180 text-black" />
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex min-h-[78px] w-full items-center justify-between rounded-[16px] border border-black/12 bg-white px-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-center gap-5">
                    <Icon name={item.icon} className="h-5 w-5 text-black" />
                    <span className="text-[17px] font-medium text-black">{item.label}</span>
                  </div>
                  <Icon name="chevron" className="h-5 w-5 rotate-180 text-black" />
                </button>
              )
            )}
          </div>
        ) : showMobileSettingsIndex ? (
          <div className="pt-2">
            <div className="px-1 text-[26px] font-medium text-black">Settings</div>
            <div className="mt-10 space-y-9 px-1">
              {settingsNavGroups.map((group) => (
                <div key={group.title}>
                  <div className="text-[14px] font-semibold uppercase tracking-[0.04em] text-black/55">
                    {group.title}
                  </div>
                  <div className="mt-4 border-b border-black/10">
                    {group.items.map((item) => {
                      const rowClassName =
                        "flex min-h-[72px] items-center justify-between gap-4 text-left text-black";

                      const content = (
                        <>
                          <div className="flex items-center gap-6">
                            <Icon name={item.icon} className="h-5 w-5 text-black/50" />
                            <span className="text-[18px] font-medium text-black">{item.label}</span>
                          </div>
                          <Icon name="chevron" className="h-5 w-5 rotate-180 text-black/35" />
                        </>
                      );

                      if (item.href) {
                        return (
                          <Link key={item.label} href={item.href} className={rowClassName}>
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => showToast(`${item.label} is next in the Settings build-out.`)}
                          className={`${rowClassName} w-full`}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="overflow-hidden rounded-[10px] border border-black/12 bg-white shadow-sm">
          <div className="border-t-4 border-t-[#4866b0]" />
          {isBasics ? (
            <>
              <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Facility Details</div>
              <div className="px-6 py-6">
                <div className="text-[16px] font-medium text-black">Basics</div>
                <p className="mt-1 text-[13px] leading-6 text-black/70">
                  Set the facility name and booking page URL
                </p>

                <div className="mt-8 space-y-5">
                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/85">Facility Name</span>
                    <input
                      value={draft.facility.name}
                      onChange={(event) => updateFacility({ name: event.target.value, organizationName: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium text-black/85">Facility Booking Page</span>
                      <button type="button" className="text-[13px] font-medium text-[#6379a5]">
                        Change
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        value={draft.facility.publicUrl}
                        onChange={(event) => updateFacility({ publicUrl: event.target.value })}
                        className="min-h-[48px] w-full rounded-[8px] border border-black/12 px-4 pr-12 text-[14px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(draft.facility.publicUrl);
                          showToast("Booking link copied.");
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/45"
                        aria-label="Copy booking page URL"
                      >
                        <Icon name="copy" className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <ToggleSwitch
                        checked={draft.facility.publicFacingCalendar}
                        onChange={(checked) => updateFacility({ publicFacingCalendar: checked })}
                        label="Public facing calendar"
                      />
                      <span className="text-[14px] font-medium text-black">Public Facing Calendar</span>
                    </div>
                    <p className="mt-3 text-[13px] leading-6 text-black/70">
                      Get a public shareable link to the facility calendar
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-black/10 px-6 py-6">
                <div className="text-[16px] font-medium text-black">Contact Info</div>
                <p className="mt-1 text-[13px] leading-6 text-black/70">
                  Add the facility&apos;s location and phone number
                </p>

                <div className="mt-8 space-y-5">
                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">Organization name</span>
                    <input
                      value={draft.facility.organizationName}
                      onChange={(event) => updateFacility({ organizationName: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">Country or region</span>
                    <select
                      value={draft.facility.country}
                      onChange={(event) => updateFacility({ country: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    >
                      {countryRegionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">Address line 1</span>
                    <input
                      value={draft.facility.addressLine1}
                      onChange={(event) => updateFacility({ addressLine1: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">Address line 2</span>
                    <input
                      value={draft.facility.addressLine2}
                      placeholder="Apt., suite, unit number, etc. (optional)"
                      onChange={(event) => updateFacility({ addressLine2: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">City</span>
                    <input
                      value={draft.facility.city}
                      onChange={(event) => updateFacility({ city: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">State</span>
                    <select
                      value={draft.facility.stateRegion}
                      onChange={(event) => updateFacility({ stateRegion: event.target.value })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    >
                      {usStateOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-black/70">ZIP code</span>
                    <input
                      value={draft.facility.postalCode}
                      onChange={(event) => updateFacility({ postalCode: event.target.value.replace(/[^\d-]/g, "").slice(0, 10) })}
                      className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-black/85">Phone</span>
                      <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">Optional</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex min-h-[48px] min-w-[54px] items-center justify-center gap-1 rounded-[8px] border border-black/12 px-2 text-[13px] font-medium text-black/70">
                        <span aria-hidden="true" className="text-[19px] leading-none">
                          {"\uD83C\uDDFA\uD83C\uDDF8"}
                        </span>
                        <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90 text-black/45" />
                      </div>
                      <input
                        value={draft.facility.phone}
                        onChange={(event) => updateFacility({ phone: formatUsPhoneInput(event.target.value) })}
                        inputMode="numeric"
                        maxLength={14}
                        className="min-h-[48px] flex-1 rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                      />
                    </div>
                  </label>
                </div>
              </div>
            </>
          ) : isRooms ? (
            <>
              <div className="border-b border-black/10 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[28px] font-medium text-black">Rooms</div>
                    <p className="mt-1 text-[14px] leading-6 text-black/70">
                      Rooms are bookable spaces within your facility.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/admin/settings/rooms/add")}
                    className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-[#1f1b1b] px-5 text-[16px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                    New
                  </button>
                </div>
                <div className="mt-5 relative">
                  <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
                  <input
                    value={roomSearch}
                    onChange={(event) => setRoomSearch(event.target.value)}
                    placeholder="Search rooms..."
                    className="min-h-[48px] w-full rounded-[8px] border border-black/12 pl-14 pr-4 text-[14px] outline-none"
                  />
                </div>
              </div>

              <div className="overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f3f6fa]">
                      <th className="px-4 py-4 text-left text-[14px] font-semibold text-black">Name</th>
                      <th className="px-4 py-4 text-left text-[14px] font-semibold text-black">Schedule</th>
                      <th className="px-4 py-4 text-right text-[14px] font-semibold text-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {filteredRooms.map((room) => {
                      const sourceIndex = draft.resources.findIndex((item) => item === room);
                      const isFirst = sourceIndex === 0;
                      const isLast = sourceIndex === draft.resources.length - 1;

                      return (
                        <tr key={`${room}-${sourceIndex}`}>
                          <td className="px-4 py-4 align-middle text-[15px] font-medium text-black">{room}</td>
                          <td className="px-4 py-4 align-middle">
                            <span className="inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-medium text-black/80">
                              Working Hours
                            </span>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div className="flex items-center justify-end gap-4 text-black/45">
                              <button
                                type="button"
                                onClick={() => router.push(getRoomEditorHref(room, resourceIdsByName))}
                                aria-label={`Edit ${room}`}
                              >
                                <Icon name="edit" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRoom(sourceIndex, "up")}
                                disabled={isFirst}
                                className="disabled:text-black/20"
                                aria-label={`Move ${room} up`}
                              >
                                <Icon name="chevron" className="h-4 w-4 rotate-90" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRoom(sourceIndex, "down")}
                                disabled={isLast}
                                className="disabled:text-black/20"
                                aria-label={`Move ${room} down`}
                              >
                                <Icon name="chevron" className="h-4 w-4 -rotate-90" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Booking Policies</div>
              <div className="px-6 py-6">
                <div className="text-[16px] font-medium text-black">Liability Waiver</div>
                <p className="mt-1 text-[13px] leading-6 text-black/70">
                  Display and require customers to agree to your liability waiver before they are allowed to make any booking.
                </p>
                <div className="mt-6 flex items-center gap-6">
                  <span className="text-[15px] font-medium text-black">Off</span>
                  <ToggleSwitch
                    checked={draft.policies.waiverEnabled}
                    onChange={(checked) => updatePolicies({ waiverEnabled: checked })}
                    label="Toggle liability waiver"
                  />
                  <span className="text-[15px] font-medium text-black">On</span>
                </div>
              </div>
            </>
          )}

          {!isRooms ? (
            <div className="flex justify-end border-t border-black/10 bg-[#f7f8fb] px-6 py-5">
              <button
                type="button"
                onClick={() => onSave(draft)}
                className="rounded-lg bg-[#1f1b1b] px-6 py-3 text-[15px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
              >
                Save
              </button>
            </div>
          ) : null}
        </div>
        )}
      </div>
    </section>
  );
}

function RoomEditorView({
  backHref,
  state,
  showToast,
  roomName,
  canDelete = false,
  onCancel,
  onDelete,
  onSave,
}: {
  backHref: string;
  state: AppState;
  showToast: (message: string) => void;
  roomName?: string;
  canDelete?: boolean;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSave: (draft: RoomEditorDraft) => Promise<void>;
}) {
  const initialDraft = useMemo<RoomEditorDraft>(() => ({
    name: roomName ?? "",
    schedule: "Working Hours",
    parentRoom: state.facility.name,
  }), [roomName, state.facility.name]);
  const [draft, setDraft] = useState<RoomEditorDraft>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const hierarchyOptions = [state.facility.name, ...state.resources];
  const pageTitle = roomName ?? "Add Room";

  return (
    <section className="min-h-screen bg-white">
      <div className="px-5 py-4 xl:hidden">
        <Link href="/admin/settings/rooms" className="inline-flex items-center gap-2 text-[15px] font-medium text-black">
          <Icon name="arrow-left" className="h-4 w-4" />
          {pageTitle}
        </Link>
      </div>

      <div className="hidden min-h-screen xl:grid xl:grid-cols-[284px_minmax(0,1fr)]">
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
                    const isActive = item.section === "rooms";
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive && item.section === "rooms" ? "bg-[#e9e9e9] font-semibold" : "text-black/75 hover:bg-black/5",
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

        <div className="px-7 py-8 lg:px-8">
          <div className="max-w-[1084px]">
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-3 text-[14px] font-medium text-black/60">
                <Link href="/admin/settings/rooms" className="text-black/70 hover:text-black">Rooms</Link>
                <span>/</span>
                <span className="text-black">{pageTitle}</span>
              </div>
              <h1 className="text-[24px] font-semibold text-black">{pageTitle}</h1>
            </div>

            <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-sm">
              <div className="border-t-4 border-t-[#4866b0]" />
              <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Room Details</div>

              <div className="divide-y divide-black/10">
                <div className="grid gap-6 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div>
                    <div className="text-[18px] font-semibold">Basics</div>
                    <p className="mt-2 text-sm leading-relaxed text-black/65">Set the name of this room</p>
                  </div>
                  <div className="grid gap-4">
                    <TextField
                      label="Name"
                      value={draft.name}
                      onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-6 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div>
                    <div className="text-[18px] font-semibold">Schedule</div>
                    <p className="mt-2 text-sm leading-relaxed text-black/65">
                      Assign a schedule to this room to set opening & closing times on the room&apos;s availability
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <SelectField
                      label="Schedule"
                      value={draft.schedule}
                      onChange={(value) => setDraft((current) => ({ ...current, schedule: value }))}
                      options={["Working Hours"]}
                    />
                  </div>
                </div>

                <div className="grid gap-6 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div>
                    <div className="text-[18px] font-semibold">Hierarchy</div>
                    <p className="mt-2 text-sm leading-relaxed text-black/65">
                      Decide where this room should exist inside the setup of your facility
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <SelectField
                      label="Room should exist within"
                      value={draft.parentRoom}
                      onChange={(value) => setDraft((current) => ({ ...current, parentRoom: value }))}
                      options={hierarchyOptions}
                    />
                    <p className="text-sm text-black/60">Rooms can live inside other rooms - up to 4 levels deep.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-black/10 bg-[#f7f8fb] px-5 py-4">
                {roomName ? (
                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => void onDelete?.()}
                    className="rounded-lg border border-black/10 bg-white px-5 py-2.5 text-[15px] font-medium text-black/30 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => void onSave(draft)}
                  className="rounded-lg bg-[#1f1b1b] px-6 py-3 text-[15px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 xl:hidden">
        <div className="mb-4 flex items-center gap-3 text-[14px] font-medium text-black/60">
          <Link href="/admin/settings/rooms" className="text-black/70 hover:text-black">Rooms</Link>
          <span>/</span>
          <span className="text-black">{pageTitle}</span>
        </div>
        <h1 className="mb-5 text-[28px] font-medium text-black">{pageTitle}</h1>

        <div className="overflow-hidden rounded-[10px] border border-black/12 bg-white shadow-sm">
          <div className="border-t-4 border-t-[#4866b0]" />
          <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Room Details</div>

          <div className="divide-y divide-black/10">
            <div className="px-6 py-6">
              <div className="text-[16px] font-medium text-black">Basics</div>
              <p className="mt-1 text-[13px] leading-6 text-black/70">Set the name of this room</p>
              <div className="mt-6">
                <label className="grid gap-2">
                  <span className="text-[14px] font-medium text-black/85">Name</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="text-[16px] font-medium text-black">Schedule</div>
              <p className="mt-1 text-[13px] leading-6 text-black/70">
                Assign a schedule to this room to set opening & closing times on the room&apos;s availability
              </p>
              <div className="mt-6">
                <label className="grid gap-2">
                  <span className="text-[14px] font-medium text-black/85">Schedule</span>
                  <select
                    value={draft.schedule}
                    onChange={(event) => setDraft((current) => ({ ...current, schedule: event.target.value }))}
                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                  >
                    <option value="Working Hours">Working Hours</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="text-[16px] font-medium text-black">Hierarchy</div>
              <p className="mt-1 text-[13px] leading-6 text-black/70">
                Decide where this room should exist inside the setup of your facility
              </p>
              <div className="mt-6 grid gap-2">
                <span className="text-[14px] font-medium text-black/85">Room should exist within</span>
                <select
                  value={draft.parentRoom}
                  onChange={(event) => setDraft((current) => ({ ...current, parentRoom: event.target.value }))}
                  className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                >
                  {hierarchyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="text-[13px] leading-6 text-black/70">
                  Rooms can live inside other rooms - up to 4 levels deep.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 border-t border-black/10 bg-[#f7f8fb] px-6 py-5">
            <button type="button" onClick={onCancel} className="text-[15px] font-medium text-black/65">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSave(draft)}
              className="rounded-lg bg-[#1f1b1b] px-6 py-3 text-[15px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
            >
              Save
            </button>
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
  const toolbarButtons = ["ÃƒÂ¢Ã¢â‚¬Â Ã‚Â¶", "ÃƒÂ¢Ã¢â‚¬Â Ã‚Â·", "ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¡", "B", "I", "U", "S", "<>", "ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬Â", "ÃƒÂ¢Ã‹Å“Ã‚Â°", "ÃƒÂ¢Ã‹Å“Ã‚Â·"];

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
                          <span aria-hidden="true">ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢</span>
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
  showToast,
  showBookingConflictDialog,
  onClose,
  onSave,
}: {
  modal: NonNullable<ModalState>;
  state: AppState;
  activeDate: string;
  showToast: (message: string) => void;
  showBookingConflictDialog: (message?: string) => void;
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
          rooms: state.resources[0] ? [state.resources[0]] : [],
          category: "rentals" as const,
          status: "Active" as const,
          calendarColor: DEFAULT_SERVICE_CALENDAR_COLOR,
        }
      : null;

  const booking =
    modal.type === "booking"
      ? state.bookings.find((item) => item.id === modal.id) ?? {
          id: "",
          date: modal.seed?.date ?? activeDate,
          start: modal.seed?.start ?? "09:00",
          end: modal.seed?.end ?? "10:00",
          customerId: modal.seed?.customerId ?? state.customers[0]?.id ?? "",
          serviceId: modal.seed?.serviceId ?? state.services[0]?.id ?? "",
          serviceName: state.services[0]?.name ?? "",
          calendarColor: state.services[0]?.calendarColor ?? DEFAULT_SERVICE_CALENDAR_COLOR,
          resource: modal.seed?.resource ?? state.resources[0] ?? "",
          status: modal.seed?.status ?? ("Confirmed" as const),
          paid: modal.seed?.paid ?? false,
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
  const bookingDraft = modal.type === "booking" ? (draft as Booking) : null;
  const matchedBookingService =
    bookingDraft
      ? findServiceForCalendarSlot(state.services, bookingDraft.resource, bookingDurationMinutes(bookingDraft))
      : null;
  const selectedBookingService =
    bookingDraft ? state.services.find((item) => item.id === bookingDraft.serviceId) ?? null : null;
  const effectiveBookingService = selectedBookingService ?? matchedBookingService;
  const canSave =
    modal.type !== "customer" ||
    Boolean(customerName.first.trim() && customerName.last.trim() && customerDraft.email.trim());

  function save() {
    if (modal.type === "service") {
      const serviceDraft = draft as Service;
      const item = {
        ...serviceDraft,
        id: draft.id || makeId("svc"),
        rooms: serviceDraft.rooms?.length ? serviceDraft.rooms : serviceDraft.resource ? [serviceDraft.resource] : [],
        category: serviceDraft.category || inferServiceCategory(serviceDraft.name),
      };
      onSave({ ...state, services: upsert(state.services, item) }, "Service saved.", { type: "service", item });
    }
    if (modal.type === "booking") {
      const item = { ...(draft as Booking), id: draft.id || makeId("bk") };

      if (hasRoomBookingConflict(state.bookings, item)) {
        showBookingConflictDialog("This room is already booked for that time. Please choose another time or another room.");
        return;
      }

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

  function patchBooking(next: Partial<Booking>) {
    if (modal.type !== "booking") return;

    const current = draft as Booking;
    const merged = { ...current, ...next };
    const didChangeService = Object.prototype.hasOwnProperty.call(next, "serviceId");
    const didChangeStart = Object.prototype.hasOwnProperty.call(next, "start");
    const didChangeEnd = Object.prototype.hasOwnProperty.call(next, "end");
    const selectedServiceFromChange =
      didChangeService && next.serviceId
        ? state.services.find((item) => item.id === next.serviceId) ?? null
        : null;
    const selectedServiceFromDraft =
      !didChangeService && merged.serviceId
        ? state.services.find((item) => item.id === merged.serviceId) ?? null
        : null;

    const durationSource = selectedServiceFromChange ?? selectedServiceFromDraft;
    let normalizedBooking: Booking = { ...merged };

    if (selectedServiceFromChange) {
      const preferredRooms =
        selectedServiceFromChange.rooms?.length
          ? selectedServiceFromChange.rooms
          : selectedServiceFromChange.resource
            ? [selectedServiceFromChange.resource]
            : [];

      if (preferredRooms.length) {
        normalizedBooking.resource =
          preferredRooms.find((room) => room === normalizedBooking.resource) ?? preferredRooms[0];
      }

      normalizedBooking.end = minutesToTime(
        timeToMinutes(normalizedBooking.start) + selectedServiceFromChange.duration
      );
    } else if (durationSource && didChangeStart && !didChangeEnd) {
      normalizedBooking.end = minutesToTime(
        timeToMinutes(normalizedBooking.start) + durationSource.duration
      );
    }

    const nextService = findServiceForCalendarSlot(
      state.services,
      normalizedBooking.resource,
      bookingDurationMinutes(normalizedBooking)
    );
    const resolvedService =
      (didChangeService && next.serviceId
        ? state.services.find((item) => item.id === next.serviceId) ?? null
        : null) ?? nextService;

    setDraft({
      ...normalizedBooking,
      serviceId: resolvedService?.id ?? normalizedBooking.serviceId,
      serviceName: resolvedService?.name ?? normalizedBooking.serviceName,
      calendarColor: resolvedService?.calendarColor ?? normalizedBooking.calendarColor,
    } as typeof draft);
  }

  function cancelBooking() {
    if (modal.type !== "booking") return;
    const item = { ...(draft as Booking), status: "Cancelled" as const };
    onSave({ ...state, bookings: upsert(state.bookings, item) }, "Booking cancelled.", { type: "booking", item });
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
              <TextField label="Date" type="date" value={(draft as Booking).date} onChange={(value) => patchBooking({ date: value })} />
              <SelectField label="Status" value={(draft as Booking).status} onChange={(value) => patchBooking({ status: value as Booking["status"] })} options={["Confirmed", "Pending", "Cancelled"]} />
              <TextField label="Start" type="time" value={(draft as Booking).start} onChange={(value) => patchBooking({ start: value })} />
              <TextField label="End" type="time" value={(draft as Booking).end} onChange={(value) => patchBooking({ end: value })} />
              <SelectField
                label="Customer"
                value={(draft as Booking).customerId}
                onChange={(value) => patchBooking({ customerId: value })}
                options={state.customers.map((item): [string, string] => [item.id, `${item.player} (${item.name})`])}
              />
              <SelectField
                label="Service"
                value={(draft as Booking).serviceId}
                onChange={(value) => patchBooking({ serviceId: value })}
                options={state.services.map((item): [string, string] => [item.id, item.name])}
              />
              <SelectField label="Resource" value={(draft as Booking).resource} onChange={(value) => patchBooking({ resource: value })} options={state.resources} />
              <SelectField
                label="Payment"
                value={String((draft as Booking).paid)}
                onChange={(value) => patchBooking({ paid: value === "true" })}
                options={[
                  ["true", "Paid"],
                  ["false", "Unpaid"],
                ]}
              />
              <div className="sm:col-span-2 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-black/70">Booking Summary</div>
                    <div className="mt-2 text-base font-semibold text-black">
                      {effectiveBookingService?.name || "No matching service selected"}
                    </div>
                    <div className="mt-1 text-sm text-black/55">
                      {bookingDraft ? `${bookingDurationMinutes(bookingDraft)} minutes • ${bookingDraft.resource || "No room selected"}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-black/55">Price</div>
                    <div className="mt-2 text-xl font-semibold text-black">
                      {effectiveBookingService ? money(effectiveBookingService.price) : "--"}
                    </div>
                  </div>
                </div>
              </div>
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

        <div className="flex items-center justify-between gap-3 border-t border-black/10 px-5 py-4">
          <div>
            {modal.type === "booking" && modal.id && (draft as Booking).status !== "Cancelled" ? (
              <button
                type="button"
                onClick={cancelBooking}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Cancel Booking
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
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

