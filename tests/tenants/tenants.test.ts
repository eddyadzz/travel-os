import { describe, expect, it, vi, beforeEach } from "vitest";
import { getTenantByHost } from "@/lib/api/tenants";
import { hashPassword, verifyPassword } from "@/lib/crypto.server";
import { resolveTenantIdFromHost, runWithTenant } from "@/lib/tenant-context.server";
import { db } from "@/lib/db.server";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
  logoUrl: null,
  primaryColor: "#0f766e",
  accentColor: null,
  fontFamily: null,
  emailFrom: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.tenant.findUnique.mockResolvedValue(null);
  mockDb.tenant.findFirst.mockResolvedValue(null);
  mockDb.tenant.create.mockResolvedValue(tenantRow);
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
});

describe("getTenantByHost", () => {
  it("falls back to the default tenant", async () => {
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
