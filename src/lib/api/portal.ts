import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type {
  BookingAttachmentDTO,
  BookingEventDTO,
  MessageDTO,
  PaymentDTO,
  PaymentStatus,
} from "@/lib/types";
import type { DocumentType } from "@/lib/documents/types";

export type PortalBookingDTO = {
  id: string;
  reference: string;
  token: string;
  status: string;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addons: string[];
  total: number;
  specialRequests?: string;
  customerName: string;
  timeline: BookingEventDTO[];
  messages: MessageDTO[];
  attachments: BookingAttachmentDTO[];
  documents: Array<{
    id: string;
    type: DocumentType;
    filename: string;
    url: string;
    version: number;
    createdAt: string;
  }>;
  payments: PaymentDTO[];
  paymentsVerified: number;
  outstandingBalance: number;
};

/** Human-friendly label for each workflow state. */
const STATUS_LABELS: Record<string, string> = {
  NEW: "New request",
  ASSIGNED: "Assigned to an agent",
  PENDING_SUPPLIER: "Awaiting supplier confirmation",
  AWAITING_CUSTOMER: "Awaiting your confirmation",
  AWAITING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Booking confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const PORTAL_STATUS_LABELS = STATUS_LABELS;

export function portalStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Customer-visible event types (internal operations are hidden). */
const VISIBLE_EVENT_TYPES = new Set([
  "BOOKING_CREATED",
  "STATUS_CHANGED",
  "MESSAGE_SENT",
  "PAYMENT_REQUESTED",
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFIED",
  "PAYMENT_REJECTED",
]);

/**
 * Returns the booking data for the customer portal. Requires the reference AND
 * the tracking token (prevents reference enumeration). Records a portal view.
 */
export const getPortalBooking = createServerFn({ method: "GET" })
  .validator(
    (input: { reference: string; token: string; ip?: string; userAgent?: string }) => input,
  )
  .handler(async ({ data }) => {
    const booking = await db.booking.findUnique({
      where: { reference: data.reference },
      include: {
        property: true,
        room: true,
        customer: true,
        addons: { include: { addon: true } },
        events: { orderBy: { createdAt: "asc" } },
        conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } },
        attachments: { orderBy: { uploadedAt: "asc" } },
        documents: { orderBy: [{ type: "asc" }, { version: "asc" }] },
        payments: {
          include: { proofs: { orderBy: { uploadedAt: "asc" } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!booking || booking.trackingToken !== data.token) {
      return null;
    }

    await db.bookingPortalView.create({
      data: {
        bookingId: booking.id,
        ...(data.ip ? { ip: data.ip } : {}),
        ...(data.userAgent ? { userAgent: data.userAgent } : {}),
      },
    });

    const dto: PortalBookingDTO = {
      id: booking.id,
      reference: booking.reference,
      token: booking.trackingToken,
      status: booking.status,
      property: booking.property.name,
      room: booking.room.name,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      nights: booking.nights,
      adults: booking.adults,
      children: booking.children,
      addons: booking.addons.map((ba) => ba.addon.name),
      total: Number(booking.totalPrice),
      ...(booking.specialRequests ? { specialRequests: booking.specialRequests } : {}),
      customerName: booking.customer.fullName,
      timeline: booking.events
        .filter((e) => VISIBLE_EVENT_TYPES.has(e.type))
        .map((e) => ({
          id: e.id,
          type: e.type,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
      messages: (booking.conversation?.messages ?? [])
        .filter((m) => !m.isInternal)
        .map((m) => ({
          id: m.id,
          senderType: m.senderType as MessageDTO["senderType"],
          senderName: m.senderName,
          message: m.message,
          isInternal: m.isInternal,
          createdAt: m.createdAt.toISOString(),
        })),
      attachments: booking.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        uploadedAt: a.uploadedAt.toISOString(),
      })),
      documents: booking.documents.map((d) => ({
        id: d.id,
        type: d.type as DocumentType,
        filename: d.filename,
        url: d.url,
        version: d.version,
        createdAt: d.createdAt.toISOString(),
      })),
      payments: booking.payments.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        type: p.type,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status as PaymentStatus,
        ...(p.paymentMethod ? { paymentMethod: p.paymentMethod } : {}),
        ...(p.notes ? { notes: p.notes } : {}),
        createdAt: p.createdAt.toISOString(),
        proofs: p.proofs.map((proof) => ({
          id: proof.id,
          filename: proof.filename,
          url: proof.url,
          uploadedAt: proof.uploadedAt.toISOString(),
        })),
      })),
      paymentsVerified: booking.payments
        .filter((p) => p.status === "VERIFIED" && p.type !== "REFUND")
        .reduce((sum, p) => sum + Number(p.amount), 0),
      outstandingBalance: Math.max(
        0,
        Number(booking.totalPrice) -
          booking.payments
            .filter((p) => p.status === "VERIFIED" && p.type !== "REFUND")
            .reduce((sum, p) => sum + Number(p.amount), 0),
      ),
    };

    return dto;
  });
