import { notFound } from "next/navigation";

import BookingAdminApp from "@/components/admin/BookingAdminApp";
import { bookingAdminViewFromSection } from "@/components/admin/bookingAdminRoutes";

export default async function AdminBookingSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const view = bookingAdminViewFromSection(section);

  if (!view) {
    notFound();
  }

  return <BookingAdminApp view={view} />;
}
