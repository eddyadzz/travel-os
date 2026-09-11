import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeScorecardsSummary, computeSupplierScorecards } from "@/lib/api/scorecards";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    supplier: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    supplierConfirmation: { findMany: vi.fn() },
    supplierUpdateRequest: { findMany: vi.fn(), groupBy: vi.fn() },
    contractRate: { findMany: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.supplier.findMany.mockResolvedValue([
    { id: "sup1", name: "Velaa Private Island", active: true, properties: [{ id: "p1" }] },
    { id: "sup2", name: "Slow Resort", active: true, properties: [{ id: "p2" }] },
  ]);
  mockDb.booking.findMany.mockResolvedValue([
    {
      propertyId: "p1",
      roomId: "r1",
      status: "CONFIRMED",
      totalPrice: 5900,
      nights: 5,
      checkIn: new Date("2026-03-01"),
      checkOut: new Date("2026-03-06"),
    },
    {
      propertyId: "p1",
      roomId: "r1",
      status: "CONFIRMED",
      totalPrice: 4000,
      nights: 4,
      checkIn: new Date("2026-05-01"),
      checkOut: new Date("2026-05-05"),
    },
    {
      propertyId: "p1",
      roomId: "r1",
      status: "CANCELLED",
      totalPrice: 2000,
      nights: 2,
      checkIn: new Date("2026-06-01"),
      checkOut: new Date("2026-06-03"),
    },
    {
      propertyId: "p2",
      roomId: "r2",
      status: "NEW",
      totalPrice: 1000,
      nights: 2,
      checkIn: new Date("2026-07-01"),
      checkOut: new Date("2026-07-03"),
    },
  ]);
  mockDb.supplierConfirmation.findMany.mockResolvedValue([
    { supplierId: "sup1", status: "CONFIRMED" },
    { supplierId: "sup1", status: "CONFIRMED" },
    { supplierId: "sup1", status: "DECLINED" },
  ]);
  mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
    {
      supplierId: "sup1",
      status: "IMPORTED",
      requestedAt: new Date("2026-01-01T00:00:00Z"),
      receivedAt: new Date("2026-01-01T04:00:00Z"),
      importedAt: null,
    },
    {
      supplierId: "sup1",
      status: "IMPORTED",
      requestedAt: new Date("2026-02-01T00:00:00Z"),
      receivedAt: new Date("2026-02-01T20:00:00Z"),
      importedAt: null,
    },
    {
      supplierId: "sup2",
      status: "REQUESTED",
      requestedAt: new Date("2026-01-01T00:00:00Z"),
      receivedAt: null,
      importedAt: null,
    },
  ]);
  mockDb.supplierUpdateRequest.groupBy.mockResolvedValue([
    { supplierId: "sup2", _count: { _all: 1 } },
  ]);
  mockDb.contractRate.findMany.mockResolvedValue([
    {
      supplierId: "sup1",
      roomId: null,
      validFrom: new Date("2026-01-01"),
      validTo: new Date("2026-09-30"),
      netRate: 700,
    },
    {
      supplierId: "sup2",
      roomId: null,
      validFrom: new Date("2026-01-01"),
      validTo: new Date("2026-08-10"),
      netRate: 400,
    },
  ]);
});

describe("computeSupplierScorecards", () => {
  it("computes volume, revenue, profit, confirmation rate and response time", async () => {
    const rows = await computeSupplierScorecards();
    const velaa = rows.find((r) => r.supplierId === "sup1")!;

    expect(velaa.bookingVolume).toBe(3);
    expect(velaa.revenue).toBe(11900); // 5900 + 4000 + 2000
    // cost = 700 × (5+4+2) = 7700 → profit 4200
    expect(velaa.profit).toBe(4200);
    // confirmations: 2 confirmed / 3 = 66.67
    expect(velaa.confirmationRate).toBe(66.67);
    // avg response: (4h + 20h)/2 = 12h
    expect(velaa.avgResponseHours).toBe(12);
    // cancellations: 1/3 = 33.33
    expect(velaa.cancellationRate).toBe(33.33);
    // contract expires 2026-09-30 → within 90 days of today (Aug 2026)
    expect(velaa.contractExpiryDays).toBeLessThanOrEqual(90);
  });

  it("ranks suppliers by composite score and assigns tiers", async () => {
    const rows = await computeSupplierScorecards();
    const velaa = rows.find((r) => r.supplierId === "sup1")!;
    const slow = rows.find((r) => r.supplierId === "sup2")!;

    // Velaa: response 12h → ~83, confirmation 66.7, cancellation 33.3 → weighted ~68
    expect(velaa.score).toBeGreaterThanOrEqual(60);
    expect(slow.score).toBeLessThan(velaa.score);
    expect(slow.openRequests).toBe(1);
    expect(slow.avgResponseHours).toBeNull();
  });

  it("sorts highest score first", async () => {
    const rows = await computeSupplierScorecards();
    const scores = rows.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe("computeScorecardsSummary", () => {
  it("counts tiers and renewal-due contracts", async () => {
    const rows = await computeSupplierScorecards();
    const summary = await computeScorecardsSummary(rows);
    expect(summary.total).toBe(2);
    expect(summary.renewalDue).toBeGreaterThanOrEqual(1); // sup2 expires within 90d
  });
});
