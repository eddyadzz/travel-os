import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  answerQuestion,
  getOperationsAdvice,
  recommendProperties,
  scoreLeads,
} from "@/lib/api/assistant";
import { createBackup, listBackups, restoreBackup, verifyBackup } from "@/lib/api/deploy";
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    property: { findMany: vi.fn(), count: vi.fn() },
    room: { findMany: vi.fn() },
    rate: { findMany: vi.fn() },
    markupRule: { findMany: vi.fn() },
    tenant: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    lead: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), count: vi.fn() },
    payment: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    supplierUpdateRequest: { findMany: vi.fn(), count: vi.fn() },
    contractRate: { findMany: vi.fn() },
    quote: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/tenant-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant-context")>();
  return { ...actual, getDefaultTenantId: vi.fn().mockResolvedValue("tnt_default") };
});
vi.mock("@/lib/api/predictive", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/predictive")>();
  return {
    ...actual,
    computeLeadIntelligence: vi.fn().mockResolvedValue({
      bySource: [
        {
          source: "WEBSITE",
          leads: 10,
          quoteRate: 50,
          conversionRate: 20,
          avgBookingValue: 3000,
          expectedRevenue: 600,
        },
        {
          source: "WHATSAPP",
          leads: 5,
          quoteRate: 60,
          conversionRate: 40,
          avgBookingValue: 4000,
          expectedRevenue: 800,
        },
      ],
      bestSource: "WHATSAPP",
      overallConversionRate: 26.7,
      avgLeadValue: 3500,
    }),
    computeSupplierRisk: vi.fn().mockResolvedValue([
      {
        supplierId: "sup1",
        name: "Velaa",
        avgResponseHours: 10,
        recentResponseHours: 60,
        responseTrend: "slowing",
        contractExpiryDays: 20,
        atRisk: true,
      },
    ]),
  };
});
vi.mock("@/lib/api/command", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/command")>();
  return {
    ...actual,
    computeCommandCenter: vi.fn().mockResolvedValue({
      month: "2026-09",
      monthRevenue: { expected: 10000, confirmed: 5000, profit: 4000 },
      attention: {
        newLeads: 3,
        openQuotes: 2,
        overdueDeposits: 1,
        supplierRequests: 2,
        atRiskSuppliers: 1,
        renewingContracts: 1,
      },
      leads: [],
      overdueDeposits: [
        { paymentId: "p1", reference: "MV-1", customer: "Jane", amount: 1475, ageDays: 5 },
      ],
      arrivals: [
        {
          reference: "MV-2",
          customer: "Omar",
          property: "Velaa",
          checkIn: "2026-09-10",
          nights: 4,
          status: "CONFIRMED",
        },
      ],
      contractsRenewing: [{ supplierId: "sup1", name: "Velaa", expiryDays: 20 }],
      agents: [],
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
  const now = Date.now();
  mockDb.property.findMany.mockResolvedValue([
    {
      id: "p1",
      name: "Velaa",
      type: "RESORT",
      atoll: "Noonu",
      highlights: ["Spa"],
      amenities: ["Pool"],
      rating: 4.8,
      transferPricePerPerson: 545,
      supplierId: null,
      status: "ACTIVE",
      rooms: [{ id: "r1", name: "Beach Villa", maxAdults: 2, extraGuestRate: 100 }],
    },
    {
      id: "p2",
      name: "Dhigurah Sands",
      type: "GUESTHOUSE",
      atoll: "South Ari",
      highlights: ["Diving"],
      amenities: [],
      rating: 4.2,
      transferPricePerPerson: 200,
      supplierId: null,
      status: "ACTIVE",
      rooms: [{ id: "r2", name: "Triple", maxAdults: 3, extraGuestRate: 0 }],
    },
  ]);
  mockDb.rate.findMany.mockResolvedValue([
    {
      id: "rt1",
      roomId: "r1",
      propertyId: "p1",
      amount: 800,
      validFrom: new Date(now - 86_400_000),
      validTo: new Date(now + 100 * 86_400_000),
    },
    {
      id: "rt2",
      roomId: "r2",
      propertyId: "p2",
      amount: 250,
      validFrom: new Date(now - 86_400_000),
      validTo: new Date(now + 100 * 86_400_000),
    },
  ]);
  mockDb.markupRule.findMany.mockResolvedValue([]);
  mockDb.lead.findMany.mockResolvedValue([
    {
      id: "l1",
      fullName: "Jane",
      source: "WHATSAPP",
      status: "CONTACTED",
      createdAt: new Date(now - 2 * 86_400_000),
      quotes: [{ id: "q1" }],
      booking: null,
    },
    {
      id: "l2",
      fullName: "Bob",
      source: "WEBSITE",
      status: "NEW",
      createdAt: new Date(now - 30 * 86_400_000),
      quotes: [],
      booking: null,
    },
  ]);
  mockDb.booking.findMany.mockResolvedValue([]);
  mockDb.booking.count.mockResolvedValue(0);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.supplierUpdateRequest.findMany.mockResolvedValue([]);
  mockDb.supplierUpdateRequest.count.mockResolvedValue(0);
  mockDb.quote.count.mockResolvedValue(0);
  mockDb.quote.findMany.mockResolvedValue([]);
});

describe("recommendProperties", () => {
  it("ranks properties by fit, applies markup and drafts a quote", async () => {
    const res = await recommendProperties({
      checkIn: "2026-09-10",
      checkOut: "2026-09-14",
      adults: 2,
      children: 0,
      budget: 8000,
      preferences: ["spa"],
    });
    expect(res.recommendations.length).toBe(2);
    const top = res.recommendations[0];
    expect(top.name).toBe("Velaa"); // 4 nights×800 + transfers + spa match
    expect(top.markupPercent).toBe(22); // RESORT default
    expect(top.fitScore).toBeGreaterThanOrEqual(50);
    expect(res.quoteDraft).toContain("Velaa");
    expect(res.quoteDraft).toContain("4 nights");
  });
});

describe("getOperationsAdvice", () => {
  it("drafts supplier follow-up, contract renewal and deposit chases", async () => {
    const advice = await getOperationsAdvice();
    expect(advice.items.some((i) => i.type === "supplier-followup")).toBe(true);
    expect(advice.items.some((i) => i.type === "contract-renewal")).toBe(true);
    expect(advice.items.some((i) => i.type === "deposit-followup")).toBe(true);
    const supplier = advice.items.find((i) => i.type === "supplier-followup")!;
    expect(supplier.draft).toContain("Velaa");
    expect(supplier.detail).toContain("slowing");
  });
});

describe("answerQuestion", () => {
  it("answers revenue questions", async () => {
    const a = await answerQuestion("expected revenue this month?");
    expect(a.answer).toContain("10,000");
  });
  it("answers deposit questions", async () => {
    const a = await answerQuestion("which deposits are overdue?");
    expect(a.answer).toContain("1");
  });
  it("answers supplier questions", async () => {
    const a = await answerQuestion("which suppliers are at risk?");
    expect(a.answer).toContain("1 supplier");
  });
});

describe("scoreLeads", () => {
  it("ranks leads by conversion probability", async () => {
    const scored = await scoreLeads();
    const [first, second] = scored;
    expect(first.fullName).toBe("Jane"); // WHATSAPP + contacted + quoted
    expect(first.conversionProbability).toBeGreaterThan(second.conversionProbability);
    expect(first.reason).toContain("Already quoted");
  });
});

describe("backup & restore", () => {
  it("creates a backup file and lists it", async () => {
    const info = await createBackup();
    expect(info.filename).toMatch(/^backup-.*\.json$/);
    expect(info.tables).toBeGreaterThan(0);
    const listed = await listBackups();
    expect(listed.some((b) => b.filename === info.filename)).toBe(true);
    const dir = join(process.cwd(), "data", "backups");
    rmSync(join(dir, info.filename), { force: true });
  });

  it("errors on a missing backup file", async () => {
    await expect(restoreBackup("missing.json")).rejects.toThrow();
  });

  it("verifies a valid backup and flags corrupt ones", async () => {
    const dir = join(process.cwd(), "data", "backups");
    writeFileSync(
      join(dir, "verify-ok.json"),
      JSON.stringify({ tenant: [{ id: "t1" }], property: [{ id: "p1" }] }),
    );
    const ok = verifyBackup("verify-ok.json");
    expect(ok.valid).toBe(true);
    expect(ok.tables).toBe(2);

    writeFileSync(join(dir, "verify-bad.json"), JSON.stringify({ tenant: [{ nope: true }] }));
    const bad = verifyBackup("verify-bad.json");
    expect(bad.valid).toBe(false);
    expect(bad.error).toBeTruthy();

    rmSync(join(dir, "verify-ok.json"), { force: true });
    rmSync(join(dir, "verify-bad.json"), { force: true });
  });
});
