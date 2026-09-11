import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeBookingBalance,
  requestPayment,
  uploadPaymentProof,
  updatePaymentStatus,
  getBookingBalance,
  getFinanceMetrics,
  listPayments,
} from "@/lib/api/payments";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findUnique: vi.fn() },
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    paymentProof: { create: vi.fn() },
    bookingEvent: { create: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

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

function paymentRow(overrides = {}) {
  return {
    id: "p1",
    bookingId: "b1",
    type: "DEPOSIT",
    amount: 500,
    currency: "USD",
    status: "REQUESTED",
    paymentMethod: null,
    reference: null,
    notes: null,
    paidAt: null,
    createdAt: new Date(),
    proofs: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findUnique.mockResolvedValue({
    id: "b1",
    reference: "MV-24081",
    totalPrice: 6410,
    trackingToken: "tok123",
    customer: { email: "jane@example.com", emailNotifications: true },
    payments: [],
  });
  mockDb.payment.create.mockResolvedValue(paymentRow());
  mockDb.payment.findUnique.mockResolvedValue(paymentRow());
  mockDb.payment.findUniqueOrThrow.mockResolvedValue(paymentRow({ status: "SUBMITTED" }));
  mockDb.payment.update.mockResolvedValue(paymentRow({ status: "SUBMITTED" }));
  mockDb.paymentProof.create.mockResolvedValue({
    id: "proof1",
    filename: "slip.pdf",
    url: "/uploads/payments/x.pdf",
    uploadedAt: new Date(),
  });
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
});

describe("computeBookingBalance", () => {
  it("computes total, verified paid and outstanding", () => {
    const balance = computeBookingBalance({
      bookingId: "b1",
      reference: "MV-24081",
      bookingTotal: 6410,
      payments: [
        { ...paymentRow(), status: "VERIFIED", amount: 3000 },
        { ...paymentRow({ id: "p2" }), status: "REQUESTED", amount: 3410 },
      ],
    });
    expect(balance.paymentsVerified).toBe(3000);
    expect(balance.outstandingBalance).toBe(3410);
  });

  it("excludes refunds from the paid amount", () => {
    const balance = computeBookingBalance({
      bookingId: "b1",
      reference: "MV-24081",
      bookingTotal: 1000,
      payments: [
        { ...paymentRow(), status: "VERIFIED", amount: 1000 },
        { ...paymentRow({ id: "r1" }), type: "REFUND", status: "VERIFIED", amount: 200 },
      ],
    });
    expect(balance.paymentsVerified).toBe(800);
    expect(balance.outstandingBalance).toBe(200);
  });
});

describe("requestPayment", () => {
  it("creates a REQUESTED payment and records a PAYMENT_REQUESTED event + notification", async () => {
    await requestPayment({
      data: { bookingId: "b1", type: "DEPOSIT", amount: 500, paymentMethod: "Bank transfer" },
    });
    expect(mockDb.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "b1",
        type: "DEPOSIT",
        amount: 500,
        status: "REQUESTED",
        paymentMethod: "Bank transfer",
      }),
      include: expect.any(Object),
    });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "PAYMENT_REQUESTED" }),
    });
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      requestPayment({ data: { bookingId: "b1", type: "DEPOSIT", amount: 0 } }),
    ).rejects.toThrow(/greater than zero/);
  });
});

describe("uploadPaymentProof", () => {
  it("stores a proof, marks the payment SUBMITTED and records an event", async () => {
    const form = new FormData();
    form.append("paymentId", "p1");
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "slip.pdf", { type: "application/pdf" }),
    );
    const result = await uploadPaymentProof({ data: form });
    expect(result.payment.status).toBe("SUBMITTED");
    expect(mockDb.payment.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "SUBMITTED" },
    });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "PAYMENT_SUBMITTED" }),
    });
  });

  it("rejects proof on an already-submitted or verified payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue(paymentRow({ status: "VERIFIED" }));
    const form = new FormData();
    form.append("paymentId", "p1");
    form.append("file", new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" }));
    await expect(uploadPaymentProof({ data: form })).rejects.toThrow(/only requested payments/i);
  });
});

describe("updatePaymentStatus", () => {
  it("verifies a payment and records an event + notification", async () => {
    mockDb.payment.update.mockResolvedValue(paymentRow({ status: "VERIFIED" }));
    const result = await updatePaymentStatus({ data: { paymentId: "p1", status: "VERIFIED" } });
    expect(result.status).toBe("VERIFIED");
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "PAYMENT_VERIFIED" }),
    });
  });

  it("rejects a payment and records an event + notification", async () => {
    mockDb.payment.update.mockResolvedValue(paymentRow({ status: "REJECTED" }));
    await updatePaymentStatus({ data: { paymentId: "p1", status: "REJECTED" } });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "PAYMENT_REJECTED" }),
    });
  });

  it("only allows VERIFIED or REJECTED from an agent", async () => {
    await expect(
      updatePaymentStatus({ data: { paymentId: "p1", status: "REQUESTED" } }),
    ).rejects.toThrow(/only verified or rejected/i);
  });
});

describe("getBookingBalance", () => {
  it("returns null when the booking is not found", async () => {
    mockDb.booking.findUnique.mockResolvedValue(null);
    const result = await getBookingBalance({ data: "b1" });
    expect(result).toBeNull();
  });

  it("computes the balance from verified payments only", async () => {
    mockDb.booking.findUnique.mockResolvedValue({
      id: "b1",
      reference: "MV-24081",
      totalPrice: 6410,
      payments: [
        paymentRow({ status: "VERIFIED", amount: 3000 }),
        paymentRow({ id: "p2", status: "REQUESTED", amount: 3410 }),
      ],
    });
    const result = await getBookingBalance({ data: "b1" });
    expect(result).toMatchObject({
      reference: "MV-24081",
      bookingTotal: 6410,
      paymentsVerified: 3000,
      outstandingBalance: 3410,
    });
    expect(result.payments).toHaveLength(2);
  });
});

describe("listPayments", () => {
  it("returns payments for a booking", async () => {
    mockDb.payment.findMany.mockResolvedValue([paymentRow({ status: "VERIFIED" })]);
    const result = await listPayments({ data: "b1" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ bookingId: "b1", status: "VERIFIED", amount: 500 });
  });
});

describe("getFinanceMetrics", () => {
  it("returns counts and outstanding revenue", async () => {
    mockDb.payment.count.mockResolvedValueOnce(2); // pending
    mockDb.payment.count.mockResolvedValueOnce(1); // submitted
    mockDb.payment.count.mockResolvedValueOnce(3); // verified
    mockDb.payment.count.mockResolvedValueOnce(1); // verified today
    mockDb.payment.findMany.mockResolvedValue([
      { amount: 3000, type: "DEPOSIT" },
      { amount: 1000, type: "BALANCE" },
    ]);
    const result = await getFinanceMetrics();
    expect(result).toEqual({
      pendingPayments: 2,
      submittedPayments: 1,
      verifiedCount: 3,
      verifiedToday: 1,
      outstandingRevenue: 4000,
    });
  });
});
