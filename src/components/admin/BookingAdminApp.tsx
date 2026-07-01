"use client";

import { useMemo, useState } from "react";

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
  notes: string;
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
      notes: "Varsity middle infielder",
    },
    {
      id: "cust-jackson",
      name: "Avery Johnson",
      player: "Jackson Johnson",
      email: "avery.johnson@example.com",
      phone: "(407) 555-0192",
      notes: "Pitching package",
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
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

  function updateState(updater: (current: AppState) => AppState) {
    setState((current) => {
      const next = updater(current);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
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
              onDelete={(id) =>
                updateState((current) => ({
                  ...current,
                  services: current.services.filter((service) => service.id !== id),
                }))
              }
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
              onChange={(rows) => updateState((current) => ({ ...current, availability: rows }))}
              onSave={() => showToast("Availability saved.")}
            />
          ) : null}
          {view === "customers" ? (
            <CustomersView
              customers={state.customers}
              bookings={state.bookings}
              search={customerSearch}
              onSearch={setCustomerSearch}
              onNew={() => setModal({ type: "customer" })}
              onEdit={(id) => setModal({ type: "customer", id })}
              onDelete={(id) =>
                updateState((current) => ({
                  ...current,
                  customers: current.customers.filter((customer) => customer.id !== id),
                  bookings: current.bookings.filter((booking) => booking.customerId !== id),
                }))
              }
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
              onSave={(next) => {
                updateState(() => next);
                showToast("Settings saved.");
              }}
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
          onSave={(next, message) => {
            updateState(() => next);
            setModal(null);
            showToast(message);
          }}
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
  onNew,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  bookings: Booking[];
  search: string;
  onSearch: (value: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = customers.filter((customer) =>
    [customer.name, customer.player, customer.email, customer.phone]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section className="min-h-screen px-6 py-8">
      <PageHeader title="Customers" subtitle="Parents, players, and booking history.">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search customers"
          className="min-h-10 rounded-lg border border-black/10 px-3 text-sm"
        />
        <PrimaryButton icon="plus" onClick={onNew}>
          New customer
        </PrimaryButton>
      </PageHeader>

      <DataTable headers={["Customer", "Player", "Email", "Phone", "Bookings", ""]}>
        {filtered.map((customer) => (
          <tr key={customer.id}>
            <Td><strong>{customer.name}</strong></Td>
            <Td>{customer.player}</Td>
            <Td>{customer.email}</Td>
            <Td>{customer.phone}</Td>
            <Td>{bookings.filter((booking) => booking.customerId === customer.id).length}</Td>
            <Td align="right">
              <div className="flex justify-end gap-2">
                <RowAction icon="edit" label="Edit customer" onClick={() => onEdit(customer.id)} />
                <RowAction icon="trash" label="Delete customer" onClick={() => onDelete(customer.id)} />
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>
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
  onSave: (next: AppState, message: string) => void;
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
          notes: "",
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
      onSave({ ...state, services: upsert(state.services, item) }, "Service saved.");
    }
    if (modal.type === "booking") {
      const item = { ...(draft as Booking), id: draft.id || makeId("bk") };
      onSave({ ...state, bookings: upsert(state.bookings, item) }, "Booking saved.");
    }
    if (modal.type === "customer") {
      const item = { ...(draft as Customer), id: draft.id || makeId("cust") };
      onSave({ ...state, customers: upsert(state.customers, item) }, "Customer saved.");
    }
    if (modal.type === "campaign") {
      const item = { ...(draft as Campaign), id: draft.id || makeId("cmp") };
      onSave({ ...state, campaigns: upsert(state.campaigns, item) }, "Campaign saved.");
    }
    if (modal.type === "product") {
      const item = { ...(draft as Product), id: draft.id || makeId("prd") };
      onSave({ ...state, products: upsert(state.products, item) }, "Item saved.");
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
