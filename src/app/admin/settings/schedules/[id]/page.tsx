import BookingAdminApp from "@/components/admin/BookingAdminApp";

export default async function AdminSettingsScheduleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookingAdminApp view="settings-schedules" selectedScheduleId={id} />;
}
