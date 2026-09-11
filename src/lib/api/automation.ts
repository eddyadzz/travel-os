import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { generateBookingDocument } from "@/lib/api/documents";
import { customerDeepLink } from "@/lib/notifications/service";
import {
  notifyArrivalInstructions,
  notifyArrivalSummary,
  notifyBalanceReminder,
  notifyDailyReport,
  notifyDepositReminder,
  notifySupplierEscalation,
} from "@/lib/notifications/service";
import type { AutomationLogDTO, AutomationRunSummary } from "@/lib/types";
import { money } from "@/lib/pricing";

const DAY = 86_400_000;

function toLogDTO(l: {
  id: string;
  type: string;
  targetType: string;
  targetId: string | null;
  message: string;
  createdAt: Date;
}): AutomationLogDTO {
  return {
    id: l.id,
    type: l.type,
    targetType: l.targetType,
    ...(l.targetId ? { targetId: l.targetId } : {}),
    message: l.message,
    createdAt: l.createdAt.toISOString(),
  };
}

async function logAction(
  type: string,
  targetType: string,
  targetId: string | null,
  message: string,
) {
  await db.automationLog.create({
    data: { type, targetType, ...(targetId ? { targetId } : {}), message },
  });
}

/** Has this automation action already run for this target within the window? */
async function loggedRecently(
  type: string,
  targetType: string,
  targetId: string | null,
  windowMs: number,
): Promise<boolean> {
  const existing = await db.automationLog.findFirst({
    where: {
      type,
      targetType,
      ...(targetId ? { targetId } : {}),
      createdAt: { gte: new Date(Date.now() - windowMs) },
    },
  });
  return existing !== null;
}

function emptySummary(): AutomationRunSummary {
  return {
    depositReminders: 0,
    balanceReminders: 0,
    supplierReminders: 0,
    supplierEscalations: 0,
    arrivalSummaries: 0,
    vouchersGenerated: 0,
    arrivalInstructions: 0,
    dailyReportSent: false,
    total: 0,
  };
}

// Payment automation ---------------------------------------------------------------------------

export async function runPaymentAutomation(): Promise<AutomationRunSummary> {
  const s = emptySummary();

  // Deposit reminders — REQUESTED deposits older than 3 days.
  const deposits = await db.payment.findMany({
    where: { type: "DEPOSIT", status: "REQUESTED" },
    include: { booking: { include: { customer: true } } },
  });
  for (const p of deposits) {
    const age = Date.now() - p.createdAt.getTime();
    if (
      age >= 3 * DAY &&
      !(await loggedRecently("DEPOSIT_REMINDER", "BOOKING", p.bookingId, 3 * DAY))
    ) {
      const link = customerDeepLink({
        reference: p.booking.reference,
        token: p.booking.trackingToken,
      });
      await notifyDepositReminder({
        recipient: p.booking.customer.email,
        reference: p.booking.reference,
        deposit: money(Number(p.amount)),
        link,
      });
      await logAction(
        "DEPOSIT_REMINDER",
        "BOOKING",
        p.bookingId,
        `Deposit reminder for ${p.booking.reference}`,
      );
      s.depositReminders += 1;
    }
  }

  // Balance reminders — upcoming non-cancelled bookings with outstanding balance.
  const upcoming = await db.booking.findMany({
    where: {
      status: { not: "CANCELLED" },
      checkIn: { gte: new Date(), lte: new Date(Date.now() + 30 * DAY) },
    },
    include: { customer: true, payments: true },
  });
  for (const b of upcoming) {
    const paid = b.payments
      .filter((p) => p.status === "VERIFIED" && p.type !== "REFUND")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = Number(b.totalPrice) - paid;
    if (outstanding <= 0) continue;
    const days = Math.round((b.checkIn.getTime() - Date.now()) / DAY);
    const window = days <= 7 ? "T7" : days <= 14 ? "T14" : "T30";
    if (!(await loggedRecently(`BALANCE_${window}`, "BOOKING", b.id, 7 * DAY))) {
      const link = customerDeepLink({ reference: b.reference, token: b.trackingToken });
      await notifyBalanceReminder({
        recipient: b.customer.email,
        reference: b.reference,
        outstanding: money(outstanding),
        daysUntilArrival: Math.max(1, days),
        link,
      });
      await logAction(
        `BALANCE_${window}`,
        "BOOKING",
        b.id,
        `Balance reminder for ${b.reference} (${window})`,
      );
      s.balanceReminders += 1;
    }
  }

  return s;
}

// Supplier escalation ---------------------------------------------------------------------------

export async function runSupplierAutomation(): Promise<AutomationRunSummary> {
  const s = emptySummary();
  const requests = await db.supplierUpdateRequest.findMany({
    where: { status: "REQUESTED" },
    include: { supplier: true },
  });
  for (const r of requests) {
    const age = Date.now() - r.requestedAt.getTime();
    if (!r.supplier.email) continue;

    // Once escalated, don't fall back to a lower-level reminder for this request.
    if (await loggedRecently("SUPPLIER_ESCALATION", "SUPPLIER", r.id, 7 * DAY)) continue;

    if (age >= 7 * DAY) {
      await notifySupplierEscalation({
        recipient: r.supplier.email,
        supplier: r.supplier.name,
        type: r.type,
        daysOld: Math.floor(age / DAY),
        level: 2,
      });
      await logAction("SUPPLIER_ESCALATION", "SUPPLIER", r.id, `Escalation to ${r.supplier.name}`);
      s.supplierEscalations += 1;
    } else if (
      age >= 3 * DAY &&
      !(await loggedRecently("SUPPLIER_REMINDER", "SUPPLIER", r.id, 3 * DAY))
    ) {
      await notifySupplierEscalation({
        recipient: r.supplier.email,
        supplier: r.supplier.name,
        type: r.type,
        daysOld: Math.floor(age / DAY),
        level: 1,
      });
      await logAction("SUPPLIER_REMINDER", "SUPPLIER", r.id, `Reminder to ${r.supplier.name}`);
      s.supplierReminders += 1;
    }
  }
  return s;
}

// Arrival automation -----------------------------------------------------------------------------

export async function runArrivalAutomation(): Promise<AutomationRunSummary> {
  const s = emptySummary();
  const now = Date.now();
  const upcoming = await db.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "COMPLETED"] },
      checkIn: { gte: new Date(now), lte: new Date(now + 7 * DAY) },
    },
    include: { customer: true, property: true, room: true },
  });

  for (const b of upcoming) {
    const days = Math.round((b.checkIn.getTime() - now) / DAY);
    const link = customerDeepLink({ reference: b.reference, token: b.trackingToken });

    // Stage ordering: once a booking reaches a stage, earlier (less urgent) stages no longer apply.
    if (await loggedRecently("ARRIVAL_T1", "BOOKING", b.id, DAY)) continue;

    if (days <= 1) {
      await notifyArrivalInstructions({
        recipient: b.customer.email,
        reference: b.reference,
        property: b.property.name,
        transfer: `${b.property.transferMethod} (${b.property.transferDuration})`,
        link,
      });
      await logAction("ARRIVAL_T1", "BOOKING", b.id, `Arrival instructions for ${b.reference}`);
      s.arrivalInstructions += 1;
      continue;
    }

    if (await loggedRecently("ARRIVAL_T3", "BOOKING", b.id, 3 * DAY)) continue;

    if (days <= 3) {
      // Generate resort + transfer vouchers.
      for (const type of ["RESORT_VOUCHER", "TRANSFER_VOUCHER"] as const) {
        try {
          await generateBookingDocument({ data: { bookingId: b.id, type } });
          s.vouchersGenerated += 1;
        } catch {
          // Skip if a voucher cannot be generated (no rate etc.).
        }
      }
      await logAction("ARRIVAL_T3", "BOOKING", b.id, `Vouchers generated for ${b.reference}`);
      continue;
    }

    if (days <= 7 && !(await loggedRecently("ARRIVAL_T7", "BOOKING", b.id, DAY))) {
      await notifyArrivalSummary({
        recipient: b.customer.email,
        reference: b.reference,
        property: b.property.name,
        room: b.room.name,
        checkIn: b.checkIn.toISOString().slice(0, 10),
        checkOut: b.checkOut.toISOString().slice(0, 10),
        link,
      });
      await logAction("ARRIVAL_T7", "BOOKING", b.id, `Booking summary for ${b.reference}`);
      s.arrivalSummaries += 1;
    }
  }
  return s;
}

// Daily report ------------------------------------------------------------------------------------

export async function runDailyReport(): Promise<AutomationRunSummary> {
  const s = emptySummary();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (await loggedRecently("DAILY_REPORT", "GLOBAL", null, DAY)) {
    return s; // already sent today
  }

  const [newLeads, quotes, confirmed, revenueAgg, outstandingAgg, supplierPending] =
    await Promise.all([
      db.lead.count({ where: { createdAt: { gte: today } } }),
      db.quote.count({ where: { createdAt: { gte: today } } }),
      db.booking.count({
        where: { status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: today } },
      }),
      db.payment.aggregate({
        where: { status: "VERIFIED", type: { not: "REFUND" }, paidAt: { gte: today } },
        _sum: { amount: true },
      }),
      db.booking.aggregate({
        where: { status: { not: "CANCELLED" } },
        _sum: { totalPrice: true },
      }),
      db.supplierUpdateRequest.count({ where: { status: "REQUESTED" } }),
    ]);

  const verifiedPayments = await db.payment.findMany({
    where: { status: "VERIFIED", type: { not: "REFUND" } },
  });
  const paidTotal = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = Math.max(0, Number(outstandingAgg._sum.totalPrice ?? 0) - paidTotal);

  const agent = await db.user.findFirst({
    where: { role: { in: ["BOOKING_AGENT", "SUPER_ADMIN"] } },
    orderBy: { createdAt: "asc" },
  });
  if (agent) {
    await notifyDailyReport({
      recipient: agent.email,
      newLeads,
      quotes,
      confirmed,
      revenue: Number(revenueAgg._sum.amount ?? 0),
      outstanding,
      supplierPending,
    });
    await logAction("DAILY_REPORT", "GLOBAL", null, "Daily operations report sent");
    s.dailyReportSent = true;
  }
  return s;
}

// Public entry points --------------------------------------------------------------------------------

export const runAllAutomation = createServerFn({ method: "POST" }).handler(async () => {
  const [payment, supplier, arrival, daily] = await Promise.all([
    runPaymentAutomation(),
    runSupplierAutomation(),
    runArrivalAutomation(),
    runDailyReport(),
  ]);
  const totals: AutomationRunSummary = {
    depositReminders: payment.depositReminders,
    balanceReminders: payment.balanceReminders,
    supplierReminders: supplier.supplierReminders,
    supplierEscalations: supplier.supplierEscalations,
    arrivalSummaries: arrival.arrivalSummaries,
    vouchersGenerated: arrival.vouchersGenerated,
    arrivalInstructions: arrival.arrivalInstructions,
    dailyReportSent: daily.dailyReportSent,
    total:
      payment.depositReminders +
      payment.balanceReminders +
      supplier.supplierReminders +
      supplier.supplierEscalations +
      arrival.arrivalSummaries +
      arrival.vouchersGenerated +
      arrival.arrivalInstructions +
      (daily.dailyReportSent ? 1 : 0),
  };
  return totals;
});

export const runPaymentAutomationFn = createServerFn({ method: "POST" }).handler(() =>
  runPaymentAutomation(),
);
export const runSupplierAutomationFn = createServerFn({ method: "POST" }).handler(() =>
  runSupplierAutomation(),
);
export const runArrivalAutomationFn = createServerFn({ method: "POST" }).handler(() =>
  runArrivalAutomation(),
);
export const runDailyReportFn = createServerFn({ method: "POST" }).handler(() => runDailyReport());

export const listAutomationLogs = createServerFn({ method: "GET" }).handler(async () => {
  const logs = await db.automationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return logs.map(toLogDTO);
});
