import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  runPaymentAutomation,
  runSupplierAutomation,
  runArrivalAutomation,
  runDailyReport,
} from "@/lib/api/automation";
import * as documents from "@/lib/api/documents";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    payment: { findMany: vi.fn(), aggregate: vi.fn() },
    booking: { findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn() },
    supplierUpdateRequest: { findMany: vi.fn(), count: vi.fn() },
    automationLog: { create: vi.fn(), findFirst: vi.fn() },
    lead: { count: vi.fn() },
    quote: { count: vi.fn() },
    user: { findFirst: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/documents", () => ({ generateBookingDocument: vi.fn() }));
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
    reference: "MV-24081",
    trackingToken: "tok",
    totalPrice: 6410,
    status: "CONFIRMED",
    checkIn: new Date(Date.now() + 10 * 86_400_000),
    checkOut: new Date(Date.now() + 15 * 86_400_000),
    customer: { email: "jane@mail.com" },
    property: { name: "Velaa", transferMethod: "Seaplane", transferDuration: "35 min" },
    room: { name: "Overwater Villa" },
    payments: [],
    ...overrides,
  };
}

function depositRow(overrides = {}) {
  return {
    id: "pay1",
    type: "DEPOSIT",
    status: "REQUESTED",
    amount: 3200,
    createdAt: new Date(Date.now() - 5 * 86_400_000), // 5 days old
    bookingId: "b1",
    booking: bookingRow(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.payment.findMany.mockResolvedValue([depositRow()]);
  mockDb.payment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
  mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
  mockDb.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 6410 } });
  mockDb.booking.count.mockResolvedValue(2);
  mockDb.supplierUpdateRequest.findMany.mockResolvedValue([]);
  mockDb.lead.count.mockResolvedValue(3);
  mockDb.quote.count.mockResolvedValue(2);
  mockDb.user.findFirst.mockResolvedValue({ email: "agent@oceanatlas.mv" });
  mockDb.automationLog.findFirst.mockResolvedValue(null); // nothing logged recently
  mockDb.automationLog.create.mockResolvedValue({ id: "l1" });
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
  (documents.generateBookingDocument as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "d1" });
});

describe("runPaymentAutomation", () => {
  it("sends a deposit reminder for an old REQUESTED deposit", async () => {
    const s = await runPaymentAutomation();
    expect(s.depositReminders).toBe(1);
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: "jane@mail.com",
        subject: expect.stringContaining("Deposit reminder"),
      }),
    });
    expect(mockDb.automationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DEPOSIT_REMINDER", targetId: "b1" }),
    });
  });

  it("skips deposits already reminded recently (idempotent)", async () => {
    mockDb.automationLog.findFirst.mockResolvedValue({ id: "existing" });
    const s = await runPaymentAutomation();
    expect(s.depositReminders).toBe(0);
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("sends a balance reminder for upcoming bookings with outstanding balance", async () => {
    mockDb.payment.findMany.mockResolvedValue([]); // no deposits
    mockDb.booking.findMany.mockResolvedValue([bookingRow({ payments: [] })]);
    const s = await runPaymentAutomation();
    expect(s.balanceReminders).toBe(1);
  });
});

describe("runSupplierAutomation", () => {
  it("escalates requests older than 7 days", async () => {
    mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
      {
        id: "u1",
        type: "AVAILABILITY",
        requestedAt: new Date(Date.now() - 10 * 86_400_000),
        supplier: { email: "res@velaa.com", name: "Velaa" },
      },
    ]);
    const s = await runSupplierAutomation();
    expect(s.supplierEscalations).toBe(1);
    expect(mockDb.automationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "SUPPLIER_ESCALATION", targetId: "u1" }),
    });
  });

  it("sends a first reminder for requests older than 3 days", async () => {
    mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
      {
        id: "u1",
        type: "AVAILABILITY",
        requestedAt: new Date(Date.now() - 4 * 86_400_000),
        supplier: { email: "res@velaa.com", name: "Velaa" },
      },
    ]);
    const s = await runSupplierAutomation();
    expect(s.supplierReminders).toBe(1);
  });

  it("does not downgrade an escalated request to a first reminder", async () => {
    mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
      {
        id: "u1",
        type: "AVAILABILITY",
        requestedAt: new Date(Date.now() - 9 * 86_400_000),
        supplier: { email: "res@velaa.com", name: "Velaa" },
      },
    ]);
    // Escalation was already logged recently → only escalation path is blocked.
    mockDb.automationLog.findFirst.mockImplementation(async ({ where }) =>
      where.type === "SUPPLIER_ESCALATION" ? { id: "existing" } : null,
    );
    const s = await runSupplierAutomation();
    expect(s.supplierEscalations).toBe(0);
    expect(s.supplierReminders).toBe(0);
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});

describe("runArrivalAutomation", () => {
  it("sends a booking summary at T-7", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({ checkIn: new Date(Date.now() + 6 * 86_400_000) }),
    ]);
    const s = await runArrivalAutomation();
    expect(s.arrivalSummaries).toBe(1);
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: expect.stringContaining("Your Maldives stay is coming up"),
      }),
    });
  });

  it("generates vouchers at T-3", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({ checkIn: new Date(Date.now() + 2 * 86_400_000) }),
    ]);
    const s = await runArrivalAutomation();
    expect(s.vouchersGenerated).toBe(2);
    expect(documents.generateBookingDocument).toHaveBeenCalledTimes(2);
  });

  it("sends arrival instructions at T-1", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({ checkIn: new Date(Date.now() + 86_400_000) }),
    ]);
    const s = await runArrivalAutomation();
    expect(s.arrivalInstructions).toBe(1);
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ subject: expect.stringContaining("Arrival instructions") }),
    });
  });

  it("does not fire earlier stages after arrival instructions were sent", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({ checkIn: new Date(Date.now() + 86_400_000) }),
    ]);
    mockDb.automationLog.findFirst.mockImplementation(async ({ where }) =>
      where.type === "ARRIVAL_T1" ? { id: "existing" } : null,
    );
    const s = await runArrivalAutomation();
    expect(s.arrivalSummaries).toBe(0);
    expect(s.vouchersGenerated).toBe(0);
    expect(s.arrivalInstructions).toBe(0);
    expect(mockDb.notification.create).not.toHaveBeenCalled();
    expect(documents.generateBookingDocument).not.toHaveBeenCalled();
  });
});

describe("runDailyReport", () => {
  it("sends a daily report to the agent email and logs it", async () => {
    const s = await runDailyReport();
    expect(s.dailyReportSent).toBe(true);
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: "agent@oceanatlas.mv",
        subject: "Daily operations report",
      }),
    });
    expect(mockDb.automationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DAILY_REPORT" }),
    });
  });

  it("skips if the daily report was already sent today", async () => {
    mockDb.automationLog.findFirst.mockResolvedValue({ id: "existing" });
    const s = await runDailyReport();
    expect(s.dailyReportSent).toBe(false);
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});
