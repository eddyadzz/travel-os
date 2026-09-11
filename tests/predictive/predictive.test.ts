import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeBookingForecast,
  computeLeadIntelligence,
  computeRevenueForecast,
  computeSupplierRisk,
} from "@/lib/api/predictive";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findMany: vi.fn(), count: vi.fn() },
    quote: { findMany: vi.fn(), count: vi.fn() },
    lead: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    supplierUpdateRequest: { findMany: vi.fn() },
    contractRate: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/api/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance")>();
  return {
    ...actual,
    computePandL: vi.fn().mockResolvedValue({
      rows: [],
      totalRevenue: 10000,
      totalCost: 6000,
      totalProfit: 4000,
      marginPercent: 40,
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

const NOW = Date.now();

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findMany.mockResolvedValue([
    { status: "CONFIRMED", checkIn: new Date(NOW + 10 * 86_400_000), totalPrice: 5000 },
    { status: "NEW", checkIn: new Date(NOW + 20 * 86_400_000), totalPrice: 3000 },
  ]);
  mockDb.booking.count.mockResolvedValue(0);
  const pendingQuote = {
    status: "PENDING",
    validUntil: new Date(NOW + 30 * 86_400_000),
    totalPrice: 2000,
    createdAt: new Date(),
  };
  mockDb.quote.findMany.mockImplementation(({ where }) => {
    if (where?.status === "PENDING") {
      return Promise.resolve([pendingQuote]);
    }
    return Promise.resolve([
      pendingQuote,
      { status: "ACCEPTED", totalPrice: 1000 },
      { status: "DECLINED", totalPrice: 1000 },
    ]);
  });
  mockDb.quote.count.mockResolvedValue(1);
  mockDb.lead.findMany.mockResolvedValue([
    { source: "WEBSITE", quotes: [], bookingId: null, booking: null },
    { source: "WEBSITE", quotes: [], bookingId: null, booking: null },
    { source: "WHATSAPP", quotes: [{ id: "q1" }], bookingId: "b1", booking: { totalPrice: 4000 } },
    { source: "WHATSAPP", quotes: [], bookingId: null, booking: null },
  ]);
  mockDb.supplier.findMany.mockResolvedValue([{ id: "sup1", name: "Velaa" }]);
  mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
    {
      supplierId: "sup1",
      requestedAt: new Date(NOW - 30 * 86_400_000),
      receivedAt: new Date(NOW - 30 * 86_400_000 + 4 * 3_600_000),
      importedAt: null,
    },
    {
      supplierId: "sup1",
      requestedAt: new Date(NOW - 5 * 86_400_000),
      receivedAt: new Date(NOW - 5 * 86_400_000 + 72 * 3_600_000),
      importedAt: null,
    },
  ]);
  mockDb.contractRate.findMany.mockResolvedValue([
    { supplierId: "sup1", validTo: new Date(NOW + 30 * 86_400_000) },
  ]);
});

describe("computeRevenueForecast", () => {
  it("sums confirmed revenue and projects pipeline", async () => {
    const r = await computeRevenueForecast();
    expect(r.confirmedRevenue).toBe(5000);
    // pipeline = 3000 (unconfirmed booking × 50% proxy) + open quote 2000 × 1/3 conversion
    expect(r.pipelineRevenue).toBeCloseTo(3000 + 2000 * (1 / 3), 0);
    expect(r.expectedCollections).toBeCloseTo(5000 + 3000 * 0.5 + 2000 * (1 / 3), 0);
    expect(r.projectedMarginPercent).toBe(40);
  });
});

describe("computeBookingForecast", () => {
  it("computes expected confirmations from open quotes × conversion", async () => {
    mockDb.booking.count.mockResolvedValue(10);
    const b = await computeBookingForecast();
    expect(b.openQuotes).toBe(1);
    expect(b.quoteConversionRate).toBe(33.3); // 1 accepted / 3 quotes
    expect(b.expectedConfirmations).toBe(0); // 1 × 0.333 → 0
  });
});

describe("computeLeadIntelligence", () => {
  it("ranks sources by conversion and reports the best", async () => {
    const l = await computeLeadIntelligence();
    const whatsapp = l.bySource.find((s) => s.source === "WHATSAPP")!;
    const website = l.bySource.find((s) => s.source === "WEBSITE")!;
    expect(whatsapp.conversionRate).toBe(50);
    expect(whatsapp.avgBookingValue).toBe(4000);
    expect(website.conversionRate).toBe(0);
    expect(l.bestSource).toBe("WHATSAPP");
    expect(l.overallConversionRate).toBe(25);
    expect(l.avgLeadValue).toBe(4000);
  });
});

describe("computeSupplierRisk", () => {
  it("detects slowing response trends and flags at-risk suppliers", async () => {
    const rows = await computeSupplierRisk();
    const velaa = rows[0];
    // 4h historic, 72h recent → slowing
    expect(velaa.responseTrend).toBe("slowing");
    expect(velaa.avgResponseHours).toBe(38); // (4 + 72) / 2
    expect(velaa.recentResponseHours).toBe(72);
    expect(velaa.contractExpiryDays).toBe(30);
    expect(velaa.atRisk).toBe(true); // slowing + >48h recent, and contract ≤90d
  });

  it("does not flag a fast, fresh supplier", async () => {
    mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
      {
        supplierId: "sup1",
        requestedAt: new Date(NOW - 2 * 86_400_000),
        receivedAt: new Date(NOW - 2 * 86_400_000 + 3 * 3_600_000),
        importedAt: null,
      },
    ]);
    mockDb.contractRate.findMany.mockResolvedValue([
      { supplierId: "sup1", validTo: new Date(NOW + 400 * 86_400_000) },
    ]);
    const rows = await computeSupplierRisk();
    expect(rows[0].responseTrend).toBe("stable");
    expect(rows[0].atRisk).toBe(false);
  });
});
