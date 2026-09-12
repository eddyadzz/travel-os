import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createTenant,
  getTenantByHost,
  getTenantUsage,
  listTenants,
  resolveTenantForHost,
  setTenantPlan,
  updateTenant,
} from "@/lib/api/tenants";
import { hashPassword, verifyPassword } from "@/lib/crypto.server";
import { resolveTenantIdFromHost, runWithTenant } from "@/lib/tenant-context.server";
import { db } from "@/lib/db.server";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tenant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    user: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    booking: { count: vi.fn() },
    lead: { count: vi.fn() },
    bookingAttachment: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@tanstack/react-start", () => {
  const handler = (h: (ctx: { data: unknown }) => unknown) => async (opts?: { data: unknown }) =>
    h({ data: opts?.data });
  return {
    createServerFn: () => ({
      validator: () => ({ handler }),
      handler,
    }),
  };
});

const tenantRow = {
  id: "tnt1",
  name: "Maldives Explorers",
  slug: "maldives-explorers",
  plan: "PROFESSIONAL",
  logoUrl: null,
  primaryColor: "#0f766e",
  accentColor: null,
  emailFrom: null,
  customDomain: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.tenant.findMany.mockResolvedValue([tenantRow]);
  mockDb.tenant.findUnique.mockResolvedValue(null);
  mockDb.tenant.findFirst.mockResolvedValue(null);
  mockDb.tenant.create.mockResolvedValue(tenantRow);
  mockDb.tenant.update.mockResolvedValue(tenantRow);
  mockDb.user.create.mockResolvedValue({ id: "u1" });
  mockDb.user.count.mockResolvedValue(1);
  mockDb.booking.count.mockResolvedValue(120);
  mockDb.lead.count.mockResolvedValue(30);
  mockDb.user.findMany.mockResolvedValue([{ id: "u1" }]);
  mockDb.bookingAttachment.count.mockResolvedValue(4);
});

describe("tenant CRUD", () => {
  it("lists tenants", async () => {
    const tenants = await listTenants();
    expect(tenants).toHaveLength(1);
    expect(tenants[0]).toMatchObject({ name: "Maldives Explorers", plan: "PROFESSIONAL" });
  });

  it("creates a tenant + admin user (onboarding)", async () => {
    const res = await createTenant({
      data: {
        name: "Blue Travel",
        slug: "blue-travel",
        plan: "STARTER",
        adminName: "Ali",
        adminEmail: "ali@blue.mv",
        adminPassword: "secret123",
      },
    });
    expect(mockDb.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Blue Travel", slug: "blue-travel", plan: "STARTER" }),
    });
    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "ali@blue.mv",
        role: "SUPER_ADMIN",
        tenantId: "tnt1",
      }),
    });
    expect(res.name).toBe("Maldives Explorers");
  });

  it("normalizes slugs and rejects duplicates", async () => {
    mockDb.tenant.findUnique.mockResolvedValue(tenantRow);
    await expect(
      createTenant({
        data: { name: "X", slug: "Maldives Explorers!", adminName: "A", adminEmail: "a@b.mv" },
      }),
    ).rejects.toThrow(/already taken/i);
  });

  it("updates branding and sets plan", async () => {
    await updateTenant({
      data: { id: "tnt1", primaryColor: "#123456", customDomain: "travel.explorers.mv" },
    });
    expect(mockDb.tenant.update).toHaveBeenCalledWith({
      where: { id: "tnt1" },
      data: expect.objectContaining({
        primaryColor: "#123456",
        customDomain: "travel.explorers.mv",
      }),
    });
    await setTenantPlan({ data: { id: "tnt1", plan: "ENTERPRISE" } });
    expect(mockDb.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "ENTERPRISE" }) }),
    );
  });
});

describe("usage & plan limits", () => {
  it("computes scoped usage and reports within-limits", async () => {
    mockDb.tenant.findUnique.mockResolvedValue({ plan: "PROFESSIONAL" });
    const usage = await getTenantUsage({ data: "tnt1" });
    expect(usage).toMatchObject({
      bookingsYear: 120,
      leads: 30,
      users: 1,
      plan: "PROFESSIONAL",
      withinLimits: true,
    });
    expect(mockDb.booking.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tnt1" }) }),
    );
  });

  it("flags usage over the limit", async () => {
    mockDb.booking.count.mockResolvedValue(6000); // over PROFESSIONAL 5000
    mockDb.tenant.findUnique.mockResolvedValue({ plan: "PROFESSIONAL" });
    const usage = await getTenantUsage({ data: "tnt1" });
    expect(usage.withinLimits).toBe(false);
  });
});

describe("host resolution", () => {
  it("resolves by custom domain", async () => {
    mockDb.tenant.findFirst.mockResolvedValue(tenantRow);
    const id = await resolveTenantIdFromHost("travel.explorers.mv");
    expect(id).toBe("tnt1");
    expect(mockDb.tenant.findFirst).toHaveBeenCalledWith({
      where: { customDomain: "travel.explorers.mv" },
    });
  });

  it("resolves by subdomain of the base domain", async () => {
    mockDb.tenant.findFirst.mockImplementation(async ({ where }) =>
      where.slug === "maldives-explorers" ? tenantRow : null,
    );
    const id = await resolveTenantIdFromHost("maldives-explorers.oceanatlas.mv");
    expect(id).toBe("tnt1");
  });

  it("returns null for an unmatched host", async () => {
    mockDb.tenant.findFirst.mockResolvedValue(null);
    expect(await resolveTenantIdFromHost("other-site.com")).toBeNull();
  });
});

describe("tenant context", () => {
  it("exposes the active tenant id inside runWithTenant", async () => {
    const seen: string[] = [];
    await runWithTenant("tnt2", async () => {
      const { getTenantContext } = await import("@/lib/tenant-context.server");
      seen.push(getTenantContext() ?? "");
    });
    expect(seen).toEqual(["tnt2"]);
  });

  it("getTenantByHost falls back to the default tenant", async () => {
    mockDb.tenant.findFirst.mockResolvedValue(null); // no custom/subdomain match
    mockDb.tenant.findUnique.mockResolvedValue(tenantRow); // default lookup
    const branding = await getTenantByHost({ data: "unknown.com" });
    expect(branding).toMatchObject({ name: "Maldives Explorers" });
  });
});

describe("password hashing", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("secret");
    expect(hash).toContain(":");
    expect(verifyPassword("secret", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("resolveTenantForHost", () => {
  it("returns the matched tenant", async () => {
    mockDb.tenant.findFirst.mockResolvedValue(tenantRow);
    mockDb.tenant.findUnique.mockResolvedValue(tenantRow);
    const t = await resolveTenantForHost({ data: "travel.explorers.mv" });
    expect(t?.id).toBe("tnt1");
  });
});
