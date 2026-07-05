export type BookingAdminView =
  | "home"
  | "services"
  | "calendar"
  | "availability"
  | "customers"
  | "more"
  | "marketing"
  | "retail"
  | "reports"
  | "settings"
  | "settings-profile"
  | "settings-basics"
  | "settings-schedules"
  | "settings-schedules-add"
  | "settings-rooms"
  | "settings-rooms-add"
  | "settings-staff"
  | "settings-roles"
  | "settings-taxes-fees"
  | "settings-registration"
  | "settings-policies";

export const bookingAdminRouteByView: Record<BookingAdminView, string> = {
  home: "/admin/home",
  services: "/admin/services",
  calendar: "/admin/calendar",
  availability: "/admin/availability",
  customers: "/admin/customers",
  more: "/admin/more",
  marketing: "/admin/marketing",
  retail: "/admin/retail",
  reports: "/admin/reports",
  settings: "/admin/settings",
  "settings-profile": "/admin/settings/profile",
  "settings-basics": "/admin/settings/basics",
  "settings-schedules": "/admin/settings/schedules",
  "settings-schedules-add": "/admin/settings/schedules/add",
  "settings-rooms": "/admin/settings/rooms",
  "settings-rooms-add": "/admin/settings/rooms/add",
  "settings-staff": "/admin/settings/staff",
  "settings-roles": "/admin/settings/roles",
  "settings-taxes-fees": "/admin/settings/taxes-fees",
  "settings-registration": "/admin/settings/registration",
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
    case "more":
    case "marketing":
    case "retail":
    case "reports":
    case "settings":
    case "settings-profile":
    case "settings-basics":
    case "settings-schedules":
    case "settings-schedules-add":
    case "settings-rooms":
    case "settings-rooms-add":
    case "settings-staff":
    case "settings-roles":
    case "settings-taxes-fees":
    case "settings-registration":
    case "settings-policies":
      return section;
    default:
      return null;
  }
}
