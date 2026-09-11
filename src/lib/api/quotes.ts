import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db.server";
import { calculatePrice, nightsBetween } from "@/lib/pricing";
import { applyMarkup, getEffectiveMarkup } from "@/lib/markup";
import { generateQuotePdf } from "@/lib/documents/generator";
import { storeDocument } from "@/lib/documents/storage";
import { notifyQuoteReady } from "@/lib/notifications/service";
import type { AutoQuoteInput, QuoteBreakdownDTO, QuoteDTO } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const quoteInclude = {
  lead: { select: { fullName: true } },
  property: { select: { name: true } },
} satisfies Prisma.QuoteInclude;

type QuoteWithRelations = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

function toQuoteDTO(q: QuoteWithRelations): QuoteDTO {
  return {
    id: q.id,
    ...(q.reference ? { reference: q.reference } : {}),
    ...(q.leadId ? { leadId: q.leadId } : {}),
    ...(q.propertyId ? { propertyId: q.propertyId } : {}),
    ...(q.roomId ? { roomId: q.roomId } : {}),
    ...(q.checkIn ? { checkIn: q.checkIn.toISOString().slice(0, 10) } : {}),
    ...(q.checkOut ? { checkOut: q.checkOut.toISOString().slice(0, 10) } : {}),
    ...(q.adults !== null ? { adults: q.adults } : {}),
    ...(q.children !== null ? { children: q.children } : {}),
    ...(q.customerName ? { customerName: q.customerName } : {}),
    ...(q.customerEmail ? { customerEmail: q.customerEmail } : {}),
    totalPrice: Number(q.totalPrice),
    validUntil: q.validUntil.toISOString().slice(0, 10),
    ...(q.notes ? { notes: q.notes } : {}),
    ...(q.documentUrl ? { documentUrl: q.documentUrl } : {}),
    ...(q.documentFilename ? { documentFilename: q.documentFilename } : {}),
    ...(q.bookingLink ? { bookingLink: q.bookingLink } : {}),
    createdAt: q.createdAt.toISOString(),
    ...(q.lead ? { leadName: q.lead.fullName } : {}),
    ...(q.property ? { propertyName: q.property.name } : {}),
  };
}

export const generateAutoQuote = createServerFn({ method: "POST" })
  .validator((input: AutoQuoteInput) => input)
  .handler(async ({ data: input }) => {
    const checkIn = new Date(`${input.checkIn}T00:00:00.000Z`);
    const checkOut = new Date(`${input.checkOut}T00:00:00.000Z`);
    const nights = nightsBetween(input.checkIn, input.checkOut);
    if (nights <= 0) throw new Error("Check-out must be after check-in.");

    const property = await db.property.findUnique({ where: { id: input.propertyId } });
    const room = await db.room.findUnique({ where: { id: input.roomId } });
    if (!property || !room) throw new Error("Property or room not found.");

    const rate = await db.rate.findFirst({
      where: { roomId: room.id, validFrom: { lte: checkIn }, validTo: { gte: checkOut } },
      orderBy: { validFrom: "desc" },
    });
    if (!rate) throw new Error("No rate covers the requested dates.");

    const addons = await db.addon.findMany({
      where: { id: { in: input.addonIds ?? [] }, active: true },
    });

    const price = calculatePrice({
      transferPricePerPerson: Number(property.transferPricePerPerson),
      room: {
        nightlyRate: Number(rate.amount),
        baseGuests: room.maxAdults,
        extraGuestRate: Number(room.extraGuestRate ?? 0),
      },
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      addons: addons.map((a) => ({
        pricing:
          a.pricingType === "PER_PERSON"
            ? "Per Person"
            : a.pricingType === "PER_ROOM"
              ? "Per Room"
              : "Fixed Amount",
        price: Number(a.amount),
      })),
    });

    const markupPercent = await getEffectiveMarkup({
      propertyId: property.id,
      propertyType: property.type,
      ...(property.supplierId ? { supplierId: property.supplierId } : {}),
    });
    const markup = Math.round(price.total * (markupPercent / 100));

    const breakdown: QuoteBreakdownDTO = {
      accommodation: price.accommodation,
      extraGuests: price.extraGuests,
      transfers: price.transfers,
      addons: price.addons,
      ...(markupPercent > 0 ? { markupPercent, markup } : {}),
      total: price.total + markup,
    };

    const reference = `QT-${Math.floor(10000 + Math.random() * 89999)}`;
    const token = randomBytes(16).toString("hex");
    const bookingLink = `/quote/${token}`;

    let customerName = input.customerName ?? "";
    let customerEmail = input.customerEmail;
    if (!customerName && input.leadId) {
      const lead = await db.lead.findUnique({
        where: { id: input.leadId },
        select: { fullName: true, email: true },
      });
      customerName = lead?.fullName ?? "";
      customerEmail = customerEmail ?? lead?.email ?? undefined;
    }

    const { buffer } = await generateQuotePdf({
      reference,
      customerName,
      ...(customerEmail ? { customerEmail } : {}),
      property: property.name,
      room: room.name,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      adults: input.adults,
      children: input.children,
      addons: addons.map((a) => a.name),
      breakdown,
      validUntil: input.validUntil,
      bookingLink,
      ...(input.notes ? { notes: input.notes } : {}),
    });

    const { url } = await storeDocument({ filename: `${reference}_Quote.pdf`, buffer });

    const quote = await db.quote.create({
      data: {
        reference,
        token,
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.roomId ? { roomId: input.roomId } : {}),
        checkIn,
        checkOut,
        adults: input.adults,
        children: input.children,
        addonIds: addons.map((a) => a.id),
        ...(customerName ? { customerName } : {}),
        ...(customerEmail ? { customerEmail } : {}),
        totalPrice: breakdown.total,
        validUntil: new Date(input.validUntil),
        ...(input.notes ? { notes: input.notes } : {}),
        documentUrl: url,
        documentFilename: `${reference}_Quote.pdf`,
        bookingLink,
      },
      include: quoteInclude,
    });

    if (input.leadId) {
      await db.lead.update({ where: { id: input.leadId }, data: { status: "QUOTED" } });
    }

    return { quote: toQuoteDTO(quote), breakdown, reference };
  });

export const listQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const quotes = await db.quote.findMany({
    orderBy: { createdAt: "desc" },
    include: quoteInclude,
  });
  return quotes.map(toQuoteDTO);
});

export const getQuote = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const quote = await db.quote.findUnique({ where: { id }, include: quoteInclude });
    return quote ? toQuoteDTO(quote) : null;
  });

export const sendQuoteEmail = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const quote = await db.quote.findUnique({ where: { id }, include: quoteInclude });
    if (!quote) throw new Error("Quote not found.");

    let recipient = quote.customerEmail ?? "";
    if (!recipient && quote.leadId) {
      const lead = await db.lead.findUnique({
        where: { id: quote.leadId },
        select: { email: true },
      });
      recipient = lead?.email ?? "";
    }
    if (!recipient) throw new Error("No customer email on this quote.");

    const notification = await notifyQuoteReady({
      recipient,
      reference: quote.reference ?? quote.id.slice(-5),
      total: Number(quote.totalPrice),
      documentUrl: quote.documentUrl ?? "",
      bookingLink: quote.bookingLink ?? "",
    });
    return { sent: notification?.status === "SENT" };
  });
