import { notFound } from "next/navigation";

import BookingAdminApp, {
  bookingAdminViewFromSection,
} from "@/components/admin/BookingAdminApp";

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
