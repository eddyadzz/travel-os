import { describe, expect, it, vi, beforeEach } from "vitest";
import { runReadinessCheck } from "@/lib/api/readiness";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tenant: { findUnique: vi.fn() },
    importJob: { count: vi.fn() },
    bookingEvent: { count: vi.fn() },
    property: { count: vi.fn() },
    booking: { count: vi.fn() },
    lead: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/api/deploy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/deploy")>();
  return {
    ...actual,
    listBackups: vi.fn().mockResolvedValue([
      {
        filename: "backup-test.json",
        sizeBytes: 10,
        tables: 0,
        rows: 0,
        createdAt: new Date().toISOString(),
      },
    ]),
    verifyBackup: vi.fn().mockReturnValue({ valid: true, tables: 2, rows: 2 }),
  };
});
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

beforeEach(() => {
  vi.clearAllMocks();
  process.env["RESEND_API_KEY"] = "test-key";
  process.env["EMAIL_FROM"] = "bookings@client.mv";
  mockDb.tenant.findUnique.mockResolvedValue({
    id: "t1",
    primaryColor: "#7c3aed",
    customDomain: "travel.client.mv",
  });
  mockDb.importJob.count.mockResolvedValue(4);
  mockDb.bookingEvent.count.mockResolvedValue(12);
  mockDb.property.count.mockResolvedValue(8);
  mockDb.booking.count.mockResolvedValue(20);
  mockDb.lead.count.mockResolvedValue(15);
});

describe("runReadinessCheck", () => {
  it("passes a fully configured deployment", async () => {
    const res = await runReadinessCheck();
    expect(res.critical).toBe(true);
    expect(res.blockers).toEqual([]);
    expect(res.readyPercent).toBe(100);
    const keys = res.checks.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining(["backup", "email", "pwa", "audit", "brand", "data", "db"]),
    );
  });

  it("flags blockers when email, branding or data are missing", async () => {
    delete process.env["RESEND_API_KEY"];
    mockDb.tenant.findUnique.mockResolvedValue({
      id: "t1",
      primaryColor: "#0f766e",
      customDomain: null,
    });
    mockDb.property.count.mockResolvedValue(0);
    const res = await runReadinessCheck();
    expect(res.critical).toBe(false);
    expect(res.blockers.length).toBeGreaterThanOrEqual(3);
    expect(res.blockers.some((b) => b.toLowerCase().includes("email"))).toBe(true);
    expect(res.blockers.some((b) => b.toLowerCase().includes("branding"))).toBe(true);
    expect(res.blockers.some((b) => b.toLowerCase().includes("properties"))).toBe(true);
    expect(res.readyPercent).toBeLessThan(100);
  });

  it("fails the backup check when the archive does not verify", async () => {
    const deploy = await import("@/lib/api/deploy");
    (deploy.verifyBackup as ReturnType<typeof vi.fn>).mockReturnValue({
      valid: false,
      tables: 0,
      rows: 0,
      error: "corrupt",
    });
    const res = await runReadinessCheck();
    const backup = res.checks.find((c) => c.key === "backup")!;
    expect(backup.ok).toBe(false);
    expect(res.blockers.some((b) => b.includes("backup"))).toBe(true);
  });
});
