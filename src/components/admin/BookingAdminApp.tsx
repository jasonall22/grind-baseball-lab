"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import {
  type BookingAdminView,
  bookingAdminRouteByView,
} from "@/components/admin/bookingAdminRoutes";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type MembershipBillingPeriod = "Weekly" | "Monthly" | "Yearly";
type MembershipCreditScope = "all_services" | "selected_services";
type MembershipCreditLimitPeriod = "day" | "week" | "month";

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
  resource: string;
  rooms: string[];
  instructors?: string[];
  category: ServiceSection;
  status: "Active" | "Draft" | "Off";
  previewText?: string;
  description?: string;
  mediaUrl?: string;
  calendarColor: string;
  scheduleId?: string | null;
  collectTax?: boolean;
  collectFee?: boolean;
  membershipBillingPeriod?: MembershipBillingPeriod;
  membershipMemberLimit?: number | null;
  membershipCreditsPerDay?: number;
  membershipCreditLimitPeriod?: MembershipCreditLimitPeriod;
  membershipCreditScope?: MembershipCreditScope;
  membershipEligibleServiceIds?: string[];
  stripeProductId?: string | null;
  stripePriceId?: string | null;
};

type ScheduleSlot = {
  id: string;
  start: string;
  end: string;
  sortOrder: number;
};

type ScheduleDayConfig = {
  day: string;
  weekday: number;
  enabled: boolean;
  slots: ScheduleSlot[];
};

type ScheduleOverride = {
  id: string;
  date: string;
  isClosed: boolean;
  slots: ScheduleSlot[];
};

type ScheduleRecord = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  roomNames: string[];
  serviceNames: string[];
  dayConfigs: ScheduleDayConfig[];
  overrides: ScheduleOverride[];
};

type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  gender: string;
  birthDate: string;
};

type BillingCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

type BillingPayment = {
  id: string;
  amountCents: number;
  currency: string;
  status: "Pending" | "Succeeded" | "Failed" | "Cancelled" | "Refunded";
  description: string | null;
  receiptUrl: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  processedAt: string | null;
  createdAt: string;
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

type StaffRole = "Owner" | "Admin" | "Instructor" | "Staff";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  calendarColor?: string;
};

type StaffAvailabilityEntry = {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  start: string;
  end: string;
  resources: string[];
  color: string;
  recurring?: boolean;
  recurrenceId?: string;
  recurrenceFrequency?: StaffAvailabilityRecurrenceFrequency;
  recurrenceEndDate?: string;
};

type StaffAvailabilityRecurrenceFrequency = "daily" | "weekly" | "custom";

type StaffRoleSummary = {
  role: StaffRole;
  permissions: "All" | "Limited";
};

type RolePermissionRecord = {
  role: StaffRole;
  enabledKeys: string[];
};

type Booking = {
  id: string;
  date: string;
  start: string;
  end: string;
  customerId: string;
  playerName?: string;
  serviceId: string;
  serviceName?: string;
  calendarColor?: string;
  resource: string;
  status: "Confirmed" | "Pending" | "Cancelled";
  paid: boolean;
  paidByMembershipCredit?: boolean;
  membershipCreditMembershipId?: string;
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

type TaxRate = {
  id: string;
  name: string;
  percentage: string;
  taxId: string;
};

type CustomFee = {
  id: string;
  name: string;
  amount: string;
};

type RegistrationPersonalFieldKey = "name" | "gender" | "dateOfBirth";
type RegistrationContactFieldKey = "address" | "phoneNumber";
type RegistrationFieldConfig = {
  required: boolean;
  hidden: boolean;
};

type RegistrationAdditionalField = {
  id: string;
  label: string;
  type: "Short Text" | "Single-select";
  required: boolean;
};

type RegistrationSettings = {
  personalFields: Record<RegistrationPersonalFieldKey, RegistrationFieldConfig>;
  contactFields: Record<RegistrationContactFieldKey, RegistrationFieldConfig>;
  additionalFields: RegistrationAdditionalField[];
};

type ServiceSection =
  | "rentals"
  | "lessons"
  | "camps"
  | "classes"
  | "memberships"
  | "packages";

type BookingModalServiceKind = "rentals" | "lessons" | "camps" | "classes" | "unavailable";

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
  instructors: string[];
  reserveOnPurchase: "any" | "all";
  reserveEquipment: boolean;
  collectTax: boolean;
  collectFee: boolean;
  slotRestrictionSummary: string;
  serviceScheduleEnabled: boolean;
  scheduleId: string;
  emergencyContactInfo: boolean;
  customFieldsSummary: string;
  private: boolean;
  calendarColor: string;
};

type MembershipDraft = {
  name: string;
  description: string;
  price: string;
  billingPeriod: MembershipBillingPeriod;
  memberLimit: string;
  creditsPerDay: string;
  creditLimitPeriod: MembershipCreditLimitPeriod;
  creditScope: MembershipCreditScope;
  eligibleServiceIds: string[];
  private: boolean;
  stripeProductId: string;
  stripePriceId: string;
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
  schedule_id: string | null;
};

type BookingSettingsRow = {
  facility_name: string;
  public_url: string;
  timezone: string;
  address: string | null;
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_email: string | null;
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
  registration_personal_fields: unknown | null;
  registration_contact_fields: unknown | null;
  registration_additional_fields: unknown[] | null;
  tax_rates: unknown[] | null;
  custom_fees: unknown[] | null;
};

type BookingServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | string;
  resource_id: string | null;
  resource_names: string[] | null;
  instructor_names: string[] | null;
  service_type: ServiceSection | null;
  status: Service["status"];
  sort_order: number;
  calendar_color: string | null;
  schedule_id: string | null;
  collect_tax?: boolean | null;
  collect_fee?: boolean | null;
  membership_billing_period: MembershipBillingPeriod | null;
  membership_member_limit: number | null;
  membership_credits_per_day: number | null;
  membership_credit_limit_period?: MembershipCreditLimitPeriod | null;
  membership_credit_scope: MembershipCreditScope | null;
  membership_eligible_service_ids: string[] | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

type BookingScheduleRow = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_active: boolean;
};

type BookingScheduleSlotRow = {
  id: string;
  schedule_id: string;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
};

type BookingScheduleOverrideRow = {
  id: string;
  schedule_id: string;
  override_date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
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

type CustomerMembershipStatus = "Active" | "Paused" | "Past Due" | "Cancelled" | "Expired";
type MembershipCancelTiming = "immediate" | "period_end";
type MembershipCancelOptions = {
  timing: MembershipCancelTiming;
  refundProrated: boolean;
};

type BookingCustomerMembershipRow = {
  id: string;
  customer_id: string;
  membership_service_id: string | null;
  status: string | null;
  billing_period: string | null;
  price_cents: number | null;
  credits_per_day: number | null;
  credit_limit_period?: MembershipCreditLimitPeriod | null;
  credit_scope: string | null;
  eligible_service_ids: string[] | null;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  auto_renew: boolean | null;
  started_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type CustomerMembershipRecord = {
  id: string;
  customerId: string;
  membershipServiceId: string;
  status: CustomerMembershipStatus;
  billingPeriod: MembershipBillingPeriod;
  priceCents: number;
  creditsPerDay: number;
  creditLimitPeriod: MembershipCreditLimitPeriod;
  creditScope: MembershipCreditScope;
  eligibleServiceIds: string[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  autoRenew: boolean;
  startedAt: string;
  cancelledAt: string;
  createdAt: string;
  updatedAt: string;
};

type MembershipCreditLedgerReason = "booking" | "manual_adjustment" | "refund" | "expiration";

type BookingMembershipCreditLedgerRow = {
  id: string;
  customer_membership_id: string | null;
  customer_id: string | null;
  booking_id: string | null;
  service_id: string | null;
  credit_date: string | null;
  amount: number | null;
  reason: string | null;
  note: string | null;
  created_at: string | null;
};

type MembershipCreditLedgerEntry = {
  id: string;
  customerMembershipId: string;
  customerId: string;
  bookingId: string;
  serviceId: string;
  creditDate: string;
  amount: number;
  reason: MembershipCreditLedgerReason;
  note: string;
  createdAt: string;
};

type BookingBookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_id: string | null;
  player_name: string | null;
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

type BookingStaffAvailabilityRow = {
  id: string;
  staff_member_id: string | null;
  availability_date: string;
  start_time: string;
  end_time: string;
  resource_names: string[] | null;
  color: string | null;
  is_recurring?: boolean | null;
  recurrence_id?: string | null;
  recurrence_frequency?: string | null;
  recurrence_end_date?: string | null;
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

type BookingStaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  sort_order: number;
  calendar_color?: string | null;
};

type BookingRolePermissionRow = {
  role: StaffRole;
  enabled_permissions: string[] | null;
  sort_order: number;
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
  profile: {
    firstName: string;
    lastName: string;
    email: string;
  };
  policies: {
    waiverEnabled: boolean;
    waiverDocumentUrl: string;
    waiverDocumentName: string;
    waiverIntro: string;
    waiverAllowInPerson: boolean;
  };
  registration: RegistrationSettings;
  taxesAndFees: {
    taxRates: TaxRate[];
    customFees: CustomFee[];
  };
  staff: StaffMember[];
  rolePermissions: RolePermissionRecord[];
  resources: string[];
  services: Service[];
  customers: Customer[];
  bookings: Booking[];
  availability: [string, boolean, string, string][];
  staffAvailability: StaffAvailabilityEntry[];
  schedules: ScheduleRecord[];
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
type SettingsSection =
  | "profile"
  | "basics"
  | "rooms"
  | "policies"
  | "registration"
  | "schedules"
  | "staff"
  | "roles"
  | "taxes-fees";

type RoomEditorDraft = {
  name: string;
  scheduleId: string;
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

const scheduleTimeOptions = Array.from({ length: 96 }, (_, index) => minutesToTime(index * 15));
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

type RolePermissionDefinition = {
  key: string;
  label: string;
  disabled?: boolean;
};

type RolePermissionGroup = {
  title: string;
  column: "left" | "right";
  permissions: RolePermissionDefinition[];
};

const rolePermissionGroups: RolePermissionGroup[] = [
  {
    title: "Rentals",
    column: "left",
    permissions: [
      { key: "rentals.view", label: "View rentals" },
      { key: "rentals.add", label: "Add rentals" },
      { key: "rentals.edit", label: "Edit rentals" },
      { key: "rentals.delete", label: "Delete rentals" },
    ],
  },
  {
    title: "Lessons",
    column: "left",
    permissions: [
      { key: "lessons.view", label: "View lessons" },
      { key: "lessons.add", label: "Add lessons" },
      { key: "lessons.edit", label: "Edit lessons" },
      { key: "lessons.delete", label: "Delete lessons" },
    ],
  },
  {
    title: "Camps",
    column: "left",
    permissions: [
      { key: "camps.view", label: "View camps" },
      { key: "camps.add", label: "Add camps" },
      { key: "camps.edit", label: "Edit camps" },
      { key: "camps.delete", label: "Delete camps" },
    ],
  },
  {
    title: "Classes",
    column: "left",
    permissions: [
      { key: "classes.view", label: "View classes" },
      { key: "classes.add", label: "Add classes" },
      { key: "classes.edit", label: "Edit classes" },
      { key: "classes.delete", label: "Delete classes" },
    ],
  },
  {
    title: "Memberships",
    column: "left",
    permissions: [
      { key: "memberships.view", label: "View memberships" },
      { key: "memberships.add", label: "Add memberships" },
      { key: "memberships.edit", label: "Edit memberships" },
      { key: "memberships.delete", label: "Delete memberships" },
    ],
  },
  {
    title: "Packages",
    column: "left",
    permissions: [
      { key: "packages.view", label: "View packages" },
      { key: "packages.add", label: "Add packages" },
      { key: "packages.edit", label: "Edit packages" },
      { key: "packages.delete", label: "Delete packages" },
    ],
  },
  {
    title: "Add Ons",
    column: "left",
    permissions: [
      { key: "addons.view", label: "View add ons" },
      { key: "addons.add", label: "Add add ons", disabled: true },
      { key: "addons.edit", label: "Edit add ons", disabled: true },
      { key: "addons.delete", label: "Delete add ons", disabled: true },
    ],
  },
  {
    title: "Calendar",
    column: "left",
    permissions: [
      { key: "calendar.view", label: "View calendar" },
      { key: "calendar.addBookings", label: "Add bookings" },
      { key: "calendar.editBookings", label: "Edit bookings" },
      { key: "calendar.deleteBookings", label: "Delete bookings" },
      {
        key: "calendar.viewOwnStaffCalendar",
        label: "View staff-based calendar (default to only their own)",
      },
      {
        key: "calendar.viewAllStaffCalendar",
        label: "View staff-based calendar for all staff members",
      },
      { key: "calendar.viewEquipmentCalendar", label: "View equipment calendar" },
    ],
  },
  {
    title: "Availability",
    column: "left",
    permissions: [
      { key: "availability.view", label: "View availability calendar" },
      { key: "availability.viewAny", label: "View availability for any staff member" },
      {
        key: "availability.viewOwn",
        label: "View availability for their own account",
        disabled: true,
      },
      { key: "availability.addAny", label: "Add availability for any staff member" },
      {
        key: "availability.addOwn",
        label: "Add availability for their own account",
        disabled: true,
      },
      { key: "availability.editAny", label: "Edit availability for any staff member" },
      {
        key: "availability.editOwn",
        label: "Edit availability for their own account",
        disabled: true,
      },
      { key: "availability.deleteAny", label: "Delete availability for any staff member" },
      {
        key: "availability.deleteOwn",
        label: "Delete availability for their own account",
        disabled: true,
      },
    ],
  },
  {
    title: "Customers",
    column: "left",
    permissions: [
      { key: "customers.view", label: "View customers" },
      { key: "customers.add", label: "Add customers" },
      { key: "customers.edit", label: "Edit customers" },
      { key: "customers.chargeRefund", label: "Charge and refund customers" },
      { key: "customers.addBilling", label: "Add custom billing options" },
      { key: "customers.editBilling", label: "Edit custom billing options" },
      { key: "customers.deleteBilling", label: "Delete custom billing options" },
      { key: "customers.createInvoices", label: "Create invoices" },
      { key: "customers.manageWallet", label: "Manage wallet balance" },
      { key: "customers.assignPackages", label: "Assign packages to customers" },
      { key: "customers.assignMemberships", label: "Assign memberships to customers" },
      { key: "customers.delete", label: "Delete customers" },
    ],
  },
  {
    title: "Equipment",
    column: "left",
    permissions: [
      { key: "equipment.view", label: "View equipment" },
      { key: "equipment.add", label: "Add equipment", disabled: true },
      { key: "equipment.edit", label: "Edit equipment", disabled: true },
      { key: "equipment.delete", label: "Delete equipment", disabled: true },
    ],
  },
  {
    title: "Marketing",
    column: "right",
    permissions: [
      { key: "marketing.view", label: "View marketing" },
      { key: "marketing.viewCoupons", label: "View coupons" },
      { key: "marketing.addCoupons", label: "Add coupons" },
      { key: "marketing.editCoupons", label: "Edit coupons" },
      { key: "marketing.deleteCoupons", label: "Delete coupons" },
      { key: "marketing.viewGiftCards", label: "View gift cards" },
      { key: "marketing.viewEmailBlasts", label: "View email blasts" },
      { key: "marketing.manageEmailBlasts", label: "Manage email blasts" },
    ],
  },
  {
    title: "Retail",
    column: "right",
    permissions: [
      { key: "retail.sellProducts", label: "Sell products" },
      { key: "retail.manageProducts", label: "Manage products" },
      { key: "retail.manageCategories", label: "Manage categories" },
    ],
  },
  {
    title: "Reports",
    column: "right",
    permissions: [
      { key: "reports.view", label: "View reports" },
      { key: "reports.bookings", label: "View bookings report" },
      { key: "reports.occupancy", label: "View occupancy report" },
      { key: "reports.customers", label: "View customer report" },
      { key: "reports.payroll", label: "View payroll report" },
      { key: "reports.revenue", label: "View revenue report" },
      { key: "reports.unpaid", label: "View unpaid registrations report" },
      { key: "reports.invoices", label: "View invoices report" },
      { key: "reports.retailSales", label: "View retail sales report" },
      { key: "reports.retailItems", label: "View retail items report" },
      { key: "reports.wallet", label: "View wallet report" },
      { key: "reports.customerCredits", label: "View customer credits report" },
    ],
  },
  {
    title: "Facility Settings",
    column: "right",
    permissions: [
      { key: "facility.view", label: "View facility settings" },
      { key: "facility.editDetails", label: "Edit facility details" },
      { key: "facility.viewRooms", label: "View rooms" },
      { key: "facility.addRooms", label: "Add rooms" },
      { key: "facility.editRooms", label: "Edit rooms" },
      { key: "facility.deleteRooms", label: "Delete rooms" },
      { key: "facility.viewSchedules", label: "View schedules" },
      { key: "facility.addSchedules", label: "Add schedules" },
      { key: "facility.editSchedules", label: "Edit schedules" },
      { key: "facility.deleteSchedules", label: "Delete schedules" },
    ],
  },
  {
    title: "Booking Settings",
    column: "right",
    permissions: [
      { key: "booking.viewPage", label: "View booking page settings" },
      { key: "booking.editPage", label: "Edit booking page settings" },
      { key: "booking.viewPolicies", label: "View policies" },
      { key: "booking.editPolicies", label: "Edit policies" },
      { key: "booking.viewRegistration", label: "View registration settings" },
      { key: "booking.editRegistration", label: "Edit registration settings" },
    ],
  },
  {
    title: "Payment Settings",
    column: "right",
    permissions: [
      { key: "payments.view", label: "View payment settings" },
      { key: "payments.edit", label: "Edit payment settings" },
      { key: "payments.viewTaxesFees", label: "View taxes & fees" },
      { key: "payments.manageTaxRates", label: "Manage tax rates" },
      { key: "payments.manageCustomFees", label: "Manage custom fees" },
    ],
  },
  {
    title: "People Settings",
    column: "right",
    permissions: [
      { key: "people.viewStaff", label: "View staff" },
      { key: "people.addStaff", label: "Add staff" },
      { key: "people.editStaff", label: "Edit staff" },
      { key: "people.deleteStaff", label: "Delete staff" },
      { key: "people.viewRoles", label: "View roles & permissions" },
      { key: "people.editRoles", label: "Edit roles & permissions", disabled: true },
    ],
  },
  {
    title: "Platform Settings",
    column: "right",
    permissions: [
      { key: "platform.viewPlan", label: "View plan & billing page" },
      { key: "platform.changePlan", label: "Change plan", disabled: true },
      { key: "platform.viewPayouts", label: "View payouts page" },
      { key: "platform.viewIntegrations", label: "View integrations page" },
      { key: "platform.editAutomations", label: "Edit automations" },
      { key: "platform.viewSenders", label: "View senders" },
      { key: "platform.addSenders", label: "Add senders" },
      { key: "platform.editSenders", label: "Edit senders" },
      { key: "platform.deleteSenders", label: "Delete senders" },
    ],
  },
];

const allEditableRolePermissionKeys = rolePermissionGroups.flatMap((group) =>
  group.permissions.filter((permission) => !permission.disabled).map((permission) => permission.key)
);

const ownerDefaultPermissionKeys = [...allEditableRolePermissionKeys];
const adminDefaultPermissionKeys = [...allEditableRolePermissionKeys];
const staffDefaultPermissionKeys = [
  "rentals.view",
  "lessons.view",
  "camps.view",
  "classes.view",
  "memberships.view",
  "packages.view",
  "calendar.view",
  "calendar.addBookings",
  "calendar.editBookings",
  "availability.view",
  "availability.viewAny",
  "customers.view",
  "customers.add",
  "customers.edit",
  "marketing.view",
  "retail.sellProducts",
  "reports.view",
];
const instructorDefaultPermissionKeys = [
  "lessons.view",
  "lessons.edit",
  "calendar.view",
  "calendar.addBookings",
  "calendar.editBookings",
  "availability.view",
  "availability.viewAny",
  "customers.view",
  "customers.edit",
];

const defaultRolePermissions: RolePermissionRecord[] = [
  { role: "Owner", enabledKeys: ownerDefaultPermissionKeys },
  { role: "Admin", enabledKeys: adminDefaultPermissionKeys },
  { role: "Staff", enabledKeys: staffDefaultPermissionKeys },
  { role: "Instructor", enabledKeys: instructorDefaultPermissionKeys },
];

function roleSlug(role: StaffRole) {
  return role.toLowerCase();
}

function roleFromSlug(value: string | null | undefined): StaffRole | null {
  if (!value) return null;
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  switch (normalized) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "staff":
      return "Staff";
    case "instructor":
      return "Instructor";
    default:
      return null;
  }
}

function normalizeRolePermissionKeys(value: unknown) {
  if (!Array.isArray(value)) return [];

  const validKeys = new Set(allEditableRolePermissionKeys);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => validKeys.has(item))
    )
  );
}

function normalizeRolePermissionEntry(value: unknown): RolePermissionRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RolePermissionRecord>;
  const role = normalizeStaffRole(item.role);
  return {
    role,
    enabledKeys: normalizeRolePermissionKeys(item.enabledKeys),
  };
}

function normalizeRolePermissions(value: unknown): RolePermissionRecord[] {
  const rows = Array.isArray(value)
    ? value.map(normalizeRolePermissionEntry).filter(Boolean) as RolePermissionRecord[]
    : [];

  const byRole = new Map(rows.map((row) => [row.role, row.enabledKeys]));

  return defaultRolePermissions.map((row) => ({
    role: row.role,
    enabledKeys: byRole.get(row.role) ?? row.enabledKeys,
  }));
}

function rolePermissionSummary(role: StaffRole, records: RolePermissionRecord[]) {
  const enabledKeys =
    records.find((record) => record.role === role)?.enabledKeys ?? [];

  return enabledKeys.length >= allEditableRolePermissionKeys.length ? "All" : "Limited";
}

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

const serviceSectionMeta: Record<
  ServiceSection,
  { label: string; singular: string; subtitle: string; basePath: string }
> = {
  rentals: {
    label: "Rentals",
    singular: "Rental",
    subtitle: "Let customers rent rooms at your facility.",
    basePath: "/admin/services/rentals",
  },
  lessons: {
    label: "Lessons",
    singular: "Lesson",
    subtitle: "Offer one-on-one and small-group instruction.",
    basePath: "/admin/services/lessons",
  },
  camps: {
    label: "Camps",
    singular: "Camp",
    subtitle: "Set up camp offerings and seasonal training programs.",
    basePath: "/admin/services/camps",
  },
  classes: {
    label: "Classes",
    singular: "Class",
    subtitle: "Create recurring class offerings for your athletes.",
    basePath: "/admin/services/classes",
  },
  memberships: {
    label: "Memberships",
    singular: "Membership",
    subtitle: "Manage membership-based access and recurring offers.",
    basePath: "/admin/services/memberships",
  },
  packages: {
    label: "Packages",
    singular: "Package",
    subtitle: "Bundle services together into bookable packages.",
    basePath: "/admin/services/packages",
  },
};

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
      {
        label: "Schedules",
        icon: "calendar",
        href: bookingAdminRouteByView["settings-schedules"],
        section: "schedules",
      },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Checkout", icon: "copy" },
      {
        label: "Taxes & Fees",
        icon: "bar",
        href: bookingAdminRouteByView["settings-taxes-fees"],
        section: "taxes-fees",
      },
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
      {
        label: "Registration",
        icon: "user",
        href: bookingAdminRouteByView["settings-registration"],
        section: "registration",
      },
      { label: "Custom Fields", icon: "edit" },
    ],
  },
  {
    title: "People",
    items: [
      {
        label: "Profile",
        icon: "user",
        href: bookingAdminRouteByView["settings-profile"],
        section: "profile",
      },
      {
        label: "Staff",
        icon: "user",
        href: bookingAdminRouteByView["settings-staff"],
        section: "staff",
      },
      {
        label: "Roles & Permissions",
        icon: "gear",
        href: bookingAdminRouteByView["settings-roles"],
        section: "roles",
      },
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
  profile: {
    firstName: "Jason",
    lastName: "Allaire",
    email: "info@grindbaseballlab.com",
  },
  policies: {
    waiverEnabled: false,
    waiverDocumentUrl: "",
    waiverDocumentName: "Liability Waiver",
    waiverIntro:
      "By clicking Agree & Continue, you confirm that the customer has had the opportunity to review this waiver and has agreed to its terms with full consent.",
    waiverAllowInPerson: true,
  },
  registration: {
    personalFields: {
      name: { required: true, hidden: false },
      gender: { required: true, hidden: false },
      dateOfBirth: { required: true, hidden: false },
    },
    contactFields: {
      address: { required: true, hidden: false },
      phoneNumber: { required: true, hidden: false },
    },
    additionalFields: [
      {
        id: "registration-organization",
        label: "Organization",
        type: "Short Text",
        required: false,
      },
      {
        id: "registration-referral",
        label: "Referral",
        type: "Single-select",
        required: false,
      },
      {
        id: "registration-shirt-size",
        label: "Shirt Size",
        type: "Single-select",
        required: false,
      },
    ],
  },
  taxesAndFees: {
    taxRates: [
      {
        id: "tax-state",
        name: "State Tax",
        percentage: "7",
        taxId: "",
      },
    ],
    customFees: [
      {
        id: "fee-service",
        name: "Service Fee",
        amount: "3.5",
      },
    ],
  },
  staff: [
    {
      id: "staff-august-backman",
      name: "August Backman",
      email: "august.baseball19@gmail.com",
      role: "Instructor",
      active: true,
    },
    {
      id: "staff-carter-cox",
      name: "Carter Cox",
      email: "cartercox3308@gmail.com",
      role: "Staff",
      active: true,
    },
    {
      id: "staff-zachary-allaire",
      name: "Zachary Allaire",
      email: "zacharyall22@icloud.com",
      role: "Staff",
      active: true,
    },
    {
      id: "staff-jr-jason-allaire",
      name: "Jr. Jason Allaire",
      email: "jasonall22jr@icloud.com",
      role: "Staff",
      active: true,
    },
    {
      id: "staff-brian-cox",
      name: "Brian Cox",
      email: "briancox4677@gmail.com",
      role: "Staff",
      active: true,
    },
    {
      id: "staff-andrea-allaire",
      name: "Andrea Allaire",
      email: "andie0218@hotmail.com",
      role: "Admin",
      active: true,
    },
    {
      id: "staff-jason-allaire",
      name: "Jason Allaire",
      email: "info@grindbaseballlab.com",
      role: "Owner",
      active: true,
    },
  ],
  rolePermissions: defaultRolePermissions,
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
    ["Monday", true, "16:00", "20:00"],
    ["Tuesday", true, "16:00", "20:00"],
    ["Wednesday", true, "16:00", "20:00"],
    ["Thursday", true, "16:00", "20:00"],
    ["Friday", true, "16:00", "18:00"],
    ["Saturday", false, "09:00", "15:00"],
    ["Sunday", false, "10:00", "14:00"],
  ],
  staffAvailability: [],
  schedules: [
    {
      id: "schedule-working-hours",
      name: "Working Hours",
      slug: "working-hours",
      isDefault: true,
      roomNames: ["The Grind Baseball Lab", "Cage 1", "Cage 2", "Pitching Lane", "HitTrax"],
      serviceNames: [],
      dayConfigs: [
        { day: "Monday", weekday: 1, enabled: true, slots: [{ id: "slot-mon-1", start: "16:00", end: "20:00", sortOrder: 1 }] },
        { day: "Tuesday", weekday: 2, enabled: true, slots: [{ id: "slot-tue-1", start: "16:00", end: "20:00", sortOrder: 1 }] },
        { day: "Wednesday", weekday: 3, enabled: true, slots: [{ id: "slot-wed-1", start: "16:00", end: "20:00", sortOrder: 1 }] },
        { day: "Thursday", weekday: 4, enabled: true, slots: [{ id: "slot-thu-1", start: "16:00", end: "20:00", sortOrder: 1 }] },
        { day: "Friday", weekday: 5, enabled: true, slots: [{ id: "slot-fri-1", start: "16:00", end: "18:00", sortOrder: 1 }] },
        { day: "Saturday", weekday: 6, enabled: false, slots: [] },
        { day: "Sunday", weekday: 0, enabled: false, slots: [] },
      ],
      overrides: [],
    },
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
  | "eye"
  | "x"
  | "arrow-left"
  | "repeat"
  | "refresh";

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
  eye: ["M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z", "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  "arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
  repeat: ["m17 2 4 4-4 4", "M3 11V9a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v2a4 4 0 0 1-4 4H3"],
  refresh: ["M21 12a9 9 0 1 1-2.64-6.36", "M21 3v6h-6"],
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
  const membershipCredits = Number(service.membershipCreditsPerDay ?? 0);
  return {
    ...service,
    instructors: Array.isArray(service.instructors)
      ? service.instructors.map((item) => item.trim()).filter(Boolean)
      : [],
    calendarColor: normalizeCalendarColor(service.calendarColor),
    scheduleId: service.scheduleId ?? null,
    collectTax: Boolean(service.collectTax),
    collectFee: Boolean(service.collectFee),
    membershipBillingPeriod: service.membershipBillingPeriod ?? "Monthly",
    membershipMemberLimit: service.membershipMemberLimit ?? null,
    membershipCreditsPerDay: Number.isFinite(membershipCredits) ? Math.max(0, membershipCredits) : 0,
    membershipCreditLimitPeriod: normalizeMembershipCreditLimitPeriod(service.membershipCreditLimitPeriod),
    membershipCreditScope: service.membershipCreditScope ?? "selected_services",
    membershipEligibleServiceIds: Array.isArray(service.membershipEligibleServiceIds)
      ? service.membershipEligibleServiceIds.filter(Boolean)
      : [],
    stripeProductId: service.stripeProductId ?? null,
    stripePriceId: service.stripePriceId ?? null,
  };
}

function normalizeServices(services: Service[]) {
  return services.map(normalizeService);
}

function createTaxRateDraft(): TaxRate {
  return {
    id: makeId("tax-rate"),
    name: "",
    percentage: "",
    taxId: "",
  };
}

function createCustomFeeDraft(): CustomFee {
  return {
    id: makeId("custom-fee"),
    name: "",
    amount: "",
  };
}

function createRegistrationAdditionalFieldDraft(): RegistrationAdditionalField {
  return {
    id: makeId("registration-field"),
    label: "",
    type: "Short Text",
    required: false,
  };
}

function normalizeTaxRateEntry(value: unknown): TaxRate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TaxRate>;
  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : makeId("tax-rate"),
    name: typeof item.name === "string" ? item.name : "",
    percentage:
      typeof item.percentage === "string"
        ? item.percentage
        : typeof item.percentage === "number"
          ? String(item.percentage)
          : "",
    taxId: typeof item.taxId === "string" ? item.taxId : "",
  };
}

function normalizeCustomFeeEntry(value: unknown): CustomFee | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CustomFee>;
  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : makeId("custom-fee"),
    name: typeof item.name === "string" ? item.name : "",
    amount:
      typeof item.amount === "string"
        ? item.amount
        : typeof item.amount === "number"
          ? String(item.amount)
          : "",
  };
}

function normalizeRegistrationFieldConfig(value: unknown, fallback: RegistrationFieldConfig): RegistrationFieldConfig {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<RegistrationFieldConfig>;
  return {
    required: typeof item.required === "boolean" ? item.required : fallback.required,
    hidden: typeof item.hidden === "boolean" ? item.hidden : fallback.hidden,
  };
}

function normalizeRegistrationAdditionalFieldEntry(value: unknown): RegistrationAdditionalField | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RegistrationAdditionalField>;
  return {
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : makeId("registration-field"),
    label: typeof item.label === "string" ? item.label : "",
    type: item.type === "Single-select" ? "Single-select" : "Short Text",
    required: typeof item.required === "boolean" ? item.required : false,
  };
}

function normalizeRegistrationSettings(
  personalValue: unknown,
  contactValue: unknown,
  additionalValue: unknown
): RegistrationSettings {
  const fallback = defaultState.registration;
  const personal = personalValue && typeof personalValue === "object" ? (personalValue as Record<string, unknown>) : {};
  const contact = contactValue && typeof contactValue === "object" ? (contactValue as Record<string, unknown>) : {};
  const additional = Array.isArray(additionalValue)
    ? additionalValue.map(normalizeRegistrationAdditionalFieldEntry).filter(Boolean) as RegistrationAdditionalField[]
    : fallback.additionalFields;

  return {
    personalFields: {
      name: normalizeRegistrationFieldConfig(personal.name, fallback.personalFields.name),
      gender: normalizeRegistrationFieldConfig(personal.gender, fallback.personalFields.gender),
      dateOfBirth: normalizeRegistrationFieldConfig(personal.dateOfBirth, fallback.personalFields.dateOfBirth),
    },
    contactFields: {
      address: normalizeRegistrationFieldConfig(contact.address, fallback.contactFields.address),
      phoneNumber: normalizeRegistrationFieldConfig(contact.phoneNumber, fallback.contactFields.phoneNumber),
    },
    additionalFields: additional.length ? additional : fallback.additionalFields,
  };
}

function normalizeTaxRates(value: unknown): TaxRate[] {
  if (!Array.isArray(value)) return defaultState.taxesAndFees.taxRates;
  const items = value.map(normalizeTaxRateEntry).filter(Boolean) as TaxRate[];
  return items.length ? items : defaultState.taxesAndFees.taxRates;
}

function normalizeCustomFees(value: unknown): CustomFee[] {
  if (!Array.isArray(value)) return defaultState.taxesAndFees.customFees;
  const items = value.map(normalizeCustomFeeEntry).filter(Boolean) as CustomFee[];
  return items.length ? items : defaultState.taxesAndFees.customFees;
}

function normalizeStaffRole(value: unknown): StaffRole {
  if (value === "Owner" || value === "Admin" || value === "Instructor" || value === "Staff") {
    return value;
  }
  return "Staff";
}

function normalizeStaffMemberEntry(value: unknown, fallbackIndex = 0): StaffMember | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StaffMember>;
  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : makeId("staff"),
    name: typeof item.name === "string" ? item.name : "",
    email: typeof item.email === "string" ? item.email : "",
    role: normalizeStaffRole(item.role),
    active: item.active ?? true,
    calendarColor: normalizeCalendarColor(item.calendarColor ?? staffAvailabilityColor(fallbackIndex)),
  };
}

function normalizeStaffMembers(value: unknown): StaffMember[] {
  if (!Array.isArray(value)) return defaultState.staff;
  const items = value.map((item, index) => normalizeStaffMemberEntry(item, index)).filter(Boolean) as StaffMember[];
  return items.length ? items : defaultState.staff;
}

const staffAvailabilityColors = ["#249b41", "#e46d32", "#e89bef", "#35d75b", "#1688d1", "#7c3aed"];
const staffAvailabilityDragPreviewColor = "#8f8f8f";
const staffAvailabilityDragPreviewBorderColor = "#6f8494";

function staffAvailabilityColor(index: number) {
  return staffAvailabilityColors[index % staffAvailabilityColors.length];
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function defaultStaffAvailabilityRecurrenceEndDate(date: string) {
  return shiftDate(date, 7);
}

function normalizeStaffAvailabilityRecurrenceFrequency(value: unknown): StaffAvailabilityRecurrenceFrequency {
  if (value === "daily" || value === "weekly" || value === "custom") return value;
  return "daily";
}

function formatStaffAvailabilityRecurrenceEnd(value: string) {
  if (!isIsoDate(value)) return value;
  return parseLocalDate(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeStaffAvailabilityEntry(value: unknown, staffById: Map<string, StaffMember>, fallbackIndex = 0): StaffAvailabilityEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StaffAvailabilityEntry>;
  const staffId = typeof item.staffId === "string" ? item.staffId : "";
  const staffMember = staffById.get(staffId);
  const date = isIsoDate(item.date) ? item.date : "";
  const start = normalizeTime(item.start);
  const end = normalizeTime(item.end);

  if (!staffMember || !date || timeToMinutes(end) <= timeToMinutes(start)) return null;

  const recurring = Boolean(item.recurring);
  const recurrenceEndDate =
    recurring && isIsoDate(item.recurrenceEndDate) && item.recurrenceEndDate >= date
      ? item.recurrenceEndDate
      : recurring
        ? defaultStaffAvailabilityRecurrenceEndDate(date)
        : undefined;

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : makeId("availability"),
    staffId,
    staffName: staffMember.name,
    date,
    start,
    end,
    resources: Array.isArray(item.resources) ? item.resources.filter((resource): resource is string => typeof resource === "string" && resource.trim().length > 0) : [],
    color: normalizeCalendarColor(item.color ?? staffMember.calendarColor ?? staffAvailabilityColor(fallbackIndex)),
    recurring,
    recurrenceId: recurring
      ? typeof item.recurrenceId === "string" && item.recurrenceId.trim()
        ? item.recurrenceId
        : makeId("recurrence")
      : undefined,
    recurrenceFrequency: recurring ? normalizeStaffAvailabilityRecurrenceFrequency(item.recurrenceFrequency) : undefined,
    recurrenceEndDate,
  };
}

function normalizeStaffAvailabilityEntries(value: unknown, staff: StaffMember[]): StaffAvailabilityEntry[] {
  if (!Array.isArray(value)) return defaultState.staffAvailability;
  const staffById = new Map(staff.map((member) => [member.id, member]));
  return value
    .map((item, index) => normalizeStaffAvailabilityEntry(item, staffById, index))
    .filter((item): item is StaffAvailabilityEntry => Boolean(item));
}

function normalizeStaffAvailabilityRow(
  row: BookingStaffAvailabilityRow,
  staffById: Map<string, StaffMember>,
  fallbackIndex = 0
): StaffAvailabilityEntry | null {
  if (!row.staff_member_id) return null;
  return normalizeStaffAvailabilityEntry(
    {
      id: row.id,
      staffId: row.staff_member_id,
      date: row.availability_date,
      start: row.start_time,
      end: row.end_time,
      resources: row.resource_names ?? [],
      color: row.color ?? staffById.get(row.staff_member_id)?.calendarColor ?? staffAvailabilityColor(fallbackIndex),
      recurring: Boolean(row.is_recurring),
      recurrenceId: row.recurrence_id ?? undefined,
      recurrenceFrequency: normalizeStaffAvailabilityRecurrenceFrequency(row.recurrence_frequency),
      recurrenceEndDate: row.recurrence_end_date ?? undefined,
    },
    staffById,
    fallbackIndex
  );
}

function expandStaffAvailabilityRecurrence(entry: StaffAvailabilityEntry, startDate = entry.date) {
  if (!entry.recurring || !entry.recurrenceEndDate) return [entry];

  const recurrenceId = entry.recurrenceId ?? makeId("recurrence");
  const recurrenceFrequency = normalizeStaffAvailabilityRecurrenceFrequency(entry.recurrenceFrequency);
  const stepDays = recurrenceFrequency === "daily" ? 1 : 7;
  const entries: StaffAvailabilityEntry[] = [];
  let date = startDate;
  let index = 0;

  while (date <= entry.recurrenceEndDate && index < 104) {
    entries.push({
      ...entry,
      id: date === entry.date ? entry.id : makeId("availability"),
      date,
      recurring: true,
      recurrenceId,
      recurrenceFrequency,
      recurrenceEndDate: entry.recurrenceEndDate,
    });
    date = shiftDate(date, stepDays);
    index += 1;
  }

  return entries;
}

function normalizeBookings(bookings: Booking[], services: Service[]) {
  const servicesById = new Map(normalizeServices(services).map((service) => [service.id, service]));
  return bookings.map((booking) => {
    const service = servicesById.get(booking.serviceId);
    return normalizeUnavailableBooking({
      ...booking,
      serviceName: service?.name ?? booking.serviceName ?? "",
      calendarColor: normalizeCalendarColor(service?.calendarColor ?? booking.calendarColor),
    });
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
    schedules: state.schedules.map((schedule) => ({
      ...schedule,
      roomNames: schedule.roomNames.map((roomName) => (roomName === currentName ? nextName : roomName)),
    })),
  };
}

function assignRoomToSchedule(schedules: ScheduleRecord[], roomName: string, scheduleId: string) {
  return schedules.map((schedule) => {
    const hasRoom = schedule.roomNames.includes(roomName);
    if (schedule.id === scheduleId) {
      return hasRoom
        ? schedule
        : {
            ...schedule,
            roomNames: [...schedule.roomNames, roomName],
          };
    }

    return hasRoom
      ? {
          ...schedule,
          roomNames: schedule.roomNames.filter((name) => name !== roomName),
        }
      : schedule;
  });
}

function removeRoomFromSchedules(schedules: ScheduleRecord[], roomName: string) {
  return schedules.map((schedule) =>
    schedule.roomNames.includes(roomName)
      ? {
          ...schedule,
          roomNames: schedule.roomNames.filter((name) => name !== roomName),
        }
      : schedule
  );
}

function assignServiceToSchedule(
  schedules: ScheduleRecord[],
  serviceName: string,
  scheduleId: string | null | undefined,
  previousServiceName?: string
) {
  const namesToRemove = new Set([serviceName, previousServiceName].filter(Boolean));

  return schedules.map((schedule) => {
    const filteredServiceNames = schedule.serviceNames.filter((name) => !namesToRemove.has(name));

    if (schedule.id === scheduleId && serviceName) {
      return filteredServiceNames.includes(serviceName)
        ? { ...schedule, serviceNames: filteredServiceNames }
        : { ...schedule, serviceNames: [...filteredServiceNames, serviceName] };
    }

    return filteredServiceNames.length === schedule.serviceNames.length
      ? schedule
      : { ...schedule, serviceNames: filteredServiceNames };
  });
}

function normalizeScheduleRecord(schedule: ScheduleRecord): ScheduleRecord {
  return {
    ...schedule,
    name: schedule.name.trim(),
    slug: slugifyScheduleName(schedule.name) || "schedule",
    dayConfigs: emptyScheduleDayConfigs().map((base) => {
      const config = schedule.dayConfigs.find((item) => item.day === base.day);
      const orderedSlots = (config?.slots ?? [])
        .filter((slot) => slot.start && slot.end && timeToMinutes(slot.end) > timeToMinutes(slot.start))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((slot, index) => ({
          ...slot,
          sortOrder: index + 1,
        }));

      return {
        ...base,
        enabled: Boolean(config?.enabled && orderedSlots.length),
        slots: config?.enabled ? orderedSlots : [],
      };
    }),
    overrides: schedule.overrides
      .map((override) => ({
        ...override,
        slots: [...override.slots]
          .filter((slot) => slot.start && slot.end && timeToMinutes(slot.end) > timeToMinutes(slot.start))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((slot, index) => ({
            ...slot,
            sortOrder: index + 1,
          })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
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
  profile: AppState["profile"],
  policies: BookingPolicies,
  registration: AppState["registration"],
  taxesAndFees: AppState["taxesAndFees"]
) {
  const { error } = await supabase.from("booking_settings").upsert({
    key: "default",
    facility_name: facility.name,
    public_url: facility.publicUrl,
    timezone: facility.timezone,
    address: composeFacilityAddress(facility),
    profile_first_name: profile.firstName || null,
    profile_last_name: profile.lastName || null,
    profile_email: profile.email || null,
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
    registration_personal_fields: registration.personalFields,
    registration_contact_fields: registration.contactFields,
    registration_additional_fields: registration.additionalFields,
    tax_rates: taxesAndFees.taxRates,
    custom_fees: taxesAndFees.customFees,
  });

  if (error) throw error;
}

async function upsertStaffMembers(staff: StaffMember[]) {
  const payload = staff.map((member, index) => ({
    id: member.id,
    full_name: member.name.trim(),
    email: member.email.trim(),
    role: member.role,
    is_active: member.active,
    calendar_color: normalizeCalendarColor(member.calendarColor ?? staffAvailabilityColor(index)),
    sort_order: index + 1,
  }));

  const { error } = await supabase.from("booking_staff_members").upsert(payload);
  if (error) throw error;

  const refreshed = await supabase
    .from("booking_staff_members")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort_order");

  if (refreshed.error) throw refreshed.error;
  return (refreshed.data ?? []) as BookingStaffRow[];
}

async function upsertRolePermissions(rolePermissions: RolePermissionRecord[]) {
  const payload = defaultRolePermissions.map((row, index) => {
    const enabledKeys =
      rolePermissions.find((item) => item.role === row.role)?.enabledKeys ?? row.enabledKeys;

    return {
      role: row.role,
      enabled_permissions: normalizeRolePermissionKeys(enabledKeys),
      sort_order: index + 1,
    };
  });

  const { error } = await supabase.from("booking_role_permissions").upsert(payload);
  if (error) throw error;

  const refreshed = await supabase
    .from("booking_role_permissions")
    .select("*")
    .order("sort_order");

  if (refreshed.error) throw refreshed.error;
  return (refreshed.data ?? []) as BookingRolePermissionRow[];
}

async function upsertResources(resourceNames: string[]) {
  const names = resourceNames.map((name) => name.trim()).filter(Boolean);
  const current = await supabase.from("booking_resources").select("id,name,sort_order,is_active,schedule_id");
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
      .select("id,name,sort_order,is_active,schedule_id")
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
    .select("id,name,sort_order,is_active,schedule_id")
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
      instructor_names: item.instructors?.length ? item.instructors : [],
      service_type: item.category,
      status: item.status,
      calendar_color: normalizeCalendarColor(item.calendarColor),
      schedule_id: item.scheduleId ?? null,
      collect_tax: Boolean(item.collectTax),
      collect_fee: Boolean(item.collectFee),
      membership_billing_period: item.membershipBillingPeriod ?? "Monthly",
      membership_member_limit: item.membershipMemberLimit ?? null,
      membership_credits_per_day: item.membershipCreditsPerDay ?? 0,
      membership_credit_limit_period: normalizeMembershipCreditLimitPeriod(item.membershipCreditLimitPeriod),
      membership_credit_scope: item.membershipCreditScope ?? "selected_services",
      membership_eligible_service_ids: item.membershipEligibleServiceIds ?? [],
      stripe_product_id: item.stripeProductId ?? null,
      stripe_price_id: item.stripePriceId ?? null,
    });
    if (error) throw error;
  }

  if (change.type === "booking") {
    const item = normalizeUnavailableBooking(change.item);
    const resourceId = resourceIdsByName[item.resource] || null;
    let creditMembership: CustomerMembershipRecord | null = null;

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

    if (item.membershipCreditMembershipId && item.status !== "Cancelled") {
      if (!item.customerId) throw new Error("Choose a customer before using a membership credit.");
      if (!item.serviceId) throw new Error("Choose a service before using a membership credit.");

      const membershipResult = await supabase
        .from("booking_customer_memberships")
        .select("*")
        .eq("id", item.membershipCreditMembershipId)
        .maybeSingle();

      if (membershipResult.error) throw membershipResult.error;
      if (!membershipResult.data) throw new Error("That membership credit is no longer available.");

      creditMembership = normalizeCustomerMembershipRow(membershipResult.data as BookingCustomerMembershipRow);
      if (creditMembership.customerId !== item.customerId) {
        throw new Error("That membership does not belong to this customer.");
      }

      let creditMembershipService: MembershipCreditSettingsSource = null;
      if (creditMembership.membershipServiceId) {
        const membershipServiceResult = await supabase
          .from("booking_services")
          .select("membership_credits_per_day, membership_credit_limit_period, membership_credit_scope, membership_eligible_service_ids")
          .eq("id", creditMembership.membershipServiceId)
          .maybeSingle();

        if (membershipServiceResult.error) throw membershipServiceResult.error;
        if (membershipServiceResult.data) {
          creditMembershipService = normalizeMembershipCreditSettingsRow(
            membershipServiceResult.data as BookingServiceRow
          );
        }
      }

      if (!membershipCanUseCredit(creditMembership, item.serviceId, item.date, creditMembershipService)) {
        throw new Error("That membership cannot be used for this service.");
      }

      const creditSettings = membershipCreditSettings(creditMembership, creditMembershipService);
      const creditRange = membershipCreditLimitPeriodRange(item.date, creditSettings.creditLimitPeriod);
      const ledgerResult = await supabase
        .from("booking_membership_credit_ledger")
        .select("*")
        .eq("customer_membership_id", item.membershipCreditMembershipId)
        .gte("credit_date", creditRange.start)
        .lte("credit_date", creditRange.end);

      if (ledgerResult.error) throw ledgerResult.error;

      const ledgerEntries = ((ledgerResult.data ?? []) as BookingMembershipCreditLedgerRow[]).map(
        normalizeMembershipCreditLedgerRow
      );
      if (membershipCreditRemaining(creditMembership, item.date, ledgerEntries, item.id, creditMembershipService) < 1) {
        throw new Error(
          `That membership has no credits remaining for this ${membershipCreditLimitPeriodLabel(
            creditSettings.creditLimitPeriod
          )}.`
        );
      }
    }

    const { error } = await supabase.from("booking_bookings").upsert({
      id: item.id,
      booking_date: item.date,
      start_time: item.start,
      end_time: item.end,
      customer_id: item.customerId || null,
      player_name: item.playerName || null,
      service_id: item.serviceId || null,
      resource_id: resourceId,
      status: item.status,
      paid: item.paid || Boolean(creditMembership),
    });
    if (error) throw error;

    const deleteLedgerResult = await supabase
      .from("booking_membership_credit_ledger")
      .delete()
      .eq("booking_id", item.id)
      .eq("reason", "booking");

    if (deleteLedgerResult.error) throw deleteLedgerResult.error;

    if (creditMembership && item.status !== "Cancelled") {
      const insertLedgerResult = await supabase.from("booking_membership_credit_ledger").insert({
        customer_membership_id: creditMembership.id,
        customer_id: item.customerId || null,
        booking_id: item.id,
        service_id: item.serviceId || null,
        credit_date: item.date,
        amount: -1,
        reason: "booking",
        note: item.serviceName || "Membership credit booking",
      });

      if (insertLedgerResult.error) throw insertLedgerResult.error;
    }
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

function moneyPrecise(value: number, currency = "USD") {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeMembershipBillingPeriod(value: unknown): MembershipBillingPeriod {
  return value === "Weekly" || value === "Yearly" ? value : "Monthly";
}

function normalizeMembershipCreditScope(value: unknown): MembershipCreditScope {
  return value === "all_services" ? "all_services" : "selected_services";
}

function normalizeMembershipCreditLimitPeriod(value: unknown): MembershipCreditLimitPeriod {
  if (value === "week" || value === "month") return value;
  return "day";
}

function normalizeCustomerMembershipStatus(value: unknown): CustomerMembershipStatus {
  if (value === "Paused" || value === "Past Due" || value === "Cancelled" || value === "Expired") return value;
  return "Active";
}

function addMembershipPeriod(dateValue: string, period: MembershipBillingPeriod) {
  const date = parseLocalDate(dateValue);
  if (period === "Weekly") date.setDate(date.getDate() + 7);
  else if (period === "Yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return isoDate(date);
}

function formatMembershipDate(value?: string | null) {
  if (!value) return "Not set";
  return parseLocalDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isActiveCustomerMembership(record: CustomerMembershipRecord) {
  return record.status === "Active" || record.status === "Paused" || record.status === "Past Due";
}

function normalizeCustomerMembershipRow(row: BookingCustomerMembershipRow): CustomerMembershipRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    membershipServiceId: row.membership_service_id ?? "",
    status: normalizeCustomerMembershipStatus(row.status),
    billingPeriod: normalizeMembershipBillingPeriod(row.billing_period),
    priceCents: Number(row.price_cents ?? 0),
    creditsPerDay: Number(row.credits_per_day ?? 0),
    creditLimitPeriod: normalizeMembershipCreditLimitPeriod(row.credit_limit_period),
    creditScope: normalizeMembershipCreditScope(row.credit_scope),
    eligibleServiceIds: Array.isArray(row.eligible_service_ids) ? row.eligible_service_ids.filter(Boolean) : [],
    currentPeriodStart: row.current_period_start ?? "",
    currentPeriodEnd: row.current_period_end ?? "",
    stripeSubscriptionId: row.stripe_subscription_id ?? "",
    stripePriceId: row.stripe_price_id ?? "",
    autoRenew: row.auto_renew ?? true,
    startedAt: row.started_at ?? row.created_at,
    cancelledAt: row.cancelled_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

type MembershipCreditSettingsSource =
  | Pick<Service, "membershipCreditsPerDay" | "membershipCreditLimitPeriod" | "membershipCreditScope" | "membershipEligibleServiceIds">
  | null
  | undefined;

function normalizeMembershipCreditSettingsRow(row: BookingServiceRow): MembershipCreditSettingsSource {
  return {
    membershipCreditsPerDay: Number(row.membership_credits_per_day ?? 0),
    membershipCreditLimitPeriod: normalizeMembershipCreditLimitPeriod(row.membership_credit_limit_period),
    membershipCreditScope: normalizeMembershipCreditScope(row.membership_credit_scope),
    membershipEligibleServiceIds: Array.isArray(row.membership_eligible_service_ids)
      ? row.membership_eligible_service_ids.filter(Boolean)
      : [],
  };
}

function normalizeMembershipCreditLedgerReason(value?: string | null): MembershipCreditLedgerReason {
  if (value === "manual_adjustment" || value === "refund" || value === "expiration") return value;
  return "booking";
}

function normalizeMembershipCreditLedgerRow(row: BookingMembershipCreditLedgerRow): MembershipCreditLedgerEntry {
  return {
    id: row.id,
    customerMembershipId: row.customer_membership_id ?? "",
    customerId: row.customer_id ?? "",
    bookingId: row.booking_id ?? "",
    serviceId: row.service_id ?? "",
    creditDate: row.credit_date ?? isoDate(new Date()),
    amount: Number(row.amount ?? 0),
    reason: normalizeMembershipCreditLedgerReason(row.reason),
    note: row.note ?? "",
    createdAt: row.created_at ?? "",
  };
}

function isMembershipCreditSpend(entry: MembershipCreditLedgerEntry) {
  return entry.reason === "booking" && entry.amount < 0;
}

function membershipCreditSettings(record: CustomerMembershipRecord, membershipService?: MembershipCreditSettingsSource) {
  const recordEligibleServiceIds = Array.isArray(record.eligibleServiceIds)
    ? record.eligibleServiceIds.filter(Boolean)
    : [];
  const serviceEligibleServiceIds = Array.isArray(membershipService?.membershipEligibleServiceIds)
    ? membershipService.membershipEligibleServiceIds.filter(Boolean)
    : [];
  const recordCreditsPerDay = Math.max(0, Math.floor(Number(record.creditsPerDay ?? 0)));
  const serviceCreditsPerDay = Math.max(0, Math.floor(Number(membershipService?.membershipCreditsPerDay ?? 0)));
  const usesServiceCreditConfig = Boolean(membershipService);

  return {
    creditsPerDay: usesServiceCreditConfig ? serviceCreditsPerDay : recordCreditsPerDay,
    creditLimitPeriod: usesServiceCreditConfig
      ? normalizeMembershipCreditLimitPeriod(membershipService?.membershipCreditLimitPeriod)
      : normalizeMembershipCreditLimitPeriod(record.creditLimitPeriod),
    creditScope: usesServiceCreditConfig
      ? membershipService?.membershipCreditScope ?? record.creditScope
      : record.creditScope,
    eligibleServiceIds: usesServiceCreditConfig ? serviceEligibleServiceIds : recordEligibleServiceIds,
  };
}

function normalizeServiceIdentifier(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function membershipCanUseCredit(
  record: CustomerMembershipRecord,
  serviceId: string,
  bookingDate: string,
  membershipService?: MembershipCreditSettingsSource,
  serviceAliases: string[] = [],
) {
  const settings = membershipCreditSettings(record, membershipService);
  if (!isActiveCustomerMembership(record)) return false;
  if (!settings.creditsPerDay || settings.creditsPerDay < 1) return false;
  if (record.currentPeriodStart && bookingDate < record.currentPeriodStart) return false;
  if (record.currentPeriodEnd && bookingDate > record.currentPeriodEnd) return false;

  const normalizedServiceCandidates = new Set<string>();
  [serviceId, ...serviceAliases].forEach((candidate) => {
    const normalized = normalizeServiceIdentifier(candidate);
    if (normalized) normalizedServiceCandidates.add(normalized);
  });

  if (
    settings.creditScope === "selected_services" &&
    settings.eligibleServiceIds.length > 0 &&
    !settings.eligibleServiceIds.some((identifier) =>
      normalizedServiceCandidates.has(normalizeServiceIdentifier(identifier))
    )
  ) {
    return false;
  }
  return normalizedServiceCandidates.size > 0;
}

function membershipCreditLimitPeriodLabel(period: MembershipCreditLimitPeriod) {
  if (period === "week") return "week";
  if (period === "month") return "month";
  return "day";
}

function membershipCreditLimitPeriodAdjective(period: MembershipCreditLimitPeriod) {
  if (period === "week") return "Weekly";
  if (period === "month") return "Monthly";
  return "Daily";
}

function membershipCreditLimitPeriodRemainingLabel(period: MembershipCreditLimitPeriod) {
  if (period === "week") return "this week";
  if (period === "month") return "this month";
  return "today";
}

function membershipCreditAllowanceLabel(credits: number, period: MembershipCreditLimitPeriod) {
  return `${credits} credit${credits === 1 ? "" : "s"} per ${membershipCreditLimitPeriodLabel(period)}`;
}

function membershipCreditLimitPeriodRange(creditDate: string, period: MembershipCreditLimitPeriod) {
  const start = parseLocalDate(creditDate);

  if (period === "week") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    const end = parseLocalDate(isoDate(start));
    end.setDate(end.getDate() + 6);
    return {
      start: isoDate(start),
      end: isoDate(end),
    };
  }

  if (period === "month") {
    const end = parseLocalDate(creditDate);
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
    return {
      start: isoDate(start),
      end: isoDate(end),
    };
  }

  return {
    start: isoDate(start),
    end: isoDate(start),
  };
}

function membershipCreditUsedInPeriod(
  recordId: string,
  creditDate: string,
  period: MembershipCreditLimitPeriod,
  ledger: MembershipCreditLedgerEntry[],
  excludedBookingId = "",
) {
  const range = membershipCreditLimitPeriodRange(creditDate, period);
  return ledger
    .filter(
      (entry) =>
        entry.customerMembershipId === recordId &&
        entry.creditDate >= range.start &&
        entry.creditDate <= range.end &&
        isMembershipCreditSpend(entry) &&
        entry.bookingId !== excludedBookingId,
    )
    .reduce((total, entry) => total + Math.abs(entry.amount), 0);
}

function membershipCreditRemaining(
  record: CustomerMembershipRecord,
  creditDate: string,
  ledger: MembershipCreditLedgerEntry[],
  excludedBookingId = "",
  membershipService?: MembershipCreditSettingsSource,
) {
  const settings = membershipCreditSettings(record, membershipService);
  return Math.max(
    0,
    settings.creditsPerDay -
      membershipCreditUsedInPeriod(record.id, creditDate, settings.creditLimitPeriod, ledger, excludedBookingId),
  );
}

function normalizedPersonName(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizedPersonNameCandidates(...values: Array<string | null | undefined>) {
  const candidates = new Set<string>();

  values.forEach((value) => {
    const normalized = normalizedPersonName(value);
    if (!normalized) return;

    candidates.add(normalized);

    const withoutParenthetical = normalizedPersonName(normalized.replace(/\([^)]*\)/g, " "));
    if (withoutParenthetical) candidates.add(withoutParenthetical);

    const parentheticalPattern = /\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = parentheticalPattern.exec(normalized)) !== null) {
      const candidate = normalizedPersonName(match[1]);
      if (candidate) candidates.add(candidate);
    }
  });

  return Array.from(candidates);
}

function familyMemberDisplayName(member: FamilyMember) {
  return `${member.firstName} ${member.lastName}`.trim();
}

function membershipRecordsForBookingCustomer(
  customerMembershipsByCustomerId: Record<string, CustomerMembershipRecord[]>,
  customers: Customer[],
  customerId?: string | null,
  playerName?: string | null,
  customerName?: string | null,
) {
  const customerIds = new Set<string>();
  const personCandidateSet = new Set(normalizedPersonNameCandidates(playerName, customerName));

  if (customerId) {
    customerIds.add(customerId);

    customers.forEach((customer) => {
      if (customer.id === customerId) {
        customerIds.add(customer.id);
        normalizedPersonNameCandidates(
          customer.name,
          customer.player,
          ...customer.familyMembers.map(familyMemberDisplayName)
        ).forEach((candidate) => personCandidateSet.add(candidate));
      }

      const matchingFamilyMember = customer.familyMembers.find((member) => member.id === customerId);
      if (matchingFamilyMember) {
        customerIds.add(customer.id);
        normalizedPersonNameCandidates(
          customer.name,
          customer.player,
          familyMemberDisplayName(matchingFamilyMember)
        ).forEach((candidate) => personCandidateSet.add(candidate));
      }
    });
  }

  const personCandidates = Array.from(personCandidateSet);
  if (personCandidates.length) {
    customers.forEach((customer) => {
      const customerCandidates = normalizedPersonNameCandidates(
        customer.name,
        customer.player,
        ...customer.familyMembers.map(familyMemberDisplayName)
      );

      if (personCandidates.some((candidate) => customerCandidates.includes(candidate))) {
        customerIds.add(customer.id);
      }
    });
  }

  const recordsById = new Map<string, CustomerMembershipRecord>();
  customerIds.forEach((id) => {
    (customerMembershipsByCustomerId[id] ?? []).forEach((record) => recordsById.set(record.id, record));
  });
  return Array.from(recordsById.values());
}

function bookingCreditLedgerEntry(ledger: MembershipCreditLedgerEntry[], bookingId: string) {
  return ledger.find((entry) => entry.bookingId === bookingId && isMembershipCreditSpend(entry));
}

function updatedMembershipCreditLedgerForBooking(current: MembershipCreditLedgerEntry[], booking: Booking) {
  const withoutBooking = current.filter((entry) => entry.bookingId !== booking.id || entry.reason !== "booking");
  if (!booking.membershipCreditMembershipId || booking.status === "Cancelled") return withoutBooking;

  return [
    ...withoutBooking,
    {
      id: makeId("credit"),
      customerMembershipId: booking.membershipCreditMembershipId,
      customerId: booking.customerId,
      bookingId: booking.id,
      serviceId: booking.serviceId,
      creditDate: booking.date,
      amount: -1,
      reason: "booking" as const,
      note: booking.serviceName || "Membership credit booking",
      createdAt: new Date().toISOString(),
    },
  ];
}

function membershipCreditScopeLabel(record: CustomerMembershipRecord, servicesById: Map<string, Service>) {
  const membershipService = servicesById.get(record.membershipServiceId) ?? null;
  const settings = membershipCreditSettings(record, membershipService);
  if (settings.creditScope === "all_services") return "All services";
  const names = settings.eligibleServiceIds.map((id) => servicesById.get(id)?.name).filter(Boolean);
  return names.length ? names.join(", ") : "No eligible services selected";
}

function formatCardBrand(brand?: string | null) {
  if (!brand) return "card";

  return brand
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

const scheduleWeekdays: Array<{ day: string; weekday: number }> = [
  { day: "Sunday", weekday: 0 },
  { day: "Monday", weekday: 1 },
  { day: "Tuesday", weekday: 2 },
  { day: "Wednesday", weekday: 3 },
  { day: "Thursday", weekday: 4 },
  { day: "Friday", weekday: 5 },
  { day: "Saturday", weekday: 6 },
];

const scheduleWeekdayOrder = new Map(scheduleWeekdays.map((item) => [item.day, item.weekday]));

function slugifyScheduleName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function emptyScheduleDayConfigs() {
  return scheduleWeekdays.map(({ day, weekday }) => ({
    day,
    weekday,
    enabled: false,
    slots: [] as ScheduleSlot[],
  }));
}

function scheduleDayConfigsFromAvailability(availability: AppState["availability"]) {
  return emptyScheduleDayConfigs().map((base) => {
    const row = availability.find(([day]) => day === base.day);
    if (!row) return base;
    const [, enabled, start, end] = row;
    return {
      ...base,
      enabled,
      slots: enabled ? [{ id: `${base.day.toLowerCase()}-1`, start, end, sortOrder: 1 }] : [],
    };
  });
}

function availabilityFromSchedule(schedule: ScheduleRecord): AppState["availability"] {
  return scheduleWeekdays
    .map(({ day }) => {
      const config = schedule.dayConfigs.find((item) => item.day === day);
      if (!config || !config.enabled || !config.slots.length) {
        return [day, false, "00:00", "23:59"] as [string, boolean, string, string];
      }

      const orderedSlots = [...config.slots].sort((a, b) => a.sortOrder - b.sortOrder);
      return [day, true, orderedSlots[0].start, orderedSlots[orderedSlots.length - 1].end] as [
        string,
        boolean,
        string,
        string,
      ];
    })
    .sort((a, b) => (scheduleWeekdayOrder.get(a[0]) ?? 99) - (scheduleWeekdayOrder.get(b[0]) ?? 99));
}

function scheduleForRoom(schedules: ScheduleRecord[], roomName: string) {
  return (
    schedules.find((schedule) => schedule.roomNames.includes(roomName)) ??
    schedules.find((schedule) => schedule.isDefault) ??
    schedules[0] ??
    null
  );
}

function scheduleForService(schedules: ScheduleRecord[], service: Service | null | undefined) {
  if (!service?.scheduleId) return null;
  return schedules.find((schedule) => schedule.id === service.scheduleId) ?? null;
}

function dayConfigForDate(schedule: ScheduleRecord | null | undefined, value: string) {
  const dayName = weekdayName(value);
  const fallback = scheduleWeekdays.find((item) => item.day === dayName) ?? { day: dayName, weekday: 0 };
  return (
    schedule?.dayConfigs.find((config) => config.day === dayName) ?? {
      day: fallback.day,
      weekday: fallback.weekday,
      enabled: false,
      slots: [],
    }
  );
}

function closedBlocksForSchedule(schedule: ScheduleRecord | null | undefined, value: string) {
  const config = dayConfigForDate(schedule, value);
  const orderedSlots = [...config.slots].sort((a, b) => a.sortOrder - b.sortOrder);

  if (!config.enabled || !orderedSlots.length) {
    return [{ start: 0, end: 1439 }];
  }

  const blocks: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  for (const slot of orderedSlots) {
    const slotStart = Math.max(0, timeToMinutes(slot.start));
    const slotEnd = Math.min(1439, timeToMinutes(slot.end));
    if (slotStart > cursor) {
      blocks.push({ start: cursor, end: slotStart });
    }
    cursor = Math.max(cursor, slotEnd);
  }

  if (cursor < 1439) {
    blocks.push({ start: cursor, end: 1439 });
  }

  return blocks;
}

function openBlocksForSchedule(schedule: ScheduleRecord | null | undefined, value: string) {
  const closedBlocks = [...closedBlocksForSchedule(schedule, value)].sort((a, b) => a.start - b.start);
  const openBlocks: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  for (const block of closedBlocks) {
    if (block.start > cursor) {
      openBlocks.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < 1439) {
    openBlocks.push({ start: cursor, end: 1439 });
  }

  return openBlocks.filter((block) => block.end > block.start);
}

function scheduleAllowsRange(
  schedule: ScheduleRecord | null | undefined,
  value: string,
  start: string,
  end: string
) {
  if (!schedule) return true;

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (endMinutes <= startMinutes) {
    return false;
  }

  return openBlocksForSchedule(schedule, value).some(
    (block) => startMinutes >= block.start && endMinutes <= block.end
  );
}

function scheduleScrollTargetTime(schedule: ScheduleRecord | null | undefined, date: string) {
  const today = isoDate(new Date());

  if (date === today) {
    const config = dayConfigForDate(schedule, date);
    const now = new Date();
    const roundedMinutes = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
    if (config.enabled && config.slots.length) {
      const firstSlot = [...config.slots].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const firstStart = timeToMinutes(firstSlot.start);
      return minutesToTime(Math.max(firstStart, roundedMinutes));
    }
    return minutesToTime(roundedMinutes);
  }

  const config = dayConfigForDate(schedule, date);
  if (!config.enabled || !config.slots.length) return "00:00";
  return [...config.slots].sort((a, b) => a.sortOrder - b.sortOrder)[0].start;
}

function scheduleRangeForDate(schedule: ScheduleRecord | null | undefined, value: string) {
  const openBlocks = openBlocksForSchedule(schedule, value);
  if (!openBlocks.length) {
    return {
      isOpen: false,
      openStart: "00:00",
      openEnd: "23:59",
    };
  }

  return {
    isOpen: true,
    openStart: minutesToTime(openBlocks[0].start),
    openEnd: minutesToTime(openBlocks[openBlocks.length - 1].end),
  };
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

function calendarScrollTargetTime(availability: AppState["availability"], date: string) {
  const today = isoDate(new Date());

  if (date === today) {
    const now = new Date();
    const roundedMinutes = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
    return minutesToTime(roundedMinutes);
  }

  const [, isOpen, openStart] = availabilityForDate(availability, date);
  if (!isOpen) return "00:00";
  return openStart;
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

function bookingScheduleConflictMessage(
  candidate: Booking,
  services: Service[],
  schedules: ScheduleRecord[]
) {
  if (candidate.status === "Cancelled") return null;

  const resourceSchedule = scheduleForRoom(schedules, candidate.resource);
  if (
    candidate.resource &&
    resourceSchedule &&
    !scheduleAllowsRange(resourceSchedule, candidate.date, candidate.start, candidate.end)
  ) {
    return `This room is unavailable from ${timeLabel(candidate.start)} to ${timeLabel(candidate.end)} on ${parseLocalDate(candidate.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })}.`;
  }

  const selectedService = services.find((service) => service.id === candidate.serviceId) ?? null;
  const inferredService =
    selectedService ??
    findServiceForCalendarSlot(services, candidate.resource, bookingDurationMinutes(candidate), {
      date: candidate.date,
      start: candidate.start,
      end: candidate.end,
      schedules,
    });
  const serviceSchedule = scheduleForService(schedules, inferredService);

  if (
    inferredService?.scheduleId &&
    !serviceSchedule
  ) {
    return `${inferredService.name} is assigned to a schedule that could not be found. Open the service and choose a valid schedule before booking it.`;
  }

  if (
    inferredService &&
    inferredService.scheduleId &&
    serviceSchedule &&
    !scheduleAllowsRange(serviceSchedule, candidate.date, candidate.start, candidate.end)
  ) {
    return `${inferredService.name} is not available from ${timeLabel(candidate.start)} to ${timeLabel(candidate.end)} on ${parseLocalDate(candidate.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })} because it follows the "${serviceSchedule.name}" schedule.`;
  }

  return null;
}

function isBookingConflictMessage(message: string) {
  return message.toLowerCase().includes("already booked");
}

const UNAVAILABLE_SERVICE_NAME = "Unavailable";

function isUnavailableBooking(booking: Pick<Booking, "serviceId" | "serviceName">) {
  return !booking.serviceId && booking.serviceName === UNAVAILABLE_SERVICE_NAME;
}

function normalizeUnavailableBooking(booking: Booking): Booking {
  if (!isUnavailableBooking(booking)) return booking;

  return {
    ...booking,
    customerId: "",
    playerName: "",
    serviceId: "",
    serviceName: UNAVAILABLE_SERVICE_NAME,
    calendarColor: "#6b7280",
    paid: false,
    paidByMembershipCredit: false,
    membershipCreditMembershipId: "",
  };
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

function bookingPaymentIndicator(booking: Booking) {
  if (isUnavailableBooking(booking)) return null;
  if (booking.status === "Cancelled") return null;

  if (booking.paidByMembershipCredit) {
    return {
      label: "Credit",
      icon: "check" as const,
      className: "bg-[#7c3aed] text-white ring-1 ring-black/10",
    };
  }

  if (booking.paid) {
    return {
      label: "Paid",
      icon: "check" as const,
      className: "bg-[#22c55e] text-white ring-1 ring-black/10",
    };
  }

  return {
    label: "Unpaid",
    icon: "clock" as const,
    className: "bg-white/90 text-black/80 ring-1 ring-black/10",
  };
}

function findServiceForCalendarSlot(
  services: Service[],
  resource: string,
  durationMinutes: number,
  options?: {
    date?: string;
    start?: string;
    end?: string;
    schedules?: ScheduleRecord[];
  }
) {
  const normalizedResource = resource.trim().toLowerCase();
  const activeServices = services.filter((service) => service.status === "Active");
  const matchesRequestedWindow = (service: Service) => {
    if (!options?.date || !options?.start || !options?.end || !options?.schedules?.length) {
      return true;
    }

    if (!service.scheduleId) {
      return true;
    }

    return scheduleAllowsRange(
      scheduleForService(options.schedules, service),
      options.date,
      options.start,
      options.end
    );
  };
  const exactRentalMatch = activeServices.find((service) => {
    const rooms = service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [];
    return (
      service.category === "rentals" &&
      service.duration === durationMinutes &&
      rooms.some((room) => room.trim().toLowerCase() === normalizedResource) &&
      matchesRequestedWindow(service)
    );
  });

  if (exactRentalMatch) return exactRentalMatch;

  const exactAnyMatch = activeServices.find((service) => {
    const rooms = service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [];
    return (
      service.duration === durationMinutes &&
      rooms.some((room) => room.trim().toLowerCase() === normalizedResource) &&
      matchesRequestedWindow(service)
    );
  });

  if (exactAnyMatch) return exactAnyMatch;

  return activeServices.find((service) => {
    const rooms = service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [];
    return rooms.some((room) => room.trim().toLowerCase() === normalizedResource) && matchesRequestedWindow(service);
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
  schedule: ScheduleRecord | null | undefined,
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

  const openBlocks = openBlocksForSchedule(schedule, date);
  const closedBlocks = closedBlocksForSchedule(schedule, date).sort((a, b) => a.start - b.start);

  if (!openBlocks.length) {
    return closedBlocks.length ? closedBlocks.map((block) => ({ type: "closed" as const, ...block })) : [{ type: "closed", start: 0, end: 1439 }];
  }

  const segments: MobileCalendarTimelineSegment[] = [];
  const sortedBookings = [...bookings].sort(
    (a, b) =>
      timeToMinutes(a.start) - timeToMinutes(b.start) ||
      timeToMinutes(a.end) - timeToMinutes(b.end)
  );
  let closedIndex = 0;
  let bookingIndex = 0;

  for (const openBlock of openBlocks) {
    while (closedIndex < closedBlocks.length && closedBlocks[closedIndex].end <= openBlock.start) {
      segments.push({ type: "closed", ...closedBlocks[closedIndex] });
      closedIndex += 1;
    }

    let cursor = openBlock.start;

    while (bookingIndex < sortedBookings.length && timeToMinutes(sortedBookings[bookingIndex].end) <= openBlock.start) {
      bookingIndex += 1;
    }

    for (let index = bookingIndex; index < sortedBookings.length; index += 1) {
      const booking = sortedBookings[index];
      const bookingStart = Math.max(openBlock.start, timeToMinutes(booking.start));
      const bookingEnd = Math.min(openBlock.end, Math.max(bookingStart + 30, timeToMinutes(booking.end)));

      if (bookingStart >= openBlock.end) {
        break;
      }

      if (bookingEnd <= openBlock.start) {
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

    if (cursor < openBlock.end) {
      pushAvailableBlocks(segments, cursor, openBlock.end);
    }
  }

  while (closedIndex < closedBlocks.length) {
    segments.push({ type: "closed", ...closedBlocks[closedIndex] });
    closedIndex += 1;
  }

  return segments
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);
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
    const staff = normalizeStaffMembers(parsed.staff ?? defaultState.staff);
    const staffAvailability = normalizeStaffAvailabilityEntries(
      parsed.staffAvailability ?? defaultState.staffAvailability,
      staff
    );
    const rolePermissions = normalizeRolePermissions(
      parsed.rolePermissions ?? defaultState.rolePermissions
    );
    const services = normalizeServices(parsed.services ?? defaultState.services);
    return {
      ...parsed,
      staff,
      staffAvailability,
      rolePermissions,
      services,
      bookings: normalizeBookings(parsed.bookings ?? defaultState.bookings, services),
    };
  } catch {
    return defaultState;
  }
}

function createRentalDraft(resources: string[], defaultScheduleId: string): RentalDraft {
  return {
    name: "",
    previewText: "",
    description: "",
    mediaUrl: "",
    defaultPricing: [{ id: makeId("price"), duration: "", price: "" }],
    membershipPricing: [],
    selectedRooms: resources,
    instructors: [],
    reserveOnPurchase: "any",
    reserveEquipment: false,
    collectTax: false,
    collectFee: false,
    slotRestrictionSummary: "No slot restrictions",
    serviceScheduleEnabled: false,
    scheduleId: defaultScheduleId,
    emergencyContactInfo: false,
    customFieldsSummary: "No custom fields",
    private: false,
    calendarColor: DEFAULT_SERVICE_CALENDAR_COLOR,
  };
}

function createRentalDraftFromService(service: Service, defaultScheduleId: string): RentalDraft {
  return {
    name: service.name,
    previewText: service.previewText ?? "",
    description: service.description ?? "",
    mediaUrl: service.mediaUrl ?? "",
    defaultPricing: [{ id: makeId("price"), duration: String(service.duration || 30), price: String(service.price || 0) }],
    membershipPricing: [],
    selectedRooms: service.rooms?.length ? service.rooms : service.resource ? [service.resource] : [],
    instructors: service.instructors ?? [],
    reserveOnPurchase: "any",
    reserveEquipment: false,
    collectTax: Boolean(service.collectTax),
    collectFee: Boolean(service.collectFee),
    slotRestrictionSummary: "No slot restrictions",
    serviceScheduleEnabled: Boolean(service.scheduleId),
    scheduleId: service.scheduleId ?? defaultScheduleId,
    emergencyContactInfo: false,
    customFieldsSummary: "No custom fields",
    private: service.status !== "Active",
    calendarColor: normalizeCalendarColor(service.calendarColor),
  };
}

function createMembershipDraftFromService(service?: Service | null): MembershipDraft {
  return {
    name: service?.name ?? "",
    description: service?.description ?? "",
    price: service ? String(service.price || "") : "",
    billingPeriod: service?.membershipBillingPeriod ?? "Monthly",
    memberLimit: service?.membershipMemberLimit != null ? String(service.membershipMemberLimit) : "",
    creditsPerDay: service?.membershipCreditsPerDay != null ? String(service.membershipCreditsPerDay) : "1",
    creditLimitPeriod: normalizeMembershipCreditLimitPeriod(service?.membershipCreditLimitPeriod),
    creditScope: service?.membershipCreditScope ?? "selected_services",
    eligibleServiceIds: service?.membershipEligibleServiceIds ?? [],
    private: service?.status === "Off",
    stripeProductId: service?.stripeProductId ?? "",
    stripePriceId: service?.stripePriceId ?? "",
  };
}

function buildMembershipMembersByServiceId(
  customers: Customer[],
  customerMembershipsByCustomerId: Record<string, CustomerMembershipRecord[]>
) {
  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.name.trim() || customer.email.trim() || "Customer"])
  );
  const membersByServiceId = new Map<string, string[]>();

  Object.entries(customerMembershipsByCustomerId).forEach(([customerId, memberships]) => {
    const customerName = customerNameById.get(customerId);
    if (!customerName) return;

    memberships.forEach((membership) => {
      if (!membership.membershipServiceId || !isActiveCustomerMembership(membership)) return;

      const existing = membersByServiceId.get(membership.membershipServiceId) ?? [];
      if (!existing.includes(customerName)) {
        existing.push(customerName);
      }
      membersByServiceId.set(membership.membershipServiceId, existing);
    });
  });

  return membersByServiceId;
}

function getRentalDeleteGuard(
  service: Service,
  state: AppState,
  customerMembershipsByCustomerId: Record<string, CustomerMembershipRecord[]>
) {
  const serviceLabel = getServiceSectionSingular(service.category ?? inferServiceCategory(service.name)).toLowerCase();
  const hasBookings = state.bookings.some(
    (booking) => booking.serviceId === service.id && booking.status !== "Cancelled"
  );
  if (hasBookings) {
    return `This ${serviceLabel} can't be deleted because it's tied to existing bookings.`;
  }

  const hasAssignedMembers = Object.values(customerMembershipsByCustomerId).some((memberships) =>
    memberships.some(
      (membership) => membership.membershipServiceId === service.id && isActiveCustomerMembership(membership)
    )
  );
  if (hasAssignedMembers) {
    return `This ${serviceLabel} can't be deleted because it's tied to available credits.`;
  }

  return null;
}

function getRoomDeleteGuard(roomName: string, state: AppState) {
  const hasBookings = state.bookings.some(
    (booking) => booking.resource === roomName && booking.status !== "Cancelled"
  );
  if (hasBookings) {
    return "This room can't be deleted because it's tied to existing bookings.";
  }

  const assignedService = state.services.find((service) =>
    [service.resource, ...(service.rooms ?? [])].includes(roomName)
  );
  if (assignedService) {
    return "This room can't be deleted because it's assigned to one or more services.";
  }

  return null;
}

function getScheduleDeleteGuard(schedule: ScheduleRecord) {
  if (schedule.isDefault || schedule.slug === "working-hours") {
    return "This schedule can't be deleted because it's the facility working-hours schedule.";
  }

  if (schedule.roomNames.length) {
    return "This schedule can't be deleted because it's assigned to one or more rooms.";
  }

  if (schedule.serviceNames.length) {
    return "This schedule can't be deleted because it's assigned to one or more services.";
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

function isServiceSection(value: string): value is ServiceSection {
  return value in serviceSectionMeta;
}

function getServiceSectionBasePath(section: ServiceSection) {
  return serviceSectionMeta[section].basePath;
}

function getServiceSectionLabel(section: ServiceSection) {
  return serviceSectionMeta[section].label;
}

function getServiceSectionSingular(section: ServiceSection) {
  return serviceSectionMeta[section].singular;
}

function formatServicePrice(price: number) {
  return `$${price.toFixed(2)}`;
}

function formatServiceDuration(duration: number) {
  const safeDuration = Number.isFinite(duration) ? duration : 0;
  return `${safeDuration} min`;
}

function getLessonInstructorNames(service: Service) {
  return (service.instructors ?? []).map((item) => item.trim()).filter(Boolean);
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
  selectedScheduleId,
  selectedRoleId,
}: {
  view?: BookingAdminView;
  selectedCustomerId?: string;
  selectedServiceId?: string;
  selectedRoomId?: string;
  selectedScheduleId?: string;
  selectedRoleId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<AppState>(loadInitialState);
  const initialQueryDate = searchParams.get("date");
  const [activeDate, setActiveDate] = useState(() =>
    initialQueryDate && /^\d{4}-\d{2}-\d{2}$/.test(initialQueryDate) ? initialQueryDate : isoDate(new Date())
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [serviceSection, setServiceSection] = useState<ServiceSection>("rentals");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice | null>(null);
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");
  const [currentAuthEmail, setCurrentAuthEmail] = useState("");
  const [currentProfileRole, setCurrentProfileRole] = useState<string | null>(null);
  const [isRemoteLoading, setIsRemoteLoading] = useState(hasSupabaseEnv);
  const [resourceIdsByName, setResourceIdsByName] = useState<Record<string, string>>({});
  const [customerMembershipsByCustomerId, setCustomerMembershipsByCustomerId] = useState<Record<string, CustomerMembershipRecord[]>>({});
  const [membershipCreditLedger, setMembershipCreditLedger] = useState<MembershipCreditLedgerEntry[]>([]);
  const [backToAppHref, setBackToAppHref] = useState(bookingAdminRouteByView.home);
  const [showCustomerImport, setShowCustomerImport] = useState(false);
  const [bookingConflictDialog, setBookingConflictDialog] = useState<string | null>(null);
  const [calendarChargeBookingId, setCalendarChargeBookingId] = useState<string | null>(null);
  const routeServiceSection = useMemo(() => {
    const match = pathname.match(/^\/admin\/services\/([^/]+)/);
    const section = match?.[1];
    return section && isServiceSection(section) ? section : null;
  }, [pathname]);
  const isServiceAddPage = Boolean(routeServiceSection && pathname === `${getServiceSectionBasePath(routeServiceSection)}/add`);
  const isServiceEditPage = Boolean(
    routeServiceSection &&
      selectedServiceId &&
      new RegExp(`^${getServiceSectionBasePath(routeServiceSection).replace(/\//g, "\\/")}\\/[^/]+$`).test(pathname)
  );
  const isRoomEditPage = Boolean(selectedRoomId && /^\/admin\/settings\/rooms\/[^/]+$/.test(pathname) && !pathname.endsWith("/add"));
  const isScheduleEditPage = Boolean(
    selectedScheduleId && /^\/admin\/settings\/schedules\/[^/]+$/.test(pathname) && !pathname.endsWith("/add")
  );
  const isRoleEditPage = Boolean(
    selectedRoleId && /^\/admin\/settings\/roles\/[^/]+$/.test(pathname)
  );

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
  const selectedScheduleName = useMemo(() => {
    if (!selectedScheduleId) return null;

    const decodedId = decodeURIComponent(selectedScheduleId);
    if (decodedId === "working-hours") return "Working Hours";
    return decodedId
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [selectedScheduleId]);
  const selectedSchedule = useMemo(() => {
    if (!selectedScheduleId) return null;

    const decodedId = decodeURIComponent(selectedScheduleId);
    return (
      state.schedules.find((schedule) => schedule.id === selectedScheduleId) ??
      state.schedules.find((schedule) => schedule.slug === decodedId) ??
      state.schedules.find((schedule) => schedule.name === selectedScheduleName) ??
      null
    );
  }, [selectedScheduleId, selectedScheduleName, state.schedules]);
  const selectedRole = useMemo(() => roleFromSlug(selectedRoleId), [selectedRoleId]);
  const calendarChargeBooking = useMemo(
    () => (calendarChargeBookingId ? state.bookings.find((item) => item.id === calendarChargeBookingId) ?? null : null),
    [calendarChargeBookingId, state.bookings]
  );
  const calendarChargeCustomer = useMemo(
    () =>
      calendarChargeBooking?.customerId
        ? state.customers.find((item) => item.id === calendarChargeBooking.customerId) ?? null
        : null,
    [calendarChargeBooking, state.customers]
  );
  const calendarChargeService = useMemo(
    () =>
      calendarChargeBooking?.serviceId
        ? state.services.find((item) => item.id === calendarChargeBooking.serviceId) ?? null
        : null,
    [calendarChargeBooking, state.services]
  );
  const currentStaffMember = useMemo(() => {
    const email = currentAuthEmail.trim().toLowerCase();
    if (!email) return null;
    return state.staff.find((staff) => staff.email.trim().toLowerCase() === email) ?? null;
  }, [currentAuthEmail, state.staff]);
  const canManageAnyAvailability =
    !hasSupabaseEnv ||
    currentProfileRole === "admin" ||
    currentStaffMember?.role === "Owner" ||
    currentStaffMember?.role === "Admin";

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
    let alive = true;

    async function loadCurrentUser() {
      if (!hasSupabaseEnv) {
        setCurrentProfileRole("admin");
        return;
      }

      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!alive) return;

      setCurrentAuthEmail(user?.email ?? "");

      if (!user?.id) {
        setCurrentProfileRole(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;
      setCurrentProfileRole(typeof profile?.role === "string" ? profile.role : null);
    }

    void loadCurrentUser();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/admin/services")) return;
    if (routeServiceSection) {
      setServiceSection(routeServiceSection);
    }
  }, [pathname, routeServiceSection]);

  useEffect(() => {
    if (!pathname.startsWith("/admin/calendar")) return;

    const requestedDate = searchParams.get("date");
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate !== activeDate) {
      setActiveDate(requestedDate);
    }
  }, [activeDate, pathname, searchParams]);

  useEffect(() => {
    if (!pathname.startsWith("/admin/calendar")) return;

    const paymentState = searchParams.get("payment");
    if (!paymentState) return;

    if (paymentState === "paid") {
      showToast("Booking marked paid.");
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("payment");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams, showToast]);

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
        customerMembershipsResult,
        membershipCreditLedgerResult,
        bookingsResult,
        availabilityResult,
        schedulesResult,
        scheduleSlotsResult,
        scheduleOverridesResult,
        staffResult,
        staffAvailabilityResult,
        rolePermissionsResult,
        campaignsResult,
        productsResult,
      ] = await Promise.all([
        supabase.from("booking_settings").select("*").eq("key", "default").maybeSingle(),
        supabase.from("booking_resources").select("*").order("sort_order"),
        supabase.from("booking_services").select("*").order("sort_order"),
        supabase.from("booking_customers").select("*").order("created_at"),
        supabase.from("booking_customer_memberships").select("*").order("created_at"),
        supabase.from("booking_membership_credit_ledger").select("*").order("created_at"),
        supabase.from("booking_bookings").select("*").order("booking_date").order("start_time"),
        supabase.from("booking_availability").select("*").order("weekday"),
        supabase.from("booking_schedules").select("*").eq("is_active", true).order("created_at"),
        supabase.from("booking_schedule_slots").select("*").order("weekday").order("sort_order"),
        supabase.from("booking_schedule_overrides").select("*").order("override_date").order("sort_order"),
        supabase.from("booking_staff_members").select("*").order("is_active", { ascending: false }).order("sort_order"),
        supabase.from("booking_staff_availability").select("*").order("availability_date").order("start_time"),
        supabase.from("booking_role_permissions").select("*").order("sort_order"),
        supabase.from("booking_campaigns").select("*").order("created_at"),
        supabase.from("booking_products").select("*").order("created_at"),
      ]);

      const error = [
        settingsResult.error,
        resourcesResult.error,
        servicesResult.error,
        customersResult.error,
        customerMembershipsResult.error,
        membershipCreditLedgerResult.error,
        bookingsResult.error,
        availabilityResult.error,
        schedulesResult.error,
        scheduleSlotsResult.error,
        scheduleOverridesResult.error,
        staffResult.error,
        staffAvailabilityResult.error,
        rolePermissionsResult.error,
        campaignsResult.error,
        productsResult.error,
      ].find(Boolean);

      if (error) throw error;

      const settings = settingsResult.data as BookingSettingsRow | null;
      const resourceRows = (resourcesResult.data ?? []) as BookingResourceRow[];
      const serviceRows = (servicesResult.data ?? []) as BookingServiceRow[];
      const customerRows = (customersResult.data ?? []) as BookingCustomerRow[];
      const customerMembershipRows = (customerMembershipsResult.data ?? []) as BookingCustomerMembershipRow[];
      const membershipCreditLedgerRows = (membershipCreditLedgerResult.data ?? []) as BookingMembershipCreditLedgerRow[];
      const bookingRows = (bookingsResult.data ?? []) as BookingBookingRow[];
      const availabilityRows = (availabilityResult.data ?? []) as BookingAvailabilityRow[];
      const scheduleRows = (schedulesResult.data ?? []) as BookingScheduleRow[];
      const scheduleSlotRows = (scheduleSlotsResult.data ?? []) as BookingScheduleSlotRow[];
      const scheduleOverrideRows = (scheduleOverridesResult.data ?? []) as BookingScheduleOverrideRow[];
      const staffRows = (staffResult.data ?? []) as BookingStaffRow[];
      const staffAvailabilityRows = (staffAvailabilityResult.data ?? []) as BookingStaffAvailabilityRow[];
      const rolePermissionRows = (rolePermissionsResult.data ?? []) as BookingRolePermissionRow[];
      const campaignRows = (campaignsResult.data ?? []) as BookingCampaignRow[];
      const productRows = (productsResult.data ?? []) as BookingProductRow[];
      const activeResourceRows = resourceRows.filter((resource) => resource.is_active);
      const resources = activeResourceRows.length ? activeResourceRows : defaultState.resources.map((name, index) => ({
        id: "",
        name,
        sort_order: index + 1,
        is_active: true,
        schedule_id: null,
      }));
      const { idsByName, namesById } = resourceLookup(resourceRows.length ? resourceRows : resources);
      const serviceMetaById = new Map(
        serviceRows.map((service) => [
          service.id,
          {
            name: service.name,
            calendarColor: normalizeCalendarColor(service.calendar_color),
            scheduleId: service.schedule_id,
          },
        ])
      );
      const customerMembershipsById = customerMembershipRows.reduce<Record<string, CustomerMembershipRecord[]>>((acc, row) => {
        const normalized = normalizeCustomerMembershipRow(row);
        if (!normalized.customerId) {
          return acc;
        }

        if (!acc[normalized.customerId]) {
          acc[normalized.customerId] = [];
        }

        acc[normalized.customerId].push(normalized);
        return acc;
      }, {});
      const membershipCreditLedgerEntries = membershipCreditLedgerRows.map(normalizeMembershipCreditLedgerRow);
      const availabilityOrder = new Map(defaultState.availability.map(([day], index) => [day, index]));
      const staffMembers = staffRows.length
        ? staffRows.map((member, index) => ({
            id: member.id,
            name: member.full_name,
            email: member.email,
            role: normalizeStaffRole(member.role),
            active: member.is_active,
            calendarColor: normalizeCalendarColor(member.calendar_color ?? staffAvailabilityColor(index)),
          }))
        : defaultState.staff;
      const staffById = new Map(staffMembers.map((member) => [member.id, member]));
      const staffAvailabilityEntries = staffAvailabilityRows
        .map((row, index) => normalizeStaffAvailabilityRow(row, staffById, index))
        .filter((entry): entry is StaffAvailabilityEntry => Boolean(entry));
      const roomNamesByScheduleId = new Map<string, string[]>();

      for (const resource of resources) {
        if (!resource.schedule_id) continue;
        const roomNames = roomNamesByScheduleId.get(resource.schedule_id) ?? [];
        roomNames.push(resource.name);
        roomNamesByScheduleId.set(resource.schedule_id, roomNames);
      }

      const serviceNamesByScheduleId = new Map<string, string[]>();
      for (const service of serviceRows) {
        if (!service.schedule_id) continue;
        const serviceNames = serviceNamesByScheduleId.get(service.schedule_id) ?? [];
        serviceNames.push(service.name);
        serviceNamesByScheduleId.set(service.schedule_id, serviceNames);
      }

      const schedules = scheduleRows.length
        ? scheduleRows.map((schedule) => {
            const dayConfigs = emptyScheduleDayConfigs().map((base) => {
              const slots = scheduleSlotRows
                .filter((slot) => slot.schedule_id === schedule.id && slot.weekday === base.weekday)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((slot) => ({
                  id: slot.id,
                  start: normalizeTime(slot.start_time),
                  end: normalizeTime(slot.end_time),
                  sortOrder: slot.sort_order,
                }));

              return {
                ...base,
                enabled: slots.length > 0,
                slots,
              };
            });

            const overrideMap = new Map<string, ScheduleOverride>();
            for (const row of scheduleOverrideRows.filter((item) => item.schedule_id === schedule.id)) {
              const existing = overrideMap.get(row.override_date) ?? {
                id: row.id,
                date: row.override_date,
                isClosed: row.is_closed,
                slots: [],
              };

              if (!row.is_closed && row.start_time && row.end_time) {
                existing.slots.push({
                  id: row.id,
                  start: normalizeTime(row.start_time),
                  end: normalizeTime(row.end_time),
                  sortOrder: row.sort_order,
                });
              }

              existing.isClosed = existing.isClosed || row.is_closed;
              overrideMap.set(row.override_date, existing);
            }

            return {
              id: schedule.id,
              name: schedule.name,
              slug: schedule.slug,
              isDefault: schedule.is_default,
              roomNames: roomNamesByScheduleId.get(schedule.id) ?? [],
              serviceNames: serviceNamesByScheduleId.get(schedule.id) ?? [],
              dayConfigs,
              overrides: Array.from(overrideMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
            };
          })
        : defaultState.schedules;

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
        profile: {
          firstName: settings?.profile_first_name ?? defaultState.profile.firstName,
          lastName: settings?.profile_last_name ?? defaultState.profile.lastName,
          email: settings?.profile_email ?? defaultState.profile.email,
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
        registration: normalizeRegistrationSettings(
          settings?.registration_personal_fields,
          settings?.registration_contact_fields,
          settings?.registration_additional_fields
        ),
        taxesAndFees: {
          taxRates: normalizeTaxRates(settings?.tax_rates),
          customFees: normalizeCustomFees(settings?.custom_fees),
        },
        staff: staffMembers,
        staffAvailability: staffAvailabilityEntries,
        rolePermissions: normalizeRolePermissions(
          rolePermissionRows.map((row) => ({
            role: normalizeStaffRole(row.role),
            enabledKeys: row.enabled_permissions ?? [],
          }))
        ),
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
          instructors: service.instructor_names ?? [],
          category: service.service_type ?? inferServiceCategory(service.name),
          status: service.status,
          calendarColor: normalizeCalendarColor(service.calendar_color),
          scheduleId: service.schedule_id,
          collectTax: Boolean(service.collect_tax),
          collectFee: Boolean(service.collect_fee),
          membershipBillingPeriod: service.membership_billing_period ?? "Monthly",
          membershipMemberLimit: service.membership_member_limit ?? null,
          membershipCreditsPerDay: Number(service.membership_credits_per_day ?? 0),
          membershipCreditLimitPeriod: normalizeMembershipCreditLimitPeriod(service.membership_credit_limit_period),
          membershipCreditScope: service.membership_credit_scope ?? "selected_services",
          membershipEligibleServiceIds: Array.isArray(service.membership_eligible_service_ids)
            ? service.membership_eligible_service_ids
            : [],
          stripeProductId: service.stripe_product_id ?? null,
          stripePriceId: service.stripe_price_id ?? null,
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
        bookings: bookingRows.map((booking) => {
          const creditEntry = bookingCreditLedgerEntry(membershipCreditLedgerEntries, booking.id);

          return normalizeUnavailableBooking({
            id: booking.id,
            date: booking.booking_date,
            start: normalizeTime(booking.start_time),
            end: normalizeTime(booking.end_time),
            customerId: booking.customer_id ?? "",
            playerName: booking.player_name ?? "",
            serviceId: booking.service_id ?? "",
            serviceName: booking.service_id ? serviceMetaById.get(booking.service_id)?.name ?? "" : UNAVAILABLE_SERVICE_NAME,
            calendarColor: booking.service_id
              ? serviceMetaById.get(booking.service_id)?.calendarColor ?? DEFAULT_SERVICE_CALENDAR_COLOR
              : "#6b7280",
            resource: booking.resource_id ? namesById.get(booking.resource_id) ?? "" : "",
            status: booking.status,
            paid: Boolean(booking.paid || creditEntry),
            paidByMembershipCredit: Boolean(creditEntry),
            membershipCreditMembershipId: creditEntry?.customerMembershipId ?? "",
          });
        }),
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
        schedules,
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
      setCustomerMembershipsByCustomerId(customerMembershipsById);
      setMembershipCreditLedger(membershipCreditLedgerEntries);
      setDataSource("supabase");
    } catch (error) {
      console.error(error);
      setDataSource("local");
      setCustomerMembershipsByCustomerId({});
      setMembershipCreditLedger([]);
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

  async function moveCalendarBooking(bookingId: string, patch: Pick<Booking, "date" | "resource" | "start" | "end">) {
    const currentBooking = state.bookings.find((booking) => booking.id === bookingId);
    if (!currentBooking) {
      showToast("Could not find booking.");
      return false;
    }

    const movedBooking = normalizeUnavailableBooking({
      ...currentBooking,
      ...patch,
    });
    const scheduleConflictMessage = bookingScheduleConflictMessage(movedBooking, state.services, state.schedules);

    if (scheduleConflictMessage) {
      showBookingConflictDialog(scheduleConflictMessage);
      return false;
    }

    if (hasRoomBookingConflict(state.bookings, movedBooking)) {
      showBookingConflictDialog("This room is already booked for that time. Please choose another time or another room.");
      return false;
    }

    const next = { ...state, bookings: upsert(state.bookings, movedBooking) };

    if (dataSource === "local") {
      saveLocal(next, "Booking moved.");
      return true;
    }

    const previousState = state;
    setState(next);

    try {
      await upsertModalChange({ type: "booking", item: movedBooking }, resourceIdsByName);
      showToast("Booking moved.");
      return true;
    } catch (error) {
      console.error(error);
      setState(previousState);
      const fallbackMessage = "Booking could not be moved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      if (isBookingConflictMessage(errorMessage)) {
        showBookingConflictDialog(errorMessage);
      } else {
        showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
      }
      return false;
    }
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
      await upsertFacilitySettings(
        normalizedNext.facility,
        normalizedNext.profile,
        normalizedNext.policies,
        normalizedNext.registration,
        normalizedNext.taxesAndFees
      );
      const resources = await upsertResources(normalizedNext.resources);
      const lookup = resourceLookup(resources);
      setResourceIdsByName(lookup.idsByName);

      const desiredScheduleIdsByRoom = new Map<string, string>();
      normalizedNext.schedules.forEach((schedule) => {
        schedule.roomNames.forEach((roomName) => {
          desiredScheduleIdsByRoom.set(roomName, schedule.id);
        });
      });

      const scheduleUpdates = resources
        .map((resource) => ({
          id: resource.id,
          currentScheduleId: resource.schedule_id ?? null,
          nextScheduleId: desiredScheduleIdsByRoom.get(resource.name) ?? null,
        }))
        .filter((resource) => resource.currentScheduleId !== resource.nextScheduleId);

      if (scheduleUpdates.length) {
        const updateResults = await Promise.all(
          scheduleUpdates.map((resource) =>
            supabase.from("booking_resources").update({ schedule_id: resource.nextScheduleId }).eq("id", resource.id)
          )
        );

        const failedUpdate = updateResults.find((result) => result.error);
        if (failedUpdate?.error) throw failedUpdate.error;
      }

      showToast("Settings saved.");
    } catch (error) {
      console.error(error);
      showToast("Settings could not be saved.");
    }
  }

  async function saveStaffMembers(nextStaff: StaffMember[], successMessage = "Staff saved.") {
    const normalizedStaff = nextStaff.map((member, index) => ({
      ...member,
      name: member.name.trim(),
      email: member.email.trim(),
      role: normalizeStaffRole(member.role),
      calendarColor: normalizeCalendarColor(member.calendarColor ?? staffAvailabilityColor(index)),
    }));
    const nextState = {
      ...state,
      staff: normalizedStaff,
    };

    if (dataSource === "local") {
      saveLocal(nextState, successMessage);
      return true;
    }

    setState(nextState);
    stateToStorage(nextState);

    try {
      const savedRows = await upsertStaffMembers(normalizedStaff);
      setState((current) => ({
        ...current,
        staff: savedRows.map((member, index) => ({
          id: member.id,
          name: member.full_name,
          email: member.email,
          role: normalizeStaffRole(member.role),
          active: member.is_active,
          calendarColor: normalizeCalendarColor(member.calendar_color ?? staffAvailabilityColor(index)),
        })),
      }));
      showToast(successMessage);
      return true;
    } catch (error) {
      console.error(error);
      showToast("Staff could not be saved.");
      void loadFromSupabase();
      return false;
    }
  }

  async function saveRolePermissions(nextRolePermissions: RolePermissionRecord[]) {
    const normalizedRolePermissions = normalizeRolePermissions(nextRolePermissions);
    const nextState = {
      ...state,
      rolePermissions: normalizedRolePermissions,
    };

    if (dataSource === "local") {
      saveLocal(nextState, "Role permissions saved.");
      return true;
    }

    setState(nextState);
    stateToStorage(nextState);

    try {
      await upsertRolePermissions(normalizedRolePermissions);
      showToast("Role permissions saved.");
      return true;
    } catch (error) {
      console.error(error);
      showToast("Role permissions could not be saved.");
      void loadFromSupabase();
      return false;
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

  async function saveStaffAvailabilityEntry(entry: StaffAvailabilityEntry) {
    const staffMember = state.staff.find((member) => member.id === entry.staffId);
    if (!staffMember) {
      showToast("Choose a staff member.");
      return false;
    }

    if (!canManageAnyAvailability && entry.staffId !== currentStaffMember?.id) {
      showToast("Staff can only change their own availability.");
      return false;
    }

    const normalizedEntry = normalizeStaffAvailabilityEntry(
      {
        ...entry,
        staffName: staffMember.name,
        resources: entry.resources.filter((resource) => state.resources.includes(resource)),
      },
      new Map(state.staff.map((member) => [member.id, member])),
      state.staffAvailability.length
    );

    if (!normalizedEntry) {
      showToast("Choose a valid start and end time.");
      return false;
    }

    const previousEntry = state.staffAvailability.find((item) => item.id === normalizedEntry.id);
    const recurrenceId = normalizedEntry.recurring ? normalizedEntry.recurrenceId : previousEntry?.recurrenceId;
    const existingSeries = recurrenceId ? state.staffAvailability.filter((item) => item.recurrenceId === recurrenceId) : [];
    const shouldPreserveSeriesStart =
      normalizedEntry.recurring &&
      previousEntry !== undefined &&
      previousEntry.recurrenceId === recurrenceId &&
      previousEntry.date === normalizedEntry.date &&
      existingSeries.length > 0;
    const recurrenceStartDate =
      shouldPreserveSeriesStart
        ? existingSeries.reduce((earliest, item) => (item.date < earliest ? item.date : earliest), existingSeries[0].date)
        : normalizedEntry.date;
    const expandedEntries = normalizedEntry.recurring
      ? expandStaffAvailabilityRecurrence(normalizedEntry, recurrenceStartDate)
      : [normalizedEntry];
    const retainedAvailability = state.staffAvailability.filter((item) =>
      recurrenceId ? item.recurrenceId !== recurrenceId && item.id !== normalizedEntry.id : item.id !== normalizedEntry.id
    );
    const nextStaff = state.staff.map((member) =>
      member.id === normalizedEntry.staffId
        ? { ...member, calendarColor: normalizedEntry.color }
        : member
    );
    const nextAvailability = [...retainedAvailability, ...expandedEntries].map((item) =>
      item.staffId === normalizedEntry.staffId ? { ...item, color: normalizedEntry.color } : item
    );
    const next = {
      ...state,
      staff: nextStaff,
      staffAvailability: nextAvailability,
    };

    if (dataSource === "local") {
      saveLocal(next, "Availability saved.");
      return true;
    }

    const previousState = state;
    setState(next);
    stateToStorage(next);

    try {
      if (recurrenceId) {
        const deleteSeries = await supabase
          .from("booking_staff_availability")
          .delete()
          .eq("recurrence_id", recurrenceId);
        if (deleteSeries.error) throw deleteSeries.error;
      }

      const { error } = await supabase.from("booking_staff_availability").upsert(
        expandedEntries.map((item) => ({
          id: item.id,
          staff_member_id: item.staffId,
          availability_date: item.date,
          start_time: item.start,
          end_time: item.end,
          resource_names: item.resources,
          color: item.color,
          is_recurring: Boolean(item.recurring),
          recurrence_id: item.recurrenceId ?? null,
          recurrence_frequency: item.recurrenceFrequency ?? null,
          recurrence_end_date: item.recurrenceEndDate ?? null,
        }))
      );

      if (error) throw error;
      if (canManageAnyAvailability) {
        const staffColorUpdate = await supabase
          .from("booking_staff_members")
          .update({ calendar_color: normalizedEntry.color })
          .eq("id", normalizedEntry.staffId);
        if (staffColorUpdate.error) throw staffColorUpdate.error;
      }

      const staffAvailabilityColorUpdate = await supabase
        .from("booking_staff_availability")
        .update({ color: normalizedEntry.color })
        .eq("staff_member_id", normalizedEntry.staffId);
      if (staffAvailabilityColorUpdate.error) throw staffAvailabilityColorUpdate.error;

      showToast("Availability saved.");
      return true;
    } catch (error) {
      console.error(error);
      setState(previousState);
      showToast("Availability could not be saved.");
      return false;
    }
  }

  async function deleteStaffAvailabilityEntry(entryId: string) {
    const entry = state.staffAvailability.find((item) => item.id === entryId);
    if (!entry) {
      showToast("Availability block was not found.");
      return false;
    }

    if (!canManageAnyAvailability && entry.staffId !== currentStaffMember?.id) {
      showToast("Staff can only change their own availability.");
      return false;
    }

    const next = {
      ...state,
      staffAvailability: state.staffAvailability.filter((item) => item.id !== entryId),
    };

    if (dataSource === "local") {
      saveLocal(next, "Availability deleted.");
      return true;
    }

    const previousState = state;
    setState(next);
    stateToStorage(next);

    try {
      const { error } = await supabase.from("booking_staff_availability").delete().eq("id", entryId);
      if (error) throw error;
      showToast("Availability deleted.");
      return true;
    } catch (error) {
      console.error(error);
      setState(previousState);
      showToast("Availability could not be deleted.");
      return false;
    }
  }

  async function saveScheduleRecord(scheduleDraft: ScheduleRecord, mode: "add" | "edit") {
    const normalizedSchedule = normalizeScheduleRecord(scheduleDraft);
    if (!normalizedSchedule.name) {
      showToast("Schedule name is required.");
      return false;
    }

    const duplicateSchedule = state.schedules.find(
      (schedule) =>
        schedule.id !== normalizedSchedule.id &&
        schedule.name.trim().toLowerCase() === normalizedSchedule.name.trim().toLowerCase()
    );
    if (duplicateSchedule) {
      showToast("That schedule already exists.");
      return false;
    }

    const persistedSchedule =
      mode === "edit"
        ? state.schedules.map((schedule) => (schedule.id === normalizedSchedule.id ? normalizedSchedule : schedule))
        : [...state.schedules, normalizedSchedule];

    const workingSchedule =
      persistedSchedule.find((schedule) => schedule.isDefault || schedule.slug === "working-hours") ?? persistedSchedule[0];
    const next = {
      ...state,
      schedules: persistedSchedule,
      availability: workingSchedule ? availabilityFromSchedule(workingSchedule) : state.availability,
    };

    if (dataSource === "local") {
      saveLocal(next, "Schedule saved.");
      return true;
    }

    const previousState = state;
    setState(next);

    try {
      const schedulePayload = {
        ...(mode === "edit" && normalizedSchedule.id ? { id: normalizedSchedule.id } : {}),
        name: normalizedSchedule.name,
        slug: normalizedSchedule.slug,
        is_default: normalizedSchedule.isDefault,
        is_active: true,
      };

      const scheduleResult = await supabase
        .from("booking_schedules")
        .upsert(schedulePayload)
        .select("id")
        .single();

      if (scheduleResult.error) throw scheduleResult.error;
      const scheduleId = scheduleResult.data.id as string;

      const deleteSlotsResult = await supabase.from("booking_schedule_slots").delete().eq("schedule_id", scheduleId);
      if (deleteSlotsResult.error) throw deleteSlotsResult.error;

      const slotRows = normalizedSchedule.dayConfigs.flatMap((config) =>
        config.enabled
          ? config.slots.map((slot, index) => ({
              schedule_id: scheduleId,
              weekday: config.weekday,
              day_name: config.day,
              start_time: slot.start,
              end_time: slot.end,
              sort_order: index + 1,
            }))
          : []
      );

      if (slotRows.length) {
        const insertSlotsResult = await supabase.from("booking_schedule_slots").insert(slotRows);
        if (insertSlotsResult.error) throw insertSlotsResult.error;
      }

      const deleteOverridesResult = await supabase.from("booking_schedule_overrides").delete().eq("schedule_id", scheduleId);
      if (deleteOverridesResult.error) throw deleteOverridesResult.error;

      const overrideRows: Array<{
        schedule_id: string;
        override_date: string;
        is_closed: boolean;
        start_time: string | null;
        end_time: string | null;
        sort_order: number;
      }> = [];

      for (const override of normalizedSchedule.overrides) {
        if (override.isClosed) {
          overrideRows.push({
            schedule_id: scheduleId,
            override_date: override.date,
            is_closed: true,
            start_time: null,
            end_time: null,
            sort_order: 1,
          });
          continue;
        }

        override.slots.forEach((slot, index) => {
          overrideRows.push({
            schedule_id: scheduleId,
            override_date: override.date,
            is_closed: false,
            start_time: slot.start,
            end_time: slot.end,
            sort_order: index + 1,
          });
        });
      }

      if (overrideRows.length) {
        const insertOverridesResult = await supabase.from("booking_schedule_overrides").insert(overrideRows);
        if (insertOverridesResult.error) throw insertOverridesResult.error;
      }

      const currentResourcesResult = await supabase
        .from("booking_resources")
        .select("id,name,schedule_id")
        .eq("is_active", true);
      if (currentResourcesResult.error) throw currentResourcesResult.error;

      const desiredScheduleIdsByRoom = new Map<string, string>();
      persistedSchedule.forEach((item) => {
        const resolvedScheduleId = item.id === normalizedSchedule.id ? scheduleId : item.id;
        item.roomNames.forEach((roomName) => {
          desiredScheduleIdsByRoom.set(roomName, resolvedScheduleId);
        });
      });

      const roomScheduleUpdates = ((currentResourcesResult.data ?? []) as BookingResourceRow[])
        .map((resource) => ({
          id: resource.id,
          currentScheduleId: resource.schedule_id ?? null,
          nextScheduleId: desiredScheduleIdsByRoom.get(resource.name) ?? null,
        }))
        .filter((resource) => resource.currentScheduleId !== resource.nextScheduleId);

      if (roomScheduleUpdates.length) {
        const updateResults = await Promise.all(
          roomScheduleUpdates.map((resource) =>
            supabase.from("booking_resources").update({ schedule_id: resource.nextScheduleId }).eq("id", resource.id)
          )
        );

        const failedUpdate = updateResults.find((result) => result.error);
        if (failedUpdate?.error) throw failedUpdate.error;
      }

      if (normalizedSchedule.isDefault) {
        const workingAvailability = availabilityFromSchedule({ ...normalizedSchedule, id: scheduleId });
        const availabilityResult = await supabase.from("booking_availability").upsert(
          workingAvailability.map(([day, open, start, end], index) => ({
            weekday: day === "Sunday" ? 0 : index + 1,
            day_name: day,
            is_open: open,
            start_time: start,
            end_time: end,
          })),
          { onConflict: "weekday" }
        );
        if (availabilityResult.error) throw availabilityResult.error;
      }

      showToast("Schedule saved.");
      await loadFromSupabase();
      return true;
    } catch (error) {
      console.error(error);
      setState(previousState);
      showToast("Schedule could not be saved.");
      return false;
    }
  }

  async function deleteScheduleRecord(schedule: ScheduleRecord) {
    const deleteGuardMessage = getScheduleDeleteGuard(schedule);
    if (deleteGuardMessage) {
      showToast(deleteGuardMessage);
      return false;
    }

    const nextSchedules = state.schedules.filter((item) => item.id !== schedule.id);
    const workingSchedule =
      nextSchedules.find((item) => item.isDefault || item.slug === "working-hours") ?? nextSchedules[0] ?? null;
    const next = {
      ...state,
      schedules: nextSchedules,
      availability: workingSchedule ? availabilityFromSchedule(workingSchedule) : state.availability,
    };

    if (dataSource === "local") {
      saveLocal(next, "Schedule deleted.");
      return true;
    }

    const previousState = state;
    setState(next);

    try {
      const deleteOverridesResult = await supabase.from("booking_schedule_overrides").delete().eq("schedule_id", schedule.id);
      if (deleteOverridesResult.error) throw deleteOverridesResult.error;

      const deleteSlotsResult = await supabase.from("booking_schedule_slots").delete().eq("schedule_id", schedule.id);
      if (deleteSlotsResult.error) throw deleteSlotsResult.error;

      const deleteScheduleResult = await supabase.from("booking_schedules").delete().eq("id", schedule.id);
      if (deleteScheduleResult.error) throw deleteScheduleResult.error;

      showToast("Schedule deleted.");
      return true;
    } catch (error) {
      console.error(error);
      setState(previousState);
      stateToStorage(previousState);
      showToast("Schedule could not be deleted.");
      return false;
    }
  }

  async function saveRoomScheduleAssignment(roomName: string, scheduleId: string) {
    if (dataSource === "local") return;
    const resourceId = resourceIdsByName[roomName];
    if (!resourceId) return;

    const updateResult = await supabase.from("booking_resources").update({ schedule_id: scheduleId }).eq("id", resourceId);
    if (updateResult.error) throw updateResult.error;
  }

  async function saveModalChange(next: AppState, message: string, change: ModalSaveChange) {
    if (dataSource === "local") {
      if (change.type === "booking") {
        setMembershipCreditLedger((current) => updatedMembershipCreditLedgerForBooking(current, change.item));
      }
      saveLocal(next, message);
      setModal(null);
      return;
    }

    const previousState = state;
    setState(next);

    try {
      await upsertModalChange(change, resourceIdsByName);
      if (change.type === "booking") {
        setMembershipCreditLedger((current) => updatedMembershipCreditLedgerForBooking(current, change.item));
      }
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

  async function saveCustomerDetail(item: Customer, message: string, options?: { silent?: boolean }) {
    const previousState = state;
    const next = { ...state, customers: upsert(state.customers, item) };

    if (dataSource === "local") {
      if (options?.silent) {
        setState(next);
        stateToStorage(next);
      } else {
        saveLocal(next, message);
      }
      return true;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "customer", item }, resourceIdsByName);
      if (!options?.silent) {
        showToast(message);
      }
      return true;
    } catch (error) {
      console.error(error);
      setState(previousState);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
      return false;
    }
  }

  async function assignMembershipToCustomer(customerId: string, membershipServiceId: string) {
    const service = state.services.find((item) => item.id === membershipServiceId);
    if (!service || (service.category ?? inferServiceCategory(service.name)) !== "memberships") {
      showToast("Choose a valid membership.");
      return false;
    }

    const hasActiveMembership = (customerMembershipsByCustomerId[customerId] ?? []).some(
      (membership) => membership.membershipServiceId === membershipServiceId && isActiveCustomerMembership(membership)
    );
    if (hasActiveMembership) {
      showToast("This membership is already active for this customer.");
      return false;
    }

    const now = new Date().toISOString();
    const billingPeriod = service.membershipBillingPeriod ?? "Monthly";
    const priceCents = Math.round(Number(service.price || 0) * 100);
    const creditsPerDay = Math.max(0, Math.floor(Number(service.membershipCreditsPerDay ?? 0)));
    const creditLimitPeriod = normalizeMembershipCreditLimitPeriod(service.membershipCreditLimitPeriod);
    const eligibleServiceIds = Array.isArray(service.membershipEligibleServiceIds)
      ? service.membershipEligibleServiceIds.filter(Boolean)
      : [];
    const currentPeriodEnd = addMembershipPeriod(now, billingPeriod);

    if (dataSource === "local") {
      const localMembership: CustomerMembershipRecord = {
        id: makeId("cmem"),
        customerId,
        membershipServiceId: service.id,
        status: "Active",
        billingPeriod,
        priceCents,
        creditsPerDay,
        creditLimitPeriod,
        creditScope: service.membershipCreditScope ?? "selected_services",
        eligibleServiceIds,
        currentPeriodStart: now,
        currentPeriodEnd,
        stripeSubscriptionId: "",
        stripePriceId: service.stripePriceId ?? "",
        autoRenew: true,
        startedAt: now,
        cancelledAt: "",
        createdAt: now,
        updatedAt: now,
      };
      setCustomerMembershipsByCustomerId((previous) => ({
        ...previous,
        [customerId]: [...(previous[customerId] ?? []), localMembership].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        ),
      }));
      showToast(`${service.name} assigned.`);
      return true;
    }

    try {
      const { data, error } = await supabase
        .from("booking_customer_memberships")
        .insert({
          customer_id: customerId,
          membership_service_id: service.id,
          status: "Active",
          billing_period: billingPeriod,
          price_cents: priceCents,
          credits_per_day: creditsPerDay,
          credit_limit_period: creditLimitPeriod,
          credit_scope: service.membershipCreditScope ?? "selected_services",
          eligible_service_ids: eligibleServiceIds,
          current_period_start: now,
          current_period_end: currentPeriodEnd,
          stripe_subscription_id: null,
          stripe_price_id: service.stripePriceId ?? null,
          auto_renew: true,
          started_at: now,
          cancelled_at: null,
        })
        .select("*")
        .single();

      if (error) throw error;

      const normalized = normalizeCustomerMembershipRow(data as BookingCustomerMembershipRow);
      setCustomerMembershipsByCustomerId((previous) => ({
        ...previous,
        [customerId]: [...(previous[customerId] ?? []), normalized].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        ),
      }));
      showToast(`${service.name} assigned.`);
      return true;
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error, "Membership could not be assigned.");
      showToast(message.includes("duplicate") || message.includes("unique") ? "This membership is already active for this customer." : message);
      return false;
    }
  }

  async function cancelCustomerMembership(
    customerId: string,
    membershipRecordId: string,
    options: MembershipCancelOptions
  ) {
    const now = new Date().toISOString();

    if (dataSource === "local") {
      setCustomerMembershipsByCustomerId((previous) => ({
        ...previous,
        [customerId]: (previous[customerId] ?? []).map((membership) =>
          membership.id === membershipRecordId
            ? options.timing === "period_end"
              ? { ...membership, autoRenew: false, cancelledAt: now, updatedAt: now }
              : { ...membership, status: "Cancelled", autoRenew: false, cancelledAt: now, currentPeriodEnd: now, updatedAt: now }
            : membership
        ),
      }));
      showToast(options.timing === "period_end" ? "Membership will cancel at period end." : "Membership cancelled.");
      return true;
    }

    try {
      const response = await fetch("/api/stripe/memberships/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          membershipRecordId,
          timing: options.timing,
          refundProrated: options.refundProrated,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Membership could not be cancelled.");
      }

      const normalized = normalizeCustomerMembershipRow(payload.membership as BookingCustomerMembershipRow);
      setCustomerMembershipsByCustomerId((previous) => ({
        ...previous,
        [customerId]: (previous[customerId] ?? []).map((membership) =>
          membership.id === normalized.id ? normalized : membership
        ),
      }));
      const refundAmount = Number(payload.refund?.amountCents ?? 0);
      if (refundAmount > 0) {
        showToast(`Membership cancelled and ${moneyPrecise(refundAmount / 100)} refunded.`);
      } else {
        showToast(options.timing === "period_end" ? "Membership will cancel at period end." : "Membership cancelled.");
      }
      return true;
    } catch (error) {
      console.error(error);
      showToast(getErrorMessage(error, "Membership could not be cancelled."));
      return false;
    }
  }

  async function saveRentalDraft(rentalDraft: RentalDraft, existingService?: Service | null) {
    const firstDefaultPrice = rentalDraft.defaultPricing[0];
    const scheduleId = rentalDraft.serviceScheduleEnabled ? rentalDraft.scheduleId || null : null;
    const serviceCategory = existingService?.category ?? serviceSection;
    const serviceLabel = getServiceSectionSingular(serviceCategory);
    const serviceBasePath = getServiceSectionBasePath(serviceCategory);
    const item: Service = {
      id: existingService?.id ?? makeId("svc"),
      name: rentalDraft.name.trim(),
      duration: Number(firstDefaultPrice?.duration || 30),
      price: Number(firstDefaultPrice?.price || 0),
      resource: rentalDraft.selectedRooms[0] ?? "",
      rooms: rentalDraft.selectedRooms,
      instructors: (rentalDraft.instructors ?? []).map((item) => item.trim()).filter(Boolean),
      category: serviceCategory,
      status: rentalDraft.private ? "Off" : existingService?.status === "Draft" ? "Draft" : "Active",
      previewText: rentalDraft.previewText,
      description: rentalDraft.description,
      mediaUrl: rentalDraft.mediaUrl,
      calendarColor: normalizeCalendarColor(rentalDraft.calendarColor),
      scheduleId,
      collectTax: rentalDraft.collectTax,
      collectFee: rentalDraft.collectFee,
    };
    const next = {
      ...state,
      services: upsert(state.services, item),
      schedules: assignServiceToSchedule(state.schedules, item.name, item.scheduleId, existingService?.name),
    };
    const successMessage = existingService ? `${serviceLabel} updated.` : `${serviceLabel} saved.`;

    if (dataSource === "local") {
      saveLocal(next, successMessage);
      router.push(serviceBasePath);
      return;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "service", item }, resourceIdsByName);
      showToast(successMessage);
      router.push(serviceBasePath);
    } catch (error) {
      console.error(error);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function saveMembershipDraft(membershipDraft: MembershipDraft, existingService?: Service | null) {
    const cleanedName = membershipDraft.name.trim();
    if (!cleanedName) {
      showToast("Membership name is required.");
      return;
    }

    const parsedPrice = Number(membershipDraft.price || 0);
    const parsedCredits = Number(membershipDraft.creditsPerDay || 0);
    const creditLimitPeriod = normalizeMembershipCreditLimitPeriod(membershipDraft.creditLimitPeriod);
    const parsedMemberLimit = membershipDraft.memberLimit.trim() ? Number(membershipDraft.memberLimit) : null;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      showToast("Enter a valid membership price.");
      return;
    }
    if (!Number.isFinite(parsedCredits) || parsedCredits < 0) {
      showToast("Enter a valid credit amount.");
      return;
    }
    if (parsedMemberLimit !== null && (!Number.isFinite(parsedMemberLimit) || parsedMemberLimit < 0)) {
      showToast("Enter a valid member limit.");
      return;
    }

    const serviceBasePath = getServiceSectionBasePath("memberships");
    const item = normalizeService({
      id: existingService?.id ?? makeId("svc"),
      name: cleanedName,
      duration: existingService?.duration ?? 30,
      price: parsedPrice,
      resource: "",
      rooms: [],
      instructors: [],
      category: "memberships",
      status: membershipDraft.private ? "Off" : "Active",
      previewText: "",
      description: membershipDraft.description.trim(),
      mediaUrl: "",
      calendarColor: existingService?.calendarColor ?? DEFAULT_SERVICE_CALENDAR_COLOR,
      scheduleId: null,
      collectTax: false,
      collectFee: false,
      membershipBillingPeriod: membershipDraft.billingPeriod,
      membershipMemberLimit: parsedMemberLimit,
      membershipCreditsPerDay: Math.floor(parsedCredits),
      membershipCreditLimitPeriod: creditLimitPeriod,
      membershipCreditScope: membershipDraft.creditScope,
      membershipEligibleServiceIds:
        membershipDraft.creditScope === "all_services" ? [] : membershipDraft.eligibleServiceIds,
      stripeProductId: membershipDraft.stripeProductId.trim() || null,
      stripePriceId: membershipDraft.stripePriceId.trim() || null,
    });

    const next = { ...state, services: upsert(state.services, item) };
    const successMessage = existingService ? "Membership updated." : "Membership saved.";

    if (dataSource === "local") {
      saveLocal(next, successMessage);
      router.push(serviceBasePath);
      return;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "service", item }, resourceIdsByName);
      showToast(successMessage);
      router.push(serviceBasePath);
    } catch (error) {
      console.error(error);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function duplicateRental(service: Service) {
    const serviceCategory = service.category ?? inferServiceCategory(service.name);
    const serviceLabel = getServiceSectionSingular(serviceCategory);
    const serviceBasePath = getServiceSectionBasePath(serviceCategory);
    const duplicate: Service = {
      ...service,
      id: makeId("svc"),
      name: `${service.name} Copy`,
    };
    const next = { ...state, services: upsert(state.services, duplicate) };

    if (dataSource === "local") {
      saveLocal(next, `${serviceLabel} duplicated.`);
      router.push(`${serviceBasePath}/${duplicate.id}`);
      return;
    }

    setState(next);

    try {
      await upsertModalChange({ type: "service", item: duplicate }, resourceIdsByName);
      showToast(`${serviceLabel} duplicated.`);
      router.push(`${serviceBasePath}/${duplicate.id}`);
    } catch (error) {
      console.error(error);
      const fallbackMessage = "That change could not be saved.";
      const errorMessage = getErrorMessage(error, fallbackMessage);
      showToast(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${errorMessage}`);
    }
  }

  async function deleteRental(service: Service) {
    const guardMessage = getRentalDeleteGuard(service, state, customerMembershipsByCustomerId);
    if (guardMessage) {
      showToast(guardMessage);
      return;
    }

    const serviceCategory = service.category ?? inferServiceCategory(service.name);
    const serviceLabel = getServiceSectionSingular(serviceCategory);
    const serviceBasePath = getServiceSectionBasePath(serviceCategory);
    const confirmed = window.confirm(`Delete this ${serviceLabel.toLowerCase()}? This cannot be undone.`);
    if (!confirmed) return;

    const previousState = state;
    const next = {
      ...state,
      services: state.services.filter((item) => item.id !== service.id),
    };

    if (dataSource === "local") {
      saveLocal(next, `${serviceLabel} deleted.`);
      router.push(serviceBasePath);
      return;
    }

    setState(next);

    try {
      const { error } = await supabase.from("booking_services").delete().eq("id", service.id);
      if (error) throw error;
      showToast(`${serviceLabel} deleted.`);
      router.push(serviceBasePath);
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
  const membershipMembersByServiceId = useMemo(
    () => buildMembershipMembersByServiceId(state.customers, customerMembershipsByCustomerId),
    [customerMembershipsByCustomerId, state.customers]
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
          "pb-[76px] lg:pb-0",
          isSettingsView ? "" : "lg:grid-cols-[284px_minmax(0,1fr)]",
        ].join(" ")}
      >
        {!isSettingsView ? (
          <aside className="hidden bg-[#f5f5f5] p-3 lg:flex lg:min-h-screen lg:flex-col lg:px-6 lg:py-6">
            <div className="-mx-6 -mt-6 mb-6 hidden items-center justify-between border-b border-white/10 bg-black px-6 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.28)] lg:flex">
              <AdminBrandLogo size="desktop" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white">
                <Icon name="user" className="h-5 w-5" />
              </div>
            </div>

            <nav className="flex w-full gap-1 overflow-x-auto lg:mt-8 lg:grid lg:overflow-visible">
              {navItems.map((item) => (
                <div key={item.key} className="shrink-0 lg:w-full">
                  <Link
                    href={bookingAdminRouteByView[item.key]}
                    title={item.label}
                    className={[
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-left text-lg transition lg:w-full",
                      activeMainView === item.key ? "bg-[#eeeeee] font-bold" : "hover:bg-black/5",
                    ].join(" ")}
                  >
                    <Icon name={item.icon} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>

                  {item.key === "services" && activeMainView === "services" ? (
                    <div className="mt-1 hidden space-y-1 pl-5 pr-2 lg:block">
                      {serviceSectionItems.map((sectionItem) => (
                        <Link
                          key={sectionItem.key}
                          href={getServiceSectionBasePath(sectionItem.key)}
                          className={[
                            "flex h-10 w-full items-center gap-3 rounded-lg px-4 text-left text-[18px] leading-none transition",
                            serviceSection === sectionItem.key ? "bg-[#eeeeee] font-semibold text-black" : "text-black hover:bg-black/5",
                          ].join(" ")}
                        >
                          <Icon name={sectionItem.icon} className="h-[18px] w-[18px] shrink-0" />
                          <span>{sectionItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>

            <div className="mt-auto hidden space-y-1 lg:block">
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
            isServiceAddPage || isServiceEditPage ? (
              serviceSection === "memberships" ? (
                <MembershipEditorView
                  key={selectedService?.id ?? "new-membership"}
                  mode={isServiceEditPage ? "edit" : "add"}
                  service={selectedService}
                  services={state.services}
                  membershipMembersByServiceId={membershipMembersByServiceId}
                  deleteGuardMessage={
                    selectedService
                      ? getRentalDeleteGuard(selectedService, state, customerMembershipsByCustomerId)
                      : null
                  }
                  onCancel={() => router.push(getServiceSectionBasePath("memberships"))}
                  onDelete={() => {
                    if (selectedService) {
                      void deleteRental(selectedService);
                    }
                  }}
                  onSave={(membershipDraft) => void saveMembershipDraft(membershipDraft, selectedService)}
                />
              ) : (
                <RentalEditorView
                  key={selectedService?.id ?? "new-service"}
                  mode={isServiceEditPage ? "edit" : "add"}
                  facilityName={state.facility.name}
                  resources={state.resources}
                  schedules={state.schedules.length ? state.schedules : defaultState.schedules}
                  onCancel={() => router.push(getServiceSectionBasePath(serviceSection))}
                  activeSection={serviceSection}
                  onSectionChange={(section) => {
                    setServiceSection(section);
                    router.push(getServiceSectionBasePath(section));
                  }}
                  service={selectedService}
                  staff={state.staff}
                  deleteGuardMessage={
                    selectedService
                      ? getRentalDeleteGuard(selectedService, state, customerMembershipsByCustomerId)
                      : null
                  }
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
              )
            ) : (
              <ServicesView
                services={state.services}
                membershipMembersByServiceId={membershipMembersByServiceId}
                activeSection={serviceSection}
                onSectionChange={setServiceSection}
                onReorder={(visibleServiceIds, serviceId, direction) =>
                  void reorderServices(visibleServiceIds, serviceId, direction)
                }
                onNew={() => {
                  router.push(`${getServiceSectionBasePath(serviceSection)}/add`);
                }}
                onEdit={(id) => {
                  router.push(`${getServiceSectionBasePath(serviceSection)}/${id}`);
                }}
              />
            )
          ) : null}
          {view === "calendar" ? (
            <CalendarView
              activeDate={activeDate}
              bookings={state.bookings}
              availability={state.availability}
              schedules={state.schedules}
              customersById={customersById}
              resources={state.resources}
              servicesById={servicesById}
              onDateChange={setActiveDate}
              onNew={(seed) => setModal({ type: "booking", seed })}
              onEdit={(id) => setModal({ type: "booking", id })}
              onMoveBooking={moveCalendarBooking}
              showToast={showToast}
            />
          ) : null}
          {view === "availability" ? (
            <AvailabilityView
              rows={state.availability}
              staff={state.staff}
              resources={state.resources}
              entries={state.staffAvailability}
              currentStaffId={currentStaffMember?.id ?? ""}
              canManageAny={canManageAnyAvailability}
              onChange={(rows) => setState((current) => ({ ...current, availability: rows }))}
              onSave={() => void saveAvailability(state.availability)}
              onSaveEntry={saveStaffAvailabilityEntry}
              onDeleteEntry={deleteStaffAvailabilityEntry}
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
                bookings={state.bookings}
                servicesById={servicesById}
                taxesAndFees={state.taxesAndFees}
                customerMemberships={selectedCustomer ? customerMembershipsByCustomerId[selectedCustomer.id] ?? [] : []}
                membershipServices={state.services.filter(
                  (service) => (service.category ?? inferServiceCategory(service.name)) === "memberships"
                )}
                onSaveCustomer={(item, options) =>
                  saveCustomerDetail(item, options?.message ?? "Customer updated.", {
                    silent: options?.silent,
                  })
                }
                onAssignMembership={assignMembershipToCustomer}
                onCancelMembership={cancelCustomerMembership}
                showToast={showToast}
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
          {view === "settings-schedules-add" ? (
            <ScheduleEditorView
              schedule={{
                id: makeId("schedule"),
                name: "",
                slug: "",
                isDefault: false,
                roomNames: [],
                serviceNames: [],
                dayConfigs: (
                  state.schedules.find((item) => item.isDefault || item.slug === "working-hours")?.dayConfigs ??
                  defaultState.schedules[0].dayConfigs
                ).map((config) => ({
                  ...config,
                  slots: config.slots.map((slot) => ({ ...slot, id: makeId("schedule-slot") })),
                })),
                overrides: [],
              }}
              resources={state.resources}
              onBack={() => router.push(bookingAdminRouteByView["settings-schedules"])}
              onSave={async (schedule) => {
                const saved = await saveScheduleRecord(schedule, "add");
                if (saved) {
                  router.push(bookingAdminRouteByView["settings-schedules"]);
                }
                return saved;
              }}
              showToast={showToast}
              mode="add"
            />
          ) : null}
          {view === "settings-schedules" ? (
            isScheduleEditPage ? (
              selectedSchedule ? (
                <ScheduleEditorView
                  schedule={selectedSchedule}
                  resources={state.resources}
                  onBack={() => router.push(bookingAdminRouteByView["settings-schedules"])}
                  onSave={(schedule) => saveScheduleRecord(schedule, "edit")}
                  onDelete={async () => {
                    const deleted = await deleteScheduleRecord(selectedSchedule);
                    if (deleted) {
                      router.push(bookingAdminRouteByView["settings-schedules"]);
                    }
                    return deleted;
                  }}
                  showToast={showToast}
                  mode="edit"
                />
              ) : (
                <section className="min-h-screen px-6 py-8 text-[16px] text-black/60">Loading schedule...</section>
              )
            ) : (
              <SchedulesSettingsView
                backHref={backToAppHref}
                state={state}
                showToast={showToast}
              />
            )
          ) : null}
          {view === "settings-staff" ? (
            <StaffSettingsView
              backHref={backToAppHref}
              staff={state.staff}
              showToast={showToast}
              onSave={saveStaffMembers}
            />
          ) : null}
          {view === "settings-roles" ? (
            isRoleEditPage ? (
              selectedRole ? (
                <StaffRoleEditorView
                  backHref={bookingAdminRouteByView["settings-roles"]}
                  role={selectedRole}
                  rolePermissions={state.rolePermissions}
                  onSave={saveRolePermissions}
                />
              ) : (
                <section className="min-h-screen px-6 py-8 text-[16px] text-black/60">Loading role...</section>
              )
            ) : (
              <StaffRolesSettingsView
                backHref={backToAppHref}
                staff={state.staff}
                rolePermissions={state.rolePermissions}
              />
            )
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
                  schedules: assignRoomToSchedule(state.schedules, name, draft.scheduleId),
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
                deleteGuardMessage={getRoomDeleteGuard(selectedRoomName, state)}
                onCancel={() => router.push("/admin/settings/rooms")}
                onDelete={async () => {
                  const next = {
                    ...state,
                    resources: state.resources.filter((resource) => resource !== selectedRoomName),
                    schedules: removeRoomFromSchedules(state.schedules, selectedRoomName),
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
                  const nextWithSchedule = {
                    ...next,
                    schedules: assignRoomToSchedule(next.schedules, name, draft.scheduleId),
                  };

                  if (dataSource === "local") {
                    setState(nextWithSchedule);
                    stateToStorage(nextWithSchedule);
                    showToast("Settings saved.");
                    router.replace(getRoomEditorHref(name, resourceIdsByName));
                    return;
                  }

                  setState(nextWithSchedule);
                  stateToStorage(nextWithSchedule);

                  try {
                    if (name !== selectedRoomName) {
                      await renameRoomInSupabase(selectedRoomName, name);
                    }

                    await saveRoomScheduleAssignment(selectedRoomName, draft.scheduleId);

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
          {!isRoomEditPage &&
          (view === "more" ||
            view === "settings" ||
            view === "settings-profile" ||
            view === "settings-basics" ||
            view === "settings-rooms" ||
            view === "settings-registration" ||
            view === "settings-taxes-fees" ||
            view === "settings-policies") ? (
            <SettingsView
              backHref={backToAppHref}
              section={
                view === "settings-profile"
                  ? "profile"
                  : view === "settings-policies"
                  ? "policies"
                  : view === "settings-taxes-fees"
                    ? "taxes-fees"
                  : view === "settings-registration"
                    ? "registration"
                  : view === "settings-rooms"
                    ? "rooms"
                    : "basics"
              }
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
          customerMembershipsByCustomerId={customerMembershipsByCustomerId}
          membershipCreditLedger={membershipCreditLedger}
          showToast={showToast}
          showBookingConflictDialog={showBookingConflictDialog}
          onClose={() => setModal(null)}
          onSave={(next, message, change) => void saveModalChange(next, message, change)}
          onChargeBooking={(booking) => {
            if (!booking.customerId) {
              showToast("Choose a customer before charging this booking.");
              return;
            }
            setModal(null);
            setCalendarChargeBookingId(booking.id);
          }}
        />
      ) : null}

      {showCustomerImport ? (
        <CustomerImportModal
          onClose={() => setShowCustomerImport(false)}
          onImport={(customersToImport) => void importCustomers(customersToImport)}
        />
      ) : null}

      {calendarChargeBooking && calendarChargeCustomer ? (
        <CalendarChargeModal
          booking={calendarChargeBooking}
          customer={calendarChargeCustomer}
          service={calendarChargeService}
          customers={state.customers}
          taxesAndFees={state.taxesAndFees}
          customerMembershipsByCustomerId={customerMembershipsByCustomerId}
          membershipCreditLedger={membershipCreditLedger}
          services={state.services}
          showToast={showToast}
          onClose={() => setCalendarChargeBookingId(null)}
          onPaid={(bookingId, message) => {
            const currentBooking = state.bookings.find((item) => item.id === bookingId);
            if (!currentBooking) {
              showToast("Could not find booking.");
              return;
            }
            const updatedBooking: Booking = {
              ...currentBooking,
              paid: true,
              paidByMembershipCredit: false,
              membershipCreditMembershipId: "",
            };
            void saveModalChange(
              { ...state, bookings: upsert(state.bookings, updatedBooking) },
              message,
              { type: "booking", item: updatedBooking }
            );
            setCalendarChargeBookingId(null);
          }}
          onMembershipCreditPaid={(bookingId, membershipId, message) => {
            const currentBooking = state.bookings.find((item) => item.id === bookingId);
            if (!currentBooking) {
              showToast("Could not find booking.");
              return;
            }
            const updatedBooking: Booking = {
              ...currentBooking,
              paid: true,
              paidByMembershipCredit: true,
              membershipCreditMembershipId: membershipId,
            };
            void saveModalChange(
              { ...state, bookings: upsert(state.bookings, updatedBooking) },
              message,
              { type: "booking", item: updatedBooking }
            );
            setCalendarChargeBookingId(null);
          }}
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
              <h2 className="text-xl font-semibold text-black">Booking conflict</h2>
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
        "sticky top-0 z-30 flex h-[84px] items-center justify-between px-7 lg:hidden",
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
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-5 border-t border-black/10 bg-white/95 px-1 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
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
                {previewDevicePresets[previewDevice].label} preview \u00b7 {previewDevicePresets[previewDevice].width} x{" "}
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
  membershipMembersByServiceId,
  onReorder,
  onNew,
  onEdit,
}: {
  activeSection: ServiceSection;
  onSectionChange: (section: ServiceSection) => void;
  services: Service[];
  membershipMembersByServiceId: Map<string, string[]>;
  onReorder: (visibleServiceIds: string[], serviceId: string, direction: "up" | "down") => void;
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const sectionServices = services.filter((service) => {
      return (service.category ?? inferServiceCategory(service.name)) === activeSection;
    });

    if (!normalizedSearch) return sectionServices;

    return sectionServices.filter((service) => {
      const rooms = (service.rooms?.length ? service.rooms : [service.resource]).map((item) => item.trim().toLowerCase());
      const instructors = (service.instructors ?? []).map((item) => item.trim().toLowerCase());
      const membershipMembers = (membershipMembersByServiceId.get(service.id) ?? []).map((customerName) =>
        customerName.trim().toLowerCase()
      );
      return (
        service.name.toLowerCase().includes(normalizedSearch) ||
        rooms.some((room) => room.includes(normalizedSearch)) ||
        instructors.some((instructor) => instructor.includes(normalizedSearch)) ||
        membershipMembers.some((member) => member.includes(normalizedSearch))
      );
    });
  }, [activeSection, membershipMembersByServiceId, search, services]);

  const visibleServiceIds = useMemo(() => filteredServices.map((service) => service.id), [filteredServices]);
  const currentCopy = serviceSectionMeta[activeSection];
  const isLessonsSection = activeSection === "lessons";
  const isMembershipsSection = activeSection === "memberships";

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
          <h1 className="text-[22px] font-medium text-black">{currentCopy.label}</h1>
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
          {isLessonsSection ? (
            <div className="grid grid-cols-[minmax(0,1.5fr)_96px_84px_84px_40px] gap-2 bg-[#f5f6f8] px-4 py-3 text-[14px] font-semibold text-black md:grid-cols-[minmax(180px,1.5fr)_130px_120px_140px_48px] md:gap-3 md:py-3 xl:grid-cols-[minmax(0,1.65fr)_170px_120px_120px_250px_72px] xl:gap-3 xl:px-5 xl:py-3">
              <div>Name</div>
              <div>Visibility</div>
              <div>Price</div>
              <div>Duration</div>
              <div className="hidden xl:block">Instructors</div>
              <div />
            </div>
          ) : isMembershipsSection ? (
            <div className="grid grid-cols-[minmax(0,1.2fr)_90px_78px_84px_40px] gap-2 bg-[#f5f6f8] px-4 py-3 text-[14px] font-semibold text-black md:grid-cols-[minmax(180px,1.45fr)_120px_120px_120px_48px] md:gap-3 md:py-3 xl:grid-cols-[minmax(0,1.65fr)_170px_140px_140px_240px_72px] xl:gap-3 xl:px-5 xl:py-3">
              <div>Name</div>
              <div>Visibility</div>
              <div>Price</div>
              <div>Billing</div>
              <div className="hidden xl:block">Members</div>
              <div />
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1.2fr)_86px_88px_40px] gap-2 bg-[#f5f6f8] px-4 py-3 text-[14px] font-semibold text-black md:grid-cols-[minmax(150px,1.35fr)_120px_minmax(140px,1fr)_48px] md:gap-3 md:py-3 xl:grid-cols-[minmax(0,1.6fr)_170px_220px_72px] xl:gap-3 xl:px-5 xl:py-3">
              <div>Name</div>
              <div>Visibility</div>
              <div>Rooms</div>
              <div />
            </div>
          )}

          {filteredServices.length ? (
            filteredServices.map((service, index) => {
              const rooms = (service.rooms?.length ? service.rooms : [service.resource]).map((item) => item.trim()).filter(Boolean);
              const visibility = service.status === "Active" ? "Everyone" : "Private";
              const instructorNames = getLessonInstructorNames(service);
              const compactInstructorNames = instructorNames.join(", ");
              const visibleInstructorNames = instructorNames.slice(0, 4);
              const remainingInstructorCount = Math.max(0, instructorNames.length - visibleInstructorNames.length);
              const membershipNames = membershipMembersByServiceId.get(service.id) ?? [];
              const compactMembershipNames = membershipNames.join(", ");
              const visibleMembershipNames = membershipNames.slice(0, 3);
              const remainingMembershipCount = Math.max(0, membershipNames.length - visibleMembershipNames.length);
              const membershipBillingLabel = service.price > 0 ? "Monthly" : "Included";

              return (
                <div
                  key={service.id}
                  className={
                    isLessonsSection
                      ? "grid grid-cols-[minmax(0,1.5fr)_96px_84px_84px_40px] items-start gap-2 border-t border-black/10 px-4 py-3 md:grid-cols-[minmax(180px,1.5fr)_130px_120px_140px_48px] md:gap-3 md:py-4 xl:grid-cols-[minmax(0,1.65fr)_170px_120px_120px_250px_72px] xl:gap-3 xl:px-5 xl:py-4"
                      : isMembershipsSection
                        ? "grid grid-cols-[minmax(0,1.2fr)_90px_78px_84px_40px] items-start gap-2 border-t border-black/10 px-4 py-3 md:grid-cols-[minmax(180px,1.45fr)_120px_120px_120px_48px] md:gap-3 md:py-4 xl:grid-cols-[minmax(0,1.65fr)_170px_140px_140px_240px_72px] xl:gap-3 xl:px-5 xl:py-4"
                      : "grid grid-cols-[minmax(0,1.2fr)_86px_88px_40px] items-start gap-2 border-t border-black/10 px-4 py-3 md:grid-cols-[minmax(150px,1.35fr)_120px_minmax(140px,1fr)_48px] md:gap-3 md:py-4 xl:grid-cols-[minmax(0,1.6fr)_170px_220px_72px] xl:gap-3 xl:px-5 xl:py-4"
                  }
                >
                  <button
                    type="button"
                    onClick={() => onEdit(service.id)}
                    className="min-w-0 text-left text-[14px] font-medium leading-5 text-black md:text-[15px] md:leading-5 xl:text-[15px]"
                  >
                    <span className="block break-words">{service.name}</span>
                    {isLessonsSection && compactInstructorNames ? (
                      <span className="mt-1 block text-[12px] font-normal leading-4 text-black/55 xl:hidden">{compactInstructorNames}</span>
                    ) : null}
                    {isMembershipsSection ? (
                      <span className="mt-1 block text-[12px] font-normal leading-4 text-black/55 xl:hidden">
                        {membershipNames.length
                          ? `${membershipNames.length} member${membershipNames.length === 1 ? "" : "s"}`
                          : "No members yet"}
                      </span>
                    ) : null}
                  </button>

                  <div className="min-w-0 pt-1">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-1 text-[11px] font-medium md:px-2.5 md:py-1 md:text-[12px] xl:px-3",
                        visibility === "Everyone" ? "bg-emerald-50 text-emerald-700" : "bg-[#f3f4f6] text-[#667085]",
                      ].join(" ")}
                    >
                      {visibility}
                    </span>
                  </div>

                  {isLessonsSection ? (
                    <>
                      <div className="min-w-0 pt-1 text-[13px] font-medium text-black md:text-[14px] xl:text-[15px]">
                        {formatServicePrice(service.price)}
                      </div>
                      <div className="min-w-0 pt-1 text-[13px] font-medium text-black md:text-[14px] xl:text-[15px]">
                        {formatServiceDuration(service.duration)}
                      </div>
                      <div className="hidden min-w-0 pt-1 xl:block">
                        {instructorNames.length ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {visibleInstructorNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#f1efef] px-2 py-1 text-[11px] font-medium leading-none text-black"
                              >
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#d9d9d9] text-[#777]">
                                  <Icon name="user" className="h-[10px] w-[10px]" />
                                </span>
                                <span className="truncate whitespace-nowrap">{name}</span>
                              </span>
                            ))}
                            {remainingInstructorCount > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-[#f1efef] px-2 py-1 text-[11px] font-medium leading-none text-black/80">
                                +{remainingInstructorCount} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="block break-words text-[13px] text-black/45">No instructors</span>
                        )}
                      </div>
                    </>
                  ) : isMembershipsSection ? (
                    <>
                      <div className="min-w-0 pt-1 text-[13px] font-medium text-black md:text-[14px] xl:text-[15px]">
                        {formatServicePrice(service.price)}
                      </div>
                      <div className="min-w-0 pt-1 text-[13px] font-medium text-black md:text-[14px] xl:text-[15px]">
                        {membershipBillingLabel}
                      </div>
                      <div className="hidden min-w-0 pt-1 xl:block">
                        {membershipNames.length ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {visibleMembershipNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#f1efef] px-2 py-1 text-[11px] font-medium leading-none text-black"
                              >
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#d9d9d9] text-[#777]">
                                  <Icon name="user" className="h-[10px] w-[10px]" />
                                </span>
                                <span className="truncate whitespace-nowrap">{name}</span>
                              </span>
                            ))}
                            {remainingMembershipCount > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-[#f1efef] px-2 py-1 text-[11px] font-medium leading-none text-black/80">
                                +{remainingMembershipCount} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="block break-words text-[13px] text-black/45">No members yet</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="min-w-0 pt-1">
                      <div className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:gap-2">
                        {rooms.length ? (
                          rooms.map((room, roomIndex) => (
                            <span
                              key={room}
                              className={[
                                "rounded-full bg-[#f1efef] px-2 py-1 text-[11px] font-medium text-black md:px-2.5 md:py-1 md:text-[12px]",
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
                          <span className="inline-flex rounded-full bg-[#f1efef] px-2 py-1 text-[11px] font-medium text-black md:px-2.5 md:py-1 md:text-[12px] xl:hidden">
                            +{rooms.length - 2} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onReorder(visibleServiceIds, service.id, "up")}
                      disabled={index === 0}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-black/12 text-black/45 disabled:opacity-40 md:h-9 md:w-9"
                      aria-label="Move service up"
                    >
                      <Icon name="chevron" className="h-4 w-4 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorder(visibleServiceIds, service.id, "down")}
                      disabled={index === filteredServices.length - 1}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-black/12 text-black/45 disabled:opacity-40 md:h-9 md:w-9"
                      aria-label="Move service down"
                    >
                      <Icon name="chevron" className="h-4 w-4 rotate-90" />
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

function MembershipEditorView({
  mode,
  service,
  services,
  membershipMembersByServiceId,
  onCancel,
  onSave,
  onDelete,
  deleteGuardMessage,
}: {
  mode: "add" | "edit";
  service?: Service | null;
  services: Service[];
  membershipMembersByServiceId: Map<string, string[]>;
  onCancel: () => void;
  onSave: (draft: MembershipDraft) => void;
  onDelete: () => void;
  deleteGuardMessage: string | null;
}) {
  const [draft, setDraft] = useState<MembershipDraft>(() => createMembershipDraftFromService(service));
  const eligibleServices = useMemo(
    () =>
      services
        .filter((item) => item.category !== "memberships" && item.category !== "packages")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [services]
  );
  const memberCount = useMemo(() => {
    if (!service) return 0;
    return (membershipMembersByServiceId.get(service.id) ?? []).length;
  }, [membershipMembersByServiceId, service]);

  const update = <Key extends keyof MembershipDraft>(key: Key, value: MembershipDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toggleEligibleService = (serviceId: string) => {
    setDraft((current) => {
      const selected = current.eligibleServiceIds.includes(serviceId);
      return {
        ...current,
        eligibleServiceIds: selected
          ? current.eligibleServiceIds.filter((id) => id !== serviceId)
          : [...current.eligibleServiceIds, serviceId],
      };
    });
  };

  const title = mode === "edit" && service ? service.name : "Add Membership";

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-black md:px-10">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black/70">
          <button type="button" className="hover:underline" onClick={onCancel}>
            Memberships
          </button>
          <span>/</span>
          <span>{mode === "edit" ? service?.name ?? "Membership" : "Add Membership"}</span>
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </div>

      <section className="overflow-hidden rounded-lg border border-black/15 bg-white shadow-sm">
        <div className="border-b border-t-4 border-[#31589b] px-5 py-4">
          <h2 className="text-2xl font-medium">Membership Details</h2>
        </div>

        <div className="grid gap-8 border-b border-black/10 px-5 py-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <h3 className="text-lg font-semibold">Basics</h3>
            <p className="mt-1 text-sm leading-6 text-black/65">
              Set the membership name, description, and booking-page visibility.
            </p>
          </div>
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">
              Name
              <input
                className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span>
                Description{" "}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black/60">
                  Optional
                </span>
              </span>
              <textarea
                className="min-h-28 rounded border border-black/20 px-4 py-3 text-base font-normal outline-none focus:border-black"
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.private}
                onChange={(event) => update("private", event.target.checked)}
              />
              Hide this membership from the public booking page
            </label>
          </div>
        </div>

        <div className="grid gap-8 border-b border-black/10 px-5 py-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <h3 className="text-lg font-semibold">Billing</h3>
            <p className="mt-1 text-sm leading-6 text-black/65">
              Charge customers automatically on a recurring schedule using their saved card.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              Price
              <div className="flex h-12 items-center rounded border border-black/20 px-3 focus-within:border-black">
                <span className="text-black/45">$</span>
                <input
                  className="w-full px-2 text-base font-normal outline-none"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(event) => update("price", event.target.value)}
                />
              </div>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Billing period
              <select
                className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                value={draft.billingPeriod}
                onChange={(event) => update("billingPeriod", event.target.value as MembershipBillingPeriod)}
              >
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Yearly</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span>
                Member limit{" "}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black/60">
                  Optional
                </span>
              </span>
              <input
                className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                inputMode="numeric"
                value={draft.memberLimit}
                onChange={(event) => update("memberLimit", event.target.value)}
                placeholder="No limit"
              />
            </label>
            {mode === "edit" ? (
              <div className="rounded-lg bg-black/[0.03] px-4 py-3 text-sm text-black/65 md:col-span-3">
                <span className="font-semibold text-black">{memberCount}</span> active member
                {memberCount === 1 ? "" : "s"} currently assigned to this membership.
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-8 border-b border-black/10 px-5 py-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <h3 className="text-lg font-semibold">Credits</h3>
            <p className="mt-1 text-sm leading-6 text-black/65">
              Give members booking credits they can spend instead of payment.
            </p>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,180px)_minmax(0,220px)]">
              <label className="grid gap-2 text-sm font-semibold">
                # of credits
                <input
                  className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                  inputMode="numeric"
                  value={draft.creditsPerDay}
                  onChange={(event) => update("creditsPerDay", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Time period
                <select
                  className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                  value={draft.creditLimitPeriod}
                  onChange={(event) =>
                    update("creditLimitPeriod", normalizeMembershipCreditLimitPeriod(event.target.value))
                  }
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </label>
            </div>
            <p className="-mt-2 text-sm text-black/55">
              {Number(draft.creditsPerDay || 0) || 0} credit{Number(draft.creditsPerDay || 0) === 1 ? "" : "s"} can be redeemed per{" "}
              {membershipCreditLimitPeriodLabel(draft.creditLimitPeriod)}.
            </p>
            <div className="grid gap-3 text-sm font-semibold">
              Eligible services
              <div className="flex flex-wrap gap-2">
                {[
                  ["selected_services", "Selected services"],
                  ["all_services", "All services"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded border px-4 py-2 text-sm font-semibold ${
                      draft.creditScope === value
                        ? "border-black bg-black text-white"
                        : "border-black/15 bg-white text-black"
                    }`}
                    onClick={() => update("creditScope", value as MembershipCreditScope)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {draft.creditScope === "selected_services" ? (
              <div className="grid gap-2 rounded-lg border border-black/10 p-3">
                {eligibleServices.length ? (
                  eligibleServices.map((eligibleService) => (
                    <label
                      key={eligibleService.id}
                      className="flex items-center justify-between gap-4 rounded-md px-3 py-2 hover:bg-black/[0.03]"
                    >
                      <span>
                        <span className="block text-sm font-semibold">{eligibleService.name}</span>
                        <span className="text-xs font-normal text-black/55">
                          {getServiceSectionLabel(eligibleService.category)} / {eligibleService.duration} mins / $
                          {eligibleService.price}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={draft.eligibleServiceIds.includes(eligibleService.id)}
                        onChange={() => toggleEligibleService(eligibleService.id)}
                      />
                    </label>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-black/50">No bookable services have been created yet.</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-8 px-5 py-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <h3 className="text-lg font-semibold">Stripe</h3>
            <p className="mt-1 text-sm leading-6 text-black/65">
              Optional Stripe IDs used when subscription auto-charge is connected.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              <span>
                Stripe product ID{" "}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black/60">
                  Optional
                </span>
              </span>
              <input
                className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                value={draft.stripeProductId}
                onChange={(event) => update("stripeProductId", event.target.value)}
                placeholder="prod_..."
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span>
                Stripe price ID{" "}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black/60">
                  Optional
                </span>
              </span>
              <input
                className="h-12 rounded border border-black/20 px-4 text-base font-normal outline-none focus:border-black"
                value={draft.stripePriceId}
                onChange={(event) => update("stripePriceId", event.target.value)}
                placeholder="price_..."
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black/10 bg-black/[0.03] px-5 py-4">
          {mode === "edit" ? (
            <button
              type="button"
              className="rounded border border-black/15 px-4 py-2 text-sm font-semibold text-black/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={Boolean(deleteGuardMessage)}
              title={deleteGuardMessage ?? undefined}
              onClick={onDelete}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button type="button" className="rounded border border-black/15 px-4 py-2 text-sm font-semibold" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="rounded bg-black px-5 py-2 text-sm font-semibold text-white shadow" onClick={() => onSave(draft)}>
              Save
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RentalEditorView({
  mode,
  facilityName,
  resources,
  schedules,
  staff,
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
  schedules: ScheduleRecord[];
  staff: StaffMember[];
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
  const scheduleOptions = useMemo(
    () =>
      schedules.map((schedule) => ({
        label: schedule.name,
        value: schedule.id,
      })),
    [schedules]
  );
  const fallbackScheduleId = scheduleOptions[0]?.value ?? "schedule-working-hours";
  const [draft, setDraft] = useState<RentalDraft>(() =>
    service ? createRentalDraftFromService(service, fallbackScheduleId) : createRentalDraft(resources, fallbackScheduleId)
  );
  const [activePriceTab, setActivePriceTab] = useState<"default" | "membership">("default");
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const calendarColorInputRef = useRef<HTMLInputElement | null>(null);
  const isEditMode = mode === "edit";
  const sectionLabel = getServiceSectionLabel(activeSection);
  const singularLabel = getServiceSectionSingular(activeSection);
  const serviceName = service?.name || draft.name.trim() || singularLabel;
  const serviceBasePath = getServiceSectionBasePath(activeSection);
  const instructorOptions = useMemo(
    () =>
      staff
        .filter((member) => member.active)
        .map((member) => member.name.trim())
        .filter(Boolean)
        .filter((name, index, all) => all.indexOf(name) === index)
        .sort((left, right) => left.localeCompare(right)),
    [staff]
  );

  const priceRows = activePriceTab === "default" ? draft.defaultPricing : draft.membershipPricing;
  const canSave = Boolean(draft.name.trim());

  useEffect(() => {
    setDraft(service ? createRentalDraftFromService(service, fallbackScheduleId) : createRentalDraft(resources, fallbackScheduleId));
  }, [fallbackScheduleId, resources, service]);

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

  function toggleInstructor(name: string) {
    patch({
      instructors: draft.instructors.includes(name)
        ? draft.instructors.filter((item) => item !== name)
        : [...draft.instructors, name],
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
        <Link href={serviceBasePath} className="font-medium text-black/75 hover:text-black">
          {sectionLabel}
        </Link>
        <span>/</span>
        <span className="font-medium text-black">{isEditMode ? serviceName : `Add ${singularLabel}`}</span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-medium leading-8 text-black md:text-[26px]">
            {isEditMode ? serviceName : `Add ${singularLabel}`}
          </h1>
        </div>
        <div className="relative shrink-0">
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={() => setShowActions((current) => !current)}
                className="grid h-12 w-12 place-items-center rounded-xl bg-[#efeff5] text-black/75"
                aria-label={`${singularLabel} actions`}
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
                    {`Duplicate ${singularLabel.toLowerCase()}`}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-black/12 bg-white">
        <div className="border-t-4 border-t-[#446fbb] px-4 py-4 text-[20px] font-medium text-black">
          {singularLabel} Details
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

          {activeSection === "lessons" ? (
            <RentalSettingRow
              title="Instructors"
              description="Choose which staff members can be booked for this lesson"
            >
              <div>
                <div className="mb-2 text-[14px] font-medium text-black/85">Available Instructors</div>
                {instructorOptions.length ? (
                  <div className="grid gap-3 text-[14px]">
                    {instructorOptions.map((instructorName) => (
                      <label key={instructorName} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={draft.instructors.includes(instructorName)}
                          onChange={() => toggleInstructor(instructorName)}
                          className="h-5 w-5 rounded border-black/20"
                        />
                        <span>{instructorName}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-black/55">No active staff members available yet.</p>
                )}
              </div>
            </RentalSettingRow>
          ) : null}

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
                  title="Card Service Fee"
                  description="Apply the configured service fee when this service is paid by credit card."
                >
                  <InlineToggleChoice checked={draft.collectFee} onChange={(checked) => patch({ collectFee: checked })} label="Charge card service fee" />
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
                  <div className="grid gap-4">
                    <div className="flex items-center gap-4">
                      <ToggleSwitch
                        checked={draft.serviceScheduleEnabled}
                        onChange={(checked) =>
                          patch({
                            serviceScheduleEnabled: checked,
                            scheduleId: checked ? draft.scheduleId || fallbackScheduleId : draft.scheduleId,
                          })
                        }
                        label="Set service schedule"
                      />
                      <span className="text-[15px] text-black/85">Set service schedule</span>
                    </div>
                    <div className="mt-2 text-[14px] text-black/65">Enable this to only allow this service to be booked on certain days or times.</div>
                    {draft.serviceScheduleEnabled ? (
                      scheduleOptions.length ? (
                        <div className="max-w-[360px]">
                          <label className="grid gap-2">
                            <span className="text-[14px] font-medium text-black/85">Schedule</span>
                            <select
                              value={draft.scheduleId}
                              onChange={(event) => patch({ scheduleId: event.target.value })}
                              className="min-h-[42px] rounded-[6px] border border-black/12 bg-white px-3 text-[14px] outline-none"
                            >
                              {scheduleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : (
                        <div className="text-[14px] text-black/55">Add a schedule under Settings &gt; Schedules first.</div>
                      )
                    ) : null}
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
  const toolbar = ["\u21b6", "\u21b7", "Normal", "B", "I", "U", "S", "<>", "\u21d7", "\u2261", "\u2630", "\u2637"];

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
  schedules,
  customersById,
  resources,
  servicesById,
  onDateChange,
  onNew,
  onEdit,
  onMoveBooking,
  showToast,
}: {
  activeDate: string;
  bookings: Booking[];
  availability: AppState["availability"];
  schedules: ScheduleRecord[];
  customersById: Map<string, Customer>;
  resources: string[];
  servicesById: Map<string, Service>;
  onDateChange: (date: string) => void;
  onNew: (seed?: Partial<Booking>) => void;
  onEdit: (id: string) => void;
  onMoveBooking: (bookingId: string, patch: Pick<Booking, "date" | "resource" | "start" | "end">) => Promise<boolean>;
  showToast: (message: string) => void;
}) {
  const allMobileResourcesValue = "__all__";
  const [resourceMode, setResourceMode] = useState<"rooms" | "staff" | "equipment">("rooms");
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("day");
  const [mobileResource, setMobileResource] = useState<string>(allMobileResourcesValue);
  const [dragBookingId, setDragBookingId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [slotSelection, setSlotSelection] = useState<{
    resource: string;
    anchorStart: number;
    anchorEnd: number;
    start: number;
    end: number;
    hasDragged: boolean;
  } | null>(null);
  const dragClickGuardRef = useRef(false);
  const slotSelectionClickGuardRef = useRef(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const mobileDayScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopDayScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDayTimeTargetRef = useRef<HTMLDivElement | null>(null);
  const desktopDayTimeTargetRef = useRef<HTMLDivElement | null>(null);
  const dayName = weekdayName(activeDate);
  const scheduleCollection = schedules.length ? schedules : defaultState.schedules;
  const defaultSchedule =
    scheduleCollection.find((schedule) => schedule.isDefault || schedule.slug === "working-hours") ??
    scheduleCollection[0] ??
    null;
  const scheduleByResource = useMemo(
    () =>
      new Map(
        resources.map((resource) => [resource, scheduleForRoom(scheduleCollection, resource) ?? defaultSchedule] as const)
      ),
    [defaultSchedule, resources, scheduleCollection]
  );
  const selectedScheduleForMobile =
    mobileResource !== allMobileResourcesValue
      ? scheduleByResource.get(mobileResource) ?? defaultSchedule
      : defaultSchedule;
  const { isOpen, openStart, openEnd } = scheduleRangeForDate(selectedScheduleForMobile, activeDate);
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
  const closedBlocks = useMemo(
    () => closedBlocksForSchedule(selectedScheduleForMobile, activeDate),
    [activeDate, selectedScheduleForMobile]
  );
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
        const schedule = scheduleByResource.get(resource) ?? defaultSchedule;
        const timeline = buildMobileCalendarTimeline(resourceBookings, schedule, activeDate);
        const availableBlocks = timeline.filter((segment) => segment.type === "available");
        return {
          resource,
          schedule,
          bookings: resourceBookings,
          timeline,
          availableBlocks,
        };
      }),
    [activeDate, defaultSchedule, resources, scheduleByResource, visibleDayBookings]
  );
  const mobileVisibleDayResourceViews = useMemo(
    () =>
      mobileResource === allMobileResourcesValue
        ? mobileDayResourceViews
        : mobileDayResourceViews.filter((item) => item.resource === mobileResource),
    [mobileDayResourceViews, mobileResource]
  );
  const dayResourceViewByName = useMemo(
    () => new Map(mobileDayResourceViews.map((item) => [item.resource, item] as const)),
    [mobileDayResourceViews]
  );
  const scrollTargetTime = useMemo(
    () => {
      const targets = resources
        .map((resource) => scheduleScrollTargetTime(scheduleByResource.get(resource) ?? defaultSchedule, activeDate))
        .map(timeToMinutes);

      if (!targets.length) {
        return calendarScrollTargetTime(availability, activeDate);
      }

      return minutesToTime(Math.min(...targets));
    },
    [activeDate, availability, defaultSchedule, resources, scheduleByResource]
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

    const targetIndex = slots.findIndex((slot) => slot === scrollTargetTime);
    if (targetIndex < 0) return;

    const syncScroll = () => {
      if (mobileDayScrollRef.current) {
        const container = mobileDayScrollRef.current;
        container.scrollTop = targetIndex * mobileSlotHeight;
      }

      if (desktopDayScrollRef.current) {
        const container = desktopDayScrollRef.current;
        container.scrollTop = targetIndex * slotHeight;
      }
    };

    const frame = window.requestAnimationFrame(syncScroll);
    const timer = window.setTimeout(syncScroll, 60);

      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
  }, [calendarMode, mobileSlotHeight, resourceMode, scrollTargetTime, slotHeight, slots]);

  useEffect(() => {
    if (!slotSelection) return;

    const cancelSlotSelection = () => {
      setSlotSelection(null);
      window.setTimeout(() => {
        slotSelectionClickGuardRef.current = false;
      }, 200);
    };

    window.addEventListener("pointerup", cancelSlotSelection);
    window.addEventListener("pointercancel", cancelSlotSelection);
    return () => {
      window.removeEventListener("pointerup", cancelSlotSelection);
      window.removeEventListener("pointercancel", cancelSlotSelection);
    };
  }, [slotSelection]);

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
      durationMinutes,
      {
        date: activeDate,
        start: minutesToTime(startMinutes),
        end: minutesToTime(endMinutes),
        schedules: scheduleCollection,
      }
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

  function slotStartFromClientY(
    element: HTMLElement,
    clientY: number,
    segmentStart: number,
    segmentEnd: number
  ) {
    const rect = element.getBoundingClientRect();
    const offsetY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const minutesInSegment = Math.max(30, segmentEnd - segmentStart);
    const clickedMinutes = segmentStart + (offsetY / Math.max(1, rect.height)) * minutesInSegment;
    const snapped = Math.floor(clickedMinutes / 30) * 30;
    return Math.max(segmentStart, Math.min(Math.max(segmentStart, segmentEnd - 30), snapped));
  }

  function slotBoundaryFromClientY(
    element: HTMLElement,
    clientY: number,
    segmentStart: number,
    segmentEnd: number
  ) {
    const rect = element.getBoundingClientRect();
    const offsetY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const minutesInSegment = Math.max(30, segmentEnd - segmentStart);
    const pointedMinutes = segmentStart + (offsetY / Math.max(1, rect.height)) * minutesInSegment;
    const snapped = Math.round(pointedMinutes / 30) * 30;
    return Math.max(segmentStart, Math.min(segmentEnd, snapped));
  }

  function slotStartFromClick(
    event: React.MouseEvent<HTMLElement>,
    segmentStart: number,
    segmentEnd: number
  ) {
    return slotStartFromClientY(event.currentTarget, event.clientY, segmentStart, segmentEnd);
  }

  function calendarDropSlotKey(resource: string, startMinutes: number) {
    return `${activeDate}-${resource}-${startMinutes}`;
  }

  function slotSelectionRange(
    selection: NonNullable<typeof slotSelection>,
    boundaryMinutes: number
  ) {
    if (boundaryMinutes <= selection.anchorStart) {
      return {
        start: Math.max(0, boundaryMinutes),
        end: selection.anchorEnd,
      };
    }

    return {
      start: selection.anchorStart,
      end: Math.max(selection.anchorEnd, boundaryMinutes),
    };
  }

  function startSlotSelection(
    event: React.PointerEvent<HTMLElement>,
    resource: string,
    segmentStart: number,
    segmentEnd: number
  ) {
    if (event.button !== 0 || dragBookingId) return;

    const startMinutes = slotStartFromClientY(event.currentTarget, event.clientY, segmentStart, segmentEnd);
    setSlotSelection({
      resource,
      anchorStart: startMinutes,
      anchorEnd: Math.min(1439, startMinutes + 30),
      start: startMinutes,
      end: Math.min(1439, startMinutes + 30),
      hasDragged: false,
    });
  }

  function updateSlotSelection(
    event: React.PointerEvent<HTMLElement>,
    resource: string,
    segmentStart: number,
    segmentEnd: number
  ) {
    if (!slotSelection || slotSelection.resource !== resource || dragBookingId) return;

    const boundaryMinutes = slotBoundaryFromClientY(event.currentTarget, event.clientY, segmentStart, segmentEnd);
    const range = slotSelectionRange(slotSelection, boundaryMinutes);
    setSlotSelection({
      ...slotSelection,
      ...range,
      hasDragged:
        slotSelection.hasDragged ||
        range.start !== slotSelection.anchorStart ||
        range.end !== slotSelection.anchorEnd,
    });
  }

  function finishSlotSelection(
    event: React.PointerEvent<HTMLElement>,
    resource: string,
    segmentStart: number,
    segmentEnd: number
  ) {
    if (!slotSelection || slotSelection.resource !== resource || dragBookingId) return;

    event.preventDefault();
    event.stopPropagation();
    slotSelectionClickGuardRef.current = true;

    const boundaryMinutes = slotBoundaryFromClientY(event.currentTarget, event.clientY, segmentStart, segmentEnd);
    const range = slotSelectionRange(slotSelection, boundaryMinutes);
    setSlotSelection(null);
    createBookingFromSlot(resource, range.start, range.end);

    window.setTimeout(() => {
      slotSelectionClickGuardRef.current = false;
    }, 200);
  }

  function isSlotSelectionTarget(resource: string, segmentStart: number, segmentEnd: number) {
    return Boolean(
      slotSelection &&
        slotSelection.resource === resource &&
        segmentEnd > slotSelection.start &&
        segmentStart < slotSelection.end
    );
  }

  function startBookingDrag(event: React.DragEvent<HTMLElement>, booking: Booking) {
    dragClickGuardRef.current = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", booking.id);
    event.dataTransfer.setData("application/x-booking-id", booking.id);
    setDragBookingId(booking.id);
  }

  function endBookingDrag() {
    setDragBookingId(null);
    setDragOverSlotKey(null);
    window.setTimeout(() => {
      dragClickGuardRef.current = false;
    }, 200);
  }

  function handleBookingCardClick(booking: Booking) {
    if (dragClickGuardRef.current) return;
    onEdit(booking.id);
  }

  function handleSlotDragOver(
    event: React.DragEvent<HTMLElement>,
    resource: string,
    segmentStart: number
  ) {
    if (!dragBookingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverSlotKey(calendarDropSlotKey(resource, segmentStart));
  }

  function handleSlotDragLeave(resource: string, segmentStart: number) {
    const slotKey = calendarDropSlotKey(resource, segmentStart);
    setDragOverSlotKey((current) => (current === slotKey ? null : current));
  }

  async function handleSlotDrop(
    event: React.DragEvent<HTMLElement>,
    resource: string,
    segmentStart: number,
    segmentEnd: number
  ) {
    const bookingId =
      event.dataTransfer.getData("application/x-booking-id") ||
      event.dataTransfer.getData("text/plain") ||
      dragBookingId;

    if (!bookingId) return;

    event.preventDefault();
    event.stopPropagation();

    const booking = activeCalendarBookings.find((item) => item.id === bookingId);
    if (!booking) {
      showToast("Could not find the dragged booking.");
      endBookingDrag();
      return;
    }

    const startMinutes = slotStartFromClientY(event.currentTarget, event.clientY, segmentStart, segmentEnd);
    const durationMinutes = bookingDurationMinutes(booking);
    const endMinutes = Math.min(1439, startMinutes + durationMinutes);

    if (booking.date === activeDate && booking.resource === resource && booking.start === minutesToTime(startMinutes)) {
      endBookingDrag();
      return;
    }

    const confirmed = window.confirm(
      `Move ${booking.playerName || booking.serviceName || "this booking"} to ${resource} from ${timeLabel(
        minutesToTime(startMinutes)
      )} to ${timeLabel(minutesToTime(endMinutes))}?`
    );

    if (!confirmed) {
      endBookingDrag();
      return;
    }

    await onMoveBooking(booking.id, {
      date: activeDate,
      resource,
      start: minutesToTime(startMinutes),
      end: minutesToTime(endMinutes),
    });

    endBookingDrag();
  }

  async function handleOpenSlotClick(
    event: React.MouseEvent<HTMLElement>,
    resource: string,
    segmentStart: number,
    segmentEnd: number
  ) {
    if (dragBookingId || dragClickGuardRef.current || slotSelectionClickGuardRef.current) return;

    const startMinutes = slotStartFromClick(event, segmentStart, segmentEnd);
    createBookingFromSlot(resource, startMinutes, startMinutes + 30);
  }

  return (
    <section className="min-h-screen px-6 py-8 lg:px-7">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <CalendarToolbarButton label="Today" onClick={() => onDateChange(isoDate(new Date()))} />
          <CalendarToolbarButton label="Back" onClick={() => onDateChange(shiftDate(activeDate, calendarMode === "week" ? -7 : -1))} />
          <CalendarToolbarButton label="Next" onClick={() => onDateChange(shiftDate(activeDate, calendarMode === "week" ? 7 : 1))} />
        </div>

        <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className="inline-flex min-h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-lg border border-black/15 bg-[#f3f3f3] px-4 text-[16px] font-semibold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          >
            <span>{formatCalendarHeading(activeDate)}</span>
            <Icon name="chevron" className="h-4 w-4 rotate-90 text-black/60" />
          </button>

          <div className="hidden items-center gap-2 lg:flex">
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

          <div className="hidden items-center gap-2 lg:flex">
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
            className="hidden lg:inline-flex"
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 lg:hidden">
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
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
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
            <div className="space-y-3 lg:hidden">
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
                <div
                  ref={mobileDayScrollRef}
                  className="overflow-auto"
                  style={{ maxHeight: "calc(100vh - 360px)" }}
                >
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
                          ref={slot === scrollTargetTime ? mobileDayTimeTargetRef : undefined}
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
                            const slotKey = calendarDropSlotKey(resource, segment.start);
                            const isDragTarget = dragOverSlotKey === slotKey;
                            const isSelectionTarget = isSlotSelectionTarget(resource, segment.start, segment.end);

                            return (
                              <button
                                key={`${resource}-mobile-open-block-${index}`}
                                type="button"
                                onClick={(event) => void handleOpenSlotClick(event, resource, segment.start, segment.end)}
                                onPointerDown={(event) => startSlotSelection(event, resource, segment.start, segment.end)}
                                onPointerMove={(event) => updateSlotSelection(event, resource, segment.start, segment.end)}
                                onPointerEnter={(event) => updateSlotSelection(event, resource, segment.start, segment.end)}
                                onPointerUp={(event) => finishSlotSelection(event, resource, segment.start, segment.end)}
                                onDragOver={(event) => handleSlotDragOver(event, resource, segment.start)}
                                onDragLeave={() => handleSlotDragLeave(resource, segment.start)}
                                onDrop={(event) => void handleSlotDrop(event, resource, segment.start, segment.end)}
                                className={`absolute left-[2px] right-[2px] overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm transition select-none ${
                                  isDragTarget || isSelectionTarget
                                    ? "border-black bg-[#d7f4e5] text-black ring-2 ring-black/30"
                                    : "border-[#caefdd] bg-[#f3fcf7] text-[#166443]"
                                } ${dragBookingId ? "cursor-copy" : ""}`}
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
                          const paymentIndicator = bookingPaymentIndicator(booking);
                          const durationMinutes = Math.max(30, segment.end - segment.start);
                          const isCompactBooking = durationMinutes <= 30;
                          const isUnavailableBlock = isUnavailableBooking(booking);
                          const isDraggingBooking = dragBookingId === booking.id;
                          const bookingCustomerName =
                            isUnavailableBlock ? "Unavailable" : booking.playerName || customer?.player || customer?.name || "Customer";
                          const bookingServiceName = isUnavailableBlock
                            ? booking.resource
                            : service?.name || booking.serviceName || "Service";

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              draggable
                              onDragStart={(event) => startBookingDrag(event, booking)}
                              onDragEnd={endBookingDrag}
                              onClick={() => handleBookingCardClick(booking)}
                              className={`absolute left-[2px] right-[2px] overflow-hidden rounded-md border text-left shadow-sm ${tone.borderClass} ${tone.containerClass} ${
                                isCompactBooking ? "px-2 py-1" : "px-2 py-1.5"
                              } ${isDraggingBooking ? "cursor-grabbing opacity-60 ring-2 ring-black ring-offset-2" : "cursor-grab"}`}
                              style={{ top, height, ...tone.style }}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <span
                                    className={`block ${isCompactBooking ? "text-[8px]" : "text-[9px]"} ${tone.timeClass} font-semibold leading-none`}
                                  >
                                    {timeLabel(minutesToTime(segment.start))} - {timeLabel(minutesToTime(segment.end))}
                                  </span>
                                  {isCompactBooking ? (
                                    <div className="truncate text-[11px] font-semibold leading-none">
                                      {bookingCustomerName}
                                    </div>
                                  ) : null}
                                </div>
                                {paymentIndicator ? (
                                  <span
                                    title={paymentIndicator.label}
                                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${paymentIndicator.className}`}
                                  >
                                    <Icon name={paymentIndicator.icon} className="h-2.5 w-2.5" />
                                  </span>
                                ) : null}
                              </div>
                              {!isCompactBooking ? (
                                <div className="mt-1 truncate text-[12px] font-semibold leading-[1.05]">
                                  {bookingCustomerName}
                                </div>
                              ) : null}
                              {isCompactBooking && isUnavailableBlock ? null : (
                                <div
                                  className={`line-clamp-2 font-medium leading-[1.05] ${tone.subClass} ${
                                    isCompactBooking ? "mt-0.5 text-[9px]" : "mt-0.5 text-[10px]"
                                  }`}
                                >
                                  {bookingServiceName}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm lg:block">
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

            <div
              ref={desktopDayScrollRef}
              className="overflow-auto"
              style={{ maxHeight: "calc(100vh - 270px)" }}
            >
              <div
                className="grid min-w-[980px]"
                style={{ gridTemplateColumns: `96px repeat(${resources.length}, minmax(220px, 1fr))` }}
              >
                <div className="relative border-r border-black/10 bg-white">
                  {slots.map((slot, index) => (
                      <div
                        key={slot}
                        ref={slot === scrollTargetTime ? desktopDayTimeTargetRef : undefined}
                        className="flex items-start justify-end border-b border-black/10 px-4 text-right text-[15px] font-medium text-black/90"
                        style={{ height: slotHeight }}
                      >
                        <div className={`w-full ${index === 0 ? "pt-1" : "pt-0.5"}`}>{timeLabel(slot)}</div>
                      </div>
                  ))}
                </div>

                {resources.map((resource) => {
                  const resourceDayView = dayResourceViewByName.get(resource);
                  const resourceTimeline = resourceDayView?.timeline ?? [];

                  return (
                    <div key={resource} className="relative border-r border-black/10 bg-[#eaf6ff] last:border-r-0" style={{ height: columnHeight }}>
                      {slots.map((slot) => (
                        <div key={`${resource}-${slot}`} className="border-b border-black/10" style={{ height: slotHeight }} />
                      ))}

                      {resourceTimeline.map((segment, index) => {
                        const top = (segment.start / 30) * slotHeight + 1;
                        const height = Math.max(slotHeight - 2, ((segment.end - segment.start) / 30) * slotHeight - 2);

                        if (segment.type === "closed") {
                          return (
                            <div
                              key={`${resource}-closed-${index}`}
                              className="absolute left-[5px] right-[5px] overflow-hidden rounded-md border border-[#6f86a0] bg-[#8a8f98] text-white"
                              style={{ top, height }}
                            >
                              <div className="px-3 py-2 text-left">
                                <div className="text-[10px] font-semibold leading-none text-white/80">
                                  {timeLabel(minutesToTime(segment.start))} - {timeLabel(minutesToTime(segment.end))}
                                </div>
                                <div className="mt-1 text-[16px] font-semibold leading-none">Closed</div>
                              </div>
                            </div>
                          );
                        }

                        if (segment.type === "available") {
                          const slotKey = calendarDropSlotKey(resource, segment.start);
                          const isDragTarget = dragOverSlotKey === slotKey;
                          const isSelectionTarget = isSlotSelectionTarget(resource, segment.start, segment.end);

                          return (
                            <button
                              key={`${resource}-available-${index}`}
                              type="button"
                              onClick={(event) => void handleOpenSlotClick(event, resource, segment.start, segment.end)}
                              onPointerDown={(event) => startSlotSelection(event, resource, segment.start, segment.end)}
                              onPointerMove={(event) => updateSlotSelection(event, resource, segment.start, segment.end)}
                              onPointerEnter={(event) => updateSlotSelection(event, resource, segment.start, segment.end)}
                              onPointerUp={(event) => finishSlotSelection(event, resource, segment.start, segment.end)}
                              onDragOver={(event) => handleSlotDragOver(event, resource, segment.start)}
                              onDragLeave={() => handleSlotDragLeave(resource, segment.start)}
                              onDrop={(event) => void handleSlotDrop(event, resource, segment.start, segment.end)}
                              aria-label={`Book ${resource} from ${timeLabel(minutesToTime(segment.start))} to ${timeLabel(minutesToTime(segment.end))}`}
                              className={`absolute left-0 right-0 overflow-hidden border text-left transition select-none ${
                                isDragTarget || isSelectionTarget
                                  ? "border-black/30 bg-[#c8e9ff] ring-2 ring-black/25"
                                  : "border-transparent bg-transparent hover:bg-[#d9efff]/70"
                              } ${
                                dragBookingId ? "cursor-copy" : ""
                              }`}
                              style={{ top, height }}
                            >
                              <span className="sr-only">
                                Available {timeLabel(minutesToTime(segment.start))} - {timeLabel(minutesToTime(segment.end))}
                              </span>
                            </button>
                          );
                        }

                        const booking = segment.booking;
                        const customer = customersById.get(booking.customerId);
                        const service = servicesById.get(booking.serviceId);
                        const statusBadge = bookingStatusBadge(booking);
                        const tone = bookingTonePresentation(booking, service);
                        const paymentIndicator = bookingPaymentIndicator(booking);
                        const durationMinutes = Math.max(30, segment.end - segment.start);
                        const isCompactBooking = durationMinutes <= 30;
                        const isUnavailableBlock = isUnavailableBooking(booking);
                        const isDraggingBooking = dragBookingId === booking.id;
                        const bookingTitle = isUnavailableBlock
                          ? "Unavailable"
                          : booking.playerName || customer?.player || customer?.name || "Customer";
                        const bookingSubtitle = isUnavailableBlock
                          ? booking.resource
                          : service?.name || booking.serviceName || "Service";

                        return (
                          <button
                            key={booking.id}
                            type="button"
                            draggable
                            onDragStart={(event) => startBookingDrag(event, booking)}
                            onDragEnd={endBookingDrag}
                            onClick={() => handleBookingCardClick(booking)}
                            className={`absolute left-[1px] right-[1px] overflow-hidden rounded-[4px] border text-left shadow-sm ${tone.borderClass} ${tone.containerClass} ${
                              isCompactBooking ? "px-2 py-1" : "px-2.5 py-1.5"
                            } ${isDraggingBooking ? "cursor-grabbing opacity-60 ring-2 ring-black ring-offset-2" : "cursor-grab"}`}
                            style={{ top, height, ...tone.style }}
                          >
                            <div className={isCompactBooking ? "pr-7" : "pr-16"}>
                              <div
                                className={`truncate ${isCompactBooking ? "text-[9px]" : "text-[10px]"} ${tone.timeClass} font-semibold leading-none`}
                              >
                                {timeLabel(minutesToTime(segment.start))} - {timeLabel(minutesToTime(segment.end))}
                              </div>
                            </div>
                            {statusBadge || paymentIndicator ? (
                              <div className="absolute right-1 top-1 flex items-center gap-1">
                              {statusBadge ? (
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${statusBadge.className}`}
                                >
                                  {statusBadge.label}
                                </span>
                              ) : null}
                              {paymentIndicator ? (
                                <span
                                  title={paymentIndicator.label}
                                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${paymentIndicator.className}`}
                                >
                                  <Icon name={paymentIndicator.icon} className="h-3 w-3" />
                                </span>
                              ) : null}
                              </div>
                            ) : null}
                            <div
                              className={`truncate font-semibold leading-none ${
                                isCompactBooking ? "mt-1 text-[13px]" : "mt-1.5 text-[15px]"
                              }`}
                            >
                              {bookingTitle}
                            </div>
                            {isCompactBooking && isUnavailableBlock ? null : (
                              <div
                                className={`truncate font-medium leading-none ${tone.subClass} ${
                                  isCompactBooking ? "mt-0.5 text-[10px]" : "mt-1 text-[11px]"
                                }`}
                              >
                                {bookingSubtitle}
                              </div>
                            )}
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
            <div className="space-y-3 lg:hidden">
              {mobileWeekBookings.map(({ date, items }) => (
                <div key={date} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                  {(() => {
                    const weekSchedule =
                      mobileResource !== allMobileResourcesValue
                        ? scheduleByResource.get(mobileResource) ?? defaultSchedule
                        : defaultSchedule;
                    const weekClosedBlocks = closedBlocksForSchedule(weekSchedule, date);
                    return (
                      <>
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
                    {weekClosedBlocks.map((block, index) => (
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
                        const paymentIndicator = bookingPaymentIndicator(booking);
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
                              {paymentIndicator ? (
                                <span
                                  title={paymentIndicator.label}
                                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${paymentIndicator.className}`}
                                >
                                  <Icon name={paymentIndicator.icon} className="h-3 w-3" />
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[18px] font-semibold leading-tight">
                              {booking.playerName || customer?.player || customer?.name || "Customer"}
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
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div className="hidden rounded-xl border border-black/10 bg-white shadow-sm lg:block">
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
                        const paymentIndicator = bookingPaymentIndicator(booking);
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
                              {paymentIndicator ? (
                                <span
                                  title={paymentIndicator.label}
                                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${paymentIndicator.className}`}
                                >
                                  <Icon name={paymentIndicator.icon} className="h-3 w-3" />
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 truncate text-[14px] font-semibold">
                              {booking.playerName || customer?.player || customer?.name || "Customer"}
                            </div>
                            <div className={`mt-1 text-[12px] ${tone.subClass}`}>
                              {(service?.name || booking.serviceName || "Service")} \u00b7 {booking.resource}
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
        className="fixed bottom-[90px] right-5 z-20 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#1f1a1a] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] lg:bottom-6"
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
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-black/15 bg-white px-4 text-[15px] font-medium text-black shadow-[0_1px_0_rgba(255,255,255,0.9)] hover:bg-black/[0.02] ${className}`.trim()}
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
        "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg border px-4 text-[15px] font-medium shadow-[0_1px_0_rgba(255,255,255,0.9)]",
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
  staff,
  resources,
  entries,
  currentStaffId,
  canManageAny,
  onChange,
  onSave,
  onSaveEntry,
  onDeleteEntry,
}: {
  rows: AppState["availability"];
  staff: StaffMember[];
  resources: string[];
  entries: StaffAvailabilityEntry[];
  currentStaffId: string;
  canManageAny: boolean;
  onChange: (rows: AppState["availability"]) => void;
  onSave: () => void;
  onSaveEntry: (entry: StaffAvailabilityEntry) => Promise<boolean>;
  onDeleteEntry: (entryId: string) => Promise<boolean>;
}) {
  const [activeDate, setActiveDate] = useState(isoDate(new Date()));
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("week");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<StaffAvailabilityEntry | null>(null);
  const [dragSelection, setDragSelection] = useState<{
    date: string;
    start: number;
    current: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const slotHeight = 50;
  const slots = useMemo(() => Array.from({ length: 48 }, (_, index) => minutesToTime(index * 30)), []);
  const visibleDates = useMemo(() => (calendarMode === "week" ? weekDates(activeDate) : [activeDate]), [activeDate, calendarMode]);
  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const manageableStaff = useMemo(() => {
    const activeStaff = staff.filter((member) => member.active);
    if (canManageAny) return activeStaff;
    return activeStaff.filter((member) => member.id === currentStaffId);
  }, [canManageAny, currentStaffId, staff]);
  const visibleEntries = useMemo(
    () => entries.filter((entry) => canManageAny || entry.staffId === currentStaffId),
    [canManageAny, currentStaffId, entries]
  );
  const staffColorById = useMemo(() => {
    const colors = new Map<string, string>();
    staff.forEach((member, index) => {
      colors.set(member.id, normalizeCalendarColor(member.calendarColor ?? staffAvailabilityColor(index)));
    });
    entries.forEach((entry) => {
      colors.set(entry.staffId, normalizeCalendarColor(entry.color));
    });
    return colors;
  }, [entries, staff]);
  const today = isoDate(new Date());
  const scrollStartMinutes = useMemo(() => {
    const openStarts = rows.filter(([, open]) => open).map(([, , start]) => timeToMinutes(start));
    if (!openStarts.length) return 15 * 60;
    return Math.max(0, Math.min(...openStarts) - 60);
  }, [rows]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = (scrollStartMinutes / 30) * slotHeight;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollStartMinutes, slotHeight]);

  function update(index: number, next: [string, boolean, string, string]) {
    onChange(rows.map((row, i) => (i === index ? next : row)));
  }

  function formatAvailabilityWeekHeading() {
    const dates = weekDates(activeDate);
    const first = parseLocalDate(dates[0]);
    const last = parseLocalDate(dates[dates.length - 1]);
    const firstLabel = first.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const lastLabel = last.toLocaleDateString("en-US", { day: "numeric" });
    return `${firstLabel} - ${lastLabel}`;
  }

  function shiftAvailabilityDate(days: number) {
    setActiveDate((current) => shiftDate(current, days));
  }

  function minutesFromColumnEvent(event: React.MouseEvent<HTMLDivElement>, snap: "floor" | "round" | "ceil" = "round") {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const rawMinutes = (offset / slotHeight) * 30;
    const snapper = snap === "floor" ? Math.floor : snap === "ceil" ? Math.ceil : Math.round;
    return Math.max(0, Math.min(23 * 60 + 59, snapper(rawMinutes / 15) * 15));
  }

  function createAvailabilityDraft(date: string, startMinutes: number, existing?: StaffAvailabilityEntry, endMinutes?: number) {
    const staffMember = existing ? staffById.get(existing.staffId) : manageableStaff[0];
    const fallbackStaff = staffMember ?? manageableStaff[0];
    if (!fallbackStaff) return null;

    const start = Math.max(0, Math.min(23 * 60 + 45, Math.floor(startMinutes / 15) * 15));
    const end = Math.min(23 * 60 + 59, endMinutes !== undefined ? Math.ceil(endMinutes / 15) * 15 : start + 60);

    return {
      id: existing?.id ?? makeId("availability"),
      staffId: existing?.staffId ?? fallbackStaff.id,
      staffName: existing?.staffName ?? fallbackStaff.name,
      date: existing?.date ?? date,
      start: existing?.start ?? minutesToTime(start),
      end: existing?.end ?? minutesToTime(end),
      resources: existing?.resources ?? resources.slice(0, Math.min(2, resources.length)),
      color: existing?.color ?? staffColorById.get(fallbackStaff.id) ?? fallbackStaff.calendarColor ?? staffAvailabilityColor(entries.length),
      recurring: existing?.recurring ?? false,
      recurrenceId: existing?.recurrenceId,
      recurrenceFrequency: existing?.recurrenceFrequency,
      recurrenceEndDate: existing?.recurrenceEndDate ?? defaultStaffAvailabilityRecurrenceEndDate(date),
    };
  }

  function beginAvailabilityDrag(date: string, event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || !manageableStaff.length) return;
    const start = minutesFromColumnEvent(event, "floor");
    setDragSelection({ date, start, current: start + 15 });
  }

  function updateAvailabilityDrag(date: string, event: React.MouseEvent<HTMLDivElement>) {
    if (!dragSelection || dragSelection.date !== date) return;
    const current = minutesFromColumnEvent(event, "ceil");
    setDragSelection((selection) => (selection && selection.date === date ? { ...selection, current } : selection));
  }

  function finishAvailabilityDrag(date: string, event: React.MouseEvent<HTMLDivElement>) {
    if (!manageableStaff.length) return;
    if (!dragSelection || dragSelection.date !== date) {
      const start = minutesFromColumnEvent(event, "floor");
      const nextDraft = createAvailabilityDraft(date, start);
      if (nextDraft) setDraft(nextDraft);
      return;
    }

    const finalCurrent = minutesFromColumnEvent(event, "ceil");
    const start = Math.min(dragSelection.start, finalCurrent);
    const end = Math.max(dragSelection.start, finalCurrent);
    const duration = end - start;
    const nextDraft = createAvailabilityDraft(date, start, undefined, duration >= 15 ? end : start + 60);
    setDragSelection(null);
    if (nextDraft) setDraft(nextDraft);
  }

  function editAvailabilityDraft(entry: StaffAvailabilityEntry) {
    if (!canManageAny && entry.staffId !== currentStaffId) return;
    const nextDraft = createAvailabilityDraft(entry.date, timeToMinutes(entry.start), entry);
    if (nextDraft) setDraft(nextDraft);
  }

  async function saveDraft() {
    if (!draft) return;
    const staffMember = staffById.get(draft.staffId);
    if (!staffMember || timeToMinutes(draft.end) <= timeToMinutes(draft.start)) return;

    const saved = await onSaveEntry({
      ...draft,
      staffName: staffMember.name,
      resources: draft.resources.filter(Boolean),
    });

    if (saved) setDraft(null);
  }

  async function deleteDraft() {
    if (!draft) return;
    const deleted = await onDeleteEntry(draft.id);
    if (deleted) setDraft(null);
  }

  function renderAvailabilityBlocks(date: string) {
    const closedBlocks = closedBlocksForDate(rows, date);
    const dayEntries = visibleEntries.filter((entry) => entry.date === date);

    return (
      <>
        {closedBlocks.map((block, index) => {
          const top = (block.start / 30) * slotHeight + 1;
          const height = Math.max(slotHeight - 2, ((block.end - block.start) / 30) * slotHeight - 2);
          return (
            <div
              key={`${date}-closed-${index}`}
              className="absolute left-[4px] right-[4px] overflow-hidden rounded-[4px] border border-[#7f8d99] bg-[#969696]/95 px-2 py-1 text-white"
              style={{ top, height }}
            >
              {height >= 48 ? (
                <>
                  <div className="text-[10px] font-semibold leading-none text-white/80">
                    {timeLabel(minutesToTime(block.start))} - {timeLabel(minutesToTime(block.end))}
                  </div>
                  <div className="mt-1 text-[16px] font-semibold leading-none">Closed</div>
                </>
              ) : null}
            </div>
          );
        })}

        {dayEntries.map((entry) => {
          const top = (timeToMinutes(entry.start) / 30) * slotHeight + 1;
          const height = Math.max(30, ((timeToMinutes(entry.end) - timeToMinutes(entry.start)) / 30) * slotHeight - 2);
          const initials = entry.staffName
            .split(" ")
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2);

          return (
            <button
              key={entry.id}
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                editAvailabilityDraft(entry);
              }}
              className="absolute left-[5px] right-[5px] block appearance-none overflow-hidden rounded-[4px] border border-black/20 text-left text-white shadow-sm"
              style={{ top, height, backgroundColor: entry.color }}
            >
              <div className="absolute left-[6px] right-[6px] top-[4px]">
                <div className="truncate text-[10px] font-semibold leading-[10px] text-white">
                  {timeLabel(entry.start)} - {timeLabel(entry.end)}
                </div>
                {height >= 42 ? (
                  <>
                    <div className="mt-[2px] truncate text-[14px] font-semibold leading-[14px] text-white">{entry.staffName}</div>
                    <div className="mt-[2px] truncate text-[11px] font-semibold leading-[11px] text-white">
                      {entry.resources.length ? entry.resources.join(", ") : "All rooms"}
                    </div>
                  </>
                ) : null}
              </div>
              {height >= 86 ? (
                <>
                  {entry.recurring ? <Icon name="repeat" className="absolute bottom-[11px] right-[42px] h-5 w-5 text-white" /> : null}
                  <div className="absolute bottom-[7px] right-[7px] grid h-7 w-7 place-items-center rounded-full border border-black/25 bg-white/90 text-[11px] font-semibold leading-none text-black/80">
                    {initials || "ST"}
                  </div>
                </>
              ) : null}
            </button>
          );
        })}

        {dragSelection?.date === date ? (() => {
          const start = Math.min(dragSelection.start, dragSelection.current);
          const end = Math.max(dragSelection.start, dragSelection.current);
          const safeEnd = end - start >= 15 ? end : start + 15;
          const top = (start / 30) * slotHeight + 1;
          const height = Math.max(24, ((safeEnd - start) / 30) * slotHeight - 2);
          return (
            <div
              className="pointer-events-none absolute left-[5px] right-[5px] overflow-hidden rounded-[4px] border pb-1 pl-[7px] pr-2 pt-[5px] text-left text-white"
              style={{
                top,
                height,
                backgroundColor: staffAvailabilityDragPreviewColor,
                borderColor: staffAvailabilityDragPreviewBorderColor,
              }}
            >
              <div className="truncate text-[12px] font-medium leading-[12px] text-white">
                {timeLabel(minutesToTime(start))} - {timeLabel(minutesToTime(safeEnd))}
              </div>
            </div>
          );
        })() : null}
      </>
    );
  }

  return (
    <section className="min-h-screen px-6 py-8 lg:px-7">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 items-center gap-2">
          <CalendarToolbarButton label="Today" onClick={() => setActiveDate(today)} />
          <CalendarToolbarButton label="Back" onClick={() => shiftAvailabilityDate(calendarMode === "week" ? -7 : -1)} />
          <CalendarToolbarButton label="Next" onClick={() => shiftAvailabilityDate(calendarMode === "week" ? 7 : 1)} />
        </div>

        <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            className="inline-flex min-h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-lg border border-black/15 bg-white px-6 text-[16px] font-medium text-black shadow-[0_1px_0_rgba(255,255,255,0.9)]"
          >
            <span>{calendarMode === "week" ? formatAvailabilityWeekHeading() : formatCalendarHeading(activeDate)}</span>
            <Icon name="chevron" className="h-4 w-4 rotate-90 text-black/60" />
          </button>
          <div className="flex items-center gap-2">
            <CalendarSegmentButton active={calendarMode === "day"} onClick={() => setCalendarMode("day")}>
              Day
            </CalendarSegmentButton>
            <CalendarSegmentButton active={calendarMode === "week"} onClick={() => setCalendarMode("week")}>
              Week
            </CalendarSegmentButton>
          </div>
          <CalendarToolbarButton label="Filter View" icon="table" onClick={() => setEditorOpen(true)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div
          className="grid min-w-[980px] border-b border-black/10 bg-white"
          style={{ gridTemplateColumns: `96px repeat(${visibleDates.length}, minmax(160px, 1fr))` }}
        >
          <div className="border-r border-black/10 px-4 py-4" />
          {visibleDates.map((date) => {
            const dateObject = parseLocalDate(date);
            const headerLabel =
              calendarMode === "week"
                ? `${dateObject.getDate()} ${dateObject.toLocaleDateString("en-US", { weekday: "short" })}`
                : dateObject.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
            return (
              <div
                key={`availability-header-${date}`}
                className={[
                  "border-r border-black/10 px-4 py-4 text-center text-[15px] font-bold last:border-r-0",
                  date === today ? "bg-[#eaf6ff]" : "bg-white",
                ].join(" ")}
              >
                {headerLabel}
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
          <div
            className="grid min-w-[980px]"
            style={{ gridTemplateColumns: `96px repeat(${visibleDates.length}, minmax(160px, 1fr))` }}
          >
            <div className="relative border-r border-black/10 bg-white">
              {slots.map((slot, index) => (
                <div
                  key={`availability-time-${slot}`}
                  className="flex items-start justify-end border-b border-black/10 px-3 text-right text-[15px] font-medium text-black/90"
                  style={{ height: slotHeight }}
                >
                  <div className={`w-full ${index === 0 ? "pt-1" : "pt-0.5"}`}>{timeLabel(slot)}</div>
                </div>
              ))}
            </div>

            {visibleDates.map((date) => (
              <div
                key={`availability-column-${date}`}
                onMouseDown={(event) => beginAvailabilityDrag(date, event)}
                onMouseMove={(event) => updateAvailabilityDrag(date, event)}
                onMouseUp={(event) => finishAvailabilityDrag(date, event)}
                onMouseLeave={() => setDragSelection((selection) => (selection?.date === date ? null : selection))}
                className={[
                  "relative cursor-crosshair border-r border-black/10 last:border-r-0",
                  date === today ? "bg-[#eaf6ff]" : "bg-white",
                ].join(" ")}
                style={{ height: slots.length * slotHeight }}
              >
                {slots.map((slot) => (
                  <div key={`${date}-${slot}`} className="border-b border-black/10" style={{ height: slotHeight }} />
                ))}
                {renderAvailabilityBlocks(date)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          const nextDraft = createAvailabilityDraft(activeDate, scrollStartMinutes);
          if (nextDraft) setDraft(nextDraft);
        }}
        className="fixed bottom-[90px] right-5 z-20 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#1f1a1a] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] lg:bottom-6"
      >
        <Icon name="plus" className="h-5 w-5" />
        <span>Availability</span>
      </button>

      {editorOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[18px] font-semibold text-black">Edit Availability</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="text-black/45" aria-label="Close availability editor">
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-5">
              <div className="rounded-lg border border-black/10 bg-white">
                {rows.map(([day, open, start, end], index) => (
                  <div
                    key={day}
                    className="grid gap-3 border-b border-black/10 px-4 py-4 last:border-0 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-center"
                  >
                    <strong className="text-[15px]">{day}</strong>
                    <input
                      type="time"
                      value={start}
                      disabled={!open}
                      onChange={(event) => update(index, [day, open, event.target.value, end])}
                      className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] disabled:bg-black/[0.03]"
                    />
                    <input
                      type="time"
                      value={end}
                      disabled={!open}
                      onChange={(event) => update(index, [day, open, start, event.target.value])}
                      className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] disabled:bg-black/[0.03]"
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
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSave();
                  setEditorOpen(false);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-black px-5 text-[14px] font-semibold text-white"
              >
                <Icon name="clock" className="h-4 w-4" />
                Save hours
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[18px] font-semibold text-black">
                {entries.some((entry) => entry.id === draft.id) ? "Edit Availability" : "Add Availability"}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="text-black/45" aria-label="Close availability editor">
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-black/70">Date</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              date: event.target.value,
                              recurrenceEndDate:
                                current.recurring && (!current.recurrenceEndDate || current.recurrenceEndDate < event.target.value)
                                  ? defaultStaffAvailabilityRecurrenceEndDate(event.target.value)
                                  : current.recurrenceEndDate,
                            }
                          : current
                      )
                    }
                    className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-black/70">Start Time</span>
                  <input
                    type="time"
                    value={draft.start}
                    onChange={(event) => setDraft((current) => (current ? { ...current, start: event.target.value } : current))}
                    className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-black/70">End Time</span>
                  <input
                    type="time"
                    value={draft.end}
                    onChange={(event) => setDraft((current) => (current ? { ...current, end: event.target.value } : current))}
                    className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px]"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-[150px_1fr_92px_180px] sm:items-start">
                <div className="grid gap-1.5">
                  <span className="text-sm font-semibold text-black/70">Repeats</span>
                  <div className="inline-grid min-h-12 grid-cols-2 overflow-hidden rounded-lg border border-black/10 bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                recurring: false,
                                recurrenceId: undefined,
                                recurrenceFrequency: undefined,
                                recurrenceEndDate: undefined,
                              }
                            : current
                        )
                      }
                      className={[
                        "px-5 text-sm font-semibold",
                        !draft.recurring ? "bg-black text-white" : "bg-white text-black/50",
                      ].join(" ")}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                recurring: true,
                                recurrenceId: current.recurrenceId ?? makeId("recurrence"),
                                recurrenceFrequency: current.recurrenceFrequency ?? "daily",
                                recurrenceEndDate: current.recurrenceEndDate ?? defaultStaffAvailabilityRecurrenceEndDate(current.date),
                              }
                            : current
                        )
                      }
                      className={[
                        "px-5 text-sm font-semibold",
                        draft.recurring ? "bg-black text-white" : "bg-white text-black/50",
                      ].join(" ")}
                    >
                      Yes
                    </button>
                  </div>
                </div>

                {draft.recurring ? (
                  <>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-semibold text-black/70">Frequency</span>
                      <select
                        value={draft.recurrenceFrequency ?? "daily"}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  recurrenceFrequency: normalizeStaffAvailabilityRecurrenceFrequency(event.target.value),
                                }
                              : current
                          )
                        }
                        className="min-h-12 rounded-lg border border-black/10 bg-white px-4 text-[15px]"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly on {weekdayName(draft.date)}</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-semibold text-black/70">Ends</span>
                      <select value="on" onChange={() => undefined} className="min-h-12 rounded-lg border border-black/10 bg-white px-4 text-[15px]">
                        <option value="on">On</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-semibold text-black/70">End Date</span>
                      <input
                        type="date"
                        min={draft.date}
                        value={draft.recurrenceEndDate ?? defaultStaffAvailabilityRecurrenceEndDate(draft.date)}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  recurrenceEndDate:
                                    event.target.value >= current.date
                                      ? event.target.value
                                      : defaultStaffAvailabilityRecurrenceEndDate(current.date),
                                }
                              : current
                          )
                        }
                        className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px]"
                      />
                      <span className="px-4 text-xs text-black/65">
                        (Ends: {formatStaffAvailabilityRecurrenceEnd(draft.recurrenceEndDate ?? defaultStaffAvailabilityRecurrenceEndDate(draft.date))})
                      </span>
                    </label>
                  </>
                ) : null}
              </div>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-black/70">Staff</span>
                <select
                  value={draft.staffId}
                  disabled={!canManageAny}
                  onChange={(event) => {
                    const staffMember = staffById.get(event.target.value);
                    setDraft((current) =>
                      current && staffMember
                        ? {
                            ...current,
                            staffId: staffMember.id,
                            staffName: staffMember.name,
                            color: staffColorById.get(staffMember.id) ?? staffMember.calendarColor ?? current.color,
                          }
                        : current
                    );
                  }}
                  className="min-h-12 rounded-lg border border-black/10 bg-white px-4 text-[15px] disabled:bg-black/[0.03]"
                >
                  {manageableStaff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-semibold text-black/70">Rooms</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {resources.map((resource) => {
                    const checked = draft.resources.includes(resource);
                    return (
                      <label key={resource} className="flex min-h-11 items-center gap-3 rounded-lg border border-black/10 px-3 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    resources: event.target.checked
                                      ? Array.from(new Set([...current.resources, resource]))
                                      : current.resources.filter((item) => item !== resource),
                                  }
                                : current
                            )
                          }
                          className="h-4 w-4 accent-black"
                        />
                        <span>{resource}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-black/70">Color</span>
                <div className="flex flex-wrap gap-2">
                  {staffAvailabilityColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraft((current) => (current ? { ...current, color } : current))}
                      className={[
                        "h-9 w-9 rounded-full border",
                        draft.color === color ? "border-black ring-2 ring-black/25" : "border-black/15",
                      ].join(" ")}
                      style={{ backgroundColor: color }}
                      aria-label={`Use color ${color}`}
                    />
                  ))}
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-black/10 px-6 py-4">
              {entries.some((entry) => entry.id === draft.id) ? (
                <button
                  type="button"
                  onClick={() => void deleteDraft()}
                  className="rounded-lg border border-red-200 px-4 py-2 text-[14px] font-semibold text-red-600"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-black px-5 text-[14px] font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const filtered = useMemo(() => {
    const loweredSearch = search.toLowerCase();
    return customers.filter((customer) =>
      [customer.name, customer.player, customer.email, customer.phone]
        .join(" ")
        .toLowerCase()
        .includes(loweredSearch)
    );
  }, [customers, search]);
  const visibleCustomers = useMemo(() => {
    return [...filtered].sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;

      return sortDirection === "desc" ? safeRight - safeLeft : safeLeft - safeRight;
    });
  }, [filtered, sortDirection]);
  const bookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((booking) => {
      counts.set(booking.customerId, (counts.get(booking.customerId) ?? 0) + 1);
    });
    return counts;
  }, [bookings]);
  const allVisibleSelected =
    visibleCustomers.length > 0 && visibleCustomers.every((customer) => selected.includes(customer.id));

  function toggleCreatedAtSort() {
    setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((current) => current.filter((id) => !visibleCustomers.some((customer) => customer.id === id)));
      return;
    }

    setSelected((current) => Array.from(new Set([...current, ...visibleCustomers.map((customer) => customer.id)])));
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
                <th className="border-b border-black/10 px-4 py-3 text-left font-semibold">
                  <button
                    type="button"
                    onClick={toggleCreatedAtSort}
                    className="inline-flex items-center gap-1.5 text-left hover:text-black/75"
                  >
                    <span>Created At</span>
                    <Icon
                      name="chevron"
                      className={[
                        "h-3.5 w-3.5 text-black/55 transition-transform",
                        sortDirection === "desc" ? "rotate-90" : "-rotate-90",
                      ].join(" ")}
                    />
                  </button>
                </th>
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
              {!loading ? visibleCustomers.map((customer) => {
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
                        className="inline-flex items-center gap-3 text-left hover:underline"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white">
                          <Icon name="user" className="h-5 w-5" />
                        </span>
                        <span className="grid gap-0.5">
                          <span className="font-semibold">{customer.name || customer.player || "Customer"}</span>
                          {customer.player && customer.player !== customer.name ? (
                            <span className="text-[12px] font-medium text-black/55">Player: {customer.player}</span>
                          ) : null}
                        </span>
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
              {!loading && !visibleCustomers.length ? (
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
  onSave: (member: FamilyMember) => void | Promise<void>;
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
  const [isSaving, setIsSaving] = useState(false);
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

  async function handleSave() {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        id: initialMember?.id ?? makeId("family"),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        relationship,
        gender,
        birthDate,
      });
    } finally {
      setIsSaving(false);
    }
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
            disabled={!canSave || isSaving}
            onClick={() => void handleSave()}
            className="rounded-md bg-black px-5 py-2.5 text-[15px] font-medium text-white disabled:bg-black/10 disabled:text-black/30"
          >
            {isSaving ? "Saving..." : "Done"}
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
  onSave: (contact: { name: string; email: string; phone: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(formatUsPhoneInput(initialPhone));
  const [isSaving, setIsSaving] = useState(false);

  const canSave = Boolean(name.trim() || email.trim() || phone.trim());

  async function handleSave() {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  }

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
            disabled={!canSave || isSaving}
            onClick={() => void handleSave()}
            className="rounded-md bg-black px-6 py-3 text-[15px] font-medium text-white disabled:bg-black/10 disabled:text-black/30"
          >
            {isSaving ? "Saving..." : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailView({
  customer,
  bookings,
  servicesById,
  taxesAndFees,
  customerMemberships,
  membershipServices,
  onSaveCustomer,
  onAssignMembership,
  onCancelMembership,
  showToast,
}: {
  customer: Customer | null;
  bookings: Booking[];
  servicesById: Map<string, Service>;
  taxesAndFees: AppState["taxesAndFees"];
  customerMemberships: CustomerMembershipRecord[];
  membershipServices: Service[];
  onSaveCustomer: (item: Customer, options?: { message?: string; silent?: boolean }) => Promise<boolean>;
  onAssignMembership: (customerId: string, membershipServiceId: string) => Promise<boolean>;
  onCancelMembership: (
    customerId: string,
    membershipRecordId: string,
    options: MembershipCancelOptions
  ) => Promise<boolean>;
  showToast: (message: string) => void;
}) {
  const tabLabels = ["Profile", "Billing", "Memberships", "Packages", "Activity", "Invoices", "Credits"] as const;
  type CustomerDetailTab = (typeof tabLabels)[number];
  type CustomerBillingSubtab = "Payments" | "Wallet" | "Saved Cards";
  type ChargeMethod = "card" | "cash" | "waive";
  const detailRouter = useRouter();
  const detailPathname = usePathname();
  const detailSearchParams = useSearchParams();
  const activeCustomerTabParam = detailSearchParams.get("tab");
  const normalizedInitialTab = useMemo<CustomerDetailTab>(() => {
    const normalized = (activeCustomerTabParam ?? "").trim().toLowerCase();
    switch (normalized) {
      case "billing":
        return "Billing";
      case "memberships":
        return "Memberships";
      case "packages":
        return "Packages";
      case "activity":
        return "Activity";
      case "invoices":
        return "Invoices";
      case "credits":
        return "Credits";
      case "profile":
      default:
        return "Profile";
    }
  }, [activeCustomerTabParam]);

  const [activeTab, setActiveTab] = useState<CustomerDetailTab>(normalizedInitialTab);
  const [activeBillingTab, setActiveBillingTab] = useState<CustomerBillingSubtab>("Payments");
  const [contactOpen, setContactOpen] = useState(true);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false);
  const [editingFamilyMember, setEditingFamilyMember] = useState<FamilyMember | null>(null);
  const [firstNameDraft, setFirstNameDraft] = useState(splitName(customer?.name ?? "").first);
  const [lastNameDraft, setLastNameDraft] = useState(splitName(customer?.name ?? "").last);
  const [emailDraft, setEmailDraft] = useState(customer?.email ?? "");
  const [profilePhone, setProfilePhone] = useState(formatUsPhoneInput(customer?.phone ?? ""));
  const [addressDraft, setAddressDraft] = useState(customer?.address ?? "");
  const [birthDateDraft, setBirthDateDraft] = useState(customer ? customerBirthDate(customer) : "");
  const [genderDraft, setGenderDraft] = useState(customer?.gender ?? "");
  const [noteDraft, setNoteDraft] = useState(customer?.notes ?? "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(true);
  const [emergencyDeleted, setEmergencyDeleted] = useState(false);
  const [billingCards, setBillingCards] = useState<BillingCard[]>([]);
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([]);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [startingCardSetup, setStartingCardSetup] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [addCardClientSecret, setAddCardClientSecret] = useState("");
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeMethod, setChargeMethod] = useState<ChargeMethod | null>(null);
  const [chargeBookingId, setChargeBookingId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeTaxEnabled, setChargeTaxEnabled] = useState(false);
  const [chargeTaxRateId, setChargeTaxRateId] = useState("");
  const [chargeFeeEnabled, setChargeFeeEnabled] = useState(false);
  const [chargeFeeId, setChargeFeeId] = useState("");
  const [chargeDiscountEnabled, setChargeDiscountEnabled] = useState(false);
  const [chargeDiscount, setChargeDiscount] = useState("");
  const [chargeReturnTo, setChargeReturnTo] = useState<"calendar" | null>(null);
  const [chargeReturnDate, setChargeReturnDate] = useState("");
  const [submittingCharge, setSubmittingCharge] = useState(false);
  const [membershipServiceDraft, setMembershipServiceDraft] = useState("");
  const [membershipActionId, setMembershipActionId] = useState("");
  const [membershipCancelDraft, setMembershipCancelDraft] = useState<CustomerMembershipRecord | null>(null);
  const [membershipCancelTiming, setMembershipCancelTiming] = useState<MembershipCancelTiming>("period_end");
  const [membershipCancelRefundProrated, setMembershipCancelRefundProrated] = useState(false);

  const customerBookings = useMemo(
    () =>
      customer
        ? bookings
            .filter((item) => item.customerId === customer.id)
            .sort((left, right) => `${right.date} ${right.start}`.localeCompare(`${left.date} ${left.start}`))
        : [],
    [bookings, customer]
  );

  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);

  useEffect(() => {
    setBillingCards([]);
    setBillingPayments([]);
    setDefaultPaymentMethodId(null);
    setBillingLoaded(false);
    setBillingLoading(false);
    setBillingError("");
    setShowAddCardModal(false);
    setAddCardClientSecret("");
    setShowPaymentMethodModal(false);
    setShowChargeModal(false);
    setChargeMethod(null);
    setChargeBookingId("");
    setChargeAmount("");
    setChargeDescription("");
    setChargeTaxEnabled(false);
    setChargeTaxRateId("");
    setChargeFeeEnabled(false);
    setChargeFeeId("");
    setChargeDiscountEnabled(false);
    setChargeDiscount("");
    setChargeReturnTo(null);
    setChargeReturnDate("");
    setMembershipServiceDraft("");
    setMembershipActionId("");
    setMembershipCancelDraft(null);
    setMembershipCancelTiming("period_end");
    setMembershipCancelRefundProrated(false);
  }, [customer?.id]);

  const currentCustomerId = customer?.id ?? "";

  const loadBillingData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!currentCustomerId) return;

      setBillingLoading(true);
      if (!options?.silent) {
        setBillingError("");
      }

      try {
        const [cardsResponse, paymentsResponse] = await Promise.all([
          fetch(`/api/stripe/cards?customerId=${encodeURIComponent(currentCustomerId)}`, { cache: "no-store" }),
          fetch(`/api/stripe/payments?customerId=${encodeURIComponent(currentCustomerId)}`, { cache: "no-store" }),
        ]);

        const [cardsPayload, paymentsPayload] = await Promise.all([cardsResponse.json(), paymentsResponse.json()]);

        if (!cardsResponse.ok) {
          throw new Error(cardsPayload?.error || "Could not load saved cards.");
        }

        if (!paymentsResponse.ok) {
          throw new Error(paymentsPayload?.error || "Could not load payments.");
        }

        setBillingCards(Array.isArray(cardsPayload.cards) ? (cardsPayload.cards as BillingCard[]) : []);
        setDefaultPaymentMethodId(
          typeof cardsPayload.defaultPaymentMethodId === "string" ? cardsPayload.defaultPaymentMethodId : null
        );
        setBillingPayments(Array.isArray(paymentsPayload.payments) ? (paymentsPayload.payments as BillingPayment[]) : []);
        setBillingLoaded(true);
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Could not load customer billing.";
        setBillingError(message);
        if (!options?.silent) {
          showToast(message);
        }
      } finally {
        setBillingLoading(false);
      }
    },
    [currentCustomerId, showToast]
  );

  useEffect(() => {
    if (activeTab === "Billing" && !billingLoaded && !billingLoading) {
      void loadBillingData({ silent: true });
    }
  }, [activeTab, billingLoaded, billingLoading, loadBillingData]);

  useEffect(() => {
    if (!customer) return;

    const bookingId = detailSearchParams.get("chargeBooking");
    if (!bookingId) return;

    const selectedBooking = customerBookings.find((item) => item.id === bookingId);
    if (!selectedBooking) {
      const params = new URLSearchParams(detailSearchParams.toString());
      params.delete("chargeBooking");
      params.delete("chargeAmount");
      params.delete("chargeDescription");
      const nextUrl = params.toString() ? `${detailPathname}?${params.toString()}` : detailPathname;
      detailRouter.replace(nextUrl, { scroll: false });
      return;
    }

    const selectedService = servicesById.get(selectedBooking.serviceId);
    const requestedAmount = detailSearchParams.get("chargeAmount");
    const requestedReturnTo = detailSearchParams.get("returnTo");
    const requestedReturnDate = detailSearchParams.get("returnDate");
    const resolvedAmount =
      requestedAmount && Number.isFinite(Number(requestedAmount))
        ? String(Number(requestedAmount))
        : selectedService
          ? String(selectedService.price)
          : "";
    const resolvedDescription =
      detailSearchParams.get("chargeDescription") ||
      [
        selectedBooking.serviceName || selectedService?.name || "Booking charge",
        selectedBooking.date,
        `${selectedBooking.start} - ${selectedBooking.end}`,
        selectedBooking.resource,
      ]
        .filter(Boolean)
        .join(" | ");

    setActiveTab("Billing");
    setActiveBillingTab("Payments");
    setChargeBookingId(selectedBooking.id);
    setChargeAmount(resolvedAmount);
    setChargeDescription(resolvedDescription);
    setChargeReturnTo(requestedReturnTo === "calendar" ? "calendar" : null);
    setChargeReturnDate(
      requestedReturnDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedReturnDate)
        ? requestedReturnDate
        : selectedBooking.date
    );
    setShowPaymentMethodModal(true);
    void loadBillingData({ silent: true });

    const params = new URLSearchParams(detailSearchParams.toString());
    params.delete("chargeBooking");
    params.delete("chargeAmount");
    params.delete("chargeDescription");
    params.delete("returnTo");
    params.delete("returnDate");
    params.set("tab", "billing");
    const nextUrl = params.toString() ? `${detailPathname}?${params.toString()}` : detailPathname;
    detailRouter.replace(nextUrl, { scroll: false });
  }, [customer, customerBookings, detailPathname, detailRouter, detailSearchParams, loadBillingData, servicesById]);

  useEffect(() => {
    const stripeState = detailSearchParams.get("stripe");
    if (!stripeState) return;

    const messages: Record<string, string> = {
      "card-added": "Card added.",
      "card-cancelled": "Card setup cancelled.",
      "charge-paid": "Charge paid.",
      "charge-cancelled": "Charge cancelled.",
    };

    const message = messages[stripeState];
    if (message) {
      showToast(message);
    }

    void loadBillingData({ silent: true });

    const params = new URLSearchParams(detailSearchParams.toString());
    params.delete("stripe");
    const nextUrl = params.toString() ? `${detailPathname}?${params.toString()}` : detailPathname;
    detailRouter.replace(nextUrl);
  }, [detailPathname, detailRouter, detailSearchParams, loadBillingData, showToast]);

  if (!customer) {
    return (
      <section className="min-h-screen px-6 py-8">
        <div className="rounded-xl border border-black/10 bg-white p-8 text-sm text-black/55">
          Customer not found.
        </div>
      </section>
    );
  }

  const joinedLabel = customerJoinedLabel(customer.createdAt);
  const initials = customerInitials(customer);
  const birthDate = customerBirthDate(customer);
  const age = calculateAge(customer.birthYear, customer.birthMonth, customer.birthDay);
  const familyMembers = customer.familyMembers;
  const primaryPlayerLabel =
    customer.player.trim() && customer.player.trim() !== customer.name.trim() ? customer.player.trim() : "";
  const relatedKidNames = Array.from(
    new Set(
      [
        primaryPlayerLabel,
        ...familyMembers
          .map((member) => `${member.firstName} ${member.lastName}`.trim())
          .filter(Boolean),
      ].filter(Boolean)
    )
  );
  const legacyMemberships = customer.memberships.filter(Boolean);
  const memberships = customerMemberships;
  const currentCustomer = customer;
  const activeMembershipServiceIds = new Set(
    memberships.filter(isActiveCustomerMembership).map((membership) => membership.membershipServiceId)
  );
  const availableMembershipServices = membershipServices.filter((service) => !activeMembershipServiceIds.has(service.id));
  const hasEmergencyContact =
    !emergencyDeleted &&
    Boolean(
      customer.emergencyContactName.trim() ||
        customer.emergencyContactEmail.trim() ||
        customer.emergencyContactPhone.trim()
    );
  const billedTotal = customerBookings.reduce((total, booking) => {
    const servicePrice = servicesById.get(booking.serviceId)?.price ?? 0;
    return total + servicePrice;
  }, 0);
  const paidTotal = customerBookings.reduce((total, booking) => {
    const servicePrice = servicesById.get(booking.serviceId)?.price ?? 0;
    return total + (booking.paid ? servicePrice : 0);
  }, 0);
  const membershipCards = memberships
    .map((membership) => {
      const service = servicesById.get(membership.membershipServiceId);
      const creditSettings = membershipCreditSettings(membership, service);

      return {
        ...membership,
        creditsPerDay: creditSettings.creditsPerDay,
        creditLimitPeriod: creditSettings.creditLimitPeriod,
        service,
      };
    })
    .sort((left, right) => {
      const leftActive = isActiveCustomerMembership(left);
      const rightActive = isActiveCustomerMembership(right);
      if (leftActive !== rightActive) return leftActive ? -1 : 1;
      return `${right.currentPeriodStart} ${right.createdAt}`.localeCompare(`${left.currentPeriodStart} ${left.createdAt}`);
    });
  const creditMemberships = membershipCards.filter(
    (membership) => isActiveCustomerMembership(membership) && membership.creditsPerDay > 0
  );
  const totalCreditAllowance = creditMemberships.reduce((total, membership) => total + membership.creditsPerDay, 0);

  function membershipStatusClasses(status: CustomerMembershipStatus) {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700";
      case "Paused":
        return "bg-amber-50 text-amber-700";
      case "Past Due":
        return "bg-orange-50 text-orange-700";
      case "Cancelled":
        return "bg-rose-50 text-rose-700";
      case "Expired":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-black/[0.05] text-black/60";
    }
  }

  async function assignSelectedMembership() {
    if (!membershipServiceDraft) {
      showToast("Choose a membership to assign.");
      return;
    }

    setMembershipActionId("assign");
    try {
      const saved = await onAssignMembership(currentCustomer.id, membershipServiceDraft);
      if (saved) {
        setMembershipServiceDraft("");
      }
    } finally {
      setMembershipActionId("");
    }
  }

  function openCancelMembershipDialog(membership: CustomerMembershipRecord) {
    setMembershipCancelDraft(membership);
    setMembershipCancelTiming("period_end");
    setMembershipCancelRefundProrated(false);
  }

  async function cancelSelectedMembership() {
    if (!membershipCancelDraft) return;

    setMembershipActionId(membershipCancelDraft.id);
    try {
      const saved = await onCancelMembership(currentCustomer.id, membershipCancelDraft.id, {
        timing: membershipCancelTiming,
        refundProrated: membershipCancelTiming === "immediate" && membershipCancelRefundProrated,
      });
      if (saved) {
        setMembershipCancelDraft(null);
        setMembershipCancelTiming("period_end");
        setMembershipCancelRefundProrated(false);
      }
    } finally {
      setMembershipActionId("");
    }
  }

  const pendingCount = customerBookings.filter((item) => !item.paid && item.status !== "Cancelled").length;
  const topPackages = Array.from(
    customerBookings.reduce((map, booking) => {
      const serviceName = booking.serviceName || servicesById.get(booking.serviceId)?.name || "Service";
      map.set(serviceName, (map.get(serviceName) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  const defaultCard = billingCards.find((card) => card.id === defaultPaymentMethodId) ?? null;
  const walletBalance = 0;
  const availableTaxRates = taxesAndFees.taxRates;
  const availableCustomFees = taxesAndFees.customFees;
  const selectedChargeBooking = chargeBookingId
    ? customerBookings.find((booking) => booking.id === chargeBookingId) ?? null
    : null;
  const selectedChargeService = selectedChargeBooking
    ? servicesById.get(selectedChargeBooking.serviceId) ??
      Array.from(servicesById.values()).find(
        (service) =>
          selectedChargeBooking.serviceName &&
          normalizeServiceIdentifier(service.name) === normalizeServiceIdentifier(selectedChargeBooking.serviceName)
      ) ??
      null
    : null;
  const selectedChargeTaxRate = availableTaxRates.find((item) => item.id === chargeTaxRateId) ?? null;
  const selectedChargeFee = availableCustomFees.find((item) => item.id === chargeFeeId) ?? null;
  const chargeSubtotal = Number.isFinite(Number(chargeAmount)) ? Number(chargeAmount) : 0;
  const chargeTaxPercent = chargeTaxEnabled ? Number(selectedChargeTaxRate?.percentage ?? 0) : 0;
  const chargeFeePercent = chargeFeeEnabled ? Number(selectedChargeFee?.amount ?? 0) : 0;
  const chargeTaxAmount =
    chargeTaxEnabled && Number.isFinite(chargeTaxPercent) ? (chargeSubtotal * chargeTaxPercent) / 100 : 0;
  const chargeFeeAmount =
    chargeFeeEnabled && Number.isFinite(chargeFeePercent) ? (chargeSubtotal * chargeFeePercent) / 100 : 0;
  const chargeDiscountAmountRaw = Number.isFinite(Number(chargeDiscount)) ? Number(chargeDiscount) : 0;
  const chargeDiscountAmount = chargeDiscountEnabled ? Math.max(0, chargeDiscountAmountRaw) : 0;
  const chargeTotal = Math.max(0, chargeSubtotal + chargeTaxAmount + chargeFeeAmount - chargeDiscountAmount);

  async function saveCustomerPatch(
    patch: Partial<Customer>,
    message: string,
    options?: { silent?: boolean }
  ) {
    const nextCustomer: Customer = {
      id: patch.id ?? currentCustomer.id,
      name: patch.name ?? currentCustomer.name,
      player: patch.player ?? currentCustomer.player,
      email: patch.email ?? currentCustomer.email,
      address: patch.address ?? currentCustomer.address,
      phone: patch.phone ?? currentCustomer.phone,
      phoneCountry: patch.phoneCountry ?? currentCustomer.phoneCountry,
      birthYear: patch.birthYear ?? currentCustomer.birthYear,
      birthMonth: patch.birthMonth ?? currentCustomer.birthMonth,
      birthDay: patch.birthDay ?? currentCustomer.birthDay,
      gender: patch.gender ?? currentCustomer.gender,
      age: patch.age ?? currentCustomer.age,
      memberships: patch.memberships ?? currentCustomer.memberships,
      waiverAgreed: patch.waiverAgreed ?? currentCustomer.waiverAgreed,
      emergencyContactName: patch.emergencyContactName ?? currentCustomer.emergencyContactName,
      emergencyContactEmail: patch.emergencyContactEmail ?? currentCustomer.emergencyContactEmail,
      emergencyContactPhone: patch.emergencyContactPhone ?? currentCustomer.emergencyContactPhone,
      familyMembers: patch.familyMembers ?? currentCustomer.familyMembers,
      notes: patch.notes ?? currentCustomer.notes,
      createdAt: patch.createdAt ?? currentCustomer.createdAt,
    };

    return onSaveCustomer(
      nextCustomer,
      {
        message,
        silent: options?.silent,
      }
    );
  }

  function openAddNote() {
    setActiveTab("Profile");
    setIsEditingNote(true);
  }

  function clearEmergencyContact() {
    setEmergencyDeleted(true);
  }

  async function saveEmergencyContact() {
    const saved = await saveCustomerPatch(
      {
        emergencyContactName: "",
        emergencyContactEmail: "",
        emergencyContactPhone: "",
      },
      "Emergency contact removed."
    );
    if (saved) {
      setEmergencyDeleted(false);
    }
  }

  async function saveEmergencyContactValues(contact: { name: string; email: string; phone: string }) {
    const saved = await saveCustomerPatch(
      {
        emergencyContactName: contact.name,
        emergencyContactEmail: contact.email,
        emergencyContactPhone: contact.phone.replace(/\D/g, "").slice(0, 10),
      },
      "Emergency contact updated."
    );
    if (saved) {
      setEmergencyDeleted(false);
      setShowEmergencyContactModal(false);
    }
  }

  async function saveFamilyMembers(nextFamilyMembers: FamilyMember[], message: string) {
    return saveCustomerPatch(
      {
        familyMembers: nextFamilyMembers,
      },
      message
    );
  }

  function openNewFamilyMemberModal() {
    setEditingFamilyMember(null);
    setShowFamilyModal(true);
  }

  function openEditFamilyMemberModal(member: FamilyMember) {
    setEditingFamilyMember(member);
    setShowFamilyModal(true);
  }

  async function saveName() {
    const nextName = joinName(firstNameDraft, lastNameDraft);
    if (nextName === currentCustomer.name) return;
    await saveCustomerPatch({ name: nextName }, "Customer updated.", { silent: true });
  }

  async function saveEmail() {
    const nextEmail = emailDraft.trim();
    if (nextEmail === currentCustomer.email) return;
    await saveCustomerPatch({ email: nextEmail }, "Customer updated.", { silent: true });
  }

  async function savePhone() {
    const digits = profilePhone.replace(/\D/g, "").slice(0, 10);
    const nextDisplay = formatUsPhoneInput(digits);
    setProfilePhone(nextDisplay);
    if (digits === currentCustomer.phone) return;
    await saveCustomerPatch({ phone: digits }, "Customer updated.", { silent: true });
  }

  async function saveAddress() {
    const nextAddress = addressDraft.trim();
    if (nextAddress === currentCustomer.address) return;
    await saveCustomerPatch({ address: nextAddress }, "Customer updated.", { silent: true });
  }

  async function saveBirthDate() {
    const nextValue = birthDateDraft.trim();
    if (!nextValue) {
      if (!currentCustomer.birthYear && !currentCustomer.birthMonth && !currentCustomer.birthDay) return;
      const saved = await saveCustomerPatch(
        {
          birthYear: "",
          birthMonth: "",
          birthDay: "",
          age: "",
        },
        "Customer updated.",
        { silent: true }
      );
      if (saved) {
        setBirthDateDraft("");
      }
      return;
    }

    const parsed = parseUsDateInput(nextValue);
    if (!parsed) {
      setBirthDateDraft(birthDate);
      return;
    }

    const birthYear = String(parsed.getFullYear());
    const birthMonth = String(parsed.getMonth() + 1).padStart(2, "0");
    const birthDay = String(parsed.getDate()).padStart(2, "0");
    const nextAge = calculateAge(birthYear, birthMonth, birthDay);

    if (
      birthYear === currentCustomer.birthYear &&
      birthMonth === currentCustomer.birthMonth &&
      birthDay === currentCustomer.birthDay
    ) {
      setBirthDateDraft(formatDateToUs(parsed));
      return;
    }

    const saved = await saveCustomerPatch(
      {
        birthYear,
        birthMonth,
        birthDay,
        age: nextAge,
      },
      "Customer updated.",
      { silent: true }
    );
    if (saved) {
      setBirthDateDraft(formatDateToUs(parsed));
    }
  }

  async function saveGender(nextGender: string) {
    setGenderDraft(nextGender);
    if (nextGender === currentCustomer.gender) return;
    await saveCustomerPatch({ gender: nextGender }, "Customer updated.", { silent: true });
  }

  async function saveNotes() {
    const nextNotes = noteDraft.trim();
    if (nextNotes === currentCustomer.notes.trim()) {
      setIsEditingNote(false);
      return;
    }

    const saved = await saveCustomerPatch({ notes: nextNotes }, "Customer updated.");
    if (saved) {
      setIsEditingNote(false);
    }
  }

  function bookingDateLabel(value: string) {
    return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function BookingRows() {
    if (!customerBookings.length) {
      return <div className="p-6 text-sm text-black/45">No bookings yet.</div>;
    }

    return (
      <div className="divide-y divide-black/10">
        {customerBookings.map((booking) => {
          const service = servicesById.get(booking.serviceId);
          return (
            <div key={booking.id} className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <div className="text-[14px] font-medium text-black">
                  {booking.serviceName || service?.name || "Service"}
                </div>
                <div className="mt-1 text-[13px] text-black/55">
                  {bookingDateLabel(booking.date)} \u00b7 {booking.start} - {booking.end} \u00b7 {booking.resource}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "rounded-full px-3 py-1 text-[12px] font-semibold",
                    booking.status === "Cancelled"
                      ? "bg-red-50 text-red-700"
                      : booking.paid
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700",
                  ].join(" ")}
                >
                  {booking.status === "Cancelled" ? "Cancelled" : booking.paid ? "Paid" : "Pending"}
                </span>
                <span className="text-[13px] font-medium text-black/65">{money(service?.price ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function cardBrandLabel(brand: string) {
    return brand
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((chunk) => chunk.slice(0, 1).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  function paymentStatusClasses(status: BillingPayment["status"]) {
    switch (status) {
      case "Succeeded":
        return "bg-emerald-50 text-emerald-700";
      case "Failed":
        return "bg-red-50 text-red-700";
      case "Cancelled":
        return "bg-black/[0.06] text-black/55";
      case "Refunded":
        return "bg-sky-50 text-sky-700";
      default:
        return "bg-amber-50 text-amber-700";
    }
  }

  function paymentDateLabel(value: string | null) {
    if (!value) return "Pending";
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  async function startCardSetup() {
    if (!stripePromise) {
      showToast("Stripe client setup is missing. Add the publishable key and redeploy.");
      return;
    }

    setStartingCardSetup(true);
    try {
      const response = await fetch("/api/stripe/cards/setup-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: currentCustomer.id,
        }),
      });

      const payload = await response.json();
      if (!response.ok || typeof payload?.clientSecret !== "string") {
        throw new Error(payload?.error || "Could not prepare card setup.");
      }

      setAddCardClientSecret(payload.clientSecret);
      setShowAddCardModal(true);
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not prepare card setup.");
    } finally {
      setStartingCardSetup(false);
    }
  }

  async function removeSavedCard(paymentMethodId: string) {
    const confirmed = window.confirm("Remove this saved card?");
    if (!confirmed) return;

    setDeletingCardId(paymentMethodId);
    try {
      const response = await fetch("/api/stripe/cards", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          paymentMethodId,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Could not remove card.");
      }

      showToast("Card removed.");
      await loadBillingData({ silent: true });
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not remove card.");
    } finally {
      setDeletingCardId(null);
    }
  }

  function resetChargeState() {
    setShowPaymentMethodModal(false);
    setShowChargeModal(false);
    setChargeMethod(null);
    setChargeBookingId("");
    setChargeAmount("");
    setChargeDescription("");
    setChargeTaxEnabled(false);
    setChargeTaxRateId("");
    setChargeFeeEnabled(false);
    setChargeFeeId("");
    setChargeDiscountEnabled(false);
    setChargeDiscount("");
    setChargeReturnTo(null);
    setChargeReturnDate("");
  }

  async function finishChargeSuccess(message: string) {
    const returnTo = chargeReturnTo;
    const returnDate = chargeReturnDate;
    resetChargeState();
    await loadBillingData({ silent: true });

    if (returnTo === "calendar") {
      const params = new URLSearchParams();
      if (returnDate) {
        params.set("date", returnDate);
      }
      params.set("payment", "paid");
      detailRouter.push(`/admin/calendar?${params.toString()}`);
      return;
    }

    showToast(message);
  }

  function openPaymentMethodModal() {
    setShowPaymentMethodModal(true);
  }

  function applyServiceChargeAdjustments(method: "card" | "cash" | "waive") {
    const shouldApplyTax = Boolean(selectedChargeService?.collectTax && availableTaxRates.length);
    const shouldApplyCardFee = Boolean(method === "card" && selectedChargeService?.collectFee && availableCustomFees.length);

    if (!chargeTaxRateId && availableTaxRates[0]) {
      setChargeTaxRateId(availableTaxRates[0].id);
    }
    if (!chargeFeeId && availableCustomFees[0]) {
      setChargeFeeId(availableCustomFees[0].id);
    }

    setChargeTaxEnabled(shouldApplyTax);
    setChargeFeeEnabled(shouldApplyCardFee);
  }

  function chooseChargeMethod(method: "card" | "cash" | "waive" | "scan") {
    if (method === "scan") {
      showToast("Scan card using iPhone is not connected yet. Use Card, Cash, or Waive Payment for now.");
      return;
    }

    if (method === "card" && !defaultCard) {
      showToast("Add a saved card first.");
      return;
    }

    applyServiceChargeAdjustments(method);

    setChargeMethod(method);
    setShowPaymentMethodModal(false);
    setShowChargeModal(true);
  }

  async function submitManualPayment(method: "cash" | "waive") {
    const amountValue = chargeTotal;
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      showToast("Enter a valid charge amount.");
      return;
    }

    setSubmittingCharge(true);
    try {
      const response = await fetch("/api/stripe/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          bookingId: chargeBookingId || undefined,
          amount: amountValue,
          description: chargeDescription,
          method,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not save payment.");
      }

      await finishChargeSuccess(method === "cash" ? "Cash payment recorded." : "Payment waived.");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not save payment.");
    } finally {
      setSubmittingCharge(false);
    }
  }

  async function submitNewCharge() {
    const amountValue = chargeTotal;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showToast("Enter a valid charge amount.");
      return;
    }

    if (!chargeMethod) {
      showToast("Choose a payment method.");
      return;
    }

    if (chargeMethod === "cash" || chargeMethod === "waive") {
      await submitManualPayment(chargeMethod);
      return;
    }

    setSubmittingCharge(true);
    try {
      const response = await fetch("/api/stripe/charges/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          bookingId: chargeBookingId || undefined,
          amount: amountValue,
          description: chargeDescription,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not charge saved card.");
      }
      await finishChargeSuccess("Charge completed.");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not charge saved card.");
    } finally {
      setSubmittingCharge(false);
    }
  }

  function renderProfileTab() {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
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
                    value={firstNameDraft}
                    onChange={(event) => setFirstNameDraft(event.target.value)}
                    onBlur={() => void saveName()}
                    className="min-h-10 w-full rounded-md border border-black/15 px-4 text-[14px] outline-none"
                  />
                  <input
                    value={lastNameDraft}
                    onChange={(event) => setLastNameDraft(event.target.value)}
                    onBlur={() => void saveName()}
                    className="min-h-10 w-full rounded-md border border-black/15 px-4 text-[14px] outline-none"
                  />
                </div>
              </div>
            </div>

            {relatedKidNames.length ? (
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium text-black/85">
                  {relatedKidNames.length === 1 ? "Player" : "Players"}
                </span>
                <div className="flex flex-wrap gap-2">
                  {relatedKidNames.map((kidName) => (
                    <span
                      key={kidName}
                      className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-semibold text-black/75"
                    >
                      {kidName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-black/85">Date of Birth</span>
                {age === "" ? null : <span className="text-[13px] text-black/45">Age: {age}</span>}
              </div>
              <div className="relative">
                <input
                  value={birthDateDraft}
                  onChange={(event) => setBirthDateDraft(formatUsDateInput(event.target.value))}
                  onBlur={() => void saveBirthDate()}
                  placeholder="MM/DD/YYYY"
                  inputMode="numeric"
                  maxLength={10}
                  className="min-h-10 w-full rounded-md border border-black/15 px-4 pr-10 text-[14px] outline-none"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-black/45">
                  <Icon name="calendar" className="h-4 w-4" />
                </div>
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium text-black/85">Gender</span>
              <select
                value={genderDraft || ""}
                onChange={(event) => void saveGender(event.target.value)}
                className="min-h-10 rounded-md border border-black/15 px-4 text-[14px] outline-none"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </label>

            <div className="overflow-hidden rounded-md border border-black/10">
              <button
                type="button"
                onClick={() => setContactOpen((current) => !current)}
                className="flex min-h-10 w-full items-center justify-between bg-black/[0.02] px-4 text-left text-[14px] text-black/55"
              >
                <span>Contact Information</span>
                <Icon
                  name="chevron"
                  className={["h-4 w-4 transition-transform", contactOpen ? "-rotate-90" : "rotate-90"].join(" ")}
                />
              </button>
              {contactOpen ? (
                <div className="grid gap-4 p-4">
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium text-black/85">Email</span>
                    <div className="relative">
                      <input
                        value={emailDraft}
                        onChange={(event) => setEmailDraft(event.target.value)}
                        onBlur={() => void saveEmail()}
                        className="min-h-10 w-full rounded-md border border-black/15 px-4 pr-16 text-[14px] outline-none"
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center gap-2 text-black/45">
                        <Icon name="edit" className="h-4 w-4" />
                        <Icon name="copy" className="h-4 w-4" />
                      </div>
                    </div>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium text-black/85">Phone</span>
                    <input
                      value={profilePhone}
                      onChange={(event) => setProfilePhone(formatUsPhoneInput(event.target.value))}
                      onBlur={() => void savePhone()}
                      inputMode="numeric"
                      maxLength={14}
                      className="min-h-10 rounded-md border border-black/15 px-4 text-[14px] outline-none"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-medium text-black/85">Address</span>
                    <input
                      value={addressDraft}
                      onChange={(event) => setAddressDraft(event.target.value)}
                      onBlur={() => void saveAddress()}
                      className="min-h-10 rounded-md border border-black/15 px-4 text-[14px] outline-none"
                    />
                  </label>
                </div>
              ) : null}
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
                  <div className="text-[14px] font-medium text-black">
                    {currentCustomer.emergencyContactName || "Emergency Contact"}
                  </div>
                  <div className="mt-1 text-[13px] text-black/55">
                    {[
                      currentCustomer.emergencyContactEmail,
                      currentCustomer.emergencyContactPhone ? formatUsPhoneInput(currentCustomer.emergencyContactPhone) : "",
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
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
                      onClick={() => void saveEmergencyContact()}
                      className="inline-flex min-h-10 items-center rounded-lg bg-black px-6 text-[14px] font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </DetailPanel>

          <DetailPanel
            title="Custom Fields"
            action={<button type="button" className="text-2xl leading-none text-black/45">+</button>}
          >
            <div className="flex items-center justify-between gap-4 p-4 text-[14px]">
              <div className="flex items-center gap-3 text-black/65">
                <Icon name="send" className="h-4 w-4" />
                <span>Referral</span>
              </div>
              <div className="ml-auto text-black/85">{currentCustomer.notes ? "From notes" : "-"}</div>
              <div className="flex gap-3 text-black/45">
                <button type="button">
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button type="button" className="text-xl leading-none">
                  ...
                </button>
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
                {familyMembers.map((member) => {
                  const memberName = [member.firstName, member.lastName].filter(Boolean).join(" ");
                  const memberMeta = [
                    member.gender !== "Unspecified" ? member.gender : "",
                    familyMemberAgeLabel(member),
                  ]
                    .filter(Boolean)
                    .join(" \u00b7 ");

                  return (
                    <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-4">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-black/[0.04] text-[13px] font-medium text-black/60">
                          {`${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[14px] font-medium text-black">{memberName || "Family Member"}</div>
                          <div className="mt-0.5 text-[13px] text-black/55">{memberMeta || "Member"}</div>
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
                          onClick={() => {
                            void saveFamilyMembers(
                              familyMembers.filter((item) => item.id !== member.id),
                              "Family member removed."
                            );
                          }}
                          tone="danger"
                        />
                      </div>
                    </div>
                  );
                })}
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
                    {currentCustomer.waiverAgreed ? "Agreed" : "Not yet agreed"}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                    currentCustomer.waiverAgreed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {currentCustomer.waiverAgreed ? "Agreed" : "Pending"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium text-black">Email marketing</div>
                  <div className="mt-1 text-[13px] text-black/55">Opted in to receive marketing emails</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMarketingEnabled((current) => !current)}
                  className={[
                    "relative h-6 w-11 rounded-full transition-colors",
                    marketingEnabled ? "bg-black" : "bg-black/15",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      marketingEnabled ? "right-0.5" : "left-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Notes"
            action={
              !isEditingNote ? (
                <button type="button" onClick={openAddNote} className="text-2xl leading-none text-black/45">
                  +
                </button>
              ) : undefined
            }
          >
            {isEditingNote ? (
              <div className="grid gap-3 p-4">
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-black/15 px-4 py-3 text-[14px] outline-none"
                  placeholder="Add a note..."
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft(currentCustomer.notes ?? "");
                      setIsEditingNote(false);
                    }}
                    className="rounded-md border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveNotes()}
                    className="rounded-md bg-black px-5 py-2 text-[14px] font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-7 text-center text-[14px] text-black/45">
                {currentCustomer.notes ? currentCustomer.notes : "No notes yet. Click + to add the first note."}
              </div>
            )}
          </DetailPanel>
        </div>
      </div>
    );
  }

  function renderBillingTab() {
    const billingTabs: CustomerBillingSubtab[] = ["Payments", "Wallet", "Saved Cards"];

    return (
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-[13px] text-black/45">
                  <Icon name="file" className="h-4 w-4" />
                  Wallet Balance
                </div>
                <div className="mt-3 text-[24px] font-medium text-black">{moneyPrecise(walletBalance)}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openPaymentMethodModal}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-black px-4 text-[14px] font-medium text-white shadow-sm"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Charge
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-4 text-[14px] font-medium text-black/30"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Redeem
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="inline-flex items-center gap-2 text-[13px] text-black/45">
              <Icon name="file" className="h-4 w-4" />
              Default Card
            </div>
            <div className="mt-3 text-[16px] text-black/55">
              {billingLoading && !billingLoaded
                ? "Loading..."
                : defaultCard
                  ? `${cardBrandLabel(defaultCard.brand)} ending in ${defaultCard.last4}`
                  : "No card on file"}
            </div>
            {defaultCard ? (
              <div className="mt-1 text-[13px] text-black/45">
                Expires {String(defaultCard.expMonth).padStart(2, "0")}/{defaultCard.expYear}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void startCardSetup()}
              disabled={startingCardSetup}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-black/12 bg-white px-4 text-[14px] font-medium text-black"
            >
              {startingCardSetup ? "Preparing..." : defaultCard ? "Replace Card" : "Add Card"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 border-b border-black/10 px-1">
          {billingTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveBillingTab(tab)}
              className={[
                "border-b-2 px-2 pb-3 text-[14px] font-medium transition-colors",
                activeBillingTab === tab ? "border-black text-black" : "border-transparent text-black/50 hover:text-black",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeBillingTab === "Payments" ? (
          <DetailPanel title="Payment History">
            <div className="border-b border-black/10 px-5 py-4 lg:flex lg:items-start lg:justify-between lg:gap-4">
              <div>
                <div className="text-[14px] text-black/55">
                  For more details, visit the{" "}
                  <Link href="/admin/reports" className="text-[#5b83b8] underline underline-offset-2">
                    Sales and Revenue reports
                  </Link>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 lg:mt-0 lg:justify-end">
                <button
                  type="button"
                  onClick={() => void loadBillingData()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/12 bg-white px-4 text-[14px] font-medium text-black"
                >
                  <Icon name="refresh" className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={openPaymentMethodModal}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-black px-4 text-[14px] font-medium text-white shadow-sm"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  New Charge
                </button>
              </div>
            </div>

            {billingError ? <div className="border-b border-black/10 px-5 py-3 text-[14px] text-red-700">{billingError}</div> : null}

            {billingLoading && !billingLoaded ? (
              <div className="grid min-h-[240px] place-items-center px-6 py-12 text-center">
                <div className="text-[14px] text-black/45">Loading payments...</div>
              </div>
            ) : billingPayments.length ? (
              <div className="divide-y divide-black/10">
                {billingPayments.map((payment) => (
                  <div key={payment.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-black">
                        {payment.description || "Stripe payment"}
                      </div>
                      <div className="mt-1 text-[13px] text-black/55">
                        {paymentDateLabel(payment.processedAt || payment.createdAt)}
                        {payment.paymentMethodBrand || payment.paymentMethodLast4
                          ? ` - ${[
                              payment.paymentMethodBrand ? cardBrandLabel(payment.paymentMethodBrand) : "",
                              payment.paymentMethodLast4 ? `**** ${payment.paymentMethodLast4}` : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={["rounded-full px-3 py-1 text-[12px] font-semibold", paymentStatusClasses(payment.status)].join(" ")}>
                        {payment.status}
                      </span>
                      {payment.receiptUrl ? (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[13px] font-medium text-[#5b83b8] underline underline-offset-2"
                        >
                          Receipt
                        </a>
                      ) : null}
                    </div>
                    <div className="text-[14px] font-semibold text-black lg:text-right">
                      {moneyPrecise(payment.amountCents / 100, payment.currency.toUpperCase())}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[240px] place-items-center px-6 py-12 text-center">
                <div>
                  <div className="text-[15px] font-medium text-black">No payments</div>
                  <div className="mt-2 text-[14px] text-black/45">This customer has no payments.</div>
                </div>
              </div>
            )}
          </DetailPanel>
        ) : null}

        {activeBillingTab === "Wallet" ? (
          <DetailPanel title="Wallet Activity">
            <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center">
              <div>
                <div className="text-[15px] font-medium text-black">No wallet activity</div>
                <div className="mt-2 text-[14px] text-black/45">Wallet transactions will appear here.</div>
              </div>
            </div>
          </DetailPanel>
        ) : null}

        {activeBillingTab === "Saved Cards" ? (
          <DetailPanel title="Saved Cards">
            <div className="border-b border-black/10 px-5 py-4">
              <button
                type="button"
                onClick={() => void startCardSetup()}
                disabled={startingCardSetup}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-black px-4 text-[14px] font-medium text-white shadow-sm"
              >
                <Icon name="plus" className="h-4 w-4" />
                {startingCardSetup ? "Preparing..." : "Add Card"}
              </button>
            </div>

            {billingLoading && !billingLoaded ? (
              <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center">
                <div className="text-[14px] text-black/45">Loading saved cards...</div>
              </div>
            ) : billingCards.length ? (
              <div className="divide-y divide-black/10">
                {billingCards.map((card) => (
                  <div key={card.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2 text-[14px] font-medium text-black">
                        <span>{cardBrandLabel(card.brand)}</span>
                        <span>**** {card.last4}</span>
                        {card.id === defaultPaymentMethodId ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[13px] text-black/45">
                        Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeSavedCard(card.id)}
                      disabled={deletingCardId === card.id}
                      className="rounded-lg border border-black/12 px-4 py-2 text-[13px] font-medium text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      {deletingCardId === card.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center">
                <div>
                  <div className="text-[15px] font-medium text-black">No saved cards</div>
                  <div className="mt-2 text-[14px] text-black/45">Cards saved for this customer will appear here.</div>
                </div>
              </div>
            )}
          </DetailPanel>
        ) : null}
      </div>
    );
  }

  function renderMembershipTab() {
    const membershipAssignment = (
      <div className="border-b border-black/10 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="mb-1 block text-[13px] font-semibold text-black">Assign membership</span>
            <select
              value={membershipServiceDraft}
              onChange={(event) => setMembershipServiceDraft(event.target.value)}
              className="h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-[14px] text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-black/[0.04] disabled:text-black/35"
              disabled={!availableMembershipServices.length || Boolean(membershipActionId)}
            >
              <option value="">Select membership</option>
              {availableMembershipServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - {money(service.price)} / {service.membershipBillingPeriod ?? "Monthly"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void assignSelectedMembership()}
            disabled={!membershipServiceDraft || Boolean(membershipActionId)}
            className="self-end rounded-lg bg-black px-4 py-3 text-[13px] font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-black/20"
          >
            {membershipActionId === "assign" ? "Assigning..." : "Assign membership"}
          </button>
        </div>
        {!membershipServices.length ? (
          <p className="mt-2 text-[13px] text-black/45">
            Create memberships in Services before assigning them to customers.
          </p>
        ) : !availableMembershipServices.length ? (
          <p className="mt-2 text-[13px] text-black/45">
            All configured memberships are already active for this customer.
          </p>
        ) : null}
      </div>
    );

    return (
      <DetailPanel title="Memberships">
        {membershipAssignment}
        {membershipCards.length ? (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {membershipCards.map((membership) => {
              const membershipName = membership.service?.name || "Membership";
              const periodLabel =
                membership.currentPeriodStart && membership.currentPeriodEnd
                  ? `${formatMembershipDate(membership.currentPeriodStart)} - ${formatMembershipDate(membership.currentPeriodEnd)}`
                  : "Billing cycle not set";

              return (
                <div key={membership.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-semibold text-black">{membershipName}</div>
                      <div className="mt-1 text-[13px] text-black/55">
                        {membership.billingPeriod} membership
                        {membership.autoRenew ? " - Auto renews" : " - Manual renewal"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${membershipStatusClasses(membership.status)}`}
                      >
                        {membership.status}
                      </span>
                      {isActiveCustomerMembership(membership) && membership.autoRenew ? (
                        <button
                          type="button"
                          onClick={() => openCancelMembershipDialog(membership)}
                          disabled={membershipActionId === membership.id}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] font-semibold text-black/65 hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {membershipActionId === membership.id ? "Cancelling..." : "Cancel"}
                        </button>
                      ) : isActiveCustomerMembership(membership) && !membership.autoRenew ? (
                        <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700">
                          Ends at period end
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-black/8 bg-black/[0.02] px-3 py-3">
                      <div className="text-[12px] uppercase tracking-[0.08em] text-black/40">Price</div>
                      <div className="mt-1 text-[15px] font-semibold text-black">{money(membership.priceCents / 100)}</div>
                    </div>
                    <div className="rounded-xl border border-black/8 bg-black/[0.02] px-3 py-3">
                      <div className="text-[12px] uppercase tracking-[0.08em] text-black/40">
                        {membershipCreditLimitPeriodAdjective(membership.creditLimitPeriod)} credits
                      </div>
                      <div className="mt-1 text-[15px] font-semibold text-black">
                        {membershipCreditAllowanceLabel(membership.creditsPerDay, membership.creditLimitPeriod)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-[13px] text-black/65">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-black/45">Credit scope</span>
                      <span className="max-w-[70%] text-right text-black">{membershipCreditScopeLabel(membership, servicesById)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-black/45">Current period</span>
                      <span className="max-w-[70%] text-right text-black">{periodLabel}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-black/45">Started</span>
                      <span className="text-right text-black">{formatMembershipDate(membership.startedAt || membership.createdAt)}</span>
                    </div>
                    {membership.cancelledAt ? (
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-black/45">Cancelled</span>
                        <span className="text-right text-black">{formatMembershipDate(membership.cancelledAt)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : legacyMemberships.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {legacyMemberships.map((membership) => (
              <div key={membership} className="rounded-xl border border-black/10 bg-black/[0.02] p-4">
                <div className="text-[15px] font-medium text-black">{membership}</div>
                <div className="mt-1 text-[13px] text-black/55">Legacy membership record</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-black/45">No memberships assigned.</div>
        )}
      </DetailPanel>
    );
  }

  function renderPackagesTab() {
    return (
      <DetailPanel title="Packages">
        {topPackages.length ? (
          <div className="divide-y divide-black/10">
            {topPackages.map(([serviceName, count]) => (
              <div key={serviceName} className="flex items-center justify-between px-4 py-4 text-[14px]">
                <span className="font-medium text-black">{serviceName}</span>
                <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[12px] font-semibold text-black/65">
                  {count} booking{count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-black/45">No package activity yet.</div>
        )}
      </DetailPanel>
    );
  }

  function renderActivityTab() {
    return (
      <DetailPanel title="Activity">
        <BookingRows />
      </DetailPanel>
    );
  }

  function renderInvoicesTab() {
    return (
      <DetailPanel title="Invoices">
        {customerBookings.length ? (
          <div className="divide-y divide-black/10">
            {customerBookings.map((booking) => {
              const service = servicesById.get(booking.serviceId);
              return (
                <div key={booking.id} className="flex items-center justify-between gap-4 px-4 py-4 text-[14px]">
                  <div>
                    <div className="font-medium text-black">{booking.serviceName || service?.name || "Service"}</div>
                    <div className="mt-1 text-[13px] text-black/55">{bookingDateLabel(booking.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-black">{money(service?.price ?? 0)}</div>
                    <div className="mt-1 text-[13px] text-black/55">{booking.paid ? "Paid" : "Awaiting payment"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-sm text-black/45">No invoices available.</div>
        )}
      </DetailPanel>
    );
  }

  function renderCreditsTab() {
    return (
      <DetailPanel title="Credits">
        {creditMemberships.length ? (
          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-4">
              <div className="text-[12px] uppercase tracking-[0.08em] text-black/40">Credit allowance</div>
              <div className="mt-2 text-[28px] font-semibold text-black">{totalCreditAllowance}</div>
              <div className="mt-1 text-[13px] text-black/55">
                Across {creditMemberships.length} active membership{creditMemberships.length === 1 ? "" : "s"}.
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {creditMemberships.map((membership) => (
                <div key={membership.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-black">{membership.service?.name || "Membership"}</div>
                      <div className="mt-1 text-[13px] text-black/55">
                        {membershipCreditAllowanceLabel(membership.creditsPerDay, membership.creditLimitPeriod)}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${membershipStatusClasses(membership.status)}`}
                    >
                      {membership.status}
                    </span>
                  </div>
                  <div className="mt-3 text-[13px] text-black/65">
                    Eligible services: <span className="text-black">{membershipCreditScopeLabel(membership, servicesById)}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-black/65">
                    Current period:{" "}
                    <span className="text-black">
                      {membership.currentPeriodStart && membership.currentPeriodEnd
                        ? `${formatMembershipDate(membership.currentPeriodStart)} - ${formatMembershipDate(membership.currentPeriodEnd)}`
                        : "Not set"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-sm text-black/45">No active membership credits available for this customer.</div>
        )}
      </DetailPanel>
    );
  }

  const tabContent: Record<CustomerDetailTab, React.ReactNode> = {
    Profile: renderProfileTab(),
    Billing: renderBillingTab(),
    Memberships: renderMembershipTab(),
    Packages: renderPackagesTab(),
    Activity: renderActivityTab(),
    Invoices: renderInvoicesTab(),
    Credits: renderCreditsTab(),
  };

  return (
    <>
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
                {customer.phone ? formatUsPhoneInput(customer.phone) : "No phone"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" className="h-3.5 w-3.5" />
                {joinedLabel ? `Joined ${joinedLabel}` : "Recently joined"}
              </span>
              {primaryPlayerLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="user" className="h-3.5 w-3.5" />
                  Player: {primaryPlayerLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 lg:justify-end">
          <button
            type="button"
            onClick={() => {
              if (customer.email) {
                window.location.href = `mailto:${customer.email}`;
              }
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/12 bg-white px-4 text-[14px] font-medium"
          >
            <Icon name="message" className="h-3.5 w-3.5" />
            Email
          </button>
          <button
            type="button"
            onClick={openAddNote}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/12 bg-white px-4 text-[14px] font-medium"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            Add note
          </button>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-black/12 bg-white text-lg leading-none">
            ...
          </button>
        </div>
      </div>

      <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-black/[0.05] p-1 text-[14px]">
        {tabLabels.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              const nextParams = new URLSearchParams(detailSearchParams.toString());
              nextParams.set("tab", tab.toLowerCase());
              detailRouter.replace(`${detailPathname}?${nextParams.toString()}`, { scroll: false });
            }}
            className={[
              "rounded-lg px-3.5 py-1.5 font-medium transition-colors",
              activeTab === tab ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5">{tabContent[activeTab]}</div>

      {showFamilyModal ? (
        <FamilyMemberModal
          initialMember={editingFamilyMember}
          onClose={() => {
            setShowFamilyModal(false);
            setEditingFamilyMember(null);
          }}
          onSave={async (member) => {
            const nextFamilyMembers = editingFamilyMember
              ? familyMembers.map((item) => (item.id === member.id ? member : item))
              : [...familyMembers, member];
            const saved = await saveFamilyMembers(
              nextFamilyMembers,
              editingFamilyMember ? "Family member updated." : "Family member added."
            );
            if (saved) {
              setShowFamilyModal(false);
              setEditingFamilyMember(null);
            }
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

      {membershipCancelDraft ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-[18px] font-semibold text-black">Cancel Membership</h2>
                <p className="mt-1 text-[13px] text-black/55">
                  {servicesById.get(membershipCancelDraft.membershipServiceId)?.name || "Membership"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMembershipCancelDraft(null);
                  setMembershipCancelTiming("period_end");
                  setMembershipCancelRefundProrated(false);
                }}
                className="text-black/45"
                aria-label="Close cancel membership dialog"
              >
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-3 px-6 py-5">
              <button
                type="button"
                onClick={() => setMembershipCancelTiming("period_end")}
                className={[
                  "rounded-xl border px-4 py-3 text-left transition",
                  membershipCancelTiming === "period_end"
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black hover:bg-black/[0.03]",
                ].join(" ")}
              >
                <span className="block text-[15px] font-semibold">Cancel at end of billing period</span>
                <span className={membershipCancelTiming === "period_end" ? "mt-1 block text-[13px] text-white/70" : "mt-1 block text-[13px] text-black/55"}>
                  Keep the membership active until {formatMembershipDate(membershipCancelDraft.currentPeriodEnd)} and stop auto renewal.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMembershipCancelTiming("immediate")}
                className={[
                  "rounded-xl border px-4 py-3 text-left transition",
                  membershipCancelTiming === "immediate"
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black hover:bg-black/[0.03]",
                ].join(" ")}
              >
                <span className="block text-[15px] font-semibold">Cancel right away</span>
                <span className={membershipCancelTiming === "immediate" ? "mt-1 block text-[13px] text-white/70" : "mt-1 block text-[13px] text-black/55"}>
                  End access now. Stripe subscription cancellation is processed immediately when connected.
                </span>
              </button>

              {membershipCancelTiming === "immediate" ? (
                <label className="mt-1 flex items-start gap-3 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(membershipCancelDraft.stripeSubscriptionId) && membershipCancelRefundProrated}
                    disabled={!membershipCancelDraft.stripeSubscriptionId}
                    onChange={(event) => setMembershipCancelRefundProrated(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold text-black">Refund prorated unused time to card</span>
                    <span className="mt-1 block text-[13px] leading-5 text-black/55">
                      {membershipCancelDraft.stripeSubscriptionId
                        ? "Refunds the unused portion of the current billing period against the last paid Stripe invoice when available."
                        : "This membership is not linked to a Stripe subscription, so no card refund can be issued."}
                    </span>
                  </span>
                </label>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setMembershipCancelDraft(null);
                  setMembershipCancelTiming("period_end");
                  setMembershipCancelRefundProrated(false);
                }}
                className="rounded-lg border border-black/10 px-4 py-2.5 text-[14px] font-medium text-black/65"
              >
                Keep Membership
              </button>
              <button
                type="button"
                onClick={() => void cancelSelectedMembership()}
                disabled={membershipActionId === membershipCancelDraft.id}
                className="rounded-lg bg-black px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-black/20"
              >
                {membershipActionId === membershipCancelDraft.id ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPaymentMethodModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[18px] font-semibold text-black">Payment Method</h2>
              <button
                type="button"
                onClick={resetChargeState}
                className="text-black/45"
                aria-label="Close payment method modal"
              >
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-3 px-6 py-5">
              <button
                type="button"
                onClick={() => chooseChargeMethod("card")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Card</span>
                  <span className="block text-[13px] text-black/55">
                    Charge the saved card on file.
                  </span>
                </span>
                <Icon name="bag" className="h-5 w-5 text-black/45" />
              </button>

              <button
                type="button"
                onClick={() => chooseChargeMethod("cash")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Cash</span>
                  <span className="block text-[13px] text-black/55">
                    Record a cash payment and mark it paid.
                  </span>
                </span>
                <Icon name="file" className="h-5 w-5 text-black/45" />
              </button>

              <button
                type="button"
                onClick={() => chooseChargeMethod("scan")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Scan card using iPhone</span>
                  <span className="block text-[13px] text-black/55">
                    Use Tap to Pay style checkout when connected.
                  </span>
                </span>
                <Icon name="phone" className="h-5 w-5 text-black/45" />
              </button>

              <button
                type="button"
                onClick={() => chooseChargeMethod("waive")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Waive payment</span>
                  <span className="block text-[13px] text-black/55">
                    Mark the balance waived without charging.
                  </span>
                </span>
                <Icon name="check" className="h-5 w-5 text-black/45" />
              </button>
            </div>

            <div className="flex items-center justify-end border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={resetChargeState}
                className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showChargeModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[18px] font-semibold text-black">
                {chargeMethod === "cash"
                  ? "Record Cash Payment"
                  : chargeMethod === "waive"
                    ? "Waive Payment"
                    : "New Charge"}
              </h2>
              <button
                type="button"
                onClick={resetChargeState}
                className="text-black/45"
                aria-label="Close charge modal"
              >
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                <div className="grid gap-4 self-start">
                  <div className="rounded-2xl border border-black/8 bg-black/[0.015] p-4">
                    <div className="grid gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-black/85">Price</span>
                        <div className="flex h-12 items-center rounded-lg border border-black/12 bg-white pl-4 pr-4">
                          <span className="pointer-events-none shrink-0 text-[18px] leading-none text-black/45">
                            $
                          </span>
                          <input
                            value={chargeAmount}
                            onChange={(event) => setChargeAmount(event.target.value.replace(/[^\d.]/g, ""))}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="h-12 w-full border-0 bg-transparent pl-3 pr-0 text-[16px] outline-none"
                          />
                        </div>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-black/85">Description</span>
                        <textarea
                          value={chargeDescription}
                          onChange={(event) => setChargeDescription(event.target.value)}
                          placeholder={`Manual charge for ${customer.name}`}
                          rows={4}
                          className="min-h-[116px] w-full resize-none rounded-lg border border-black/12 px-4 py-3 text-[15px] leading-6 outline-none"
                        />
                      </label>

                      <div className="rounded-xl border border-black/8 bg-white px-4 py-3 text-[13px] leading-5 text-black/55">
                        {chargeMethod === "cash"
                          ? "This will record a cash payment and mark this balance as paid."
                          : chargeMethod === "waive"
                            ? "This will waive the balance and mark this booking as paid."
                            : "This will charge the customer's saved default card immediately."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="self-start rounded-2xl border border-black/10 bg-white">
                  <div className="border-b border-black/8 px-4 py-3">
                    <p className="text-[14px] font-semibold text-black">Invoice Summary</p>
                  </div>
                  <div className="grid gap-3 px-4 py-4">
                    <div className="flex items-center justify-between gap-4 text-[14px]">
                      <span className="text-black/65">Subtotal</span>
                      <span className="text-[15px] font-semibold text-black">{moneyPrecise(chargeSubtotal)}</span>
                    </div>

                    <div className="rounded-xl border border-black/8 px-3 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-black">Tax</p>
                          <p className="text-[12px] text-black/45">
                            {chargeTaxEnabled && selectedChargeTaxRate
                              ? `${selectedChargeTaxRate.name} (${selectedChargeTaxRate.percentage}%)`
                              : "Not applied"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (chargeTaxEnabled) {
                              setChargeTaxEnabled(false);
                              return;
                            }
                            if (availableTaxRates[0] && !chargeTaxRateId) {
                              setChargeTaxRateId(availableTaxRates[0].id);
                            }
                            setChargeTaxEnabled(true);
                          }}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70"
                        >
                          {chargeTaxEnabled ? "Remove" : "Add"}
                        </button>
                      </div>
                      {chargeTaxEnabled ? (
                        <div className="grid gap-2">
                          <select
                            value={chargeTaxRateId}
                            onChange={(event) => setChargeTaxRateId(event.target.value)}
                            className="h-10 w-full rounded-lg border border-black/12 px-3 text-[14px] outline-none"
                          >
                            {availableTaxRates.map((rate) => (
                              <option key={rate.id} value={rate.id}>
                                {rate.name} ({rate.percentage}%)
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between gap-4 text-[13px]">
                            <span className="text-black/55">Tax amount</span>
                            <span className="font-medium text-black">{moneyPrecise(chargeTaxAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-black/8 px-3 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-black">Service Fee</p>
                          <p className="text-[12px] text-black/45">
                            {chargeFeeEnabled && selectedChargeFee
                              ? `${selectedChargeFee.name} (${selectedChargeFee.amount}%)`
                              : "Not applied"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (chargeFeeEnabled) {
                              setChargeFeeEnabled(false);
                              return;
                            }
                            if (availableCustomFees[0] && !chargeFeeId) {
                              setChargeFeeId(availableCustomFees[0].id);
                            }
                            setChargeFeeEnabled(true);
                          }}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70"
                        >
                          {chargeFeeEnabled ? "Remove" : "Add"}
                        </button>
                      </div>
                      {chargeFeeEnabled ? (
                        <div className="grid gap-2">
                          <select
                            value={chargeFeeId}
                            onChange={(event) => setChargeFeeId(event.target.value)}
                            className="h-10 w-full rounded-lg border border-black/12 px-3 text-[14px] outline-none"
                          >
                            {availableCustomFees.map((fee) => (
                              <option key={fee.id} value={fee.id}>
                                {fee.name} ({fee.amount}%)
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between gap-4 text-[13px]">
                            <span className="text-black/55">Service fee amount</span>
                            <span className="font-medium text-black">{moneyPrecise(chargeFeeAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-black/8 px-3 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-black">Discount</p>
                          <p className="text-[12px] text-black/45">
                            {chargeDiscountEnabled
                              ? chargeDiscountAmount > 0
                                ? `${moneyPrecise(chargeDiscountAmount)} off`
                                : "Enter a discount amount"
                              : "Not applied"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (chargeDiscountEnabled) {
                              setChargeDiscountEnabled(false);
                              setChargeDiscount("");
                              return;
                            }
                            setChargeDiscountEnabled(true);
                          }}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70"
                        >
                          {chargeDiscountEnabled ? "Remove" : "Add"}
                        </button>
                      </div>
                      {chargeDiscountEnabled ? (
                        <div className="grid gap-2">
                          <label className="grid gap-1.5">
                            <span className="text-[13px] text-black/55">Discount amount</span>
                            <div className="flex h-10 items-center rounded-lg border border-black/12 bg-white pl-3 pr-3">
                              <span className="pointer-events-none shrink-0 text-[15px] leading-none text-black/45">
                                $
                              </span>
                              <input
                                value={chargeDiscount}
                                onChange={(event) => setChargeDiscount(event.target.value.replace(/[^\d.]/g, ""))}
                                inputMode="decimal"
                                placeholder="0.00"
                                className="h-10 w-full border-0 bg-transparent pl-2 text-[14px] outline-none"
                              />
                            </div>
                          </label>
                          <div className="flex items-center justify-between gap-4 text-[13px]">
                            <span className="text-black/55">Discount applied</span>
                            <span className="font-medium text-red-600">-{moneyPrecise(chargeDiscountAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-black/8 pt-3 text-[15px]">
                      <span className="font-semibold text-black">Total</span>
                      <span className="text-[18px] font-semibold text-black">{moneyPrecise(chargeTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={resetChargeState}
                className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitNewCharge()}
                disabled={submittingCharge}
                className="rounded-lg bg-black px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {submittingCharge
                  ? chargeMethod === "cash"
                    ? "Saving..."
                    : chargeMethod === "waive"
                      ? "Saving..."
                      : "Charging..."
                  : chargeMethod === "cash"
                    ? "Record cash payment"
                    : chargeMethod === "waive"
                      ? "Waive payment"
                      : "Charge card"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddCardModal && addCardClientSecret ? (
        <AddCardModal
          customer={currentCustomer}
          clientSecret={addCardClientSecret}
          onClose={() => {
            setShowAddCardModal(false);
            setAddCardClientSecret("");
          }}
          onSaved={async () => {
            setShowAddCardModal(false);
            setAddCardClientSecret("");
            await loadBillingData({ silent: true });
            showToast("Card added.");
          }}
          onError={(message) => showToast(message)}
        />
      ) : null}
    </>
  );
}

type AddCardModalProps = {
  customer: Customer;
  clientSecret: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (message: string) => void;
};

function AddCardModal({ customer, clientSecret, onClose, onSaved, onError }: AddCardModalProps) {
  if (!stripePromise) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[86] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
          <h2 className="text-[18px] font-semibold text-black">Add Card</h2>
          <button type="button" onClick={onClose} className="text-black/45" aria-label="Close add card modal">
            <Icon name="x" className="h-6 w-6" />
          </button>
        </div>

        <Elements stripe={stripePromise} key={clientSecret}>
          <AddCardModalForm
            customer={customer}
            clientSecret={clientSecret}
            onClose={onClose}
            onSaved={onSaved}
            onError={onError}
          />
        </Elements>
      </div>
    </div>
  );
}

type AddCardModalFormProps = {
  customer: Customer;
  clientSecret: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (message: string) => void;
};

function AddCardModalForm({ customer, clientSecret, onClose, onSaved, onError }: AddCardModalFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState(customer.name || customer.player || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage("Card form is not ready yet.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName || customer.name || undefined,
            email: customer.email || undefined,
            phone: customer.phone || undefined,
          },
        },
      });

      if (result.error) {
        throw new Error(result.error.message || "Could not save card.");
      }

      if (!result.setupIntent || result.setupIntent.status !== "succeeded") {
        throw new Error("Card setup is not complete yet.");
      }

      const response = await fetch("/api/stripe/cards/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customer.id,
          setupIntentId: result.setupIntent.id,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not save card.");
      }

      await onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save card.";
      console.error(error);
      setErrorMessage(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-4 px-6 py-5">
        <label className="grid gap-1.5">
          <span className="text-[13px] font-medium text-black/85">Cardholder name</span>
          <input
            value={cardholderName}
            onChange={(event) => setCardholderName(event.target.value)}
            placeholder={customer.name || "Full name on card"}
            className="min-h-11 w-full rounded-lg border border-black/12 px-4 text-[15px] outline-none"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-medium text-black/85">Card information</span>
          <div className="rounded-lg border border-black/12 px-4 py-3">
            <CardElement
              options={{
                hidePostalCode: false,
                style: {
                  base: {
                    fontSize: "15px",
                    color: "#111111",
                    "::placeholder": {
                      color: "rgba(17,17,17,0.38)",
                    },
                  },
                },
              }}
            />
          </div>
        </label>

        <div className="rounded-xl border border-black/8 bg-black/[0.02] px-4 py-3 text-[13px] text-black/55">
          This saves the card to the customer and makes it the default payment method for future charges.
        </div>

        {errorMessage ? <div className="text-[13px] font-medium text-red-700">{errorMessage}</div> : null}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="rounded-lg bg-black px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save card"}
        </button>
      </div>
    </form>
  );
}

type CalendarChargeModalProps = {
  booking: Booking;
  customer: Customer;
  service: Service | null;
  customers: Customer[];
  taxesAndFees: AppState["taxesAndFees"];
  customerMembershipsByCustomerId: Record<string, CustomerMembershipRecord[]>;
  membershipCreditLedger: MembershipCreditLedgerEntry[];
  services: Service[];
  showToast: (message: string) => void;
  onClose: () => void;
  onPaid: (bookingId: string, message: string) => void;
  onMembershipCreditPaid: (bookingId: string, membershipId: string, message: string) => void;
};

function CalendarChargeModal({
  booking,
  customer,
  service,
  customers,
  taxesAndFees,
  customerMembershipsByCustomerId,
  membershipCreditLedger,
  services,
  showToast,
  onClose,
  onPaid,
  onMembershipCreditPaid,
}: CalendarChargeModalProps) {
  const [billingCards, setBillingCards] = useState<BillingCard[]>([]);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(true);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeMethod, setChargeMethod] = useState<"card" | "cash" | "waive" | null>(null);
  const [chargeAmount, setChargeAmount] = useState(service ? String(service.price) : "");
  const [chargeDescription, setChargeDescription] = useState(
    [
      booking.serviceName || service?.name || "Booking charge",
      booking.date,
      `${booking.start} - ${booking.end}`,
      booking.resource,
    ]
      .filter(Boolean)
      .join(" | ")
  );
  const [chargeTaxEnabled, setChargeTaxEnabled] = useState(false);
  const [chargeTaxRateId, setChargeTaxRateId] = useState("");
  const [chargeFeeEnabled, setChargeFeeEnabled] = useState(false);
  const [chargeFeeId, setChargeFeeId] = useState("");
  const [chargeDiscountEnabled, setChargeDiscountEnabled] = useState(false);
  const [chargeDiscount, setChargeDiscount] = useState("");
  const [submittingCharge, setSubmittingCharge] = useState(false);

  const availableTaxRates = taxesAndFees.taxRates;
  const availableCustomFees = taxesAndFees.customFees;
  const selectedChargeTaxRate = availableTaxRates.find((item) => item.id === chargeTaxRateId) ?? null;
  const selectedChargeFee = availableCustomFees.find((item) => item.id === chargeFeeId) ?? null;
  const chargeSubtotal = Number.isFinite(Number(chargeAmount)) ? Number(chargeAmount) : 0;
  const chargeTaxPercent = chargeTaxEnabled ? Number(selectedChargeTaxRate?.percentage ?? 0) : 0;
  const chargeFeePercent = chargeFeeEnabled ? Number(selectedChargeFee?.amount ?? 0) : 0;
  const chargeTaxAmount =
    chargeTaxEnabled && Number.isFinite(chargeTaxPercent) ? (chargeSubtotal * chargeTaxPercent) / 100 : 0;
  const chargeFeeAmount =
    chargeFeeEnabled && Number.isFinite(chargeFeePercent) ? (chargeSubtotal * chargeFeePercent) / 100 : 0;
  const chargeDiscountAmountRaw = Number.isFinite(Number(chargeDiscount)) ? Number(chargeDiscount) : 0;
  const chargeDiscountAmount = chargeDiscountEnabled ? Math.max(0, chargeDiscountAmountRaw) : 0;
  const chargeTotal = Math.max(0, chargeSubtotal + chargeTaxAmount + chargeFeeAmount - chargeDiscountAmount);
  const defaultCard = billingCards.find((card) => card.id === defaultPaymentMethodId) ?? null;
  const membershipCreditOptions = useMemo(() => {
    const bookingService =
      services.find((item) => item.id === booking.serviceId) ??
      services.find(
        (item) =>
          normalizeServiceIdentifier(item.name) === normalizeServiceIdentifier(booking.serviceName)
      ) ??
      service ??
      null;
    const bookingServiceName = bookingService?.name || booking.serviceName || "";
    const bookingServiceAliases = Array.from(
      new Set(
        [
          booking.serviceId,
          booking.serviceName,
          bookingService?.id,
          bookingService?.name,
          ...services
            .filter(
              (item) =>
                bookingServiceName &&
                normalizeServiceIdentifier(item.name) ===
                  normalizeServiceIdentifier(bookingServiceName)
            )
            .flatMap((item) => [item.id, item.name]),
        ].filter((value): value is string => Boolean(value))
      )
    );
    const bookingServiceId = bookingService?.id || booking.serviceId || booking.serviceName || "";
    const playerCandidates = normalizedPersonNameCandidates(booking.playerName);
    const bookingCustomer =
      customers.find((customer) => customer.id === booking.customerId) ??
      (playerCandidates.length
        ? customers.find((customer) => {
            const customerCandidates = normalizedPersonNameCandidates(
              customer.name,
              customer.player,
              ...customer.familyMembers.map(familyMemberDisplayName)
            );

            return playerCandidates.some((candidate) => customerCandidates.includes(candidate));
          }) ?? null
        : null);
    const bookingCustomerId = booking.customerId || bookingCustomer?.id || "";
    const bookingCustomerName = bookingCustomer?.name ?? booking.playerName ?? "";

    if (
      (!bookingCustomerId && !booking.playerName && !bookingCustomerName) ||
      !bookingServiceId ||
      booking.status === "Cancelled"
    ) {
      return [];
    }

    return membershipRecordsForBookingCustomer(
      customerMembershipsByCustomerId,
      customers,
      bookingCustomerId,
      booking.playerName,
      bookingCustomerName
    )
      .map((record) => {
        const membershipService = services.find((item) => item.id === record.membershipServiceId) ?? null;
        return { record, membershipService };
      })
      .filter(({ record, membershipService }) =>
        membershipCanUseCredit(
          record,
          bookingServiceId,
          booking.date,
          membershipService,
          bookingServiceAliases
        )
      )
      .map(({ record, membershipService }) => {
        const remaining = membershipCreditRemaining(
          record,
          booking.date,
          membershipCreditLedger,
          booking.id,
          membershipService
        );
        const creditLimitPeriod = membershipCreditSettings(record, membershipService).creditLimitPeriod;
        return {
          record,
          remaining,
          membershipService,
          creditLimitPeriod,
        };
      })
      .filter(
        ({ record, remaining }) =>
          remaining > 0 || booking.membershipCreditMembershipId === record.id
      );
  }, [
    booking.customerId,
    booking.date,
    booking.id,
    booking.membershipCreditMembershipId,
    booking.playerName,
    booking.serviceId,
    booking.serviceName,
    booking.status,
    customers,
    customerMembershipsByCustomerId,
    membershipCreditLedger,
    service,
    services,
  ]);
  const [selectedMembershipCreditId, setSelectedMembershipCreditId] = useState("");
  const selectedMembershipCreditOption =
    membershipCreditOptions.find(({ record }) => record.id === selectedMembershipCreditId) ??
    membershipCreditOptions[0] ??
    null;
  const membershipCreditDescription = selectedMembershipCreditOption
    ? `${selectedMembershipCreditOption.membershipService?.name ?? "Membership"} - ${
        selectedMembershipCreditOption.remaining
      } credit${selectedMembershipCreditOption.remaining === 1 ? "" : "s"} left ${membershipCreditLimitPeriodRemainingLabel(
        selectedMembershipCreditOption.creditLimitPeriod
      )}.`
    : "No eligible membership credits for this booking.";

  const loadBillingCards = useCallback(async () => {
    setBillingLoading(true);
    try {
      const cardsResponse = await fetch(`/api/stripe/cards?customerId=${encodeURIComponent(customer.id)}`, {
        cache: "no-store",
      });
      const cardsPayload = await cardsResponse.json();

      if (!cardsResponse.ok) {
        throw new Error(cardsPayload?.error || "Could not load saved cards.");
      }

      setBillingCards(Array.isArray(cardsPayload.cards) ? (cardsPayload.cards as BillingCard[]) : []);
      setDefaultPaymentMethodId(cardsPayload.defaultPaymentMethodId ?? null);
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not load saved cards.");
    } finally {
      setBillingLoading(false);
    }
  }, [customer.id, showToast]);

  useEffect(() => {
    void loadBillingCards();
  }, [loadBillingCards]);

  useEffect(() => {
    setSelectedMembershipCreditId((current) => {
      if (current && membershipCreditOptions.some(({ record }) => record.id === current)) {
        return current;
      }

      return membershipCreditOptions[0]?.record.id ?? "";
    });
  }, [membershipCreditOptions]);

  function resetChargeState() {
    setShowPaymentMethodModal(true);
    setShowChargeModal(false);
    setChargeMethod(null);
    setChargeTaxEnabled(false);
    setChargeTaxRateId("");
    setChargeFeeEnabled(false);
    setChargeFeeId("");
    setChargeDiscountEnabled(false);
    setChargeDiscount("");
    setChargeAmount(service ? String(service.price) : "");
    setChargeDescription(
      [
        booking.serviceName || service?.name || "Booking charge",
        booking.date,
        `${booking.start} - ${booking.end}`,
        booking.resource,
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  function closeAll() {
    resetChargeState();
    onClose();
  }

  function applyServiceChargeAdjustments(method: "card" | "cash" | "waive") {
    const shouldApplyTax = Boolean(service?.collectTax && availableTaxRates.length);
    const shouldApplyCardFee = Boolean(method === "card" && service?.collectFee && availableCustomFees.length);

    if (!chargeTaxRateId && availableTaxRates[0]) {
      setChargeTaxRateId(availableTaxRates[0].id);
    }
    if (!chargeFeeId && availableCustomFees[0]) {
      setChargeFeeId(availableCustomFees[0].id);
    }

    setChargeTaxEnabled(shouldApplyTax);
    setChargeFeeEnabled(shouldApplyCardFee);
  }

  function chooseChargeMethod(method: "card" | "cash" | "waive" | "scan") {
    if (method === "scan") {
      showToast("Scan card using iPhone is not connected yet. Use Card, Cash, or Waive Payment for now.");
      return;
    }

    if (method === "card") {
      if (billingLoading) {
        showToast("Still loading saved cards. Try again in a second.");
        return;
      }
      if (!defaultCard) {
        showToast("Add a saved card first from the customer billing page.");
        return;
      }
    }

    applyServiceChargeAdjustments(method);

    setChargeMethod(method);
    setShowPaymentMethodModal(false);
    setShowChargeModal(true);
  }

  function submitMembershipCreditPayment() {
    if (!selectedMembershipCreditOption) {
      showToast("No membership credits are available for this booking.");
      return;
    }

    if (
      selectedMembershipCreditOption.remaining < 1 &&
      booking.membershipCreditMembershipId !== selectedMembershipCreditOption.record.id
    ) {
      showToast("This membership does not have credits left for this date.");
      return;
    }

    onMembershipCreditPaid(
      booking.id,
      selectedMembershipCreditOption.record.id,
      "Membership credit applied."
    );
  }

  async function submitManualPayment(method: "cash" | "waive") {
    const amountValue = chargeTotal;
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      showToast("Enter a valid charge amount.");
      return;
    }

    setSubmittingCharge(true);
    try {
      const response = await fetch("/api/stripe/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customer.id,
          bookingId: booking.id,
          amount: amountValue,
          description: chargeDescription,
          method,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not save payment.");
      }

      onPaid(booking.id, method === "cash" ? "Cash payment recorded." : "Payment waived.");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not save payment.");
    } finally {
      setSubmittingCharge(false);
    }
  }

  async function submitNewCharge() {
    const amountValue = chargeTotal;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showToast("Enter a valid charge amount.");
      return;
    }

    if (!chargeMethod) {
      showToast("Choose a payment method.");
      return;
    }

    if (chargeMethod === "cash" || chargeMethod === "waive") {
      await submitManualPayment(chargeMethod);
      return;
    }

    setSubmittingCharge(true);
    try {
      const response = await fetch("/api/stripe/charges/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customer.id,
          bookingId: booking.id,
          amount: amountValue,
          description: chargeDescription,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not charge saved card.");
      }

      onPaid(booking.id, "Charge completed.");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not charge saved card.");
    } finally {
      setSubmittingCharge(false);
    }
  }

  return (
    <>
      {showPaymentMethodModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[18px] font-semibold text-black">Payment Method</h2>
              <button
                type="button"
                onClick={closeAll}
                className="text-black/45"
                aria-label="Close payment method modal"
              >
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-3 px-6 py-5">
              <button
                type="button"
                onClick={() => chooseChargeMethod("card")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Card</span>
                  <span className="block text-[13px] text-black/55">
                    {defaultCard
                      ? `Charge ${formatCardBrand(defaultCard.brand)} ending in ${defaultCard.last4}.`
                      : billingLoading
                        ? "Loading saved card on file."
                        : "Charge the saved card on file."}
                  </span>
                </span>
                <Icon name="bag" className="h-5 w-5 text-black/45" />
              </button>

              <button
                type="button"
                onClick={() => chooseChargeMethod("cash")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Cash</span>
                  <span className="block text-[13px] text-black/55">
                    Record a cash payment and mark it paid.
                  </span>
                </span>
                <Icon name="file" className="h-5 w-5 text-black/45" />
              </button>

              <div
                className={`rounded-xl border border-black/10 ${
                  selectedMembershipCreditOption ? "bg-white" : "bg-black/[0.02] opacity-70"
                }`}
              >
                <button
                  type="button"
                  disabled={!selectedMembershipCreditOption}
                  onClick={submitMembershipCreditPayment}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02] disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span>
                    <span className="block text-[15px] font-semibold text-black">Membership credit</span>
                    <span className="block text-[13px] text-black/55">
                      {membershipCreditDescription}
                    </span>
                  </span>
                  <Icon name="check" className="h-5 w-5 shrink-0 text-black/45" />
                </button>
                {membershipCreditOptions.length > 1 ? (
                  <div className="border-t border-black/10 px-4 pb-3">
                    <select
                      value={selectedMembershipCreditId}
                      onChange={(event) => setSelectedMembershipCreditId(event.target.value)}
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none"
                    >
                      {membershipCreditOptions.map(({ record, membershipService, remaining, creditLimitPeriod }) => (
                        <option key={record.id} value={record.id}>
                          {membershipService?.name ?? "Membership"} - {remaining} left{" "}
                          {membershipCreditLimitPeriodRemainingLabel(creditLimitPeriod)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => chooseChargeMethod("scan")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Scan card using iPhone</span>
                  <span className="block text-[13px] text-black/55">
                    Use Tap to Pay style checkout when connected.
                  </span>
                </span>
                <Icon name="phone" className="h-5 w-5 text-black/45" />
              </button>

              <button
                type="button"
                onClick={() => chooseChargeMethod("waive")}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.02]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-black">Waive payment</span>
                  <span className="block text-[13px] text-black/55">
                    Mark the balance waived without charging.
                  </span>
                </span>
                <Icon name="check" className="h-5 w-5 text-black/45" />
              </button>
            </div>

            <div className="flex items-center justify-end border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showChargeModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[18px] font-semibold text-black">
                {chargeMethod === "cash"
                  ? "Record Cash Payment"
                  : chargeMethod === "waive"
                    ? "Waive Payment"
                    : "New Charge"}
              </h2>
              <button
                type="button"
                onClick={closeAll}
                className="text-black/45"
                aria-label="Close charge modal"
              >
                <Icon name="x" className="h-6 w-6" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="grid gap-4 self-start">
                  <div className="rounded-2xl border border-black/8 bg-black/[0.015] p-4">
                    <div className="grid gap-4">
                      <div className="rounded-xl border border-black/8 bg-white px-4 py-3">
                        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-black/40">
                          Booking
                        </p>
                        <p className="mt-2 text-[18px] font-semibold text-black">
                          {booking.serviceName || service?.name || "Booking charge"}
                        </p>
                        <p className="mt-1 text-[14px] text-black/55">
                          {customer.name} | {booking.date} | {timeLabel(booking.start)} - {timeLabel(booking.end)} | {booking.resource}
                        </p>
                      </div>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-black/85">Price</span>
                        <div className="flex h-12 items-center rounded-lg border border-black/12 bg-white pl-4 pr-4">
                          <span className="pointer-events-none shrink-0 text-[18px] leading-none text-black/45">
                            $
                          </span>
                          <input
                            value={chargeAmount}
                            onChange={(event) => setChargeAmount(event.target.value.replace(/[^\d.]/g, ""))}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="h-12 w-full border-0 bg-transparent pl-3 pr-0 text-[16px] outline-none"
                          />
                        </div>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-black/85">Description</span>
                        <textarea
                          value={chargeDescription}
                          onChange={(event) => setChargeDescription(event.target.value)}
                          placeholder={`Manual charge for ${customer.name}`}
                          rows={3}
                          className="min-h-[96px] w-full resize-none rounded-lg border border-black/12 px-4 py-3 text-[15px] leading-6 outline-none"
                        />
                      </label>

                      <div className="rounded-xl border border-black/8 bg-white px-4 py-3 text-[13px] leading-5 text-black/55">
                        {chargeMethod === "cash"
                          ? "This will record a cash payment and mark this booking as paid."
                          : chargeMethod === "waive"
                            ? "This will waive the balance and mark this booking as paid."
                            : "This will charge the customer's saved default card immediately."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="self-start rounded-2xl border border-black/10 bg-white">
                  <div className="border-b border-black/8 px-4 py-3">
                    <p className="text-[14px] font-semibold text-black">Invoice Summary</p>
                  </div>
                  <div className="grid gap-3 px-4 py-4">
                    <div className="flex items-center justify-between gap-4 text-[14px]">
                      <span className="text-black/65">Subtotal</span>
                      <span className="text-[15px] font-semibold text-black">{moneyPrecise(chargeSubtotal)}</span>
                    </div>

                    <div className="rounded-xl border border-black/8 px-3 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-black">Tax</p>
                          <p className="text-[12px] text-black/45">
                            {chargeTaxEnabled && selectedChargeTaxRate
                              ? `${selectedChargeTaxRate.name} (${selectedChargeTaxRate.percentage}%)`
                              : "Not applied"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (chargeTaxEnabled) {
                              setChargeTaxEnabled(false);
                              return;
                            }
                            if (availableTaxRates[0] && !chargeTaxRateId) {
                              setChargeTaxRateId(availableTaxRates[0].id);
                            }
                            setChargeTaxEnabled(true);
                          }}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70"
                        >
                          {chargeTaxEnabled ? "Remove" : "Add"}
                        </button>
                      </div>
                      {chargeTaxEnabled ? (
                        <div className="grid gap-2">
                          <select
                            value={chargeTaxRateId}
                            onChange={(event) => setChargeTaxRateId(event.target.value)}
                            className="h-10 w-full rounded-lg border border-black/12 px-3 text-[14px] outline-none"
                          >
                            {availableTaxRates.map((rate) => (
                              <option key={rate.id} value={rate.id}>
                                {rate.name} ({rate.percentage}%)
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between gap-4 text-[13px]">
                            <span className="text-black/55">Tax amount</span>
                            <span className="font-medium text-black">{moneyPrecise(chargeTaxAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-black/8 px-3 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-black">Service Fee</p>
                          <p className="text-[12px] text-black/45">
                            {chargeFeeEnabled && selectedChargeFee
                              ? `${selectedChargeFee.name} (${selectedChargeFee.amount}%)`
                              : "Not applied"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (chargeFeeEnabled) {
                              setChargeFeeEnabled(false);
                              return;
                            }
                            if (availableCustomFees[0] && !chargeFeeId) {
                              setChargeFeeId(availableCustomFees[0].id);
                            }
                            setChargeFeeEnabled(true);
                          }}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70"
                        >
                          {chargeFeeEnabled ? "Remove" : "Add"}
                        </button>
                      </div>
                      {chargeFeeEnabled ? (
                        <div className="grid gap-2">
                          <select
                            value={chargeFeeId}
                            onChange={(event) => setChargeFeeId(event.target.value)}
                            className="h-10 w-full rounded-lg border border-black/12 px-3 text-[14px] outline-none"
                          >
                            {availableCustomFees.map((fee) => (
                              <option key={fee.id} value={fee.id}>
                                {fee.name} ({fee.amount}%)
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between gap-4 text-[13px]">
                            <span className="text-black/55">Service fee amount</span>
                            <span className="font-medium text-black">{moneyPrecise(chargeFeeAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-black/8 px-3 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-black">Discount</p>
                          <p className="text-[12px] text-black/45">
                            {chargeDiscountEnabled
                              ? chargeDiscountAmount > 0
                                ? `${moneyPrecise(chargeDiscountAmount)} off`
                                : "Enter a discount amount"
                              : "Not applied"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (chargeDiscountEnabled) {
                              setChargeDiscountEnabled(false);
                              setChargeDiscount("");
                              return;
                            }
                            setChargeDiscountEnabled(true);
                          }}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70"
                        >
                          {chargeDiscountEnabled ? "Remove" : "Add"}
                        </button>
                      </div>
                      {chargeDiscountEnabled ? (
                        <div className="grid gap-2">
                          <label className="grid gap-1.5">
                            <span className="text-[13px] text-black/55">Discount amount</span>
                            <div className="flex h-10 items-center rounded-lg border border-black/12 bg-white pl-3 pr-3">
                              <span className="pointer-events-none shrink-0 text-[15px] leading-none text-black/45">
                                $
                              </span>
                              <input
                                value={chargeDiscount}
                                onChange={(event) => setChargeDiscount(event.target.value.replace(/[^\d.]/g, ""))}
                                inputMode="decimal"
                                placeholder="0.00"
                                className="h-10 w-full border-0 bg-transparent pl-2 text-[14px] outline-none"
                              />
                            </div>
                          </label>
                          <div className="flex items-center justify-between gap-4 text-[13px]">
                            <span className="text-black/55">Discount applied</span>
                            <span className="font-medium text-red-600">-{moneyPrecise(chargeDiscountAmount)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-black/8 pt-3 text-[15px]">
                      <span className="font-semibold text-black">Total</span>
                      <span className="text-[18px] font-semibold text-black">{moneyPrecise(chargeTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg border border-black/10 px-4 py-2 text-[14px] font-medium text-black/65"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitNewCharge()}
                disabled={submittingCharge}
                className="rounded-lg bg-black px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {submittingCharge
                  ? chargeMethod === "cash" || chargeMethod === "waive"
                    ? "Saving..."
                    : "Charging..."
                  : chargeMethod === "cash"
                    ? "Record cash payment"
                    : chargeMethod === "waive"
                      ? "Waive payment"
                      : "Charge card"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
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

const registrationPersonalFieldMeta: Array<{
  key: RegistrationPersonalFieldKey;
  label: string;
  description: string;
}> = [
  {
    key: "name",
    label: "Name",
    description:
      "Choose whether users must enter their name when creating an account at your facility.",
  },
  {
    key: "gender",
    label: "Gender",
    description:
      "Choose whether users must enter their gender when creating an account at your facility.",
  },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    description:
      "Choose whether users must enter their date of birth when creating an account at your facility.",
  },
];

const registrationContactFieldMeta: Array<{
  key: RegistrationContactFieldKey;
  label: string;
  description: string;
}> = [
  {
    key: "address",
    label: "Address",
    description:
      "Choose whether users must enter their address when creating an account at your facility.",
  },
  {
    key: "phoneNumber",
    label: "Phone Number",
    description:
      "Choose whether users must enter their phone number when creating an account at your facility.",
  },
];

function RegistrationRequiredToggle({
  checked,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      aria-checked={checked}
      aria-label={label}
      role="switch"
      disabled={disabled}
      className={[
        "relative inline-flex h-7 w-12 items-center rounded-full border px-[2px] transition",
        disabled
          ? "cursor-not-allowed border-black/10 bg-[#eceff4]"
          : checked
            ? "border-black bg-[#1f1b1b]"
            : "border-black/10 bg-[#d8dde6]",
      ].join(" ")}
    >
      <span
        className={[
          "h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function RegistrationSettingsEditor({
  value,
  onChange,
  mobile = false,
}: {
  value: RegistrationSettings;
  onChange: (next: RegistrationSettings) => void;
  mobile?: boolean;
}) {
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<RegistrationAdditionalField["type"]>("Short Text");

  function updatePersonalField(key: RegistrationPersonalFieldKey, next: Partial<RegistrationFieldConfig>) {
    onChange({
      ...value,
      personalFields: {
        ...value.personalFields,
        [key]: {
          ...value.personalFields[key],
          ...next,
        },
      },
    });
  }

  function updateContactField(key: RegistrationContactFieldKey, next: Partial<RegistrationFieldConfig>) {
    onChange({
      ...value,
      contactFields: {
        ...value.contactFields,
        [key]: {
          ...value.contactFields[key],
          ...next,
        },
      },
    });
  }

  function updateAdditionalField(id: string, next: Partial<RegistrationAdditionalField>) {
    onChange({
      ...value,
      additionalFields: value.additionalFields.map((field) => (field.id === id ? { ...field, ...next } : field)),
    });
  }

  function moveAdditionalField(index: number, direction: "up" | "down") {
    onChange({
      ...value,
      additionalFields: moveListItem(value.additionalFields, index, direction),
    });
  }

  function removeAdditionalField(id: string) {
    onChange({
      ...value,
      additionalFields: value.additionalFields.filter((field) => field.id !== id),
    });
  }

  function addAdditionalField() {
    const label = newFieldLabel.trim();
    if (!label) return;

    onChange({
      ...value,
      additionalFields: [
        ...value.additionalFields,
        {
          ...createRegistrationAdditionalFieldDraft(),
          label,
          type: newFieldType,
        },
      ],
    });

    setNewFieldLabel("");
    setNewFieldType("Short Text");
    setIsAddFieldOpen(false);
  }

  function renderStandardFieldCard(
    label: string,
    config: RegistrationFieldConfig,
    onRequiredChange: (checked: boolean) => void,
    onHiddenChange: (hidden: boolean) => void
  ) {
    return (
      <div
        className={[
          "rounded-[12px] border border-black/10 bg-white",
          config.hidden ? "opacity-60" : "",
          mobile ? "px-4 py-3.5" : "px-5 py-4",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 text-[15px] font-medium text-black">{label}</div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-black/45">{config.required ? "Required" : "Optional"}</span>
            <RegistrationRequiredToggle
              checked={config.required}
              disabled={config.hidden}
              onChange={onRequiredChange}
              label={`${label} required`}
            />
            <button
              type="button"
              onClick={() => onHiddenChange(!config.hidden)}
              className={config.hidden ? "text-black/30" : "text-black/45"}
              aria-label={`${config.hidden ? "Show" : "Hide"} ${label}`}
              title={`${config.hidden ? "Show" : "Hide"} ${label}`}
            >
              <Icon name="eye" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sectionClass = mobile
    ? "px-6 py-6"
    : "grid gap-6 px-5 py-5 lg:grid-cols-[220px_minmax(0,1fr)]";
  const addButtonClass =
    "inline-flex min-h-11 items-center rounded-[8px] bg-[#6282b2] px-5 text-[15px] font-medium text-white shadow-[0_2px_6px_rgba(72,102,176,0.25)]";

  return (
    <>
      <div className="divide-y divide-black/10">
        <div className={sectionClass}>
          <div>
            <div className="text-[18px] font-semibold">Personal Information</div>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              Choose which personal details users will be required to enter when creating an account at your facility.
            </p>
          </div>
          <div className="grid gap-3">
            {registrationPersonalFieldMeta.map((field) =>
              renderStandardFieldCard(
                field.label,
                value.personalFields[field.key],
                (checked) => updatePersonalField(field.key, { required: checked }),
                (hidden) => updatePersonalField(field.key, { hidden })
              )
            )}
          </div>
        </div>

        <div className={sectionClass}>
          <div>
            <div className="text-[18px] font-semibold">Contact Information</div>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              Choose which pieces of contact information users will be required to enter when creating an account at your facility.
            </p>
          </div>
          <div className="grid gap-3">
            {registrationContactFieldMeta.map((field) =>
              renderStandardFieldCard(
                field.label,
                value.contactFields[field.key],
                (checked) => updateContactField(field.key, { required: checked }),
                (hidden) => updateContactField(field.key, { hidden })
              )
            )}
          </div>
        </div>

        <div className={sectionClass}>
          <div>
            <div className="text-[18px] font-semibold">Additional Information</div>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              Request the client to fill out additional details during registration.
            </p>
          </div>
          <div>
            <div className="grid gap-3">
              {value.additionalFields.map((field, index) => (
                <div
                  key={field.id}
                  className={[
                    "rounded-[12px] border border-black/10 bg-white",
                    mobile ? "px-4 py-3.5" : "px-5 py-4",
                  ].join(" ")}
                >
                  <div className={`flex ${mobile ? "flex-col gap-4" : "items-center justify-between gap-4"}`}>
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex flex-col text-black/35">
                        <button
                          type="button"
                          onClick={() => moveAdditionalField(index, "up")}
                          disabled={index === 0}
                          className="disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Move ${field.label} up`}
                        >
                          <Icon name="chevron" className="h-4 w-4 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAdditionalField(index, "down")}
                          disabled={index === value.additionalFields.length - 1}
                          className="disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Move ${field.label} down`}
                        >
                          <Icon name="chevron" className="h-4 w-4 -rotate-90" />
                        </button>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium text-black">{field.label || "Untitled field"}</div>
                        <div className="mt-1 text-[13px] text-black/45">{field.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] text-black/45">{field.required ? "Required" : "Optional"}</span>
                      <RegistrationRequiredToggle
                        checked={field.required}
                        onChange={(checked) => updateAdditionalField(field.id, { required: checked })}
                        label={`${field.label} required`}
                      />
                      <button
                        type="button"
                        onClick={() => removeAdditionalField(field.id)}
                        className="text-[20px] leading-none text-black/35 transition hover:text-black/60"
                        aria-label={`Remove ${field.label}`}
                        title={`Remove ${field.label}`}
                      >
                        x
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setIsAddFieldOpen(true)} className={addButtonClass}>
                Add Custom Field
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAddFieldOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[520px] overflow-hidden rounded-[14px] bg-white shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[28px] font-medium text-black">Add Custom Field</h2>
              <button
                type="button"
                onClick={() => setIsAddFieldOpen(false)}
                className="text-black/45 transition hover:text-black"
                aria-label="Close custom field editor"
              >
                <Icon name="x" className="h-7 w-7" />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6">
              <TextField label="Field Name" value={newFieldLabel} onChange={setNewFieldLabel} placeholder="Organization" />
              <SelectField
                label="Field Type"
                value={newFieldType}
                onChange={(next) => setNewFieldType(next as RegistrationAdditionalField["type"])}
                options={["Short Text", "Single-select"]}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-5">
              <button
                type="button"
                onClick={() => setIsAddFieldOpen(false)}
                className="rounded-[10px] border border-black/10 px-5 py-2.5 text-[15px] font-medium text-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addAdditionalField}
                disabled={!newFieldLabel.trim()}
                className="rounded-[10px] bg-[#1f1b1b] px-5 py-2.5 text-[15px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TaxesAndFeesSettingsEditor({
  value,
  onChange,
  mobile = false,
}: {
  value: AppState["taxesAndFees"];
  onChange: (next: AppState["taxesAndFees"]) => void;
  mobile?: boolean;
}) {
  const [expandedTaxRateId, setExpandedTaxRateId] = useState<string | null>(value.taxRates[0]?.id ?? null);
  const [expandedCustomFeeId, setExpandedCustomFeeId] = useState<string | null>(value.customFees[0]?.id ?? null);

  useEffect(() => {
    if (value.taxRates.length === 0) {
      setExpandedTaxRateId(null);
    } else if (!value.taxRates.some((item) => item.id === expandedTaxRateId)) {
      setExpandedTaxRateId(value.taxRates[0]?.id ?? null);
    }
  }, [expandedTaxRateId, value.taxRates]);

  useEffect(() => {
    if (value.customFees.length === 0) {
      setExpandedCustomFeeId(null);
    } else if (!value.customFees.some((item) => item.id === expandedCustomFeeId)) {
      setExpandedCustomFeeId(value.customFees[0]?.id ?? null);
    }
  }, [expandedCustomFeeId, value.customFees]);

  function updateTaxRate(id: string, next: Partial<TaxRate>) {
    onChange({
      ...value,
      taxRates: value.taxRates.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });
  }

  function updateCustomFee(id: string, next: Partial<CustomFee>) {
    onChange({
      ...value,
      customFees: value.customFees.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });
  }

  function addTaxRate() {
    const next = createTaxRateDraft();
    onChange({
      ...value,
      taxRates: [...value.taxRates, next],
    });
    setExpandedTaxRateId(next.id);
  }

  function addCustomFee() {
    const next = createCustomFeeDraft();
    onChange({
      ...value,
      customFees: [...value.customFees, next],
    });
    setExpandedCustomFeeId(next.id);
  }

  function removeTaxRate(id: string) {
    const nextTaxRates = value.taxRates.filter((item) => item.id !== id);
    onChange({
      ...value,
      taxRates: nextTaxRates.length ? nextTaxRates : [createTaxRateDraft()],
    });
  }

  function removeCustomFee(id: string) {
    const nextCustomFees = value.customFees.filter((item) => item.id !== id);
    onChange({
      ...value,
      customFees: nextCustomFees.length ? nextCustomFees : [createCustomFeeDraft()],
    });
  }

  const summaryPadding = mobile ? "px-6 py-5" : "px-0 py-0";
  const detailPadding = mobile ? "px-0 py-0" : "px-0 py-0";
  const addButtonClass = mobile
    ? "inline-flex min-h-[44px] items-center rounded-[8px] bg-[#6282b2] px-5 text-[15px] font-medium text-white shadow-[0_2px_6px_rgba(72,102,176,0.25)]"
    : "inline-flex min-h-11 items-center rounded-[8px] bg-[#6282b2] px-5 text-[15px] font-medium text-white shadow-[0_2px_6px_rgba(72,102,176,0.25)]";

  return (
    <div className="divide-y divide-black/10">
      <div className={`${mobile ? "px-6 py-6" : "px-5 py-5"} grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]`}>
        <div>
          <div className="text-[18px] font-semibold">Tax Rates</div>
          <p className="mt-2 text-sm leading-relaxed text-black/65">
            Set up tax rates to charge for products &amp; services at your facility.{" "}
            <a
              href="https://help.runswiftapp.com/article/424-tax-rates"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-black underline"
            >
              Learn more
            </a>
          </p>
        </div>
        <div>
          <div className="text-[18px] font-semibold">Tax Rates</div>
          <div className="mt-3 overflow-hidden border-t border-black/10">
            {value.taxRates.map((item) => {
              const open = item.id === expandedTaxRateId;
              const summary = `${item.name || "Untitled Tax Rate"} - ${item.percentage || "0"}%`;
              return (
                <div key={item.id} className="border-b border-black/10">
                  <div className={`flex items-center justify-between gap-3 ${summaryPadding}`}>
                    <button
                      type="button"
                      onClick={() => setExpandedTaxRateId(open ? null : item.id)}
                      className="min-w-0 flex-1 text-left text-[16px] text-black/75"
                    >
                      {summary}
                    </button>
                    <div className="flex items-center gap-4 text-black/45">
                      <button
                        type="button"
                        onClick={() => removeTaxRate(item.id)}
                        className="text-[20px] leading-none transition hover:text-black"
                        aria-label={`Delete ${item.name || "tax rate"}`}
                      >
                        ...
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedTaxRateId(open ? null : item.id)}
                        className="transition hover:text-black"
                        aria-label={open ? "Collapse tax rate" : "Expand tax rate"}
                      >
                        <Icon name="chevron" className={`h-5 w-5 transition ${open ? "-rotate-90" : "rotate-90"}`} />
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <div className={`${detailPadding} border-t border-black/10`}>
                      <div className={`${mobile ? "px-6 py-5" : "px-5 py-5"} text-[18px] font-semibold`}>
                        Tax Rate Details
                      </div>
                      <div className={`${mobile ? "px-6 pb-6" : "px-5 pb-5"} grid gap-4`}>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-black/70">Name</span>
                          <input
                            value={item.name}
                            onChange={(event) => updateTaxRate(item.id, { name: event.target.value })}
                            placeholder="Sales Tax"
                            className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                          />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                          <label className="grid gap-1.5">
                            <span className="text-sm font-semibold text-black/70">Percentage</span>
                            <div className="relative">
                              <input
                                value={item.percentage}
                                onChange={(event) =>
                                  updateTaxRate(item.id, {
                                    percentage: event.target.value.replace(/[^\d.]/g, "").slice(0, 6),
                                  })
                                }
                                placeholder="13"
                                className="min-h-12 w-full rounded-lg border border-black/10 px-4 pr-8 text-[15px] outline-none focus:border-black/30"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-black/45">
                                %
                              </span>
                            </div>
                          </label>
                          <label className="grid gap-1.5">
                            <span className="text-sm font-semibold text-black/70">Tax ID</span>
                            <input
                              value={item.taxId}
                              onChange={(event) => updateTaxRate(item.id, { taxId: event.target.value })}
                              placeholder="12-3456789"
                              className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={addTaxRate} className={addButtonClass}>
              Add another tax rate
            </button>
          </div>
        </div>
      </div>

      <div className={`${mobile ? "px-6 py-6" : "px-5 py-5"} grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]`}>
        <div>
          <div className="text-[18px] font-semibold">Custom Fees</div>
          <p className="mt-2 text-sm leading-relaxed text-black/65">
            Set up custom fees to charge for products &amp; services at your facility.{" "}
            <a
              href="https://help.runswiftapp.com/article/424-tax-and-fees"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-black underline"
            >
              Learn more
            </a>
          </p>
        </div>
        <div>
          <div className="text-[18px] font-semibold">Custom Fees</div>
          <div className="mt-3 overflow-hidden border-t border-black/10">
            {value.customFees.map((item) => {
              const open = item.id === expandedCustomFeeId;
              const summary = `${item.name || "Untitled Custom Fee"} - ${item.amount || "0"}%`;
              return (
                <div key={item.id} className="border-b border-black/10">
                  <div className={`flex items-center justify-between gap-3 ${summaryPadding}`}>
                    <button
                      type="button"
                      onClick={() => setExpandedCustomFeeId(open ? null : item.id)}
                      className="min-w-0 flex-1 text-left text-[16px] text-black/75"
                    >
                      {summary}
                    </button>
                    <div className="flex items-center gap-4 text-black/45">
                      <button
                        type="button"
                        onClick={() => removeCustomFee(item.id)}
                        className="text-[20px] leading-none transition hover:text-black"
                        aria-label={`Delete ${item.name || "custom fee"}`}
                      >
                        ...
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedCustomFeeId(open ? null : item.id)}
                        className="transition hover:text-black"
                        aria-label={open ? "Collapse custom fee" : "Expand custom fee"}
                      >
                        <Icon name="chevron" className={`h-5 w-5 transition ${open ? "-rotate-90" : "rotate-90"}`} />
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <div className={`${detailPadding} border-t border-black/10`}>
                      <div className={`${mobile ? "px-6 py-5" : "px-5 py-5"} text-[18px] font-semibold`}>
                        Custom Fee Details
                      </div>
                      <div className={`${mobile ? "px-6 pb-6" : "px-5 pb-5"} grid gap-4`}>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-black/70">Name</span>
                          <input
                            value={item.name}
                            onChange={(event) => updateCustomFee(item.id, { name: event.target.value })}
                            placeholder="Technology Fee"
                            className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                          />
                          <span className="text-[13px] text-black/45">This name will be visible during checkout</span>
                        </label>
                        <label className="grid max-w-[220px] gap-1.5">
                          <span className="text-sm font-semibold text-black/70">Amount</span>
                          <div className="relative">
                            <input
                              value={item.amount}
                              onChange={(event) =>
                                updateCustomFee(item.id, {
                                  amount: event.target.value.replace(/[^\d.]/g, "").slice(0, 6),
                                })
                              }
                              placeholder="10"
                              className="min-h-12 w-full rounded-lg border border-black/10 px-4 pr-8 text-[15px] outline-none focus:border-black/30"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-black/45">
                              %
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={addCustomFee} className={addButtonClass}>
              Add another fee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function staffInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ST";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function StaffRoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className="inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-[14px] font-medium text-black/80">
      {role}
    </span>
  );
}

function StaffSettingsView({
  backHref,
  staff,
  showToast,
  onSave,
}: {
  backHref: string;
  staff: StaffMember[];
  showToast: (message: string) => void;
  onSave: (nextStaff: StaffMember[], successMessage?: string) => Promise<boolean | void>;
}) {
  const [draft, setDraft] = useState(staff);
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<StaffRole>("Staff");
  const [memberIsActive, setMemberIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(staff);
  }, [staff]);

  const activeCount = draft.filter((member) => member.active).length;
  const inactiveCount = draft.length - activeCount;
  const normalizedSearch = search.trim().toLowerCase();

  const filteredStaff = useMemo(() => {
    return draft.filter((member) => {
      if (activeTab === "active" && !member.active) return false;
      if (activeTab === "inactive" && member.active) return false;
      if (!normalizedSearch) return true;
      return [member.name, member.email, member.role].join(" ").toLowerCase().includes(normalizedSearch);
    });
  }, [activeTab, draft, normalizedSearch]);

  function resetEditor() {
    setEditingStaffId(null);
    setMemberName("");
    setMemberEmail("");
    setMemberRole("Staff");
    setMemberIsActive(true);
  }

  function openNewEditor() {
    resetEditor();
    setEditorOpen(true);
  }

  function openEditEditor(member: StaffMember) {
    setEditingStaffId(member.id);
    setMemberName(member.name);
    setMemberEmail(member.email);
    setMemberRole(member.role);
    setMemberIsActive(member.active);
    setEditorOpen(true);
  }

  async function saveMember() {
    const trimmedName = memberName.trim();
    const trimmedEmail = memberEmail.trim();

    if (!trimmedName) {
      showToast("Staff name is required.");
      return;
    }

    if (!trimmedEmail) {
      showToast("Staff email is required.");
      return;
    }

    const nextMember: StaffMember = {
      id: editingStaffId ?? makeId("staff"),
      name: trimmedName,
      email: trimmedEmail,
      role: memberRole,
      active: memberIsActive,
      calendarColor:
        draft.find((member) => member.id === editingStaffId)?.calendarColor ??
        staffAvailabilityColor(draft.length),
    };

    const nextStaff = editingStaffId
      ? draft.map((member) => (member.id === editingStaffId ? nextMember : member))
      : [...draft, nextMember];

    setSaving(true);
    try {
      setDraft(nextStaff);
      const result = await onSave(nextStaff, editingStaffId ? "Staff member updated." : "Staff member added.");
      if (result !== false) {
        setEditorOpen(false);
        resetEditor();
      }
    } finally {
      setSaving(false);
    }
  }

  const summaryRange =
    filteredStaff.length === 0 ? "0-0 of 0" : `1-${Math.min(filteredStaff.length, 25)} of ${filteredStaff.length}`;

  return (
    <section className="min-h-screen bg-white">
      <div className="px-5 py-4 xl:hidden">
        <Link href={backHref} className="inline-flex items-center gap-2 text-[15px] font-medium text-black">
          <Icon name="arrow-left" className="h-4 w-4" />
          Staff
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
                    const isActive = item.section === "staff";
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive && item.section === "staff"
                        ? "bg-[#e9e9e9] font-semibold"
                        : "text-black/75 hover:bg-black/5",
                    ].join(" ");

                    const content = (
                      <>
                        <Icon name={item.icon} className="h-[18px] w-[18px]" />
                        <span>{item.label}</span>
                      </>
                    );

                    return item.href ? (
                      <Link key={item.label} href={item.href} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <button key={item.label} type="button" className={className}>
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="px-8 py-9">
          <PageHeader title="Staff" subtitle="Manage your staff members & permissions">
            <PrimaryButton icon="plus" onClick={openNewEditor}>
              New
            </PrimaryButton>
          </PageHeader>

          <div className="mb-6 flex items-end gap-8 border-b border-black/10">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={[
                "border-b-2 px-5 pb-4 text-[16px] transition",
                activeTab === "active" ? "border-black font-medium text-black" : "border-transparent text-black/55",
              ].join(" ")}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inactive")}
              className={[
                "border-b-2 px-1 pb-4 text-[16px] transition",
                activeTab === "inactive"
                  ? "border-black font-medium text-black"
                  : "border-transparent text-black/55",
              ].join(" ")}
            >
              Inactive ({inactiveCount})
            </button>
          </div>

          <div className="mb-5 max-w-[920px]">
            <div className="relative">
              <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search staff..."
                className="min-h-12 w-full rounded-lg border border-black/10 bg-white pl-14 pr-4 text-[15px] outline-none focus:border-black/30"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f3f6fa]">
                  <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Name</th>
                  <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Email</th>
                  <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {filteredStaff.length ? (
                  filteredStaff.map((member) => (
                    <tr
                      key={member.id}
                      className="cursor-pointer bg-white transition hover:bg-black/[0.02]"
                      onClick={() => openEditEditor(member)}
                    >
                      <td className="px-5 py-5 align-middle">
                        <div className="flex items-center gap-4">
                          <div className="grid h-[34px] w-[34px] place-items-center rounded-full bg-black/[0.12] text-[14px] font-medium text-white">
                            {staffInitials(member.name)}
                          </div>
                          <span className="text-[17px] text-black">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 align-middle text-[17px] text-black/80">{member.email}</td>
                      <td className="px-5 py-5 align-middle">
                        <StaffRoleBadge role={member.role} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-[15px] text-black/45">
                      No staff members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-end gap-8 border-t border-black/10 px-5 py-4 text-[15px] text-black/70">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <div className="inline-flex items-center gap-2">
                  <span>25</span>
                  <Icon name="chevron" className="h-4 w-4 -rotate-90 text-black/45" />
                </div>
              </div>
              <div>{summaryRange}</div>
              <div className="flex items-center gap-2 text-black/25">
                <Icon name="chevron" className="h-4 w-4 rotate-180" />
                <Icon name="chevron" className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 pb-8 xl:hidden">
        <PageHeader title="Staff" subtitle="Manage your staff members & permissions">
          <PrimaryButton icon="plus" onClick={openNewEditor}>
            New
          </PrimaryButton>
        </PageHeader>

        <div className="flex items-end gap-6 border-b border-black/10">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={[
              "border-b-2 pb-3 text-[16px] transition",
              activeTab === "active" ? "border-black font-medium text-black" : "border-transparent text-black/55",
            ].join(" ")}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inactive")}
            className={[
              "border-b-2 pb-3 text-[16px] transition",
              activeTab === "inactive" ? "border-black font-medium text-black" : "border-transparent text-black/55",
            ].join(" ")}
          >
            Inactive ({inactiveCount})
          </button>
        </div>

        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff..."
            className="min-h-12 w-full rounded-lg border border-black/10 bg-white pl-14 pr-4 text-[15px] outline-none focus:border-black/30"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 bg-[#f3f6fa] px-4 py-4 text-[14px] font-semibold text-black">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
          </div>
          {filteredStaff.length ? (
            filteredStaff.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => openEditEditor(member)}
                className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 border-t border-black/10 px-4 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.12] text-[13px] font-medium text-white">
                    {staffInitials(member.name)}
                  </div>
                  <span className="text-[15px] font-medium text-black">{member.name}</span>
                </div>
                <span className="truncate text-[14px] text-black/70">{member.email}</span>
                <StaffRoleBadge role={member.role} />
              </button>
            ))
          ) : (
            <div className="px-4 py-10 text-center text-[15px] text-black/45">No staff members found.</div>
          )}
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 px-4 py-10">
          <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[18px] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-[28px] font-medium text-black">
                {editingStaffId ? "Edit Staff Member" : "New Staff Member"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false);
                  resetEditor();
                }}
                className="text-black/45 transition hover:text-black"
                aria-label="Close"
              >
                <Icon name="x" className="h-7 w-7" />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-6">
              <TextField label="Name" value={memberName} onChange={setMemberName} placeholder="Full name" />
              <TextField
                label="Email"
                value={memberEmail}
                onChange={setMemberEmail}
                type="email"
                placeholder="staff@example.com"
              />
              <SelectField
                label="Role"
                value={memberRole}
                onChange={(value) => setMemberRole(normalizeStaffRole(value))}
                options={["Owner", "Admin", "Instructor", "Staff"]}
              />
              <div className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3">
                <div>
                  <div className="text-[15px] font-semibold text-black">Active</div>
                  <div className="text-sm text-black/55">Inactive staff members stay available in the inactive tab.</div>
                </div>
                <ToggleSwitch checked={memberIsActive} onChange={setMemberIsActive} label="Toggle active staff member" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-5">
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false);
                  resetEditor();
                }}
                className="rounded-lg px-4 py-3 text-[16px] text-black/70 transition hover:bg-black/[0.03]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveMember()}
                disabled={saving}
                className="rounded-lg bg-[#1f1b1b] px-6 py-3 text-[16px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const staffRoleDisplayOrder: StaffRoleSummary[] = [
  { role: "Owner", permissions: "All" },
  { role: "Admin", permissions: "All" },
  { role: "Staff", permissions: "Limited" },
  { role: "Instructor", permissions: "Limited" },
];

function roleEditorHref(role: StaffRole) {
  return `/admin/settings/roles/${roleSlug(role)}`;
}

function StaffRolesSettingsView({
  backHref,
  staff,
  rolePermissions,
}: {
  backHref: string;
  staff: StaffMember[];
  rolePermissions: RolePermissionRecord[];
}) {
  const roleRows = useMemo(() => {
    const presentRoles = new Set(staff.map((member) => member.role));
    return staffRoleDisplayOrder
      .filter((item) => presentRoles.has(item.role))
      .map((item) => ({
        ...item,
        permissions: rolePermissionSummary(item.role, rolePermissions),
      }));
  }, [rolePermissions, staff]);

  return (
    <section className="min-h-screen bg-white">
      <div className="px-5 py-4 xl:hidden">
        <Link href={backHref} className="inline-flex items-center gap-2 text-[15px] font-medium text-black">
          <Icon name="arrow-left" className="h-4 w-4" />
          Roles &amp; Permissions
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
                    const isActive = item.section === "roles";
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive && item.section === "roles"
                        ? "bg-[#e9e9e9] font-semibold"
                        : "text-black/75 hover:bg-black/5",
                    ].join(" ");

                    const content = (
                      <>
                        <Icon name={item.icon} className="h-[18px] w-[18px]" />
                        <span>{item.label}</span>
                      </>
                    );

                    return item.href ? (
                      <Link key={item.label} href={item.href} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <button key={item.label} type="button" className={className}>
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="px-8 py-9">
          <div className="max-w-[1084px]">
            <PageHeader
              title="Roles & Permissions"
              subtitle="Manage the permissions & access for each staff role"
            />

            <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f3f6fa]">
                    <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Name</th>
                    <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {roleRows.map((item) => (
                    <tr key={item.role} className="bg-white transition hover:bg-black/[0.015]">
                      <td className="px-5 py-5 text-[18px] text-black">
                        <Link href={roleEditorHref(item.role)} className="block">
                          {item.role}
                        </Link>
                      </td>
                      <td className="px-5 py-5 text-[18px] text-black/80">
                        <Link href={roleEditorHref(item.role)} className="block">
                          {item.permissions}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 pb-8 xl:hidden">
        <PageHeader
          title="Roles & Permissions"
          subtitle="Manage the permissions & access for each staff role"
        />

        <div className="overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-[1.1fr_.9fr] gap-3 bg-[#f3f6fa] px-4 py-4 text-[14px] font-semibold text-black">
            <span>Name</span>
            <span>Permissions</span>
          </div>
          {roleRows.map((item) => (
            <Link
              key={item.role}
              href={roleEditorHref(item.role)}
              className="grid grid-cols-[1.1fr_.9fr] gap-3 border-t border-black/10 px-4 py-4 transition hover:bg-black/[0.015]"
            >
              <div className="text-[17px] text-black">{item.role}</div>
              <div className="text-[17px] text-black/75">{item.permissions}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function StaffRoleEditorView({
  backHref,
  role,
  rolePermissions,
  onSave,
}: {
  backHref: string;
  role: StaffRole;
  rolePermissions: RolePermissionRecord[];
  onSave: (nextRolePermissions: RolePermissionRecord[]) => Promise<boolean>;
}) {
  const [enabledKeys, setEnabledKeys] = useState<string[]>(
    () => rolePermissions.find((item) => item.role === role)?.enabledKeys ?? []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabledKeys(rolePermissions.find((item) => item.role === role)?.enabledKeys ?? []);
  }, [role, rolePermissions]);

  const leftGroups = useMemo(
    () => rolePermissionGroups.filter((group) => group.column === "left"),
    []
  );
  const rightGroups = useMemo(
    () => rolePermissionGroups.filter((group) => group.column === "right"),
    []
  );

  function togglePermission(key: string, checked: boolean) {
    setEnabledKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return Array.from(next);
    });
  }

  function selectAll() {
    setEnabledKeys([...allEditableRolePermissionKeys]);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(
        rolePermissions.map((item) =>
          item.role === role
            ? {
                ...item,
                enabledKeys: normalizeRolePermissionKeys(enabledKeys),
              }
            : item
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const renderPermissionGroup = (group: RolePermissionGroup) => (
    <div key={group.title} className="border-b border-black/10 pb-5 last:border-b-0 last:pb-0">
      <div className="mb-4 text-[20px] font-semibold text-black">{group.title}</div>
      <div className="grid gap-3">
        {group.permissions.map((permission) => {
          const checked = enabledKeys.includes(permission.key);
          return (
            <label
              key={permission.key}
              className={[
                "flex items-center gap-3 text-[15px] leading-snug text-black",
                permission.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={permission.disabled}
                onChange={(event) => togglePermission(permission.key, event.target.checked)}
                className="h-[18px] w-[18px] rounded border border-black/20 accent-black"
              />
              <span>{permission.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="min-h-screen bg-white">
      <div className="px-5 py-4 xl:hidden">
        <Link href={backHref} className="inline-flex items-center gap-2 text-[15px] font-medium text-black">
          <Icon name="arrow-left" className="h-4 w-4" />
          Roles
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
                    const isActive = item.section === "roles";
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive ? "bg-[#e9e9e9] font-semibold" : "text-black/75 hover:bg-black/5",
                    ].join(" ");

                    const content = (
                      <>
                        <Icon name={item.icon} className="h-[18px] w-[18px]" />
                        <span>{item.label}</span>
                      </>
                    );

                    return item.href ? (
                      <Link key={item.label} href={item.href} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <button key={item.label} type="button" className={className}>
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="px-8 py-9">
          <StaffRoleEditorCard
            backHref={backHref}
            role={role}
            saving={saving}
            onSave={save}
            onSelectAll={selectAll}
            leftGroups={leftGroups}
            rightGroups={rightGroups}
            renderPermissionGroup={renderPermissionGroup}
          />
        </div>
      </div>

      <div className="px-5 pb-8 xl:hidden">
        <StaffRoleEditorCard
          backHref={backHref}
          role={role}
          saving={saving}
          onSave={save}
          onSelectAll={selectAll}
          leftGroups={leftGroups}
          rightGroups={rightGroups}
          renderPermissionGroup={renderPermissionGroup}
          mobile
        />
      </div>
    </section>
  );
}

function StaffRoleEditorCard({
  backHref,
  role,
  saving,
  onSave,
  onSelectAll,
  leftGroups,
  rightGroups,
  renderPermissionGroup,
  mobile = false,
}: {
  backHref: string;
  role: StaffRole;
  saving: boolean;
  onSave: () => Promise<void>;
  onSelectAll: () => void;
  leftGroups: RolePermissionGroup[];
  rightGroups: RolePermissionGroup[];
  renderPermissionGroup: (group: RolePermissionGroup) => React.ReactNode;
  mobile?: boolean;
}) {
  return (
    <div className={mobile ? "space-y-4" : "max-w-[1240px]"}>
      <div className={mobile ? "mb-5" : "mb-7"}>
        <div className="text-[14px] font-medium text-black/55">
          <Link href={backHref} className="transition hover:text-black">
            Roles
          </Link>{" "}
          / <span className="text-black">{role}</span>
        </div>
        <h1
          className={[
            "mt-2 font-medium leading-tight text-black",
            mobile ? "text-[28px]" : "text-[24px]",
          ].join(" ")}
        >
          {role}
        </h1>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-sm">
        <div className="border-t-[4px] border-[#4f76b8] px-5 py-5 text-[20px] font-medium text-black">
          Role Details
        </div>

        <div className={mobile ? "px-5 py-5" : "px-6 py-6"}>
          <div className={mobile ? "grid gap-6" : "grid gap-0"}>
            <div
              className={[
                "border-b border-black/10 pb-6",
                mobile ? "grid gap-4" : "grid grid-cols-[220px_minmax(0,1fr)] gap-8",
              ].join(" ")}
            >
              <div className="text-[16px] font-semibold text-black">Name</div>
              <label className="grid gap-2">
                <span className="sr-only">Name</span>
                <input
                  value={role}
                  disabled
                  className="min-h-12 rounded-lg border border-black/10 bg-[#f8f8f8] px-4 text-[16px] text-black/75"
                  readOnly
                />
              </label>
            </div>

            <div
              className={[
                "py-6",
                mobile ? "grid gap-4" : "grid grid-cols-[220px_minmax(0,1fr)] gap-8",
              ].join(" ")}
            >
              <div className="text-[16px] font-semibold text-black">Permissions</div>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="rounded-lg border border-black/10 bg-white px-4 py-2 text-[15px] font-medium text-black transition hover:bg-black/[0.03]"
                >
                  Select all
                </button>
              </div>
            </div>

            <div className="border-t border-black/10 pt-8">
              <div className={mobile ? "grid gap-8" : "grid gap-10 xl:grid-cols-2"}>
                <div className="space-y-8">{leftGroups.map(renderPermissionGroup)}</div>
                <div className="space-y-8">{rightGroups.map(renderPermissionGroup)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-black/10 bg-[#fafafa] px-5 py-5">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="rounded-lg bg-[#1f1b1b] px-6 py-3 text-[16px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
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
  const isProfile = section === "profile";
  const isBasics = section === "basics";
  const isRooms = section === "rooms";
  const isRegistration = section === "registration";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingWaiver, setIsUploadingWaiver] = useState(false);
  const [waiverUploadError, setWaiverUploadError] = useState("");
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [roomSearch, setRoomSearch] = useState("");
  const isTaxesFees = section === "taxes-fees";

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

  function updateProfile(next: Partial<AppState["profile"]>) {
    setDraft((current) => ({
      ...current,
      profile: {
        ...current.profile,
        ...next,
      },
    }));
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

  function updateTaxesAndFees(next: AppState["taxesAndFees"]) {
    setDraft((current) => ({
      ...current,
      taxesAndFees: next,
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

  const sectionTitle = isProfile
    ? "Profile"
    : isBasics
      ? "Basics"
      : isRooms
        ? "Rooms"
        : isRegistration
          ? "Registration"
        : isTaxesFees
          ? "Taxes & Fees"
          : "Policies";
  const filteredRooms = draft.resources.filter((resource) =>
    resource.toLowerCase().includes(roomSearch.trim().toLowerCase())
  );
  const scheduleCollection = draft.schedules.length ? draft.schedules : defaultState.schedules;
  const defaultScheduleName =
    scheduleCollection.find((schedule) => schedule.isDefault || schedule.slug === "working-hours")?.name ??
    scheduleCollection[0]?.name ??
    "Working Hours";
  const scheduleNameForRoom = (roomName: string) =>
    scheduleForRoom(scheduleCollection, roomName)?.name ?? defaultScheduleName;
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
              title={
                isProfile
                  ? "Profile"
                  : isBasics
                    ? "Basics"
                    : isRooms
                      ? "Rooms"
                      : isRegistration
                        ? "Registration"
                        : isTaxesFees
                          ? "Taxes & Fees"
                          : "Policies"
              }
              subtitle={
                isProfile
                  ? "Manage your user profile"
                  : isBasics
                  ? "Manage your facility settings."
                  : isRooms
                    ? "Rooms are bookable spaces within your facility."
                  : isRegistration
                    ? "Configure registration policies and requirements for your facility"
                  : isTaxesFees
                    ? "Configure tax rates and custom fees for your facility"
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

              {isProfile ? (
                <>
                  <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Your Details</div>
                  <div className="grid gap-6 px-5 py-6 lg:grid-cols-[140px_minmax(0,1fr)]">
                    <div className="flex items-start justify-center pt-3">
                      <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#d3d3d3] text-white">
                        <Icon name="user" className="h-12 w-12" />
                      </div>
                    </div>
                    <div className="grid gap-7">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <label className="grid gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-black/70">First Name</span>
                            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">
                              Optional
                            </span>
                          </div>
                          <input
                            value={draft.profile.firstName}
                            onChange={(event) => updateProfile({ firstName: event.target.value })}
                            className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-black/70">Last Name</span>
                            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">
                              Optional
                            </span>
                          </div>
                          <input
                            value={draft.profile.lastName}
                            onChange={(event) => updateProfile({ lastName: event.target.value })}
                            className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                          />
                        </label>
                      </div>

                      <div className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-semibold text-black/70">Email</span>
                          <button
                            type="button"
                            onClick={() => showToast("Email changes are coming next.")}
                            className="text-[13px] font-medium text-[#6379a5]"
                          >
                            Change
                          </button>
                        </div>
                        <input
                          value={draft.profile.email}
                          disabled
                          className="min-h-12 w-full rounded-lg border border-black/10 bg-[#fafafa] px-4 text-[15px] text-black/55 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : isBasics ? (
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
                              {defaultScheduleName}
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
                                      {scheduleNameForRoom(room)}
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
              ) : isRegistration ? (
                <>
                  <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Registration Policies</div>
                  <RegistrationSettingsEditor
                    value={draft.registration}
                    onChange={(next) => setDraft((current) => ({ ...current, registration: next }))}
                  />
                </>
              ) : isTaxesFees ? (
                <>
                  <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Taxes &amp; Fees</div>
                  <TaxesAndFeesSettingsEditor
                    value={draft.taxesAndFees}
                    onChange={updateTaxesAndFees}
                  />
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
          {isProfile ? (
            <>
              <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Your Details</div>
              <div className="grid gap-6 px-6 py-6">
                <div className="flex justify-center">
                  <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#d3d3d3] text-white">
                    <Icon name="user" className="h-12 w-12" />
                  </div>
                </div>

                <label className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-black/85">First Name</span>
                    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">Optional</span>
                  </div>
                  <input
                    value={draft.profile.firstName}
                    onChange={(event) => updateProfile({ firstName: event.target.value })}
                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-black/85">Last Name</span>
                    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">Optional</span>
                  </div>
                  <input
                    value={draft.profile.lastName}
                    onChange={(event) => updateProfile({ lastName: event.target.value })}
                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                  />
                </label>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-medium text-black/85">Email</span>
                    <button
                      type="button"
                      onClick={() => showToast("Email changes are coming next.")}
                      className="text-[13px] font-medium text-[#6379a5]"
                    >
                      Change
                    </button>
                  </div>
                  <input
                    value={draft.profile.email}
                    disabled
                    className="min-h-[48px] rounded-[8px] border border-black/12 bg-[#fafafa] px-4 text-[14px] text-black/55 outline-none"
                  />
                </div>
              </div>
            </>
          ) : isBasics ? (
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
                              {scheduleNameForRoom(room)}
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
          ) : isRegistration ? (
            <>
              <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Registration Policies</div>
              <RegistrationSettingsEditor
                value={draft.registration}
                onChange={(next) => setDraft((current) => ({ ...current, registration: next }))}
                mobile
              />
            </>
          ) : isTaxesFees ? (
            <>
              <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Taxes &amp; Fees</div>
              <TaxesAndFeesSettingsEditor
                value={draft.taxesAndFees}
                onChange={updateTaxesAndFees}
                mobile
              />
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

function formatScheduleTimeLabel(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scheduleHref(scheduleKey: string) {
  return `/admin/settings/schedules/${encodeURIComponent(scheduleKey)}`;
}

function SchedulesSettingsView({
  backHref,
  state,
  showToast,
}: {
  backHref: string;
  state: AppState;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const schedules = state.schedules.length ? state.schedules : defaultState.schedules;
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSchedules = useMemo(() => {
    if (!normalizedSearch) return schedules;
    return schedules.filter((schedule) => {
      const haystack = [
        schedule.name,
        schedule.serviceNames.join(" "),
        schedule.roomNames.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, schedules]);

  return (
    <section className="min-h-screen bg-white">
      <div className="px-5 py-4 xl:hidden">
        <Link href={backHref} className="inline-flex items-center gap-2 text-[15px] font-medium text-black">
          <Icon name="arrow-left" className="h-4 w-4" />
          Schedules
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
                    const isActive = item.section === "schedules";
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive && item.section === "schedules"
                        ? "bg-[#e9e9e9] font-semibold"
                        : "text-black/75 hover:bg-black/5",
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
              title="Schedules"
              subtitle="Schedules indicate when a set of rooms are available for online booking"
            >
              <PrimaryButton
                icon="plus"
                onClick={() => router.push(bookingAdminRouteByView["settings-schedules-add"])}
              >
                New
              </PrimaryButton>
            </PageHeader>

            <div className="mb-5 max-w-full">
              <div className="relative">
                <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search schedules"
                  className="min-h-12 w-full rounded-lg border border-black/10 bg-white pl-14 pr-4 text-[15px] outline-none focus:border-black/30"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-sm">
              <table className="w-full border-collapse">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[38%]" />
                  <col className="w-[38%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#f3f6fa]">
                    <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Name</th>
                    <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Services</th>
                    <th className="px-5 py-5 text-left text-[15px] font-semibold text-black">Rooms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {filteredSchedules.map((schedule) => (
                    <tr
                      key={schedule.id}
                      className="cursor-pointer bg-white transition hover:bg-black/[0.02]"
                      onClick={() => router.push(scheduleHref(schedule.id))}
                    >
                      <td className="px-5 py-6 align-middle">
                        <div className="max-w-[170px]">
                          <div className="text-[18px] font-medium leading-[1.35] text-black break-words">
                            {schedule.name}
                          </div>
                          <div className="mt-2 text-[13px] leading-5 text-black/55">
                            {schedule.serviceNames.length} service{schedule.serviceNames.length === 1 ? "" : "s"} \u00b7{" "}
                            {schedule.roomNames.length} room{schedule.roomNames.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-6 align-middle text-[16px] text-black/75">
                        {schedule.serviceNames.length ? (
                          <div className="flex flex-wrap gap-2.5">
                            {schedule.serviceNames.map((serviceName) => (
                              <span
                                key={`${schedule.id}-service-${serviceName}`}
                                className="inline-flex min-h-9 items-center rounded-full bg-black/[0.06] px-3.5 py-1 text-[13px] font-medium text-black/80"
                              >
                                {serviceName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex min-h-9 items-center rounded-full bg-black/[0.04] px-3.5 py-1 text-[13px] font-medium text-black/50">
                            No services assigned
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-6 align-middle">
                        {schedule.roomNames.length ? (
                          <div className="flex flex-wrap gap-2.5">
                            {schedule.roomNames.map((room) => (
                              <span
                                key={`${schedule.id}-room-${room}`}
                                className="inline-flex min-h-9 items-center rounded-full bg-black/[0.06] px-3.5 py-1 text-[13px] font-medium text-black/80"
                              >
                                {room}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex min-h-9 items-center rounded-full bg-black/[0.04] px-3.5 py-1 text-[13px] font-medium text-black/50">
                            No rooms assigned
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-[15px] text-black/45">
                        No schedules found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 pb-6 xl:hidden">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-[30px] font-medium text-black">Schedules</h1>
            <p className="mt-1 text-[14px] leading-6 text-black/70">
              Schedules indicate when a set of rooms are available for online booking
            </p>
          </div>
          <PrimaryButton
            icon="plus"
            onClick={() => router.push(bookingAdminRouteByView["settings-schedules-add"])}
          >
            New
          </PrimaryButton>
        </div>

        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search schedules"
            className="min-h-12 w-full rounded-[12px] border border-black/12 bg-white pl-14 pr-4 text-[15px] outline-none focus:border-black/30"
          />
        </div>

        {filteredSchedules.map((schedule) => (
          <button
            key={schedule.id}
            type="button"
            onClick={() => router.push(scheduleHref(schedule.id))}
            className="w-full rounded-[16px] border border-black/12 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <div className="text-[20px] font-medium text-black">{schedule.name}</div>
            <div className="mt-2 text-[13px] leading-5 text-black/55">
              {schedule.serviceNames.length} service{schedule.serviceNames.length === 1 ? "" : "s"} \u00b7{" "}
              {schedule.roomNames.length} room{schedule.roomNames.length === 1 ? "" : "s"}
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">Services</div>
              <div className="flex flex-wrap gap-2">
                {schedule.serviceNames.length ? (
                  schedule.serviceNames.map((serviceName) => (
                    <span
                      key={`${schedule.id}-mobile-service-${serviceName}`}
                      className="inline-flex min-h-[34px] items-center rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-medium text-black/80"
                    >
                      {serviceName}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex min-h-[34px] items-center rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-medium text-black/50">
                    No services assigned
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">Rooms</div>
              <div className="flex flex-wrap gap-2">
                {schedule.roomNames.length ? (
                  schedule.roomNames.map((room) => (
                    <span
                      key={`${schedule.id}-mobile-room-${room}`}
                      className="inline-flex min-h-[34px] items-center rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-medium text-black/80"
                    >
                      {room}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex min-h-[34px] items-center rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-medium text-black/50">
                    No rooms assigned
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
        {filteredSchedules.length === 0 ? (
          <div className="rounded-[16px] border border-black/12 bg-white px-5 py-10 text-center text-[15px] text-black/45 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            No schedules found.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ScheduleEditorView({
  schedule,
  resources,
  onBack,
  onSave,
  onDelete,
  showToast,
  mode = "add",
}: {
  schedule: ScheduleRecord;
  resources: string[];
  onBack: () => void;
  onSave: (schedule: ScheduleRecord) => Promise<boolean> | boolean;
  onDelete?: () => Promise<boolean> | boolean;
  showToast: (message: string) => void;
  mode?: "add" | "edit";
}) {
  const [draft, setDraft] = useState<ScheduleRecord>(schedule);
  const isEditMode = mode === "edit";
  const pageTitle = isEditMode ? schedule.name || "Schedule" : "Add Schedule";
  const breadcrumbLabel = isEditMode ? pageTitle : "Add Schedule";
  const deleteGuardMessage = isEditMode ? getScheduleDeleteGuard(schedule) : null;

  useEffect(() => {
    setDraft(schedule);
  }, [schedule]);

  function cloneScheduleSlots(slots: ScheduleSlot[]) {
    return slots.map((slot, index) => ({
      ...slot,
      id: makeId("schedule-slot"),
      sortOrder: index + 1,
    }));
  }

  function replaceDayConfig(day: string, source: ScheduleDayConfig) {
    updateDayConfig(day, () => ({
      day,
      weekday: scheduleWeekdayOrder.get(day) ?? 0,
      enabled: source.enabled,
      slots: cloneScheduleSlots(source.slots),
    }));
  }

  function updateDayConfig(day: string, recipe: (current: ScheduleDayConfig) => ScheduleDayConfig) {
    setDraft((current) => ({
      ...current,
      dayConfigs: current.dayConfigs.map((config) => (config.day === day ? recipe(config) : config)),
    }));
  }

  function toggleDay(day: string, enabled: boolean) {
    updateDayConfig(day, (current) => ({
      ...current,
      enabled,
      slots: enabled
        ? current.slots.length
          ? current.slots
          : [{ id: makeId("schedule-slot"), start: "09:00", end: "17:00", sortOrder: 1 }]
        : [],
    }));
  }

  function updateSlot(day: string, slotId: string, next: Partial<ScheduleSlot>) {
    updateDayConfig(day, (current) => ({
      ...current,
      slots: current.slots.map((slot) => (slot.id === slotId ? { ...slot, ...next } : slot)),
    }));
  }

  function addSlot(day: string) {
    updateDayConfig(day, (current) => {
      const lastSlot = [...current.slots].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
      const nextStartMinutes = lastSlot ? Math.min(timeToMinutes(lastSlot.end), 23 * 60 + 30) : 9 * 60;
      const nextEndMinutes = Math.min(nextStartMinutes + 60, 23 * 60 + 45);
      return {
        ...current,
        enabled: true,
        slots: [
          ...current.slots,
          {
            id: makeId("schedule-slot"),
            start: minutesToTime(nextStartMinutes),
            end: minutesToTime(nextEndMinutes),
            sortOrder: current.slots.length + 1,
          },
        ],
      };
    });
  }

  function removeSlot(day: string, slotId: string) {
    updateDayConfig(day, (current) => {
      const nextSlots = current.slots.filter((slot) => slot.id !== slotId);
      return {
        ...current,
        enabled: nextSlots.length > 0,
        slots: nextSlots.map((slot, index) => ({ ...slot, sortOrder: index + 1 })),
      };
    });
  }

  function copyPreviousRow(day: string) {
    const currentIndex = draft.dayConfigs.findIndex((config) => config.day === day);
    const previous = draft.dayConfigs[currentIndex - 1];
    if (!previous) {
      showToast("There is no previous day to copy yet.");
      return;
    }

    replaceDayConfig(day, previous);
    showToast(`${day} copied ${previous.day}.`);
  }

  function copyDayToTargets(sourceDay: string, targetDays: string[], label: string) {
    const source = draft.dayConfigs.find((config) => config.day === sourceDay);
    if (!source) {
      showToast(`Could not find ${sourceDay}.`);
      return;
    }

    const filteredTargets = targetDays.filter((day) => day !== sourceDay);
    if (!filteredTargets.length) {
      showToast(`There are no ${label.toLowerCase()} left to copy to.`);
      return;
    }

    setDraft((current) => ({
      ...current,
      dayConfigs: current.dayConfigs.map((config) =>
        filteredTargets.includes(config.day)
          ? {
              day: config.day,
              weekday: scheduleWeekdayOrder.get(config.day) ?? config.weekday,
              enabled: source.enabled,
              slots: cloneScheduleSlots(source.slots),
            }
          : config
      ),
    }));
    showToast(`${sourceDay} copied to ${label.toLowerCase()}.`);
  }

  function copyToWeekdays(day: string) {
    copyDayToTargets(
      day,
      scheduleWeekdays.filter((item) => item.weekday >= 1 && item.weekday <= 5).map((item) => item.day),
      "Weekdays"
    );
  }

  function copyToWeekend(day: string) {
    copyDayToTargets(day, ["Saturday", "Sunday"], "Weekend");
  }

  function copyToAllDays(day: string) {
    copyDayToTargets(
      day,
      draft.dayConfigs.map((config) => config.day),
      "All days"
    );
  }

  function makeDefaultScheduleSlot() {
    return { id: makeId("override-slot"), start: "09:00", end: "17:00", sortOrder: 1 };
  }

  function buildOverrideSlots(date: string) {
    const baseConfig = dayConfigForDate(draft, date);
    return baseConfig.enabled && baseConfig.slots.length ? cloneScheduleSlots(baseConfig.slots) : [makeDefaultScheduleSlot()];
  }

  function appendOverride(override: ScheduleOverride) {
    setDraft((current) => ({
      ...current,
      overrides: [...current.overrides, override].sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }

  function sortOverrides(overrides: ScheduleOverride[]) {
    return [...overrides].sort((a, b) => a.date.localeCompare(b.date));
  }

  function addClosedOverride() {
    appendOverride({
      id: makeId("override"),
      date: isoDate(new Date()),
      isClosed: true,
      slots: [],
    });
    showToast("Closed date added.");
  }

  function addCustomHoursOverride() {
    const date = isoDate(new Date());
    appendOverride({
      id: makeId("override"),
      date,
      isClosed: false,
      slots: buildOverrideSlots(date),
    });
    showToast("Custom hours date added.");
  }

  function updateOverride(overrideId: string, recipe: (current: ScheduleOverride) => ScheduleOverride) {
    setDraft((current) => ({
      ...current,
      overrides: sortOverrides(
        current.overrides.map((override) => (override.id === overrideId ? recipe(override) : override))
      ),
    }));
  }

  function resetOverrideToRegularHours(overrideId: string, date: string) {
    updateOverride(overrideId, (current) => ({
      ...current,
      isClosed: false,
      slots: buildOverrideSlots(date),
    }));
    showToast("Override reset to regular hours.");
  }

  async function handleSave() {
    await onSave(normalizeScheduleRecord(draft));
  }

  return (
    <section className="min-h-screen bg-white">
      <div className="hidden min-h-screen xl:grid xl:grid-cols-[284px_minmax(0,1fr)]">
        <aside className="border-b border-black/10 bg-[#f7f7f7] px-4 py-5 lg:border-b-0 lg:border-r">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-black/70 transition hover:text-black"
          >
            <Icon name="arrow-left" className="h-4 w-4" />
            Back to app
          </button>

          <div className="mt-6 space-y-6">
            {settingsNavGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-sm font-medium text-black/45">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item.section === "schedules";
                    const className = [
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition",
                      isActive && item.section === "schedules"
                        ? "bg-[#e9e9e9] font-semibold"
                        : "text-black/75 hover:bg-black/5",
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
                <Link href={bookingAdminRouteByView["settings-schedules"]} className="text-black/70 hover:text-black">
                  Schedules
                </Link>
                <span>/</span>
                <span className="text-black">{breadcrumbLabel}</span>
              </div>
              <h1 className="text-[24px] font-semibold text-black">{pageTitle}</h1>
            </div>

            <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-sm">
              <div className="border-t-4 border-t-[#4866b0]" />
              <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold">Schedule Details</div>

              <div className="divide-y divide-black/10">
                <div className="px-5 py-5">
                  <label className="grid max-w-[240px] gap-1.5">
                    <span className="text-sm font-semibold text-black/70">Name</span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          name: event.target.value,
                          slug: slugifyScheduleName(event.target.value) || current.slug,
                        }))
                      }
                      className="min-h-12 rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                    />
                  </label>
                </div>

                <div className="px-5 py-5">
                  <div className="mb-5 text-[18px] font-semibold text-black">Hours</div>
                  <div className="space-y-4">
                    {draft.dayConfigs.map((config) => (
                      <div key={config.day} className="grid grid-cols-[170px_minmax(0,1fr)] items-start gap-6">
                        <div className="flex items-center gap-3">
                          <ToggleSwitch
                            checked={config.enabled}
                            onChange={(checked) => toggleDay(config.day, checked)}
                            label={`${config.day} open`}
                          />
                          <span className="text-[16px] font-medium text-black">{config.day}</span>
                        </div>

                        {config.enabled ? (
                          <div className="space-y-3">
                            {config.slots.map((slot, slotIndex) => (
                              <div key={slot.id} className="flex flex-wrap items-center gap-4">
                                <select
                                  value={slot.start}
                                  onChange={(event) => updateSlot(config.day, slot.id, { start: event.target.value })}
                                  className="min-h-12 min-w-[164px] rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                                >
                                  {scheduleTimeOptions.map((value) => (
                                    <option key={value} value={value}>
                                      {formatScheduleTimeLabel(value)}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[18px] text-black/45">-</span>
                                <select
                                  value={slot.end}
                                  onChange={(event) => updateSlot(config.day, slot.id, { end: event.target.value })}
                                  className="min-h-12 min-w-[164px] rounded-lg border border-black/10 px-4 text-[15px] outline-none focus:border-black/30"
                                >
                                  {scheduleTimeOptions.map((value) => (
                                    <option key={value} value={value}>
                                      {formatScheduleTimeLabel(value)}
                                    </option>
                                  ))}
                                </select>
                                {slotIndex === 0 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => addSlot(config.day)}
                                      className="text-black/55 transition hover:text-black"
                                      aria-label={`Add time slot for ${config.day}`}
                                    >
                                      <Icon name="plus" className="h-5 w-5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyPreviousRow(config.day)}
                                      className="text-black/55 transition hover:text-black"
                                      aria-label={`Copy hours to ${config.day}`}
                                      title="Copy previous day"
                                    >
                                      <Icon name="copy" className="h-5 w-5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => removeSlot(config.day, slot.id)}
                                    className="text-black/55 transition hover:text-black"
                                    aria-label={`Remove time slot from ${config.day}`}
                                  >
                                    <Icon name="trash" className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => copyToWeekdays(config.day)}
                                className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70 transition hover:border-black/20 hover:bg-black/[0.03] hover:text-black"
                              >
                                Copy to weekdays
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToWeekend(config.day)}
                                className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70 transition hover:border-black/20 hover:bg-black/[0.03] hover:text-black"
                              >
                                Copy to weekend
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToAllDays(config.day)}
                                className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-black/70 transition hover:border-black/20 hover:bg-black/[0.03] hover:text-black"
                              >
                                Copy to all days
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[16px] text-black/55">Closed</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-5">
                  <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white">
                    <div className="border-b border-black/10 px-5 py-4 text-[18px] font-semibold text-black">
                      Date Overrides ({draft.overrides.length})
                    </div>
                    <div className="flex flex-col items-start gap-4 px-5 py-5">
                      <p className="text-[15px] leading-7 text-black/65">
                        Add specific dates when your schedule changes from your regular hours.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={addClosedOverride}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-black/10 bg-white px-5 py-2.5 text-[15px] font-medium text-black"
                        >
                          <Icon name="plus" className="h-4 w-4" />
                          Add closed date
                        </button>
                        <button
                          type="button"
                          onClick={addCustomHoursOverride}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-black/10 bg-white px-5 py-2.5 text-[15px] font-medium text-black"
                        >
                          <Icon name="plus" className="h-4 w-4" />
                          Add custom hours date
                        </button>
                      </div>
                      {draft.overrides.length ? (
                        <div className="grid w-full gap-4">
                          {draft.overrides.map((override) => (
                            <div key={override.id} className="rounded-lg border border-black/10 p-4">
                              <div className="grid gap-4 lg:grid-cols-[180px_auto_1fr_auto] lg:items-center">
                                <label className="grid gap-1.5">
                                  <span className="text-[13px] font-semibold text-black/70">Date</span>
                                  <input
                                    type="date"
                                    value={override.date}
                                    onChange={(event) =>
                                      updateOverride(override.id, (current) => ({ ...current, date: event.target.value }))
                                    }
                                    className="min-h-11 rounded-lg border border-black/10 px-3 text-[14px] outline-none"
                                  />
                                </label>
                                <div className="flex items-center gap-3 pt-5 lg:pt-0">
                                  <ToggleSwitch
                                    checked={!override.isClosed}
                                    onChange={(checked) =>
                                      updateOverride(override.id, (current) => ({
                                        ...current,
                                        isClosed: !checked,
                                        slots: checked
                                          ? current.slots.length
                                            ? current.slots
                                            : [{ id: makeId("override-slot"), start: "09:00", end: "17:00", sortOrder: 1 }]
                                          : [],
                                      }))
                                    }
                                    label={`${override.date} custom hours`}
                                  />
                                  <span className="text-[14px] text-black/70">
                                    {override.isClosed ? "Closed" : "Custom hours"}
                                  </span>
                                </div>
                                {!override.isClosed ? (
                                  <div className="space-y-3">
                                    {override.slots.map((slot, slotIndex) => (
                                      <div key={slot.id} className="flex flex-wrap items-center gap-3">
                                        <select
                                          value={slot.start}
                                          onChange={(event) =>
                                            updateOverride(override.id, (current) => ({
                                              ...current,
                                              slots: current.slots.map((item) =>
                                                item.id === slot.id ? { ...item, start: event.target.value } : item
                                              ),
                                            }))
                                          }
                                          className="min-h-11 min-w-[148px] rounded-lg border border-black/10 px-3 text-[14px] outline-none"
                                        >
                                          {scheduleTimeOptions.map((value) => (
                                            <option key={value} value={value}>
                                              {formatScheduleTimeLabel(value)}
                                            </option>
                                          ))}
                                        </select>
                                        <span className="text-black/45">-</span>
                                        <select
                                          value={slot.end}
                                          onChange={(event) =>
                                            updateOverride(override.id, (current) => ({
                                              ...current,
                                              slots: current.slots.map((item) =>
                                                item.id === slot.id ? { ...item, end: event.target.value } : item
                                              ),
                                            }))
                                          }
                                          className="min-h-11 min-w-[148px] rounded-lg border border-black/10 px-3 text-[14px] outline-none"
                                        >
                                          {scheduleTimeOptions.map((value) => (
                                            <option key={value} value={value}>
                                              {formatScheduleTimeLabel(value)}
                                            </option>
                                          ))}
                                        </select>
                                        {slotIndex === 0 ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateOverride(override.id, (current) => ({
                                                ...current,
                                                slots: [
                                                  ...current.slots,
                                                  {
                                                    id: makeId("override-slot"),
                                                    start: slot.end,
                                                    end: minutesToTime(Math.min(timeToMinutes(slot.end) + 60, 23 * 60 + 45)),
                                                    sortOrder: current.slots.length + 1,
                                                  },
                                                ],
                                              }))
                                            }
                                            className="text-black/55 transition hover:text-black"
                                            aria-label={`Add override time slot for ${override.date}`}
                                          >
                                            <Icon name="plus" className="h-5 w-5" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateOverride(override.id, (current) => ({
                                                ...current,
                                                slots: current.slots.filter((item) => item.id !== slot.id),
                                              }))
                                            }
                                            className="text-black/55 transition hover:text-black"
                                            aria-label={`Remove override time slot for ${override.date}`}
                                          >
                                            <Icon name="trash" className="h-5 w-5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="pt-5 text-[14px] text-black/55 lg:pt-0">Closed all day</div>
                                )}
                                <div className="flex items-center gap-3 pt-5 lg:pt-0">
                                  <button
                                    type="button"
                                    onClick={() => resetOverrideToRegularHours(override.id, override.date)}
                                    className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-medium text-black/70 transition hover:border-black/20 hover:bg-black/[0.03] hover:text-black"
                                  >
                                    Use regular hours
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraft((current) => ({
                                        ...current,
                                        overrides: current.overrides.filter((item) => item.id !== override.id),
                                      }))
                                    }
                                    className="text-black/55 transition hover:text-black"
                                    aria-label={`Remove ${override.date} override`}
                                  >
                                    <Icon name="trash" className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-black/10 bg-[#f7f8fb] px-5 py-4">
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
                      onClick={() => void onDelete?.()}
                      className="rounded-lg border border-[#e7c3bf] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#b33a30] transition hover:bg-[#fff3f1]"
                    >
                      Delete
                    </button>
                  )
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => void handleSave()}
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
          <button type="button" onClick={onBack} className="text-black/70 hover:text-black">
            Schedules
          </button>
          <span>/</span>
          <span className="text-black">{breadcrumbLabel}</span>
        </div>
        <h1 className="mb-5 text-[28px] font-medium text-black">{pageTitle}</h1>

        <div className="overflow-hidden rounded-[10px] border border-black/12 bg-white shadow-sm">
          <div className="border-t-4 border-t-[#4866b0]" />
          <div className="border-b border-black/10 px-6 py-5 text-[18px] font-medium">Schedule Details</div>

          <div className="divide-y divide-black/10">
            <div className="px-6 py-6">
              <label className="grid max-w-[240px] gap-2">
                <span className="text-[14px] font-medium text-black/85">Name</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: slugifyScheduleName(event.target.value) || current.slug,
                    }))
                  }
                  className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                />
              </label>
            </div>

            <div className="px-6 py-6">
              <div className="mb-4 text-[16px] font-medium text-black">Hours</div>
              <div className="space-y-5">
                {draft.dayConfigs.map((config) => (
                  <div key={config.day} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <ToggleSwitch
                        checked={config.enabled}
                        onChange={(checked) => toggleDay(config.day, checked)}
                        label={`${config.day} open`}
                      />
                      <span className="text-[18px] font-medium text-black">{config.day}</span>
                    </div>
                    {config.enabled ? (
                      <div className="space-y-3">
                        {config.slots.map((slot, slotIndex) => (
                          <div key={slot.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_28px_28px] sm:items-center">
                            <select
                              value={slot.start}
                              onChange={(event) => updateSlot(config.day, slot.id, { start: event.target.value })}
                              className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                            >
                              {scheduleTimeOptions.map((value) => (
                                <option key={value} value={value}>
                                  {formatScheduleTimeLabel(value)}
                                </option>
                              ))}
                            </select>
                            <span className="hidden text-center text-[18px] text-black/45 sm:block">-</span>
                            <select
                              value={slot.end}
                              onChange={(event) => updateSlot(config.day, slot.id, { end: event.target.value })}
                              className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                            >
                              {scheduleTimeOptions.map((value) => (
                                <option key={value} value={value}>
                                  {formatScheduleTimeLabel(value)}
                                </option>
                              ))}
                            </select>
                            {slotIndex === 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => addSlot(config.day)}
                                  className="grid h-7 w-7 place-items-center text-black/55"
                                  aria-label={`Add time slot for ${config.day}`}
                                >
                                  <Icon name="plus" className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyPreviousRow(config.day)}
                                  className="grid h-7 w-7 place-items-center text-black/55"
                                  aria-label={`Copy hours to ${config.day}`}
                                  title="Copy previous day"
                                >
                                  <Icon name="copy" className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeSlot(config.day, slot.id)}
                                className="grid h-7 w-7 place-items-center text-black/55"
                                aria-label={`Remove time slot from ${config.day}`}
                              >
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => copyToWeekdays(config.day)}
                            className="rounded-full border border-black/12 px-3 py-1.5 text-[12px] font-medium text-black/70"
                          >
                            Weekdays
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToWeekend(config.day)}
                            className="rounded-full border border-black/12 px-3 py-1.5 text-[12px] font-medium text-black/70"
                          >
                            Weekend
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToAllDays(config.day)}
                            className="rounded-full border border-black/12 px-3 py-1.5 text-[12px] font-medium text-black/70"
                          >
                            All days
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[16px] text-black/55">Closed</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="overflow-hidden rounded-[10px] border border-black/12 bg-white">
                <div className="border-b border-black/10 px-5 py-4 text-[16px] font-medium">
                  Date Overrides ({draft.overrides.length})
                </div>
                <div className="px-5 py-5">
                  <p className="text-[14px] leading-6 text-black/70">
                    Add specific dates when your schedule changes from your regular hours.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={addClosedOverride}
                      className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-black/12 bg-white px-5 py-2.5 text-[15px] font-medium text-black"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                      Add closed date
                    </button>
                    <button
                      type="button"
                      onClick={addCustomHoursOverride}
                      className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-black/12 bg-white px-5 py-2.5 text-[15px] font-medium text-black"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                      Add custom hours date
                    </button>
                  </div>
                  {draft.overrides.length ? (
                    <div className="mt-4 grid gap-4">
                      {draft.overrides.map((override) => (
                        <div key={override.id} className="rounded-[10px] border border-black/12 p-4">
                          <label className="grid gap-2">
                            <span className="text-[14px] font-medium text-black/85">Date</span>
                            <input
                              type="date"
                              value={override.date}
                              onChange={(event) =>
                                updateOverride(override.id, (current) => ({ ...current, date: event.target.value }))
                              }
                              className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                            />
                          </label>

                          <div className="mt-4 flex items-center gap-3">
                            <ToggleSwitch
                              checked={!override.isClosed}
                              onChange={(checked) =>
                                updateOverride(override.id, (current) => ({
                                  ...current,
                                  isClosed: !checked,
                                  slots: checked
                                    ? current.slots.length
                                      ? current.slots
                                      : [{ id: makeId("override-slot"), start: "09:00", end: "17:00", sortOrder: 1 }]
                                    : [],
                                }))
                              }
                              label={`${override.date} custom hours`}
                            />
                            <span className="text-[14px] text-black/70">{override.isClosed ? "Closed" : "Custom hours"}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => resetOverrideToRegularHours(override.id, override.date)}
                              className="inline-flex min-h-[34px] items-center rounded-full border border-black/12 px-3 py-1 text-[12px] font-medium text-black/70"
                            >
                              Use regular hours
                            </button>
                          </div>

                          {!override.isClosed && override.slots.length ? (
                            <div className="mt-4 space-y-3">
                              {override.slots.map((slot, slotIndex) => (
                                <div key={slot.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_28px] sm:items-center">
                                  <select
                                    value={slot.start}
                                    onChange={(event) =>
                                      updateOverride(override.id, (current) => ({
                                        ...current,
                                        slots: current.slots.map((item) =>
                                          item.id === slot.id ? { ...item, start: event.target.value } : item
                                        ),
                                      }))
                                    }
                                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                                  >
                                    {scheduleTimeOptions.map((value) => (
                                      <option key={value} value={value}>
                                        {formatScheduleTimeLabel(value)}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="hidden text-center text-[18px] text-black/45 sm:block">-</span>
                                  <select
                                    value={slot.end}
                                    onChange={(event) =>
                                      updateOverride(override.id, (current) => ({
                                        ...current,
                                        slots: current.slots.map((item) =>
                                          item.id === slot.id ? { ...item, end: event.target.value } : item
                                        ),
                                      }))
                                    }
                                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                                  >
                                    {scheduleTimeOptions.map((value) => (
                                      <option key={value} value={value}>
                                        {formatScheduleTimeLabel(value)}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      slotIndex === 0
                                        ? updateOverride(override.id, (current) => ({
                                            ...current,
                                            slots: [
                                              ...current.slots,
                                              {
                                                id: makeId("override-slot"),
                                                start: slot.end,
                                                end: minutesToTime(Math.min(timeToMinutes(slot.end) + 60, 23 * 60 + 45)),
                                                sortOrder: current.slots.length + 1,
                                              },
                                            ],
                                          }))
                                        : updateOverride(override.id, (current) => ({
                                            ...current,
                                            slots: current.slots.filter((item) => item.id !== slot.id),
                                          }))
                                    }
                                    className="grid h-7 w-7 place-items-center text-black/55"
                                    aria-label={slotIndex === 0 ? "Add override slot" : "Remove override slot"}
                                  >
                                    <Icon name={slotIndex === 0 ? "plus" : "trash"} className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                overrides: current.overrides.filter((item) => item.id !== override.id),
                              }))
                            }
                            className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium text-black/55"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                            Remove override
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-black/10 bg-[#f7f8fb] px-6 py-5">
            {isEditMode ? (
              deleteGuardMessage ? (
                <div className="max-w-[220px] text-[12px] leading-5 text-black/45">{deleteGuardMessage}</div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onDelete?.()}
                  className="rounded-lg border border-[#e7c3bf] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#b33a30]"
                >
                  Delete
                </button>
              )
            ) : (
              <div />
            )}
            <div className="flex items-center gap-4">
              <button type="button" onClick={onBack} className="text-[15px] font-medium text-black/65">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="rounded-lg bg-[#1f1b1b] px-6 py-3 text-[15px] font-medium text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoomEditorView({
  backHref,
  state,
  showToast,
  roomName,
  deleteGuardMessage = null,
  onCancel,
  onDelete,
  onSave,
}: {
  backHref: string;
  state: AppState;
  showToast: (message: string) => void;
  roomName?: string;
  deleteGuardMessage?: string | null;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSave: (draft: RoomEditorDraft) => Promise<void>;
}) {
  const scheduleOptions = useMemo(
    () => (state.schedules.length ? state.schedules : defaultState.schedules).map((schedule) => ({
      label: schedule.name,
      value: schedule.id,
    })),
    [state.schedules]
  );
  const fallbackScheduleId = scheduleOptions[0]?.value ?? "schedule-working-hours";
  const initialDraft = useMemo<RoomEditorDraft>(() => ({
    name: roomName ?? "",
    scheduleId:
      scheduleForRoom(state.schedules.length ? state.schedules : defaultState.schedules, roomName ?? "")?.id ??
      fallbackScheduleId,
    parentRoom: state.facility.name,
  }), [fallbackScheduleId, roomName, state.facility.name, state.schedules]);
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
                      value={draft.scheduleId}
                      onChange={(value) => setDraft((current) => ({ ...current, scheduleId: value }))}
                      options={scheduleOptions.map((option) => [option.value, option.label] as [string, string])}
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
                      onClick={() => void onDelete?.()}
                      className="rounded-lg border border-[#e7c3bf] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#b33a30] transition hover:bg-[#fff3f1]"
                    >
                      Delete
                    </button>
                  )
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
                    value={draft.scheduleId}
                    onChange={(event) => setDraft((current) => ({ ...current, scheduleId: event.target.value }))}
                    className="min-h-[48px] rounded-[8px] border border-black/12 px-4 text-[14px] outline-none"
                  >
                    {scheduleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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

          <div className="flex items-center justify-between gap-4 border-t border-black/10 bg-[#f7f8fb] px-6 py-5">
            {roomName ? (
              deleteGuardMessage ? (
                <div className="max-w-[220px] text-[12px] leading-5 text-black/45">{deleteGuardMessage}</div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onDelete?.()}
                  className="rounded-lg border border-[#e7c3bf] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#b33a30]"
                >
                  Delete
                </button>
              )
            ) : (
              <div />
            )}
            <div className="flex items-center gap-4">
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
  const toolbarButtons = ["\u21b6", "\u21b7", "\u00b6", "B", "I", "U", "S", "<>", "\u21d7", "\u2261", "\u2630"];

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
    <label className="grid min-w-0 gap-1.5">
      <span className="text-sm font-semibold text-black/70">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-black/10 px-3 pr-10 outline-none focus:border-black/30"
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

function ConstrainedSelectField({
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedOptions = useMemo(
    () => options.map((option) => (Array.isArray(option) ? option : [option, option])),
    [options]
  );
  const selectedLabel =
    normalizedOptions.find((option) => option[0] === value)?.[1] ?? normalizedOptions[0]?.[1] ?? "";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-sm font-semibold text-black/70">{label}</span>
      <div ref={rootRef} className="relative min-w-0">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex min-h-10 w-full min-w-0 max-w-full items-center rounded-lg border border-black/10 px-3 pr-10 text-left outline-none transition focus:border-black/30"
        >
          <span className="block min-w-0 flex-1 truncate">{selectedLabel}</span>
          <Icon
            name="chevron"
            className={[
              "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 transition",
              open ? "rotate-90" : "",
            ].join(" ")}
          />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[95] w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <div className="max-h-56 overflow-y-auto py-1">
              {normalizedOptions.map((option) => {
                const active = option[0] === value;
                return (
                  <button
                    key={option[0]}
                    type="button"
                    onClick={() => {
                      onChange(option[0]);
                      setOpen(false);
                    }}
                    className={[
                      "flex w-full min-w-0 items-center px-3 py-2 text-left text-sm transition",
                      active ? "bg-black text-white" : "text-black hover:bg-black/[0.04]",
                    ].join(" ")}
                  >
                    <span className="block min-w-0 flex-1 truncate">{option[1]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
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
                          <span aria-hidden="true">{"\u2192"}</span>
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
  customerMembershipsByCustomerId,
  membershipCreditLedger,
  showToast,
  showBookingConflictDialog,
  onClose,
  onSave,
  onChargeBooking,
}: {
  modal: NonNullable<ModalState>;
  state: AppState;
  activeDate: string;
  customerMembershipsByCustomerId: Record<string, CustomerMembershipRecord[]>;
  membershipCreditLedger: MembershipCreditLedgerEntry[];
  showToast: (message: string) => void;
  showBookingConflictDialog: (message?: string) => void;
  onClose: () => void;
  onSave: (next: AppState, message: string, change: ModalSaveChange) => void;
  onChargeBooking: (booking: Booking) => void;
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
          customerId: modal.seed?.customerId ?? "",
          playerName: modal.seed?.playerName ?? "",
          serviceId: modal.seed?.serviceId ?? "",
          serviceName: "",
          calendarColor: DEFAULT_SERVICE_CALENDAR_COLOR,
          resource: modal.seed?.resource ?? state.resources[0] ?? "",
          status: modal.seed?.status ?? ("Confirmed" as const),
          paid: modal.seed?.paid ?? false,
          paidByMembershipCredit: modal.seed?.paidByMembershipCredit ?? false,
          membershipCreditMembershipId: modal.seed?.membershipCreditMembershipId ?? "",
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
  const selectedBookingCustomer =
    bookingDraft ? state.customers.find((item) => item.id === bookingDraft.customerId) ?? null : null;
  const bookingCustomerOptions: Array<[string, string]> = [
    ["", "Select customer"],
    ...state.customers.map((item): [string, string] => [item.id, item.name.trim() || item.player.trim() || "Customer"]),
  ];
  const bookingPlayerOptions: Array<[string, string]> = selectedBookingCustomer
    ? [
        ["", "Select player"] as [string, string],
        ...Array.from(
          new Set(
            [
              selectedBookingCustomer.player.trim(),
              ...selectedBookingCustomer.familyMembers
                .map((member) => `${member.firstName} ${member.lastName}`.trim())
                .filter(Boolean),
            ].filter(Boolean)
          )
        ).map((name): [string, string] => [name, name]),
      ]
    : [["", "Select player"]];
  const resolveBookingModalServiceKind = (category?: ServiceSection | null): BookingModalServiceKind => {
    switch (category) {
      case "lessons":
      case "camps":
      case "classes":
      case "rentals":
        return category;
      default:
        return "rentals";
    }
  };
  const matchedBookingService =
    bookingDraft
      ? findServiceForCalendarSlot(state.services, bookingDraft.resource, bookingDurationMinutes(bookingDraft), {
          date: bookingDraft.date,
          start: bookingDraft.start,
          end: bookingDraft.end,
          schedules: state.schedules,
        })
      : null;
  const selectedBookingService =
    bookingDraft ? state.services.find((item) => item.id === bookingDraft.serviceId) ?? null : null;
  const effectiveBookingService = bookingDraft?.serviceId ? selectedBookingService ?? matchedBookingService : null;
  const [bookingServiceKind, setBookingServiceKind] = useState<BookingModalServiceKind>(() => {
    if (!bookingDraft) return "rentals";
    if (isUnavailableBooking(bookingDraft)) return "unavailable";
    return resolveBookingModalServiceKind(selectedBookingService?.category ?? matchedBookingService?.category);
  });
  const [bookingTypeTouched, setBookingTypeTouched] = useState(false);
  const bookingServiceItems: { key: BookingModalServiceKind; label: string; icon: IconName }[] = [
    { key: "rentals", label: "Rental", icon: "clock" },
    { key: "lessons", label: "Lesson", icon: "user" },
    { key: "camps", label: "Camp", icon: "calendar" },
    { key: "classes", label: "Class", icon: "user" },
    { key: "unavailable", label: "Unavailable", icon: "x" },
  ];
  const bookingServiceOptions =
    bookingServiceKind === "unavailable"
      ? []
      : [
          ["", "Select service"] as [string, string],
          ...state.services
            .filter((item) => item.category === bookingServiceKind)
            .map((item): [string, string] => [item.id, item.name]),
        ];
  const activeBookingDraft = modal.type === "booking" ? (draft as Booking) : null;
  const activeBookingServiceId = activeBookingDraft?.serviceId ?? "";
  const activeBookingDate = activeBookingDraft?.date ?? activeDate;
  const activeBookingCustomer = activeBookingDraft?.customerId
    ? state.customers.find((customer) => customer.id === activeBookingDraft.customerId) ?? null
    : null;
  const eligibleCreditOptions =
    (activeBookingDraft?.customerId || activeBookingDraft?.playerName) &&
    activeBookingServiceId &&
    bookingServiceKind !== "unavailable"
      ? membershipRecordsForBookingCustomer(
          customerMembershipsByCustomerId,
          state.customers,
          activeBookingDraft.customerId,
          activeBookingDraft.playerName,
          activeBookingCustomer?.name,
        )
          .map((record) => {
            const membershipService =
              state.services.find((service) => service.id === record.membershipServiceId) ?? null;
            return { record, membershipService };
          })
          .filter(({ record, membershipService }) =>
            membershipCanUseCredit(record, activeBookingServiceId, activeBookingDate, membershipService)
          )
          .map(({ record, membershipService }) => {
            const remaining = membershipCreditRemaining(
              record,
              activeBookingDate,
              membershipCreditLedger,
              activeBookingDraft.id,
              membershipService,
            );
            const creditLimitPeriod = membershipCreditSettings(record, membershipService).creditLimitPeriod;

            return {
              record,
              remaining,
              membershipService,
              creditLimitPeriod,
            };
          })
          .filter(
            ({ record, remaining }) =>
              remaining > 0 || activeBookingDraft.membershipCreditMembershipId === record.id,
          )
      : [];
  const canSave =
    modal.type !== "customer" ||
    Boolean(customerName.first.trim() && customerName.last.trim() && customerDraft.email.trim());

  useEffect(() => {
    if (!bookingDraft) return;

    if (!bookingDraft.serviceId && bookingTypeTouched) return;

    const nextKind: BookingModalServiceKind =
      isUnavailableBooking(bookingDraft)
        ? "unavailable"
        : bookingDraft.serviceId
          ? resolveBookingModalServiceKind(selectedBookingService?.category ?? matchedBookingService?.category)
          : bookingServiceKind;

    setBookingServiceKind((current) => (current === nextKind ? current : nextKind));
  }, [
    bookingDraft,
    bookingDraft?.serviceId,
    bookingDraft?.serviceName,
    bookingServiceKind,
    bookingTypeTouched,
    matchedBookingService?.category,
    selectedBookingService?.category,
  ]);

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
      const item = normalizeUnavailableBooking({ ...(draft as Booking), id: draft.id || makeId("bk") });
      const scheduleConflictMessage = bookingScheduleConflictMessage(item, state.services, state.schedules);

      if (scheduleConflictMessage) {
        showBookingConflictDialog(scheduleConflictMessage);
        return;
      }

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
    const didChangeCustomer = Object.prototype.hasOwnProperty.call(next, "customerId");
    const didChangeDate = Object.prototype.hasOwnProperty.call(next, "date");
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
    if (
      (didChangeCustomer || didChangeService || didChangeDate) &&
      !Object.prototype.hasOwnProperty.call(next, "membershipCreditMembershipId")
    ) {
      normalizedBooking = {
        ...normalizedBooking,
        membershipCreditMembershipId: "",
        paidByMembershipCredit: false,
        paid: current.paidByMembershipCredit ? false : normalizedBooking.paid,
      };
    }

    const isUnavailableMode =
      bookingServiceKind === "unavailable" ||
      isUnavailableBooking(normalizedBooking);

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

    if (isUnavailableMode && !selectedServiceFromChange) {
      setDraft({
        ...normalizedBooking,
        customerId: "",
        playerName: "",
        serviceId: "",
        serviceName: UNAVAILABLE_SERVICE_NAME,
        calendarColor: normalizedBooking.calendarColor || "#6b7280",
        paid: false,
        paidByMembershipCredit: false,
        membershipCreditMembershipId: "",
      } as typeof draft);
      return;
    }

    const nextService = findServiceForCalendarSlot(
      state.services,
      normalizedBooking.resource,
      bookingDurationMinutes(normalizedBooking),
      {
        date: normalizedBooking.date,
        start: normalizedBooking.start,
        end: normalizedBooking.end,
        schedules: state.schedules,
      }
    );
    const resolvedService = didChangeService
      ? next.serviceId
        ? state.services.find((item) => item.id === next.serviceId) ?? null
        : null
      : normalizedBooking.serviceId
        ? state.services.find((item) => item.id === normalizedBooking.serviceId) ?? nextService
        : null;

    setDraft({
      ...normalizedBooking,
      serviceId: resolvedService?.id ?? "",
      serviceName: resolvedService?.name ?? "",
      calendarColor: resolvedService?.calendarColor ?? DEFAULT_SERVICE_CALENDAR_COLOR,
    } as typeof draft);
  }

  function changeBookingServiceKind(kind: BookingModalServiceKind) {
    if (modal.type !== "booking") return;

    setBookingTypeTouched(true);
    setBookingServiceKind(kind);

    if (kind === "unavailable") {
      patchBooking({
        serviceId: "",
        serviceName: UNAVAILABLE_SERVICE_NAME,
        customerId: "",
        playerName: "",
        calendarColor: "#6b7280",
        paid: false,
        paidByMembershipCredit: false,
        membershipCreditMembershipId: "",
      });
      return;
    }

    setDraft({
      ...(draft as Booking),
      serviceId: "",
      serviceName: "",
      calendarColor: DEFAULT_SERVICE_CALENDAR_COLOR,
      paid: false,
      paidByMembershipCredit: false,
      membershipCreditMembershipId: "",
    } as typeof draft);
  }

  function cancelBooking() {
    if (modal.type !== "booking") return;
    const item = { ...(draft as Booking), status: "Cancelled" as const };
    onSave({ ...state, bookings: upsert(state.bookings, item) }, "Booking cancelled.", { type: "booking", item });
  }

  function chargeBooking() {
    if (modal.type !== "booking") return;

    const item = draft as Booking;
    if (!item.id) {
      showToast("Save the booking before charging it.");
      return;
    }
    if (!item.customerId) {
      showToast("Choose a customer before charging this booking.");
      return;
    }
    if (item.status === "Cancelled") {
      showToast("Cancelled bookings cannot be charged.");
      return;
    }
    if (item.paid) {
      showToast("This booking is already marked paid.");
      return;
    }

    onChargeBooking(item);
  }

  function toggleCustomerSection(section: string) {
    setOpenCustomerSections((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section]
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold capitalize">{title}</h2>
          <RowAction icon="x" label="Close" onClick={onClose} />
        </div>

        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
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
              <div className="sm:col-span-2">
                <div className="mb-2 text-sm font-semibold text-black/70">Booking Type</div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {bookingServiceItems.map((item) => {
                    const active = bookingServiceKind === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => changeBookingServiceKind(item.key)}
                        className={[
                          "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                          active
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-white text-black hover:bg-black/[0.03]",
                        ].join(" ")}
                      >
                        <Icon name={item.icon} className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <TextField label="Date" type="date" value={(draft as Booking).date} onChange={(value) => patchBooking({ date: value })} />
              <SelectField label="Status" value={(draft as Booking).status} onChange={(value) => patchBooking({ status: value as Booking["status"] })} options={["Confirmed", "Pending", "Cancelled"]} />
              <TextField label="Start" type="time" value={(draft as Booking).start} onChange={(value) => patchBooking({ start: value })} />
              <TextField label="End" type="time" value={(draft as Booking).end} onChange={(value) => patchBooking({ end: value })} />
              {bookingServiceKind !== "unavailable" ? (
                <>
                  <SelectField
                    label="Customer"
                    value={(draft as Booking).customerId}
                    onChange={(value) => {
                      patchBooking({
                        customerId: value,
                        playerName: "",
                      });
                    }}
                    options={bookingCustomerOptions}
                  />
                  <SelectField
                    label="Player"
                    value={(draft as Booking).playerName ?? ""}
                    onChange={(value) => patchBooking({ playerName: value })}
                    options={bookingPlayerOptions}
                  />
                </>
              ) : null}
              {bookingServiceKind === "unavailable" ? (
                <div className="grid gap-2">
                  <div className="text-sm font-semibold text-black/70">Service</div>
                  <div className="min-h-10 rounded-lg border border-dashed border-black/15 bg-black/[0.02] px-3 py-2 text-sm text-black/60">
                    This block will be marked unavailable and won&apos;t be tied to a service.
                  </div>
                </div>
              ) : (
                <ConstrainedSelectField
                  label="Service"
                  value={(draft as Booking).serviceId}
                  onChange={(value) => patchBooking({ serviceId: value })}
                  options={bookingServiceOptions}
                />
              )}
              <SelectField label="Resource" value={(draft as Booking).resource} onChange={(value) => patchBooking({ resource: value })} options={state.resources} />
              {(activeBookingDraft?.customerId || activeBookingDraft?.playerName) &&
              activeBookingDraft.serviceId &&
              eligibleCreditOptions.length ? (
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-black/70">Membership Credit</span>
                  <select
                    value={activeBookingDraft.membershipCreditMembershipId ?? ""}
                    onChange={(event) => {
                      const membershipId = event.target.value;
                      patchBooking({
                        membershipCreditMembershipId: membershipId,
                        paidByMembershipCredit: Boolean(membershipId),
                        paid: membershipId ? true : Boolean(activeBookingDraft.paid && !activeBookingDraft.paidByMembershipCredit),
                      });
                    }}
                    className="h-12 w-full rounded-md border border-black/10 bg-white px-4 text-base outline-none focus:border-black/35"
                  >
                    <option value="">Do not use membership credit</option>
                    {eligibleCreditOptions.map(({ record, remaining, membershipService, creditLimitPeriod }) => (
                      <option key={record.id} value={record.id}>
                        {membershipService?.name || "Membership"} - {remaining} credit{remaining === 1 ? "" : "s"} left{" "}
                        {membershipCreditLimitPeriodRemainingLabel(creditLimitPeriod)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="sm:col-span-2 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-black/70">Booking Summary</div>
                    <div className="mt-2 text-base font-semibold text-black">
                      {effectiveBookingService?.name || "No matching service selected"}
                    </div>
                    <div className="mt-1 text-sm text-black/55">
                      {bookingDraft ? `${bookingDurationMinutes(bookingDraft)} minutes - ${bookingDraft.resource || "No room selected"}` : ""}
                    </div>
                    {bookingDraft?.paidByMembershipCredit ? (
                      <div className="mt-2 inline-flex rounded-full bg-[#ede9fe] px-2.5 py-1 text-xs font-semibold text-[#5b21b6]">
                        Paid with membership credit
                      </div>
                    ) : null}
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
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            {modal.type === "booking" && modal.id && (draft as Booking).status !== "Cancelled" ? (
              <>
                <button
                  type="button"
                  onClick={chargeBooking}
                  disabled={(draft as Booking).paid || !effectiveBookingService || effectiveBookingService.price <= 0}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                >
                  {(draft as Booking).paid ? "Already Paid" : "Charge Customer"}
                </button>
                <button
                  type="button"
                  onClick={cancelBooking}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Cancel Booking
                </button>
              </>
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
        booking.playerName || customer?.player || "",
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



