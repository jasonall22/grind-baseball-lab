import BookingAdminApp from "@/components/admin/BookingAdminApp";

export default async function AdminSettingsRoomEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookingAdminApp view="settings-rooms" selectedRoomId={id} />;
}
