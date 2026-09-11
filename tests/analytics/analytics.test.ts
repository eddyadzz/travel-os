import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeExecutiveMetrics,
  computeRevenueAnalytics,
  computeProfitAnalytics,
  computePropertyPerformance,
  computeSupplierPerformance,
  computeAgentPerformance,
  computeSearchFunnel,
  computePaymentAnalytics,
} from "@/lib/api/analytics";
import * as suppliers from "@/lib/api/suppliers";

const range = { from: "2026-01-01", to: "2026-12-31" };

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findMany: vi.fn(), count: vi.fn() },
    payment: { findMany: vi.fn() },
    searchLog: { count: vi.fn() },
    supplierConfirmation: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/api/suppliers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/suppliers")>();
  return {
    ...actual,
    computeBookingCosting: vi.fn(),
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

function bookingRow(overrides = {}) {
  return {
    id: "b1",
    totalPrice: 6410,
    status: "CONFIRMED",
    createdAt: new Date("2026-03-15T10:00:00.000Z"),
    propertyId: "p1",
    assignedAgentId: "agent1",
    assignedAgent: { fullName: "Ahmed Hassan" },
    property: { name: "Velaa Lagoon Resort & Spa" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (suppliers.computeBookingCosting as ReturnType<typeof vi.fn>).mockResolvedValue({
    supplierCost: 3100,
    grossProfit: 3310,
  });
  mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.searchLog.count.mockResolvedValue(100);
  mockDb.booking.count.mockResolvedValue(10);
  mockDb.supplierConfirmation.findMany.mockResolvedValue([
    {
      id: "c1",
      supplierId: "s1",
      supplier: { name: "Velaa Private Island" },
      booking: bookingRow(),
      status: "CONFIRMED",
      createdAt: new Date("2026-03-16"),
    },
  ]);
});

describe("computeExecutiveMetrics", () => {
  it("computes revenue, profit, bookings, confirmed and outstanding", async () => {
    mockDb.booking.findMany.mockResolvedValue([bookingRow(), bookingRow({ status: "NEW" })]);
    const m = await computeExecutiveMetrics(range);
    expect(m).toMatchObject({
      revenue: 12820,
      grossProfit: 6620,
      bookings: 2,
      confirmedBookings: 1,
      averageBookingValue: 6410,
    });
  });

  it("computes outstanding payments from verified payments", async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { amount: 3000, status: "VERIFIED", type: "DEPOSIT" },
    ]);
    const m = await computeExecutiveMetrics(range);
    // revenue 6410, verified 3000, outstanding 3410
    expect(m.outstandingPayments).toBe(3410);
  });
});

describe("computeRevenueAnalytics", () => {
  it("groups revenue by month and splits by status", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({ status: "CONFIRMED", createdAt: new Date("2026-03-15") }),
      bookingRow({
        status: "CANCELLED",
        id: "b2",
        totalPrice: 1000,
        createdAt: new Date("2026-04-01"),
      }),
      bookingRow({ status: "NEW", id: "b3", totalPrice: 2000, createdAt: new Date("2026-03-20") }),
    ]);
    const r = await computeRevenueAnalytics(range);
    expect(r.totalRevenue).toBe(9410);
    expect(r.confirmedRevenue).toBe(6410);
    expect(r.cancelledRevenue).toBe(1000);
    expect(r.pendingRevenue).toBe(2000);
    expect(r.monthlyTrend).toHaveLength(2);
    expect(r.monthlyTrend[0].month).toBe("2026-03");
  });
});

describe("computeProfitAnalytics", () => {
  it("computes total profit and monthly trend", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow(),
      bookingRow({ id: "b2", totalPrice: 2000, createdAt: new Date("2026-04-01") }),
    ]);
    const p = await computeProfitAnalytics(range);
    expect(p.totalRevenue).toBe(8410);
    expect(p.totalSupplierCost).toBe(6200); // 3100 x 2
    expect(p.totalProfit).toBe(2210);
    expect(p.marginPercent).toBeGreaterThan(0);
    expect(p.monthlyTrend).toHaveLength(2);
  });
});

describe("computePropertyPerformance", () => {
  it("ranks properties by revenue", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow(),
      bookingRow({ id: "b2", propertyId: "p2", property: { name: "Kaani" }, totalPrice: 1000 }),
    ]);
    const rows = await computePropertyPerformance(range);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Velaa Lagoon Resort & Spa");
    expect(rows[0].bookings).toBe(1);
    expect(rows[0].revenue).toBe(6410);
    expect(rows[0].profit).toBe(3310);
    expect(rows[0].averageValue).toBe(6410);
  });
});

describe("computeSupplierPerformance", () => {
  it("computes confirmation rate and profit per supplier", async () => {
    mockDb.supplierConfirmation.findMany.mockResolvedValue([
      {
        id: "c1",
        supplierId: "s1",
        supplier: { name: "Velaa" },
        booking: bookingRow(),
        status: "CONFIRMED",
      },
      {
        id: "c2",
        supplierId: "s1",
        supplier: { name: "Velaa" },
        booking: bookingRow({ id: "b2", totalPrice: 2000 }),
        status: "DECLINED",
      },
    ]);
    const rows = await computeSupplierPerformance(range);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Velaa",
      bookings: 2,
      revenue: 8410,
      confirmed: 1,
      declined: 1,
      confirmationRate: 50,
    });
    expect(rows[0].profit).toBeGreaterThan(0);
  });
});

describe("computeAgentPerformance", () => {
  it("aggregates bookings by assigned agent", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow(),
      bookingRow({ id: "b2", status: "CANCELLED", totalPrice: 1000 }),
    ]);
    const rows = await computeAgentPerformance(range);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Ahmed Hassan",
      assigned: 2,
      confirmed: 1,
      cancelled: 1,
      revenue: 7410,
    });
  });
});

describe("computeSearchFunnel", () => {
  it("computes the funnel and conversion rate", async () => {
    mockDb.searchLog.count
      .mockResolvedValueOnce(1000) // all searches
      .mockResolvedValueOnce(850); // searches with results
    mockDb.booking.count.mockResolvedValueOnce(120).mockResolvedValueOnce(54);
    const f = await computeSearchFunnel(range);
    expect(f).toMatchObject({
      searches: 1000,
      searchesWithResults: 850,
      bookingRequests: 120,
      confirmedBookings: 54,
    });
    expect(f.conversionRate).toBe(5.4);
  });
});

describe("computePaymentAnalytics", () => {
  it("computes payment status breakdown and outstanding", async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { amount: 3000, status: "VERIFIED", type: "DEPOSIT" },
      { amount: 500, status: "SUBMITTED", type: "DEPOSIT" },
      { amount: 200, status: "REQUESTED", type: "DEPOSIT" },
    ]);
    mockDb.booking.findMany.mockResolvedValue([bookingRow()]); // total 6410
    const p = await computePaymentAnalytics(range);
    expect(p).toMatchObject({
      requested: 1,
      submitted: 1,
      verified: 1,
      verifiedAmount: 3000,
      outstanding: 3410,
    });
  });

  it("excludes refunds from verified amount", async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { amount: 3000, status: "VERIFIED", type: "DEPOSIT" },
      { amount: 200, status: "VERIFIED", type: "REFUND" },
    ]);
    mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
    const p = await computePaymentAnalytics(range);
    expect(p.verifiedAmount).toBe(3000);
  });
});

describe("edge cases", () => {
  it("returns zeros when there are no bookings", async () => {
    mockDb.booking.findMany.mockResolvedValue([]);
    const m = await computeExecutiveMetrics(range);
    expect(m).toMatchObject({
      revenue: 0,
      grossProfit: 0,
      bookings: 0,
      confirmedBookings: 0,
      averageBookingValue: 0,
      outstandingPayments: 0,
    });
    const rev = await computeRevenueAnalytics(range);
    expect(rev.monthlyTrend).toEqual([]);
  });

  it("handles no supplier cost in executive metrics", async () => {
    (suppliers.computeBookingCosting as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
    const m = await computeExecutiveMetrics(range);
    expect(m.grossProfit).toBe(0);
  });

  it("computes zero margin when revenue is zero", async () => {
    mockDb.booking.findMany.mockResolvedValue([]);
    const p = await computeProfitAnalytics(range);
    expect(p.marginPercent).toBe(0);
    expect(p.monthlyTrend).toEqual([]);
  });

  it("returns empty property/supplier/agent lists when no data", async () => {
    mockDb.booking.findMany.mockResolvedValue([]);
    mockDb.supplierConfirmation.findMany.mockResolvedValue([]);
    expect(await computePropertyPerformance(range)).toEqual([]);
    expect(await computeSupplierPerformance(range)).toEqual([]);
    expect(await computeAgentPerformance(range)).toEqual([]);
  });

  it("returns zero conversion when no searches", async () => {
    mockDb.searchLog.count.mockResolvedValue(0);
    mockDb.booking.count.mockResolvedValue(0);
    const f = await computeSearchFunnel(range);
    expect(f.conversionRate).toBe(0);
  });
});
