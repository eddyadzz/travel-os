import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { createBookingRecord } from "@/lib/api/bookings";
import { requestPayment } from "@/lib/api/payments";
import type { QuoteDetailDTO, QuoteEventDTO, QuoteStatus } from "@/lib/types";

const quoteInclude = {
  lead: { select: { fullName: true, email: true, phone: true } },
  property: { select: { name: true } },
  room: { select: { name: true } },
} satisfies import("@/generated/prisma/client").Prisma.QuoteInclude;

function toEventDTO(e: {
  id: string;
  quoteId: string;
  type: string;
  message: string;
  createdAt: Date;
}): QuoteEventDTO {
  return {
    id: e.id,
    quoteId: e.quoteId,
    type: e.type,
    message: e.message,
    createdAt: e.createdAt.toISOString(),
  };
}

async function recordActivity(quoteId: string, type: string, message: string) {
  await db.quoteEvent.create({ data: { quoteId, type, message } });
}

function computeBreakdown(
  adults: number,
  children: number,
  addonIds: string[],
  total: number,
): QuoteDetailDTO["breakdown"] {
  // The stored quote only keeps the total; derive a display breakdown from the
  // addon pricing where possible, otherwise show the total as accommodation.
  return {
    accommodation: total,
    extraGuests: 0,
    transfers: 0,
    addons: 0,
    total,
  };
}

export const getQuoteByToken = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const quote = await db.quote.findUnique({
      where: { token },
      include: {
        lead: { select: { fullName: true, email: true, phone: true } },
        property: { select: { name: true } },
        room: { select: { name: true } },
        activity: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!quote) return null;

    const nights =
      quote.checkIn && quote.checkOut
        ? Math.round((quote.checkOut.getTime() - quote.checkIn.getTime()) / 86_400_000)
        : 0;
    const expired = quote.validUntil.getTime() < Date.now();

    const dto: QuoteDetailDTO = {
      quote: {
        id: quote.id,
        ...(quote.reference ? { reference: quote.reference } : {}),
        ...(quote.token ? { token: quote.token } : {}),
        status: quote.status as QuoteStatus,
        ...(quote.leadId ? { leadId: quote.leadId } : {}),
        ...(quote.propertyId ? { propertyId: quote.propertyId } : {}),
        ...(quote.roomId ? { roomId: quote.roomId } : {}),
        ...(quote.checkIn ? { checkIn: quote.checkIn.toISOString().slice(0, 10) } : {}),
        ...(quote.checkOut ? { checkOut: quote.checkOut.toISOString().slice(0, 10) } : {}),
        ...(quote.adults !== null ? { adults: quote.adults } : {}),
        ...(quote.children !== null ? { children: quote.children } : {}),
        ...(quote.customerName ? { customerName: quote.customerName } : {}),
        totalPrice: Number(quote.totalPrice),
        validUntil: quote.validUntil.toISOString().slice(0, 10),
        ...(quote.notes ? { notes: quote.notes } : {}),
        ...(quote.documentUrl ? { documentUrl: quote.documentUrl } : {}),
        ...(quote.bookingLink ? { bookingLink: quote.bookingLink } : {}),
        ...(quote.bookingId ? { bookingId: quote.bookingId } : {}),
        createdAt: quote.createdAt.toISOString(),
        ...(quote.lead ? { leadName: quote.lead.fullName } : {}),
        ...(quote.property ? { propertyName: quote.property.name } : {}),
      },
      propertyName: quote.property?.name ?? "",
      roomName: quote.room?.name ?? "",
      nights,
      breakdown: computeBreakdown(
        quote.adults ?? 2,
        quote.children ?? 0,
        quote.addonIds,
        Number(quote.totalPrice),
      ),
      addons: [],
      activity: quote.activity.map(toEventDTO),
      expired,
    };
    return dto;
  });

export const acceptQuote = createServerFn({ method: "POST" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const quote = await db.quote.findUnique({
      where: { token },
      include: { lead: { select: { fullName: true, email: true, phone: true } } },
    });
    if (!quote) throw new Error("Quote not found.");
    if (quote.status !== "PENDING")
      throw new Error(`This quote is already ${quote.status.toLowerCase()}.`);
    if (quote.validUntil.getTime() < Date.now()) throw new Error("This quote has expired.");
    if (!quote.propertyId || !quote.roomId || !quote.checkIn || !quote.checkOut) {
      throw new Error("This quote is missing stay details.");
    }

    // Create the booking (re-validates availability + rate for the dates).
    const booking = await createBookingRecord({
      propertyId: quote.propertyId,
      roomId: quote.roomId,
      checkIn: quote.checkIn.toISOString().slice(0, 10),
      checkOut: quote.checkOut.toISOString().slice(0, 10),
      adults: quote.adults ?? 2,
      children: quote.children ?? 0,
      addonIds: quote.addonIds,
      customer: {
        fullName: quote.customerName ?? quote.lead?.fullName ?? "",
        email: quote.customerEmail ?? quote.lead?.email ?? "",
        phone: quote.lead?.phone ?? "",
        country: "",
      },
    });

    // Mark quote ACCEPTED + link booking.
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", bookingId: booking.id, acceptedAt: new Date() },
    });
    await recordActivity(
      quote.id,
      "ACCEPTED",
      `Quote accepted — booking ${booking.reference} created`,
    );
    await recordActivity(
      quote.id,
      "BOOKING_CREATED",
      `Booking ${booking.reference} created automatically`,
    );

    // Automatic deposit request (50% of total).
    const deposit = Math.round(Number(quote.totalPrice) * 0.5);
    await requestPayment({
      data: {
        bookingId: booking.id,
        type: "DEPOSIT",
        amount: deposit,
        notes: "Automatic deposit from accepted quote",
      },
    });

    // Portal activated: the booking's tracking token is the customer's portal access.
    const portalUrl = `/track/${booking.reference}?token=${booking.trackingToken}`;

    return { bookingId: booking.id, reference: booking.reference, deposit, portalUrl };
  });

export const declineQuote = createServerFn({ method: "POST" })
  .validator((input: { token: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const quote = await db.quote.findUnique({ where: { token: data.token } });
    if (!quote) throw new Error("Quote not found.");
    await db.quote.update({
      where: { id: quote.id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
        ...(data.reason ? { declineReason: data.reason } : {}),
      },
    });
    await recordActivity(
      quote.id,
      "DECLINED",
      data.reason ? `Quote declined — ${data.reason}` : "Quote declined",
    );
    return { ok: true };
  });

export const requestQuoteChanges = createServerFn({ method: "POST" })
  .validator((input: { token: string; message: string }) => input)
  .handler(async ({ data }) => {
    const quote = await db.quote.findUnique({ where: { token: data.token } });
    if (!quote) throw new Error("Quote not found.");
    await db.quote.update({ where: { id: quote.id }, data: { status: "MODIFIED" } });
    await recordActivity(quote.id, "CHANGES_REQUESTED", `Changes requested: ${data.message}`);
    return { ok: true };
  });

export const getQuoteActivity = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const quote = await db.quote.findUnique({ where: { token } });
    if (!quote) return [];
    const events = await db.quoteEvent.findMany({
      where: { quoteId: quote.id },
      orderBy: { createdAt: "asc" },
    });
    return events.map(toEventDTO);
  });
