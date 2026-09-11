import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { db } from "@/lib/db.server";
import type {
  AccountingFormat,
  AgentFinanceReport,
  DepositReport,
  ExcelExportResult,
  ExportResult,
  FinanceDashboardDTO,
  FinanceReportType,
  OutstandingReport,
  PandLReport,
  PaymentLedgerReport,
  ReportFilter,
} from "@/lib/types";

const DAY = 86_400_000;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseFilter(input: ReportFilter): { from: Date; to: Date } {
  const from = new Date(`${input.from}T00:00:00.000Z`);
  const to = new Date(`${input.to}T23:59:59.999Z`);
  return { from, to };
}

function defaultFilter(): ReportFilter {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * DAY);
  return { from: iso(from), to: iso(to) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Batch costing — supplier net rate × nights per booking, one query for rates.
// ---------------------------------------------------------------------------

type CostedBooking = {
  id: string;
  reference: string;
  customerName: string;
  propertyName: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  status: string;
  totalPrice: number;
  supplierCost: number;
  grossProfit: number;
  marginPercent: number;
  assignedAgentId?: string;
};

async function loadCostedBookings({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): Promise<CostedBooking[]> {
  const bookings = await db.booking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      property: { include: { supplier: true } },
      room: { select: { name: true } },
      customer: { select: { fullName: true } },
      assignedAgent: { select: { id: true } },
    },
  });
  const supplierIds = [
    ...new Set(bookings.map((b) => b.property.supplierId).filter(Boolean)),
  ] as string[];
  const rates = supplierIds.length
    ? await db.contractRate.findMany({ where: { supplierId: { in: supplierIds } } })
    : [];

  return bookings.map((b) => {
    const revenue = Number(b.totalPrice);
    let supplierCost = 0;
    if (b.property.supplier) {
      const rate = rates.find(
        (r) =>
          r.supplierId === b.property.supplier!.id &&
          r.validFrom <= b.checkIn &&
          r.validTo >= b.checkOut &&
          (!r.roomId || r.roomId === b.roomId),
      );
      if (rate) supplierCost = Number(rate.netRate) * b.nights;
    }
    const grossProfit = round2(revenue - supplierCost);
    return {
      id: b.id,
      reference: b.reference,
      customerName: b.customer.fullName,
      propertyName: b.property.name,
      roomName: b.room.name,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      status: b.status,
      totalPrice: revenue,
      supplierCost: round2(supplierCost),
      grossProfit,
      marginPercent: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
      ...(b.assignedAgent ? { assignedAgentId: b.assignedAgent.id } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Report computations
// ---------------------------------------------------------------------------

export async function computePandL(filter: ReportFilter): Promise<PandLReport> {
  const { from, to } = parseFilter(filter);
  const bookings = await loadCostedBookings({ from, to });
  const rows = bookings.map((b) => ({
    reference: b.reference,
    customer: b.customerName,
    property: b.propertyName,
    room: b.roomName,
    checkIn: iso(b.checkIn),
    nights: b.nights,
    status: b.status,
    revenue: b.totalPrice,
    supplierCost: b.supplierCost,
    grossProfit: b.grossProfit,
    marginPercent: b.marginPercent,
  }));
  const totalRevenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
  const totalCost = round2(rows.reduce((s, r) => s + r.supplierCost, 0));
  const totalProfit = round2(totalRevenue - totalCost);
  return {
    rows,
    totalRevenue,
    totalCost,
    totalProfit,
    marginPercent: totalRevenue > 0 ? round2((totalProfit / totalRevenue) * 100) : 0,
  };
}

export async function computeOutstanding(): Promise<OutstandingReport> {
  const bookings = await db.booking.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      property: { select: { name: true } },
      customer: { select: { fullName: true } },
      payments: { select: { status: true, type: true, amount: true } },
    },
    orderBy: { checkIn: "asc" },
  });
  const rows = bookings.map((b) => {
    const totalPrice = Number(b.totalPrice);
    const paid = round2(
      b.payments
        .filter((p) => p.status === "VERIFIED" && p.type !== "REFUND")
        .reduce((s, p) => s + Number(p.amount), 0),
    );
    return {
      reference: b.reference,
      customer: b.customer.fullName,
      property: b.property.name,
      checkIn: iso(b.checkIn),
      totalPrice,
      paid,
      outstanding: round2(totalPrice - paid),
      status: b.status,
    };
  });
  return { rows, totalOutstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)) };
}

export async function computeDeposits(filter: ReportFilter): Promise<DepositReport> {
  const { from, to } = parseFilter(filter);
  const payments = await db.payment.findMany({
    where: { type: "DEPOSIT", createdAt: { gte: from, lte: to } },
    include: { booking: { include: { customer: { select: { fullName: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const rows = payments.map((p) => ({
    date: iso(p.createdAt),
    reference: p.booking.reference,
    customer: p.booking.customer.fullName,
    amount: Number(p.amount),
    status: p.status,
  }));
  return { rows, total: round2(rows.reduce((s, r) => s + r.amount, 0)), count: rows.length };
}

export async function computePaymentLedger(filter: ReportFilter): Promise<PaymentLedgerReport> {
  const { from, to } = parseFilter(filter);
  const payments = await db.payment.findMany({
    where: { paidAt: { gte: from, lte: to } },
    include: { booking: { include: { customer: { select: { fullName: true } } } } },
    orderBy: { paidAt: "desc" },
  });
  const rows = payments.map((p) => ({
    date: p.paidAt ? iso(p.paidAt) : iso(p.createdAt),
    reference: p.booking.reference,
    customer: p.booking.customer.fullName,
    type: p.type,
    status: p.status,
    amount: Number(p.amount),
  }));
  return { rows, total: round2(rows.reduce((s, r) => s + r.amount, 0)) };
}

export async function computeAgentPerformance(filter: ReportFilter): Promise<AgentFinanceReport> {
  const { from, to } = parseFilter(filter);
  const [agents, costed] = await Promise.all([
    db.user.findMany({ select: { id: true, fullName: true, commissionRate: true } }),
    loadCostedBookings({ from, to }),
  ]);
  const rows = agents
    .map((a) => {
      const mine = costed.filter((b) => b.assignedAgentId === a.id);
      if (mine.length === 0) return null;
      const revenue = round2(mine.reduce((s, b) => s + b.totalPrice, 0));
      const profit = round2(mine.reduce((s, b) => s + b.grossProfit, 0));
      const commissionRate = Number(a.commissionRate ?? 10);
      const commission = round2((profit * commissionRate) / 100);
      return {
        agentId: a.id,
        name: a.fullName,
        bookings: mine.length,
        revenue,
        profit,
        averageValue: round2(revenue / mine.length),
        commissionRate,
        commission,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  return { rows };
}

export async function computeFinanceDashboard(filter: ReportFilter): Promise<FinanceDashboardDTO> {
  const [pandl, outstanding, deposits, ledger, agents] = await Promise.all([
    computePandL(filter),
    computeOutstanding(),
    computeDeposits(filter),
    computePaymentLedger(filter),
    computeAgentPerformance(filter),
  ]);
  return { pandl, outstanding, deposits, ledger, agents };
}

// ---------------------------------------------------------------------------
// CSV + Excel builders
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

function buildCsvForReport(
  report: FinanceReportType,
  filter: ReportFilter,
  data: FinanceDashboardDTO,
): string {
  switch (report) {
    case "P&L":
      return rowsToCsv(
        [
          "Reference",
          "Customer",
          "Property",
          "Room",
          "Check-in",
          "Nights",
          "Status",
          "Revenue",
          "Supplier Cost",
          "Gross Profit",
          "Margin %",
        ],
        data.pandl.rows.map((r) => [
          r.reference,
          r.customer,
          r.property,
          r.room,
          r.checkIn,
          r.nights,
          r.status,
          r.revenue,
          r.supplierCost,
          r.grossProfit,
          r.marginPercent,
        ]),
      );
    case "OUTSTANDING":
      return rowsToCsv(
        ["Reference", "Customer", "Property", "Check-in", "Total", "Paid", "Outstanding", "Status"],
        data.outstanding.rows.map((r) => [
          r.reference,
          r.customer,
          r.property,
          r.checkIn,
          r.totalPrice,
          r.paid,
          r.outstanding,
          r.status,
        ]),
      );
    case "DEPOSITS":
      return rowsToCsv(
        ["Date", "Reference", "Customer", "Amount", "Status"],
        data.deposits.rows.map((r) => [r.date, r.reference, r.customer, r.amount, r.status]),
      );
    case "LEDGER":
      return rowsToCsv(
        ["Date", "Reference", "Customer", "Type", "Status", "Amount"],
        data.ledger.rows.map((r) => [r.date, r.reference, r.customer, r.type, r.status, r.amount]),
      );
    case "AGENTS":
      return rowsToCsv(
        [
          "Agent",
          "Bookings",
          "Revenue",
          "Profit",
          "Commission Rate %",
          "Commission",
          "Average Value",
        ],
        data.agents.rows.map((r) => [
          r.name,
          r.bookings,
          r.revenue,
          r.profit,
          r.commissionRate,
          r.commission,
          r.averageValue,
        ]),
      );
  }
}

function buildExcelWorkbook(report: FinanceReportType, data: FinanceDashboardDTO): Buffer {
  const wb = XLSX.utils.book_new();
  switch (report) {
    case "P&L": {
      const aoa = [
        [
          "Reference",
          "Customer",
          "Property",
          "Room",
          "Check-in",
          "Nights",
          "Status",
          "Revenue",
          "Supplier Cost",
          "Gross Profit",
          "Margin %",
        ],
        ...data.pandl.rows.map((r) => [
          r.reference,
          r.customer,
          r.property,
          r.room,
          r.checkIn,
          r.nights,
          r.status,
          r.revenue,
          r.supplierCost,
          r.grossProfit,
          r.marginPercent,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Profit & Loss");
      break;
    }
    case "OUTSTANDING": {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [
            "Reference",
            "Customer",
            "Property",
            "Check-in",
            "Total",
            "Paid",
            "Outstanding",
            "Status",
          ],
          ...data.outstanding.rows.map((r) => [
            r.reference,
            r.customer,
            r.property,
            r.checkIn,
            r.totalPrice,
            r.paid,
            r.outstanding,
            r.status,
          ]),
        ]),
        "Outstanding",
      );
      break;
    }
    case "DEPOSITS": {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Date", "Reference", "Customer", "Amount", "Status"],
          ...data.deposits.rows.map((r) => [r.date, r.reference, r.customer, r.amount, r.status]),
        ]),
        "Deposits",
      );
      break;
    }
    case "LEDGER": {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Date", "Reference", "Customer", "Type", "Status", "Amount"],
          ...data.ledger.rows.map((r) => [
            r.date,
            r.reference,
            r.customer,
            r.type,
            r.status,
            r.amount,
          ]),
        ]),
        "Payments",
      );
      break;
    }
    case "AGENTS": {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [
            "Agent",
            "Bookings",
            "Revenue",
            "Profit",
            "Commission Rate %",
            "Commission",
            "Average Value",
          ],
          ...data.agents.rows.map((r) => [
            r.name,
            r.bookings,
            r.revenue,
            r.profit,
            r.commissionRate,
            r.commission,
            r.averageValue,
          ]),
        ]),
        "Agents",
      );
      break;
    }
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ---------------------------------------------------------------------------
// Accounting-ready journals (double-entry, balanced)
// ---------------------------------------------------------------------------

type JournalEntry = {
  date: string;
  reference: string;
  name: string;
  memo: string;
  account: string;
  debit: number;
  credit: number;
};

export async function buildJournal(filter: ReportFilter): Promise<JournalEntry[]> {
  const { from, to } = parseFilter(filter);
  const entries: JournalEntry[] = [];

  const bookings = await loadCostedBookings({ from, to });
  for (const b of bookings) {
    if (b.status === "CANCELLED") continue;
    const d = iso(b.checkIn);
    const memo = `Booking ${b.reference} — ${b.propertyName} ${b.roomName} (${b.nights}n)`;
    entries.push({
      date: d,
      reference: b.reference,
      name: b.customerName,
      memo,
      account: "Accounts Receivable",
      debit: b.totalPrice,
      credit: 0,
    });
    entries.push({
      date: d,
      reference: b.reference,
      name: b.customerName,
      memo: `Sale — ${b.reference}`,
      account: "Sales Revenue",
      debit: 0,
      credit: b.totalPrice,
    });
    if (b.supplierCost > 0) {
      entries.push({
        date: d,
        reference: b.reference,
        name: b.propertyName,
        memo: `COGS — ${b.reference}`,
        account: "Cost of Goods Sold",
        debit: b.supplierCost,
        credit: 0,
      });
      entries.push({
        date: d,
        reference: b.reference,
        name: b.propertyName,
        memo: `Supplier cost — ${b.reference}`,
        account: "Supplier Payables",
        debit: 0,
        credit: b.supplierCost,
      });
    }
  }

  const payments = await db.payment.findMany({
    where: { paidAt: { gte: from, lte: to } },
    include: { booking: { include: { customer: { select: { fullName: true } } } } },
  });
  for (const p of payments) {
    if (p.status !== "VERIFIED") continue;
    const isRefund = p.type === "REFUND";
    const amount = Number(p.amount);
    const d = p.paidAt ? iso(p.paidAt) : iso(p.createdAt);
    const memo = `${isRefund ? "Refund" : "Payment"} (${p.type}) — ${p.booking.reference}`;
    entries.push({
      date: d,
      reference: p.booking.reference,
      name: p.booking.customer.fullName,
      memo,
      account: "Bank",
      debit: isRefund ? 0 : amount,
      credit: isRefund ? amount : 0,
    });
    entries.push({
      date: d,
      reference: p.booking.reference,
      name: p.booking.customer.fullName,
      memo,
      account: "Accounts Receivable",
      debit: isRefund ? amount : 0,
      credit: isRefund ? 0 : amount,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export function buildQuickBooksCSV(entries: JournalEntry[]): string {
  // QuickBooks import convention: signed amount (debit positive, credit negative).
  return rowsToCsv(
    ["Date", "Transaction Type", "Num", "Name", "Memo", "Account", "Amount"],
    entries.map((e) => [
      e.date,
      "Journal Entry",
      e.reference,
      e.name,
      e.memo,
      e.account,
      round2(e.debit - e.credit),
    ]),
  );
}

export function buildXeroCSV(entries: JournalEntry[]): string {
  // Xero journal import convention.
  return rowsToCsv(
    ["JournalDate", "Reference", "Description", "Account", "Debit", "Credit"],
    entries.map((e) => [e.date, e.reference, e.memo, e.account, round2(e.debit), round2(e.credit)]),
  );
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const getFinanceReport = createServerFn({ method: "GET" })
  .validator((filter?: ReportFilter) => filter)
  .handler(async ({ data }) => computeFinanceDashboard(data ?? defaultFilter()));

export const setAgentCommissionRate = createServerFn({ method: "POST" })
  .validator((input: { agentId: string; rate: number }) => input)
  .handler(async ({ data }) => {
    if (!(data.rate >= 0 && data.rate <= 100)) throw new Error("Rate must be between 0 and 100.");
    await db.user.update({ where: { id: data.agentId }, data: { commissionRate: data.rate } });
    return { ok: true };
  });

export const listAgentsWithRates = createServerFn({ method: "GET" }).handler(async () => {
  const agents = await db.user.findMany({
    select: { id: true, fullName: true, commissionRate: true, role: true },
    orderBy: { fullName: "asc" },
  });
  return agents.map((a) => ({
    agentId: a.id,
    name: a.fullName,
    commissionRate: Number(a.commissionRate ?? 10),
    role: a.role,
  }));
});

export const exportFinanceCSV = createServerFn({ method: "POST" })
  .validator((input: { report: FinanceReportType; from: string; to: string }) => input)
  .handler(async ({ data }): Promise<ExportResult> => {
    const filter = { from: data.from, to: data.to };
    const dashboard = await computeFinanceDashboard(filter);
    const content = buildCsvForReport(data.report, filter, dashboard);
    return { filename: `${data.report.toLowerCase()}-${data.from}-${data.to}.csv`, content };
  });

export const exportFinanceExcel = createServerFn({ method: "POST" })
  .validator((input: { report: FinanceReportType; from: string; to: string }) => input)
  .handler(async ({ data }): Promise<ExcelExportResult> => {
    const dashboard = await computeFinanceDashboard({ from: data.from, to: data.to });
    const buf = buildExcelWorkbook(data.report, dashboard);
    return {
      filename: `${data.report.toLowerCase()}-${data.from}-${data.to}.xlsx`,
      base64: buf.toString("base64"),
    };
  });

export const exportAccounting = createServerFn({ method: "POST" })
  .validator((input: { format: AccountingFormat; from: string; to: string }) => input)
  .handler(async ({ data }): Promise<ExportResult> => {
    const entries = await buildJournal({ from: data.from, to: data.to });
    const content = data.format === "XERO" ? buildXeroCSV(entries) : buildQuickBooksCSV(entries);
    return {
      filename: `${data.format.toLowerCase()}-journal-${data.from}-${data.to}.csv`,
      content,
    };
  });
