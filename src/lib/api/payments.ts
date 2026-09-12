import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { uploadObject } from "@/lib/storage/object-storage.server";
import {
  notifyPaymentRejected,
  notifyPaymentRequest,
  notifyPaymentVerified,
} from "@/lib/notifications/service";
import type { BookingBalanceDTO, CreatePaymentInput, PaymentDTO, PaymentStatus } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const paymentInclude = {
  proofs: { orderBy: { uploadedAt: "asc" } },
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

function toPaymentDTO(payment: PaymentWithRelations): PaymentDTO {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    type: payment.type,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    ...(payment.paymentMethod ? { paymentMethod: payment.paymentMethod } : {}),
    ...(payment.reference ? { reference: payment.reference } : {}),
    ...(payment.notes ? { notes: payment.notes } : {}),
    ...(payment.paidAt ? { paidAt: payment.paidAt.toISOString() } : {}),
    createdAt: payment.createdAt.toISOString(),
    proofs: payment.proofs.map((p) => ({
      id: p.id,
      filename: p.filename,
      url: p.url,
      uploadedAt: p.uploadedAt.toISOString(),
    })),
  };
}

/** Computes the financial balance for a booking from verified payments. */
export function computeBookingBalance(args: {
  bookingId: string;
  reference: string;
  bookingTotal: number;
  payments: PaymentWithRelations[];
}): BookingBalanceDTO {
  const paymentsVerified = args.payments
    .filter((p) => p.status === "VERIFIED" && p.type !== "REFUND")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const refunds = args.payments
    .filter((p) => p.status === "VERIFIED" && p.type === "REFUND")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const netPaid = Math.max(0, paymentsVerified - refunds);
  return {
    bookingId: args.bookingId,
    reference: args.reference,
    bookingTotal: args.bookingTotal,
    paymentsVerified: netPaid,
    outstandingBalance: Math.max(0, args.bookingTotal - netPaid),
    payments: args.payments.map(toPaymentDTO),
  };
}

export const requestPayment = createServerFn({ method: "POST" })
  .validator((input: CreatePaymentInput) => input)
  .handler(async ({ data: input }) => {
    if (input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
    const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw new Error("Booking not found.");

    const payment = await db.payment.create({
      data: {
        bookingId: input.bookingId,
        type: input.type,
        amount: input.amount,
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        status: "REQUESTED",
      },
      include: paymentInclude,
    });

    await db.bookingEvent.create({
      data: {
        bookingId: input.bookingId,
        type: "PAYMENT_REQUESTED",
        message: `${input.type === "DEPOSIT" ? "Deposit" : input.type === "BALANCE" ? "Balance" : "Refund"} payment of $${input.amount} requested`,
      },
    });
    await notifyPaymentRequest({ bookingId: input.bookingId, amount: input.amount });

    return toPaymentDTO(payment);
  });

export const listPayments = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    const payments = await db.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      include: paymentInclude,
    });
    return payments.map(toPaymentDTO);
  });

export const getBookingBalance = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { payments: { orderBy: { createdAt: "desc" }, include: paymentInclude } },
    });
    if (!booking) return null;
    return computeBookingBalance({
      bookingId: booking.id,
      reference: booking.reference,
      bookingTotal: Number(booking.totalPrice),
      payments: booking.payments,
    });
  });

export const uploadPaymentProof = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const paymentId = String(data.get("paymentId") ?? "");
    const file = data.get("file");
    if (!file || typeof file === "string") throw new Error("No file provided.");

    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error("Payment not found.");
    if (payment.status !== "REQUESTED")
      throw new Error("Only requested payments can accept proof.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadObject({
      key: `payments/${file.name}`,
      buffer,
      contentType: file.type || "application/octet-stream",
    });

    const proof = await db.paymentProof.create({
      data: { paymentId, filename: file.name, url },
    });
    await db.payment.update({ where: { id: paymentId }, data: { status: "SUBMITTED" } });
    await db.bookingEvent.create({
      data: {
        bookingId: payment.bookingId,
        type: "PAYMENT_SUBMITTED",
        message: `Payment proof submitted (${file.name})`,
      },
    });

    const updated = await db.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: paymentInclude,
    });
    return {
      proof: {
        id: proof.id,
        filename: proof.filename,
        url: proof.url,
        uploadedAt: proof.uploadedAt.toISOString(),
      },
      payment: toPaymentDTO(updated),
    };
  });

export const updatePaymentStatus = createServerFn({ method: "POST" })
  .validator((input: { paymentId: string; status: PaymentStatus }) => input)
  .handler(async ({ data: { paymentId, status } }) => {
    if (status !== "VERIFIED" && status !== "REJECTED") {
      throw new Error("Only VERIFIED or REJECTED can be set by an agent.");
    }
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error("Payment not found.");

    const updated = await db.payment.update({
      where: { id: paymentId },
      data: { status, ...(status === "VERIFIED" ? { paidAt: new Date() } : {}) },
      include: paymentInclude,
    });

    if (status === "VERIFIED") {
      await db.bookingEvent.create({
        data: {
          bookingId: payment.bookingId,
          type: "PAYMENT_VERIFIED",
          message: `Payment of $${Number(payment.amount)} verified`,
        },
      });
      await notifyPaymentVerified({ bookingId: payment.bookingId });
    } else {
      await db.bookingEvent.create({
        data: {
          bookingId: payment.bookingId,
          type: "PAYMENT_REJECTED",
          message: `Payment of $${Number(payment.amount)} rejected`,
        },
      });
      await notifyPaymentRejected({ bookingId: payment.bookingId });
    }

    return toPaymentDTO(updated);
  });

export type { PaymentDTO, PaymentStatus };

// Finance dashboard metrics --------------------------------------------------

export type FinanceMetricsDTO = {
  pendingPayments: number;
  submittedPayments: number;
  verifiedCount: number;
  verifiedToday: number;
  outstandingRevenue: number;
};

export const getFinanceMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const pending = await db.payment.count({ where: { status: "REQUESTED" } });
  const submitted = await db.payment.count({ where: { status: "SUBMITTED" } });
  const verified = await db.payment.count({ where: { status: "VERIFIED" } });
  const verifiedToday = await db.payment.count({
    where: { status: "VERIFIED", paidAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  const verifiedPayments = await db.payment.findMany({
    where: { status: "VERIFIED", type: { not: "REFUND" } },
  });
  const outstandingRevenue = verifiedPayments.reduce((s, p) => s + Number(p.amount), 0);

  const metrics: FinanceMetricsDTO = {
    pendingPayments: pending,
    submittedPayments: submitted,
    verifiedCount: verified,
    verifiedToday,
    outstandingRevenue,
  };
  return metrics;
});
