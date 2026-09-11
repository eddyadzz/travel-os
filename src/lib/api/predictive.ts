import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { computePandL } from "@/lib/api/finance";
import type {
  BookingForecastDTO,
  BookingStatus,
  LeadIntelligenceDTO,
  PredictiveDashboardDTO,
  RevenueForecastDTO,
  SupplierRiskRow,
} from "@/lib/types";

const DAY = 86_400_000;
const CONFIRMED: BookingStatus[] = ["CONFIRMED", "COMPLETED"];
const PIPELINE: BookingStatus[] = [
  "NEW",
  "ASSIGNED",
  "PENDING_SUPPLIER",
  "AWAITING_CUSTOMER",
  "AWAITING_PAYMENT",
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

// Revenue forecast -------------------------------------------------------------------------------

export async function computeRevenueForecast(windowDays = 90): Promise<RevenueForecastDTO> {
  const now = Date.now();
  const horizon = new Date(now + windowDays * DAY);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [bookings, quotes, pandl] = await Promise.all([
    db.booking.findMany({
      where: {
        status: { in: [...CONFIRMED, ...PIPELINE] },
        checkIn: { gte: new Date(now), lte: horizon },
      },
      select: { status: true, checkIn: true, totalPrice: true },
    }),
    db.quote.findMany({
      where: { status: "PENDING", validUntil: { gte: new Date(now) } },
      select: { totalPrice: true, createdAt: true },
    }),
    computePandL({
      from: yearStart.toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    }),
  ]);

  const margin = pandl.marginPercent;
  const confirmedByMonth = new Map<string, number>();
  const pipelineByMonth = new Map<string, number>();

  let confirmed = 0;
  let pipeline = 0;
  for (const b of bookings) {
    const amount = Number(b.totalPrice);
    if (CONFIRMED.includes(b.status)) {
      confirmed += amount;
      confirmedByMonth.set(
        monthKey(b.checkIn),
        (confirmedByMonth.get(monthKey(b.checkIn)) ?? 0) + amount,
      );
    } else {
      pipeline += amount;
      pipelineByMonth.set(
        monthKey(b.checkIn),
        (pipelineByMonth.get(monthKey(b.checkIn)) ?? 0) + amount,
      );
    }
  }

  // Quote pipeline → expected conversion at the historic quote conversion rate.
  const allQuotes = await db.quote.findMany({ select: { status: true } });
  const accepted = allQuotes.filter((q) => q.status === "ACCEPTED").length;
  const quoteConv = allQuotes.length > 0 ? accepted / allQuotes.length : 0.4;
  const openQuoteValue = quotes.reduce((s, q) => s + Number(q.totalPrice), 0);
  const quotePipeline = openQuoteValue * quoteConv;

  const expectedCollections = round2(confirmed + pipeline * 0.5 + quotePipeline);
  const expectedProfit = round2((expectedCollections * margin) / 100);

  // Monthly projection: confirmed + (pipeline × 50% + quotes × conversion) spread by month.
  const months = new Set([...confirmedByMonth.keys(), ...pipelineByMonth.keys()]);
  const monthly = [...months].sort().map((m) => {
    const confirmedValue = confirmedByMonth.get(m) ?? 0;
    const pipelineValue = pipelineByMonth.get(m) ?? 0;
    return {
      month: m,
      confirmed: round2(confirmedValue),
      expected: round2(confirmedValue + pipelineValue * 0.5),
    };
  });

  return {
    windowDays,
    confirmedRevenue: round2(confirmed),
    pipelineRevenue: round2(pipeline + quotePipeline),
    expectedCollections,
    expectedProfit,
    projectedMarginPercent: round2(margin),
    monthly,
  };
}

// Booking forecast ------------------------------------------------------------------------------

export async function computeBookingForecast(): Promise<BookingForecastDTO> {
  const now = Date.now();
  const [openQuotes, allQuotes, bookingsInWindow, confirmedInWindow] = await Promise.all([
    db.quote.count({ where: { status: "PENDING", validUntil: { gte: new Date(now) } } }),
    db.quote.findMany({ select: { status: true } }),
    db.booking.count({
      where: { status: { in: PIPELINE }, checkIn: { gte: new Date(now) } },
    }),
    db.booking.count({ where: { status: "CONFIRMED" } }),
  ]);

  const accepted = allQuotes.filter((q) => q.status === "ACCEPTED").length;
  const quoteConversionRate =
    allQuotes.length > 0 ? Math.round((accepted / allQuotes.length) * 1000) / 10 : 40;

  const [totalBookings, cancelledBookings] = await Promise.all([
    db.booking.count(),
    db.booking.count({ where: { status: "CANCELLED" } }),
  ]);
  const cancellationRate = totalBookings > 0 ? cancelledBookings / totalBookings : 0.05;

  return {
    openQuotes,
    quoteConversionRate,
    expectedConfirmations: Math.round(openQuotes * (quoteConversionRate / 100)),
    expectedCancellations: Math.round(confirmedInWindow * cancellationRate),
    pipelineBookings: bookingsInWindow,
  };
}

// Lead intelligence ------------------------------------------------------------------------------

export async function computeLeadIntelligence(): Promise<LeadIntelligenceDTO> {
  const leads = await db.lead.findMany({
    include: {
      quotes: { select: { id: true } },
      booking: { select: { totalPrice: true } },
    },
  });

  const bySource = new Map<
    string,
    { leads: number; quoted: number; converted: number; value: number }
  >();
  for (const l of leads) {
    const entry = bySource.get(l.source) ?? { leads: 0, quoted: 0, converted: 0, value: 0 };
    entry.leads += 1;
    if (l.quotes.length > 0) entry.quoted += 1;
    if (l.bookingId && l.booking) {
      entry.converted += 1;
      entry.value += Number(l.booking.totalPrice);
    }
    bySource.set(l.source, entry);
  }

  const rows = [...bySource.entries()]
    .map(([source, e]) => {
      const quoteRate = e.leads > 0 ? Math.round((e.quoted / e.leads) * 1000) / 10 : 0;
      const conversionRate = e.leads > 0 ? Math.round((e.converted / e.leads) * 1000) / 10 : 0;
      const avgBookingValue = e.converted > 0 ? round2(e.value / e.converted) : 0;
      return {
        source,
        leads: e.leads,
        quoteRate,
        conversionRate,
        avgBookingValue,
        expectedRevenue: round2(
          (e.leads - e.converted) * (conversionRate / 100) * (avgBookingValue || 0),
        ),
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate);

  const total = leads.length;
  const converted = leads.filter((l) => l.bookingId).length;
  const overallConversionRate = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;
  const totalValue = leads.reduce((s, l) => s + (l.booking ? Number(l.booking.totalPrice) : 0), 0);
  const avgLeadValue = converted > 0 ? round2(totalValue / converted) : 0;

  return {
    bySource: rows,
    bestSource: rows[0] && rows[0].leads > 0 ? rows[0].source : null,
    overallConversionRate,
    avgLeadValue,
  };
}

// Supplier risk ----------------------------------------------------------------------------------

export async function computeSupplierRisk(): Promise<SupplierRiskRow[]> {
  const suppliers = await db.supplier.findMany({
    where: { properties: { some: {} } },
    select: { id: true, name: true },
  });
  if (suppliers.length === 0) return [];

  const [requests, contractRates] = await Promise.all([
    db.supplierUpdateRequest.findMany({
      where: { supplierId: { in: suppliers.map((s) => s.id) } },
      select: { supplierId: true, requestedAt: true, receivedAt: true, importedAt: true },
    }),
    db.contractRate.findMany({
      where: { supplierId: { in: suppliers.map((s) => s.id) } },
      select: { supplierId: true, validTo: true },
    }),
  ]);

  const recentCutoff = Date.now() - 14 * DAY;
  const now = Date.now();

  return suppliers.map((supplier) => {
    const mine = requests.filter((r) => r.supplierId === supplier.id);
    let avgMs = 0;
    let avgCount = 0;
    let recentMs = 0;
    let recentCount = 0;
    for (const r of mine) {
      const resolved = r.importedAt ?? r.receivedAt;
      if (!resolved) continue;
      const elapsed = resolved.getTime() - r.requestedAt.getTime();
      avgMs += elapsed;
      avgCount += 1;
      if (r.requestedAt.getTime() >= recentCutoff) {
        recentMs += elapsed;
        recentCount += 1;
      }
    }
    const avgResponseHours =
      avgCount > 0 ? Math.round((avgMs / avgCount / 3_600_000) * 10) / 10 : null;
    const recentResponseHours =
      recentCount > 0 ? Math.round((recentMs / recentCount / 3_600_000) * 10) / 10 : null;

    let responseTrend: SupplierRiskRow["responseTrend"] = "stable";
    if (avgResponseHours != null && recentResponseHours != null) {
      responseTrend =
        recentResponseHours < avgResponseHours * 0.85
          ? "improving"
          : recentResponseHours > avgResponseHours * 1.25
            ? "slowing"
            : "stable";
    }

    let contractExpiryDays: number | null = null;
    for (const r of contractRates) {
      if (r.supplierId !== supplier.id) continue;
      const days = Math.round((r.validTo.getTime() - now) / DAY);
      if (contractExpiryDays == null || days < contractExpiryDays) contractExpiryDays = days;
    }

    const atRisk =
      (responseTrend === "slowing" && (recentResponseHours ?? 0) > 48) ||
      (contractExpiryDays != null && contractExpiryDays <= 90);

    return {
      supplierId: supplier.id,
      name: supplier.name,
      avgResponseHours,
      recentResponseHours,
      responseTrend,
      contractExpiryDays,
      atRisk,
    };
  });
}

// Dashboard --------------------------------------------------------------------------------------

export async function computePredictiveDashboard(): Promise<PredictiveDashboardDTO> {
  const [revenue, bookings, leads, supplierRisks] = await Promise.all([
    computeRevenueForecast(),
    computeBookingForecast(),
    computeLeadIntelligence(),
    computeSupplierRisk(),
  ]);
  return { revenue, bookings, leads, supplierRisks };
}

export const getPredictiveDashboard = createServerFn({ method: "GET" }).handler(async () =>
  computePredictiveDashboard(),
);
