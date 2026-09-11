import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type { SupplierInsightRow, SupplierScorecardsSummary } from "@/lib/types";

const DAY = 86_400_000;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function responseScore(avgHours: number | null): number {
  if (avgHours == null) return 50;
  return Math.max(0, Math.round(100 - (avgHours / 72) * 100));
}

function fmtHours(hours: number | null): number | null {
  return hours == null ? null : Math.round(hours * 10) / 10;
}

export async function computeSupplierScorecards(): Promise<SupplierInsightRow[]> {
  const suppliers = await db.supplier.findMany({
    where: { active: true, properties: { some: {} } },
    include: { properties: { select: { id: true } } },
  });
  if (suppliers.length === 0) return [];

  const supplierIds = suppliers.map((s) => s.id);
  const propertyIds = suppliers.flatMap((s) => s.properties.map((p) => p.id));
  const propToSupplier = new Map(suppliers.flatMap((s) => s.properties.map((p) => [p.id, s.id])));

  const [bookings, confirmations, updateRequests, contractRates, openRequests] = await Promise.all([
    db.booking.findMany({
      where: { propertyId: { in: propertyIds } },
      select: {
        propertyId: true,
        roomId: true,
        status: true,
        totalPrice: true,
        nights: true,
        checkIn: true,
        checkOut: true,
      },
    }),
    db.supplierConfirmation.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { supplierId: true, status: true },
    }),
    db.supplierUpdateRequest.findMany({
      where: { supplierId: { in: supplierIds } },
      select: {
        supplierId: true,
        status: true,
        requestedAt: true,
        receivedAt: true,
        importedAt: true,
      },
    }),
    db.contractRate.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { supplierId: true, roomId: true, validFrom: true, validTo: true, netRate: true },
    }),
    db.supplierUpdateRequest.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: supplierIds }, status: "REQUESTED" },
      _count: { _all: true },
    }),
  ]);

  const openBySupplier = new Map(openRequests.map((r) => [r.supplierId, r._count._all]));

  // Response times per supplier.
  const responseBySupplier = new Map<string, { ms: number; count: number }>();
  for (const r of updateRequests) {
    const resolved = r.importedAt ?? r.receivedAt;
    if (!resolved) continue;
    const entry = responseBySupplier.get(r.supplierId) ?? { ms: 0, count: 0 };
    entry.ms += resolved.getTime() - r.requestedAt.getTime();
    entry.count += 1;
    responseBySupplier.set(r.supplierId, entry);
  }

  // Confirmation counts per supplier.
  const confBySupplier = new Map<string, { confirmed: number; declined: number }>();
  for (const c of confirmations) {
    const entry = confBySupplier.get(c.supplierId) ?? { confirmed: 0, declined: 0 };
    if (c.status === "CONFIRMED") entry.confirmed += 1;
    else if (c.status === "DECLINED") entry.declined += 1;
    confBySupplier.set(c.supplierId, entry);
  }

  const rows: SupplierInsightRow[] = suppliers.map((supplier) => {
    const myPropertyIds = new Set(supplier.properties.map((p) => p.id));
    const myBookings = bookings.filter((b) => myPropertyIds.has(b.propertyId));
    const volume = myBookings.length;
    const cancelled = myBookings.filter((b) => b.status === "CANCELLED").length;
    const revenue = round2(myBookings.reduce((s, b) => s + Number(b.totalPrice), 0));

    // Profit = revenue − netRate×nights for each booking covered by a contract rate.
    let cost = 0;
    for (const b of myBookings) {
      const rate = contractRates.find(
        (r) =>
          r.supplierId === supplier.id &&
          r.validFrom <= b.checkIn &&
          r.validTo >= b.checkOut &&
          (!r.roomId || r.roomId === b.roomId),
      );
      if (rate) cost += Number(rate.netRate) * b.nights;
    }
    const profit = round2(revenue - cost);

    const conf = confBySupplier.get(supplier.id);
    const confirmationRate =
      conf && conf.confirmed + conf.declined > 0
        ? round2((conf.confirmed / (conf.confirmed + conf.declined)) * 100)
        : null;

    const resp = responseBySupplier.get(supplier.id);
    const avgResponseHours =
      resp && resp.count > 0 ? fmtHours(resp.ms / resp.count / 3_600_000) : null;

    const cancellationRate = volume > 0 ? round2((cancelled / volume) * 100) : null;

    // Contract intelligence: nearest expiring contract + its net rate.
    const now = Date.now();
    let contractExpiryDays: number | null = null;
    let contractNetRate: number | null = null;
    for (const r of contractRates) {
      if (r.supplierId !== supplier.id) continue;
      const days = Math.round((r.validTo.getTime() - now) / DAY);
      if (contractExpiryDays == null || days < contractExpiryDays) {
        contractExpiryDays = days;
        contractNetRate = Number(r.netRate);
      }
    }

    const score = Math.round(
      0.4 * responseScore(avgResponseHours) +
        0.4 * (confirmationRate ?? 50) +
        0.2 * (100 - (cancellationRate ?? 50)),
    );
    const tier = score >= 80 ? "Reliable" : score >= 60 ? "Needs Attention" : "At Risk";

    return {
      supplierId: supplier.id,
      name: supplier.name,
      score,
      tier,
      confirmationRate,
      avgResponseHours,
      cancellationRate,
      bookingVolume: volume,
      revenue,
      profit,
      openRequests: openBySupplier.get(supplier.id) ?? 0,
      contractExpiryDays,
      contractNetRate,
    };
  });

  rows.sort((a, b) => b.score - a.score);
  return rows;
}

export async function computeScorecardsSummary(
  rows: SupplierInsightRow[],
): Promise<SupplierScorecardsSummary> {
  const reliable = rows.filter((r) => r.tier === "Reliable").length;
  const needsAttention = rows.filter((r) => r.tier === "Needs Attention").length;
  const atRisk = rows.filter((r) => r.tier === "At Risk").length;
  const renewalDue = rows.filter(
    (r) => r.contractExpiryDays != null && r.contractExpiryDays <= 90,
  ).length;
  return { reliable, needsAttention, atRisk, renewalDue, total: rows.length };
}

export const getSupplierPerformance = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await computeSupplierScorecards();
  const summary = await computeScorecardsSummary(rows);
  return { rows, summary };
});
