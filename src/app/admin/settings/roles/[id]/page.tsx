import BookingAdminApp from "@/components/admin/BookingAdminApp";

export default async function AdminSettingsRoleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookingAdminApp view="settings-roles" selectedRoleId={id} />;
}
