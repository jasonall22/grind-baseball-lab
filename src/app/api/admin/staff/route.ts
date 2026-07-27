import { NextResponse } from "next/server";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type StaffRole = "Owner" | "Admin" | "Instructor" | "Staff";

type StaffPayload = {
  id: string;
  customerId?: string | null;
  authUserId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  bio?: string | null;
  notes?: string | null;
  role: StaffRole;
  active: boolean;
  calendarColor?: string | null;
};

const staffRoles: StaffRole[] = ["Owner", "Admin", "Instructor", "Staff"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown): StaffRole {
  return staffRoles.includes(value as StaffRole) ? (value as StaffRole) : "Staff";
}

function profileRoleForStaff(_role: StaffRole, active: boolean) {
  if (!active) return "parent";
  return "admin";
}

async function findAuthUserIdByEmail(admin: any, email: string) {
  if (!email) return "";
  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = result.data?.users ?? [];
    const user = users.find((item: { id?: string; email?: string }) => clean(item.email).toLowerCase() === email);
    if (user?.id) return user.id;
    if (users.length < 1000) break;
  }
  return "";
}

function stripLinkColumns<T extends Record<string, unknown>>(member: T) {
  const { customer_id: _customerId, auth_user_id: _authUserId, ...rest } = member;
  return rest;
}

export async function POST(req: Request) {
  const context = await requireAdminRouteContext();
  if ("error" in context) return context.error;

  try {
    const body = (await req.json()) as { staff?: StaffPayload[] };
    const staff = Array.isArray(body.staff) ? body.staff : [];
    if (!staff.length) return routeJsonError("Add at least one staff member.");

    const admin = getSupabaseAdmin() as any;
    const payload = await Promise.all(staff.map(async (member, index) => {
      const name = clean(member.name);
      const email = clean(member.email).toLowerCase();
      const role = normalizeRole(member.role);
      const authUserId = clean(member.authUserId) || (await findAuthUserIdByEmail(admin, email));

      if (!member.id || !name || !email) {
        throw new Error("Every staff member needs a name and email.");
      }

      return {
        id: member.id,
        customer_id: clean(member.customerId) || null,
        auth_user_id: authUserId || null,
        full_name: name,
        email,
        phone: clean(member.phone) || null,
        bio: clean(member.bio) || null,
        notes: clean(member.notes) || null,
        role,
        is_active: Boolean(member.active),
        calendar_color: clean(member.calendarColor) || null,
        sort_order: index + 1,
      };
    }));

    let { error } = await admin.from("booking_staff_members").upsert(payload);
    if (error && /customer_id|auth_user_id|schema cache/i.test(error.message ?? "")) {
      const fallbackPayload = payload.map(stripLinkColumns);
      const fallback = await admin.from("booking_staff_members").upsert(fallbackPayload);
      error = fallback.error;
    }
    if (error) throw error;

    await Promise.all(
      payload
        .filter((member) => member.auth_user_id)
        .map((member) =>
          admin
            .from("profiles")
            .update({ role: profileRoleForStaff(normalizeRole(member.role), Boolean(member.is_active)) })
            .eq("id", member.auth_user_id)
        )
    );

    const refreshed = await admin
      .from("booking_staff_members")
      .select("*")
      .order("is_active", { ascending: false })
      .order("sort_order");

    if (refreshed.error) throw refreshed.error;

    return NextResponse.json({ ok: true, staff: refreshed.data ?? [] });
  } catch (error) {
    return routeJsonError(error instanceof Error ? error.message : "Staff could not be saved.", 500);
  }
}

export async function DELETE(req: Request) {
  const context = await requireAdminRouteContext();
  if ("error" in context) return context.error;

  try {
    const body = (await req.json()) as { id?: string };
    const id = clean(body.id);
    if (!id) return routeJsonError("Missing staff id.");

    const admin = getSupabaseAdmin() as any;
    let staffResult = await admin
      .from("booking_staff_members")
      .select("id,email,auth_user_id")
      .eq("id", id)
      .maybeSingle();
    if (staffResult.error && /auth_user_id|schema cache/i.test(staffResult.error.message ?? "")) {
      staffResult = await admin
        .from("booking_staff_members")
        .select("id,email")
        .eq("id", id)
        .maybeSingle();
    }
    if (staffResult.error) throw staffResult.error;

    const staffRow = staffResult.data as { auth_user_id?: string | null; email?: string | null } | null;
    const authUserId = clean(staffRow?.auth_user_id) || (await findAuthUserIdByEmail(admin, clean(staffRow?.email).toLowerCase()));
    const deleteResult = await admin.from("booking_staff_members").delete().eq("id", id);
    if (deleteResult.error) throw deleteResult.error;

    if (authUserId) {
      await admin.from("profiles").update({ role: "parent" }).eq("id", authUserId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeJsonError(error instanceof Error ? error.message : "Staff member could not be deleted.", 500);
  }
}
