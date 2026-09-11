import { createServerFn } from "@tanstack/react-start";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db.server";
import { resolveTenantIdFromHost, getDefaultTenantId } from "@/lib/tenant-context";
import type {
  CreateTenantInput,
  PlanType,
  TenantBrandingDTO,
  TenantDTO,
  TenantUsageDTO,
} from "@/lib/types";

export const PLAN_LIMITS: Record<
  PlanType,
  { bookingsPerYear: number; leads: number; users: number }
> = {
  STARTER: { bookingsPerYear: 500, leads: 1_000, users: 5 },
  PROFESSIONAL: { bookingsPerYear: 5_000, leads: 10_000, users: 25 },
  ENTERPRISE: { bookingsPerYear: Infinity, leads: Infinity, users: Infinity },
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

function toDTO(t: {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  emailFrom: string | null;
  customDomain: string | null;
  active: boolean;
  createdAt: Date;
  _count?: { users: number };
}): TenantDTO {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    ...(t.logoUrl ? { logoUrl: t.logoUrl } : {}),
    ...(t.primaryColor ? { primaryColor: t.primaryColor } : {}),
    ...(t.accentColor ? { accentColor: t.accentColor } : {}),
    ...(t.emailFrom ? { emailFrom: t.emailFrom } : {}),
    ...(t.customDomain ? { customDomain: t.customDomain } : {}),
    active: t.active,
    userCount: t._count?.users ?? 0,
    createdAt: t.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

async function computeUsage(tenantId: string): Promise<TenantUsageDTO> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  const plan = tenant?.plan ?? "STARTER";
  const [bookings, leads, users, attachments] = await Promise.all([
    db.booking.count({ where: { tenantId, createdAt: { gte: yearStart } } }),
    db.lead.count({ where: { tenantId } }),
    db.user.count({ where: { tenantId } }),
    db.bookingAttachment.count({ where: { booking: { tenantId } } }),
  ]);
  const limits = PLAN_LIMITS[plan];
  const withinLimits =
    bookings < limits.bookingsPerYear && leads < limits.leads && users < limits.users;
  return {
    tenantId,
    plan,
    bookingsYear: bookings,
    leads,
    users,
    attachments,
    limits,
    withinLimits,
  };
}

// ---------------------------------------------------------------------------
// Tenant CRUD
// ---------------------------------------------------------------------------

export const listTenants = createServerFn({ method: "GET" }).handler(
  async (): Promise<TenantDTO[]> => {
    const tenants = await db.tenant.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });
    return tenants.map(toDTO);
  },
);

export const getTenant = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<TenantDTO | null> => {
    const tenant = await db.tenant.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    return tenant ? toDTO(tenant) : null;
  });

/**
 * Agency onboarding — creates the tenant and its first admin user in one step.
 */
export const createTenant = createServerFn({ method: "POST" })
  .validator((input: CreateTenantInput) => input)
  .handler(async ({ data }): Promise<TenantDTO> => {
    const slug = data.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    if (!slug) throw new Error("Agency slug is required (e.g. maldives-explorers).");
    const exists = await db.tenant.findUnique({ where: { slug } });
    if (exists) throw new Error(`Agency slug "${slug}" is already taken.`);
    const password = data.adminPassword ?? randomBytes(8).toString("hex");

    const tenant = await db.tenant.create({
      data: {
        name: data.name.trim(),
        slug,
        plan: data.plan ?? "STARTER",
        ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}),
        ...(data.primaryColor ? { primaryColor: data.primaryColor } : {}),
        ...(data.customDomain ? { customDomain: data.customDomain } : {}),
      },
    });
    await db.user.create({
      data: {
        email: data.adminEmail.trim().toLowerCase(),
        fullName: data.adminName.trim(),
        passwordHash: hashPassword(password),
        role: "SUPER_ADMIN",
        tenantId: tenant.id,
      },
    });
    return toDTO({ ...tenant, _count: { users: 1 } });
  });

export const updateTenant = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      emailFrom?: string;
      customDomain?: string;
      active?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const tenant = await db.tenant.update({
      where: { id: data.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
        ...(data.accentColor !== undefined ? { accentColor: data.accentColor } : {}),
        ...(data.emailFrom !== undefined ? { emailFrom: data.emailFrom } : {}),
        ...(data.customDomain !== undefined ? { customDomain: data.customDomain || null } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
    return toDTO({ ...tenant, _count: { users: 0 } });
  });

export const setTenantPlan = createServerFn({ method: "POST" })
  .validator((input: { id: string; plan: PlanType }) => input)
  .handler(async ({ data }) => {
    const tenant = await db.tenant.update({ where: { id: data.id }, data: { plan: data.plan } });
    return toDTO({ ...tenant, _count: { users: 0 } });
  });

export const getTenantUsage = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => computeUsage(id));

// ---------------------------------------------------------------------------
// White label & domain resolution
// ---------------------------------------------------------------------------

export const getTenantByHost = createServerFn({ method: "GET" })
  .validator((host: string) => host)
  .handler(async ({ data: host }): Promise<TenantBrandingDTO | null> => {
    const tenantId = (await resolveTenantIdFromHost(host)) ?? (await getDefaultTenantId());
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;
    return {
      tenantId: tenant.id,
      name: tenant.name,
      ...(tenant.logoUrl ? { logoUrl: tenant.logoUrl } : {}),
      ...(tenant.primaryColor ? { primaryColor: tenant.primaryColor } : {}),
      ...(tenant.accentColor ? { accentColor: tenant.accentColor } : {}),
      ...(tenant.fontFamily ? { fontFamily: tenant.fontFamily } : {}),
      ...(tenant.emailFrom ? { emailFrom: tenant.emailFrom } : {}),
    };
  });

export const resolveTenantForHost = createServerFn({ method: "GET" })
  .validator((host: string) => host)
  .handler(async ({ data: host }) => {
    const tenantId = (await resolveTenantIdFromHost(host)) ?? (await getDefaultTenantId());
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    return tenant ? toDTO({ ...tenant, _count: { users: 0 } }) : null;
  });
