import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { computeBookingCosting } from "@/lib/api/suppliers";
import type {
  AgentPerformanceRow,
  DateRange,
  ExecutiveMetricsDTO,
  PaymentAnalyticsDTO,
  PropertyPerformanceRow,
  ProfitAnalyticsDTO,
  RevenueAnalyticsDTO,
  SearchFunnelDTO,
  SupplierPerformanceRow,
} from "@/lib/types";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function rangeWhere(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);
  return { gte: fromDate, lte: toDate };
}

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

// Executive metrics -----------------------------------------------------------------------------

export async function computeExecutiveMetrics(range: DateRange): Promise<ExecutiveMetricsDTO> {
  const where = rangeWhere(range.from, range.to);
  const bookings = await db.booking.findMany({ where: { createdAt: where } });
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");
  const revenue = bookings.reduce((s, b) => s + Number(b.totalPrice), 0);
  const confirmedRevenue = confirmed.reduce((s, b) => s + Number(b.totalPrice), 0);

  // Profit: cost from the linked supplier's contract rate for each booking.
  let grossProfit = 0;
  for (const b of bookings) {
    const costing = await computeBookingCosting(b.id);
    if (costing) grossProfit += costing.grossProfit;
  }

  const verifiedPayments = await db.payment.findMany({
    where: { status: "VERIFIED", type: { not: "REFUND" } },
  });
  const paidTotal = verifiedPayments.reduce((s, p) => s + Number(p.amount), 0);

  return {
    revenue: money(revenue),
    grossProfit: money(grossProfit),
    bookings: bookings.length,
    confirmedBookings: confirmed.length,
    averageBookingValue: bookings.length > 0 ? money(revenue / bookings.length) : 0,
    outstandingPayments: money(revenue - paidTotal),
  };
}

// Revenue analytics ------------------------------------------------------------------------------

export async function computeRevenueAnalytics(range: DateRange): Promise<RevenueAnalyticsDTO> {
  const where = rangeWhere(range.from, range.to);
  const bookings = await db.booking.findMany({ where: { createdAt: where } });

  const byMonth = new Map<string, { revenue: number; bookings: number }>();
  for (const b of bookings) {
    const key = monthKey(b.createdAt);
    const entry = byMonth.get(key) ?? { revenue: 0, bookings: 0 };
    entry.revenue += Number(b.totalPrice);
    entry.bookings += 1;
    byMonth.set(key, entry);
  }

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");
  const pending = bookings.filter(
    (b) => !["CONFIRMED", "COMPLETED", "CANCELLED"].includes(b.status),
  );

  return {
    totalRevenue: money(bookings.reduce((s, b) => s + Number(b.totalPrice), 0)),
    confirmedRevenue: money(confirmed.reduce((s, b) => s + Number(b.totalPrice), 0)),
    pendingRevenue: money(pending.reduce((s, b) => s + Number(b.totalPrice), 0)),
    cancelledRevenue: money(cancelled.reduce((s, b) => s + Number(b.totalPrice), 0)),
    monthlyTrend: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, revenue: money(v.revenue), bookings: v.bookings })),
  };
}

// Profit analytics --------------------------------------------------------------------------------

export async function computeProfitAnalytics(range: DateRange): Promise<ProfitAnalyticsDTO> {
  const where = rangeWhere(range.from, range.to);
  const bookings = await db.booking.findMany({ where: { createdAt: where } });

  const byMonth = new Map<string, { revenue: number; cost: number }>();
  let totalRevenue = 0;
  let totalCost = 0;
  for (const b of bookings) {
    totalRevenue += Number(b.totalPrice);
    const costing = await computeBookingCosting(b.id);
    const cost = costing?.supplierCost ?? 0;
    totalCost += cost;
    const key = monthKey(b.createdAt);
    const entry = byMonth.get(key) ?? { revenue: 0, cost: 0 };
    entry.revenue += Number(b.totalPrice);
    entry.cost += cost;
    byMonth.set(key, entry);
  }

  const profit = totalRevenue - totalCost;
  return {
    totalRevenue: money(totalRevenue),
    totalSupplierCost: money(totalCost),
    totalProfit: money(profit),
    marginPercent: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0,
    monthlyTrend: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        revenue: money(v.revenue),
        cost: money(v.cost),
        profit: money(v.revenue - v.cost),
      })),
  };
}

// Property performance ------------------------------------------------------------------------------

export async function computePropertyPerformance(
  range: DateRange,
): Promise<PropertyPerformanceRow[]> {
  const where = rangeWhere(range.from, range.to);
  const bookings = await db.booking.findMany({
    where: { createdAt: where },
    include: { property: true },
  });

  const byProperty = new Map<
    string,
    { name: string; bookings: number; revenue: number; profit: number }
  >();
  for (const b of bookings) {
    const entry = byProperty.get(b.propertyId) ?? {
      name: b.property.name,
      bookings: 0,
      revenue: 0,
      profit: 0,
    };
    entry.bookings += 1;
    entry.revenue += Number(b.totalPrice);
    const costing = await computeBookingCosting(b.id);
    if (costing) entry.profit += costing.grossProfit;
    byProperty.set(b.propertyId, entry);
  }

  return [...byProperty.values()]
    .map((p) => ({
      propertyId: p.name,
      name: p.name,
      bookings: p.bookings,
      revenue: money(p.revenue),
      profit: money(p.profit),
      averageValue: p.bookings > 0 ? money(p.revenue / p.bookings) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Supplier performance ---------------------------------------------------------------------------------

export async function computeSupplierPerformance(
  range: DateRange,
): Promise<SupplierPerformanceRow[]> {
  const where = rangeWhere(range.from, range.to);
  const confirmations = await db.supplierConfirmation.findMany({
    where: { createdAt: where },
    include: { supplier: true, booking: true },
  });

  const bySupplier = new Map<
    string,
    {
      name: string;
      bookings: number;
      revenue: number;
      cost: number;
      confirmed: number;
      declined: number;
    }
  >();
  for (const c of confirmations) {
    const entry = bySupplier.get(c.supplierId) ?? {
      name: c.supplier.name,
      bookings: 0,
      revenue: 0,
      cost: 0,
      confirmed: 0,
      declined: 0,
    };
    entry.bookings += 1;
    entry.revenue += Number(c.booking.totalPrice);
    if (c.status === "CONFIRMED") entry.confirmed += 1;
    if (c.status === "DECLINED") entry.declined += 1;
    const costing = await computeBookingCosting(c.bookingId);
    if (costing) entry.cost += costing.supplierCost;
    bySupplier.set(c.supplierId, entry);
  }

  return [...bySupplier.values()]
    .map((s) => ({
      supplierId: s.name,
      name: s.name,
      bookings: s.bookings,
      revenue: money(s.revenue),
      cost: money(s.cost),
      profit: money(s.revenue - s.cost),
      confirmed: s.confirmed,
      declined: s.declined,
      confirmationRate: s.bookings > 0 ? Math.round((s.confirmed / s.bookings) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Agent performance --------------------------------------------------------------------------------------

export async function computeAgentPerformance(range: DateRange): Promise<AgentPerformanceRow[]> {
  const where = rangeWhere(range.from, range.to);
  const bookings = await db.booking.findMany({
    where: { createdAt: where, assignedAgentId: { not: null } },
    include: { assignedAgent: true },
  });

  const byAgent = new Map<
    string,
    {
      name: string;
      assigned: number;
      confirmed: number;
      cancelled: number;
      revenue: number;
      profit: number;
    }
  >();
  for (const b of bookings) {
    const agentId = b.assignedAgentId!;
    const entry = byAgent.get(agentId) ?? {
      name: b.assignedAgent?.fullName ?? "Unknown",
      assigned: 0,
      confirmed: 0,
      cancelled: 0,
      revenue: 0,
      profit: 0,
    };
    entry.assigned += 1;
    entry.revenue += Number(b.totalPrice);
    if (b.status === "CONFIRMED" || b.status === "COMPLETED") entry.confirmed += 1;
    if (b.status === "CANCELLED") entry.cancelled += 1;
    const costing = await computeBookingCosting(b.id);
    if (costing) entry.profit += costing.grossProfit;
    byAgent.set(agentId, entry);
  }

  return [...byAgent.entries()]
    .map(([agentId, a]) => ({
      agentId,
      name: a.name,
      assigned: a.assigned,
      confirmed: a.confirmed,
      cancelled: a.cancelled,
      revenue: money(a.revenue),
      profit: money(a.profit),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Search funnel --------------------------------------------------------------------------------------------

export async function computeSearchFunnel(range: DateRange): Promise<SearchFunnelDTO> {
  const where = rangeWhere(range.from, range.to);

  const [searches, searchesWithResults, bookingRequests] = await Promise.all([
    db.searchLog.count({ where: { createdAt: where } }),
    db.searchLog.count({ where: { createdAt: where, resultCount: { gt: 0 } } }),
    db.booking.count({ where: { createdAt: where } }),
  ]);
  const confirmedBookings = await db.booking.count({
    where: { createdAt: where, status: { in: ["CONFIRMED", "COMPLETED"] } },
  });

  const conversionRate =
    searches > 0 ? Math.round((confirmedBookings / searches) * 10000) / 100 : 0;
  return { searches, searchesWithResults, bookingRequests, confirmedBookings, conversionRate };
}

// Payment analytics --------------------------------------------------------------------------------------------

export async function computePaymentAnalytics(range: DateRange): Promise<PaymentAnalyticsDTO> {
  const where = rangeWhere(range.from, range.to);
  const payments = await db.payment.findMany({ where: { createdAt: where } });
  const verified = payments.filter((p) => p.status === "VERIFIED" && p.type !== "REFUND");
  const verifiedAmount = verified.reduce((s, p) => s + Number(p.amount), 0);

  const allBookings = await db.booking.findMany({ where: { createdAt: where } });
  const totalBookingValue = allBookings.reduce((s, b) => s + Number(b.totalPrice), 0);

  return {
    requested: payments.filter((p) => p.status === "REQUESTED").length,
    submitted: payments.filter((p) => p.status === "SUBMITTED").length,
    verified: verified.length,
    verifiedAmount: money(verifiedAmount),
    outstanding: money(Math.max(0, totalBookingValue - verifiedAmount)),
  };
}

// Server function wrappers ---------------------------------------------------------------------------------------

export const getExecutiveMetrics = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computeExecutiveMetrics(data ?? defaultRange()));

export const getRevenueAnalytics = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computeRevenueAnalytics(data ?? defaultRange()));

export const getProfitAnalytics = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computeProfitAnalytics(data ?? defaultRange()));

export const getPropertyPerformance = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computePropertyPerformance(data ?? defaultRange()));

export const getSupplierPerformance = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computeSupplierPerformance(data ?? defaultRange()));

export const getAgentPerformance = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computeAgentPerformance(data ?? defaultRange()));

export const getSearchFunnel = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computeSearchFunnel(data ?? defaultRange()));

export const getPaymentAnalytics = createServerFn({ method: "GET" })
  .validator((range?: DateRange) => range)
  .handler(async ({ data }) => computePaymentAnalytics(data ?? defaultRange()));
