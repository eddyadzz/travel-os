import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { computeRevenueForecast } from "@/lib/api/predictive";
import { computeSupplierScorecards } from "@/lib/api/scorecards";
import { computeAgentPerformance } from "@/lib/api/finance";
import type { CommandCenterDTO } from "@/lib/types";

const DAY = 86_400_000;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function computeCommandCenter(): Promise<CommandCenterDTO> {
  const now = Date.now();
  const today = new Date();
  const monthKey = today.toISOString().slice(0, 7);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [
    forecast,
    scorecards,
    agents,
    leads,
    deposits,
    arrivals,
    supplierRequests,
    openQuotes,
    rates,
  ] = await Promise.all([
    computeRevenueForecast(30),
    computeSupplierScorecards(),
    computeAgentPerformance({
      from: iso(yearStart),
      to: iso(today),
    }),
    db.lead.findMany({
      where: { status: { in: ["NEW", "CONTACTED"] } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, fullName: true, source: true, status: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { status: "REQUESTED", type: "DEPOSIT", createdAt: { lt: new Date(now - 3 * DAY) } },
      include: {
        booking: {
          include: { customer: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    db.booking.findMany({
      where: {
        status: "CONFIRMED",
        checkIn: { gte: new Date(now), lte: new Date(now + 14 * DAY) },
      },
      include: { property: { select: { name: true } }, customer: { select: { fullName: true } } },
      orderBy: { checkIn: "asc" },
      take: 20,
    }),
    db.supplierUpdateRequest.count({ where: { status: "REQUESTED" } }),
    db.quote.count({ where: { status: "PENDING", validUntil: { gte: new Date(now) } } }),
    db.contractRate.findMany({ select: { supplierId: true, validTo: true } }),
  ]);

  // Current-month revenue from the forecast's monthly projection.
  const thisMonth = forecast.monthly.find((m) => m.month === monthKey);
  const monthRevenue = {
    expected: thisMonth?.expected ?? forecast.confirmedRevenue,
    confirmed: thisMonth?.confirmed ?? 0,
    profit: forecast.expectedProfit,
  };

  const atRiskSuppliers = scorecards.filter((s) => s.tier === "At Risk").length;
  const renewingContracts = new Map<string, number>();
  for (const r of rates) {
    const days = Math.round((r.validTo.getTime() - now) / DAY);
    if (days > 90) continue;
    const current = renewingContracts.get(r.supplierId);
    if (current == null || days < current) renewingContracts.set(r.supplierId, days);
  }
  const supplierNames = new Map(scorecards.map((s) => [s.supplierId, s.name]));
  const contractsRenewing = [...renewingContracts.entries()].map(([supplierId, expiryDays]) => ({
    supplierId,
    name: supplierNames.get(supplierId) ?? supplierId,
    expiryDays,
  }));

  return {
    month: monthKey,
    monthRevenue,
    attention: {
      newLeads: leads.length,
      openQuotes,
      overdueDeposits: deposits.length,
      supplierRequests,
      atRiskSuppliers,
      renewingContracts: contractsRenewing.length,
    },
    leads: leads.map((l) => ({
      id: l.id,
      fullName: l.fullName,
      source: l.source,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    })),
    overdueDeposits: deposits.map((p) => ({
      paymentId: p.id,
      reference: p.booking.reference,
      customer: p.booking.customer.fullName,
      amount: Number(p.amount),
      ageDays: Math.floor((now - p.createdAt.getTime()) / DAY),
    })),
    arrivals: arrivals.map((b) => ({
      reference: b.reference,
      customer: b.customer.fullName,
      property: b.property.name,
      checkIn: iso(b.checkIn),
      nights: b.nights,
      status: b.status,
    })),
    contractsRenewing,
    agents: agents.rows,
  };
}

export const getCommandCenter = createServerFn({ method: "GET" }).handler(async () =>
  computeCommandCenter(),
);
