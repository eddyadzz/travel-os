import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { calculatePrice, nightsBetween } from "@/lib/pricing";
import { checkAvailability } from "@/lib/availability";
import type { BookingDTO, BookingStatus, CreateBookingInput } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const ADDON_PRICING_LABELS: Record<string, "Per Person" | "Per Room" | "Fixed Amount"> = {
  PER_PERSON: "Per Person",
  PER_ROOM: "Per Room",
  FIXED: "Fixed Amount",
};

const bookingInclude = {
  property: true,
  room: true,
  customer: true,
  addons: { include: { addon: true } },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

function toBookingDTO(booking: BookingWithRelations): BookingDTO {
  return {
    id: booking.id,
    reference: booking.reference,
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
    customer: {
      name: booking.customer.fullName,
      email: booking.customer.email,
      phone: booking.customer.phone,
      country: booking.customer.country,
    },
    submittedAt: booking.submittedAt.toISOString(),
    ...(booking.specialRequests ? { specialRequests: booking.specialRequests } : {}),
  };
}

function generateReference(): string {
  return `MV-${Math.floor(10000 + Math.random() * 89999)}`;
}

export const createBooking = createServerFn({ method: "POST" })
  .validator((input: CreateBookingInput) => input)
  .handler(async ({ data: input }) => {
    const checkIn = new Date(`${input.checkIn}T00:00:00.000Z`);
    const checkOut = new Date(`${input.checkOut}T00:00:00.000Z`);
    const nights = nightsBetween(input.checkIn, input.checkOut);
    if (nights <= 0) {
      throw new Error("Check-out must be after check-in.");
    }

    const property = await db.property.findUnique({ where: { id: input.propertyId } });
    const room = await db.room.findUnique({ where: { id: input.roomId } });
    if (!property || !room) throw new Error("Property or room not found.");

    const rate = await db.rate.findFirst({
      where: { roomId: room.id, validFrom: { lte: checkIn }, validTo: { gte: checkOut } },
      orderBy: { validFrom: "desc" },
    });
    if (!rate) throw new Error("No rate covers the requested dates.");

    const availability = await checkAvailability({
      roomId: room.id,
      checkIn,
      checkOut,
      lookup: ({ roomId, date }) =>
        db.availability.findUnique({ where: { roomId_date: { roomId, date } } }),
    });
    if (!availability.available) {
      throw new Error(availability.reason ?? "No availability for the requested dates.");
    }

    const addons = await db.addon.findMany({ where: { id: { in: input.addonIds }, active: true } });

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
        pricing: ADDON_PRICING_LABELS[a.pricingType] ?? "Fixed Amount",
        price: Number(a.amount),
      })),
    });

    const customer = await db.customer.upsert({
      where: { email: input.customer.email },
      create: input.customer,
      update: {
        fullName: input.customer.fullName,
        phone: input.customer.phone,
        country: input.customer.country,
      },
    });

    let reference = generateReference();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await db.booking.findUnique({ where: { reference } });
      if (!exists) break;
      reference = generateReference();
    }

    const booking = await db.booking.create({
      data: {
        reference,
        propertyId: property.id,
        roomId: room.id,
        customerId: customer.id,
        checkIn,
        checkOut,
        nights,
        adults: input.adults,
        children: input.children,
        totalPrice: price.total,
        ...(input.specialRequests ? { specialRequests: input.specialRequests } : {}),
        addons: {
          create: addons.map((a) => ({ addonId: a.id, priceSnapshot: a.amount })),
        },
      },
      include: bookingInclude,
    });

    return toBookingDTO(booking);
  });

export const getBookingByReference = createServerFn({ method: "GET" })
  .validator((reference: string) => reference)
  .handler(async ({ data: reference }) => {
    const booking = await db.booking.findUnique({
      where: { reference },
      include: bookingInclude,
    });
    return booking ? toBookingDTO(booking) : null;
  });

export const listBookings = createServerFn({ method: "GET" })
  .validator((status?: BookingStatus) => status)
  .handler(async ({ data: status }) => {
    const bookings = await db.booking.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { submittedAt: "desc" },
      include: bookingInclude,
    });
    return bookings.map(toBookingDTO);
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: BookingStatus }) => input)
  .handler(async ({ data: { id, status } }) => {
    const booking = await db.booking.update({
      where: { id },
      data: { status },
      include: bookingInclude,
    });
    return toBookingDTO(booking);
  });
