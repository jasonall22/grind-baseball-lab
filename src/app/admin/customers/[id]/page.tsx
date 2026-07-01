import BookingAdminApp from "@/components/admin/BookingAdminApp";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookingAdminApp view="customers" selectedCustomerId={id} />;
}
