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
  | "settings-rooms"
  | "settings-rooms-add"
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
  settings: "/admin/more",
  "settings-basics": "/admin/settings/basics",
  "settings-rooms": "/admin/settings/rooms",
  "settings-rooms-add": "/admin/settings/rooms/add",
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
    case "settings-rooms":
    case "settings-rooms-add":
    case "settings-policies":
      return section;
    default:
      return null;
  }
}
