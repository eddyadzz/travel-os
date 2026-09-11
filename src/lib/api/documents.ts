import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { generateDocument } from "@/lib/documents/generator";
import { storeDocument } from "@/lib/documents/storage";
import { documentFilename } from "@/lib/documents/generator";
import { customerDeepLink } from "@/lib/notifications/service";
import { notifyAttachmentAdded } from "@/lib/notifications/service";
import { computeBookingBalance } from "@/lib/api/payments";
import type { DocumentType } from "@/lib/documents/types";
import type { Prisma } from "@/generated/prisma/client";

export type BookingDocumentDTO = {
  id: string;
  type: DocumentType;
  filename: string;
  url: string;
  version: number;
  createdAt: string;
};

const DOCUMENT_SELECT = {
  id: true,
  type: true,
  filename: true,
  url: true,
  version: true,
  createdAt: true,
} satisfies Prisma.BookingDocumentSelect;

function toDocumentDTO(
  doc: Prisma.BookingDocumentGetPayload<{ select: typeof DOCUMENT_SELECT }>,
): BookingDocumentDTO {
  return {
    id: doc.id,
    type: doc.type as DocumentType,
    filename: doc.filename,
    url: doc.url,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
  };
}

type DocumentBooking = Prisma.BookingGetPayload<{
  include: {
    property: true;
    room: true;
    customer: true;
    addons: { include: { addon: true } };
    payments: { include: { proofs: true } };
  };
}>;

async function loadBookingData(bookingId: string): Promise<DocumentBooking | null> {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: true,
      room: true,
      customer: true,
      addons: { include: { addon: true } },
      payments: { include: { proofs: true } },
    },
  });
}

export const generateBookingDocument = createServerFn({ method: "POST" })
  .validator((input: { bookingId: string; type: DocumentType }) => input)
  .handler(async ({ data }) => {
    const booking = await loadBookingData(data.bookingId);
    if (!booking) throw new Error("Booking not found.");

    const balance = computeBookingBalance({
      bookingId: booking.id,
      reference: booking.reference,
      bookingTotal: Number(booking.totalPrice),
      payments: booking.payments,
    });

    const portalUrl = customerDeepLink({
      reference: booking.reference,
      token: booking.trackingToken,
    });

    const docData = {
      reference: booking.reference,
      property: booking.property.name,
      room: booking.room.name,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      nights: booking.nights,
      adults: booking.adults,
      children: booking.children,
      addons: booking.addons.map((ba) => ba.addon.name),
      total: Number(booking.totalPrice),
      paid: balance.paymentsVerified,
      outstanding: balance.outstandingBalance,
      customerName: booking.customer.fullName,
      customerEmail: booking.customer.email,
      transfer: {
        method: booking.property.transferMethod,
        duration: booking.property.transferDuration,
      },
      ...(booking.room.boardBasis ? { boardBasis: booking.room.boardBasis } : {}),
      ...(booking.specialRequests ? { specialRequests: booking.specialRequests } : {}),
      ...(booking.supplierReference ? { supplierReference: booking.supplierReference } : {}),
      portalUrl,
    };

    // Versioning: count existing docs of this type, next version = count + 1
    const existing = await db.bookingDocument.count({
      where: { bookingId: booking.id, type: data.type },
    });
    const version = existing + 1;

    const { buffer } = await generateDocument(data.type, docData);
    const filename = documentFilename(data.type, booking.reference, version);
    const { url } = await storeDocument({ filename, buffer });

    const doc = await db.bookingDocument.create({
      data: {
        bookingId: booking.id,
        type: data.type,
        filename,
        url,
        version,
      },
      select: DOCUMENT_SELECT,
    });

    await notifyAttachmentAdded({ bookingId: booking.id, filename });

    return toDocumentDTO(doc);
  });

export const listBookingDocuments = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    const docs = await db.bookingDocument.findMany({
      where: { bookingId },
      orderBy: [{ type: "asc" }, { version: "asc" }],
      select: DOCUMENT_SELECT,
    });
    return docs.map(toDocumentDTO);
  });

export type { DocumentType };
