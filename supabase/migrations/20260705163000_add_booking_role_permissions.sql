create table if not exists public.booking_role_permissions (
  role text primary key check (role in ('Owner', 'Admin', 'Instructor', 'Staff')),
  enabled_permissions text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_booking_role_permissions on public.booking_role_permissions;
create trigger touch_booking_role_permissions
before update on public.booking_role_permissions
for each row execute function public.touch_updated_at();

alter table public.booking_role_permissions enable row level security;

drop policy if exists "Admins can manage booking role permissions" on public.booking_role_permissions;
create policy "Admins can manage booking role permissions"
on public.booking_role_permissions
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.booking_role_permissions (role, enabled_permissions, sort_order)
select *
from (
  values
    (
      'Owner',
      array[
        'rentals.view','rentals.add','rentals.edit','rentals.delete',
        'lessons.view','lessons.add','lessons.edit','lessons.delete',
        'camps.view','camps.add','camps.edit','camps.delete',
        'classes.view','classes.add','classes.edit','classes.delete',
        'memberships.view','memberships.add','memberships.edit','memberships.delete',
        'packages.view','packages.add','packages.edit','packages.delete',
        'addons.view',
        'calendar.view','calendar.addBookings','calendar.editBookings','calendar.deleteBookings','calendar.viewOwnStaffCalendar','calendar.viewAllStaffCalendar','calendar.viewEquipmentCalendar',
        'availability.view','availability.viewAny','availability.addAny','availability.editAny','availability.deleteAny',
        'customers.view','customers.add','customers.edit','customers.chargeRefund','customers.addBilling','customers.editBilling','customers.deleteBilling','customers.createInvoices','customers.manageWallet','customers.assignPackages','customers.assignMemberships','customers.delete',
        'equipment.view',
        'marketing.view','marketing.viewCoupons','marketing.addCoupons','marketing.editCoupons','marketing.deleteCoupons','marketing.viewGiftCards','marketing.viewEmailBlasts','marketing.manageEmailBlasts',
        'retail.sellProducts','retail.manageProducts','retail.manageCategories',
        'reports.view','reports.bookings','reports.occupancy','reports.customers','reports.payroll','reports.revenue','reports.unpaid','reports.invoices','reports.retailSales','reports.retailItems','reports.wallet','reports.customerCredits',
        'facility.view','facility.editDetails','facility.viewRooms','facility.addRooms','facility.editRooms','facility.deleteRooms','facility.viewSchedules','facility.addSchedules','facility.editSchedules','facility.deleteSchedules',
        'booking.viewPage','booking.editPage','booking.viewPolicies','booking.editPolicies','booking.viewRegistration','booking.editRegistration',
        'payments.view','payments.edit','payments.viewTaxesFees','payments.manageTaxRates','payments.manageCustomFees',
        'people.viewStaff','people.addStaff','people.editStaff','people.deleteStaff','people.viewRoles',
        'platform.viewPlan','platform.viewPayouts','platform.viewIntegrations','platform.editAutomations','platform.viewSenders','platform.addSenders','platform.editSenders','platform.deleteSenders'
      ]::text[],
      1
    ),
    (
      'Admin',
      array[
        'rentals.view','rentals.add','rentals.edit','rentals.delete',
        'lessons.view','lessons.add','lessons.edit','lessons.delete',
        'camps.view','camps.add','camps.edit','camps.delete',
        'classes.view','classes.add','classes.edit','classes.delete',
        'memberships.view','memberships.add','memberships.edit','memberships.delete',
        'packages.view','packages.add','packages.edit','packages.delete',
        'addons.view',
        'calendar.view','calendar.addBookings','calendar.editBookings','calendar.deleteBookings','calendar.viewOwnStaffCalendar','calendar.viewAllStaffCalendar','calendar.viewEquipmentCalendar',
        'availability.view','availability.viewAny','availability.addAny','availability.editAny','availability.deleteAny',
        'customers.view','customers.add','customers.edit','customers.chargeRefund','customers.addBilling','customers.editBilling','customers.deleteBilling','customers.createInvoices','customers.manageWallet','customers.assignPackages','customers.assignMemberships','customers.delete',
        'equipment.view',
        'marketing.view','marketing.viewCoupons','marketing.addCoupons','marketing.editCoupons','marketing.deleteCoupons','marketing.viewGiftCards','marketing.viewEmailBlasts','marketing.manageEmailBlasts',
        'retail.sellProducts','retail.manageProducts','retail.manageCategories',
        'reports.view','reports.bookings','reports.occupancy','reports.customers','reports.payroll','reports.revenue','reports.unpaid','reports.invoices','reports.retailSales','reports.retailItems','reports.wallet','reports.customerCredits',
        'facility.view','facility.editDetails','facility.viewRooms','facility.addRooms','facility.editRooms','facility.deleteRooms','facility.viewSchedules','facility.addSchedules','facility.editSchedules','facility.deleteSchedules',
        'booking.viewPage','booking.editPage','booking.viewPolicies','booking.editPolicies','booking.viewRegistration','booking.editRegistration',
        'payments.view','payments.edit','payments.viewTaxesFees','payments.manageTaxRates','payments.manageCustomFees',
        'people.viewStaff','people.addStaff','people.editStaff','people.deleteStaff','people.viewRoles',
        'platform.viewPlan','platform.viewPayouts','platform.viewIntegrations','platform.editAutomations','platform.viewSenders','platform.addSenders','platform.editSenders','platform.deleteSenders'
      ]::text[],
      2
    ),
    (
      'Staff',
      array[
        'rentals.view','lessons.view','camps.view','classes.view','memberships.view','packages.view',
        'calendar.view','calendar.addBookings','calendar.editBookings',
        'availability.view','availability.viewAny',
        'customers.view','customers.add','customers.edit',
        'marketing.view','retail.sellProducts','reports.view'
      ]::text[],
      3
    ),
    (
      'Instructor',
      array[
        'lessons.view','lessons.edit',
        'calendar.view','calendar.addBookings','calendar.editBookings',
        'availability.view','availability.viewAny',
        'customers.view','customers.edit'
      ]::text[],
      4
    )
) as seed(role, enabled_permissions, sort_order)
where not exists (
  select 1
  from public.booking_role_permissions
);
