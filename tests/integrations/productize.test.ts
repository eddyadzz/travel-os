import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getImportTemplates,
  getSetupStatus,
  getSystemInfo,
  getSupportBundle,
} from "@/lib/api/productize";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tenant: { findUnique: vi.fn() },
    property: { count: vi.fn() },
    room: { count: vi.fn() },
    supplier: { count: vi.fn() },
    user: { count: vi.fn() },
    lead: { count: vi.fn() },
    booking: { count: vi.fn() },
    cmsPage: { count: vi.fn() },
    jobRun: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/backup.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backup.server")>();
  return {
    ...actual,
    listBackups: vi.fn().mockResolvedValue([
      {
        filename: "backup-a.json",
        sizeBytes: 10,
        tables: 0,
        rows: 0,
        createdAt: new Date().toISOString(),
      },
    ]),
    verifyBackup: vi.fn().mockReturnValue({ valid: true, tables: 2, rows: 2 }),
  };
});
vi.mock("@/lib/api/readiness", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/readiness")>();
  return {
    ...actual,
    runReadinessCheck: vi.fn().mockResolvedValue({
      readyPercent: 86,
      blockers: ["Email not configured"],
      critical: false,
      checks: [],
    }),
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
  mockDb.tenant.findUnique.mockResolvedValue({
    id: "t1",
    name: "Paradise Travel",
    slug: "ocean-atlas",
    primaryColor: "#7c3aed",
    emailFrom: "bookings@paradise.mv",
    customDomain: "travel.paradise.mv",
  });
  mockDb.property.count.mockResolvedValue(8);
  mockDb.room.count.mockResolvedValue(12);
  mockDb.supplier.count.mockResolvedValue(3);
  mockDb.user.count.mockResolvedValue(4);
  mockDb.lead.count.mockResolvedValue(15);
  mockDb.booking.count.mockResolvedValue(20);
  mockDb.cmsPage.count.mockResolvedValue(2);
  mockDb.jobRun.findFirst.mockResolvedValue({
    id: "j1",
    jobKey: "daily-report",
    status: "SUCCESS",
    startedAt: new Date(),
  });
  mockDb.jobRun.findMany.mockResolvedValue([
    { id: "j1", jobKey: "daily-report", status: "SUCCESS", startedAt: new Date(), error: null },
  ]);
});

describe("getSetupStatus", () => {
  it("returns company, branding, email and counts", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    const s = await getSetupStatus();
    expect(s.company.name).toBe("Paradise Travel");
    expect(s.branding.applied).toBe(true);
    expect(s.email.configured).toBe(true);
    expect(s.counts).toMatchObject({
      properties: 8,
      rooms: 12,
      suppliers: 3,
      users: 4,
      leads: 15,
      bookings: 20,
    });
    expect(s.lastBackup).toBe("backup-a.json");
    expect(s.lastJob?.key).toBe("daily-report");
  });
});

describe("getSystemInfo", () => {
  it("reports environment, counts and readiness", async () => {
    const info = await getSystemInfo();
    expect(info.counts.properties).toBe(8);
    expect(info.lastBackup).toMatchObject({ filename: "backup-a.json", valid: true });
    expect(info.lastJob?.status).toBe("SUCCESS");
    expect(info.readiness.readyPercent).toBe(86);
    expect(typeof info.database.urlHost).toBe("string");
  });
});

describe("getSupportBundle", () => {
  it("assembles a diagnostics bundle", async () => {
    const bundle = await getSupportBundle();
    expect(bundle.filename).toMatch(/^boliflow-support-/);
    expect(bundle.content).toContain("SYSTEM");
    expect(bundle.content).toContain("RECENT JOBS");
    expect(bundle.content).toContain("daily-report");
    expect(bundle.content).toContain("READINESS");
  });
});

describe("getImportTemplates", () => {
  it("generates xlsx templates for all catalogue formats", async () => {
    const templates = await getImportTemplates();
    expect(templates.length).toBe(6);
    const formats = templates.map((t) => t.format);
    expect(formats).toEqual(
      expect.arrayContaining(["Properties", "Rooms", "Rates", "Suppliers", "Customers", "Leads"]),
    );
    for (const t of templates) {
      const bytes = Buffer.from(t.base64, "base64");
      expect(bytes.subarray(0, 2).toString()).toBe("PK"); // valid xlsx zip
    }
  });
});
