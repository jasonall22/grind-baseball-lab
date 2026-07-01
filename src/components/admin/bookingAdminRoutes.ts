export type BookingAdminView =
  | "home"
  | "services"
  | "calendar"
  | "availability"
  | "customers"
  | "marketing"
  | "retail"
  | "reports"
  | "settings"
  | "settings-basics"
  | "settings-policies";

export const bookingAdminRouteByView: Record<BookingAdminView, string> = {
  home: "/admin/home",
  services: "/admin/services",
  calendar: "/admin/calendar",
  availability: "/admin/availability",
  customers: "/admin/customers",
  marketing: "/admin/marketing",
  retail: "/admin/retail",
  reports: "/admin/reports",
  settings: "/admin/settings",
  "settings-basics": "/admin/settings/basics",
  "settings-policies": "/admin/settings/policies",
};

export function bookingAdminViewFromSection(
  section: string
): BookingAdminView | null {
  switch (section) {
    case "home":
    case "services":
    case "calendar":
    case "availability":
    case "customers":
    case "marketing":
    case "retail":
    case "reports":
    case "settings":
    case "settings-basics":
    case "settings-policies":
      return section;
    default:
      return null;
  }
}
