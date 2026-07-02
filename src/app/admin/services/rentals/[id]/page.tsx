import BookingAdminApp from "@/components/admin/BookingAdminApp";

export default async function AdminRentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookingAdminApp view="services" selectedServiceId={id} />;
}
