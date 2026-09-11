import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { uploadObject } from "@/lib/storage/object-storage";
import { calculatePrice, nightsBetween } from "@/lib/pricing";
import { applyMarkup, getEffectiveMarkup } from "@/lib/markup";
import { checkAvailability } from "@/lib/availability";
import { notifyAttachmentAdded, notifyStatusChanged } from "@/lib/notifications/service";
import { portalStatusLabel } from "@/lib/api/portal";
import type {
  AgentDTO,
  BookingAttachmentDTO,
  BookingDetailDTO,
  BookingDTO,
  BookingEventDTO,
  BookingNoteDTO,
  BookingStatus,
  CreateBookingInput,
} from "@/lib/types";
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
  assignedAgent: true,
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

const bookingDetailInclude = {
  ...bookingInclude,
  events: { orderBy: { createdAt: "asc" as const } },
  notes: { orderBy: { createdAt: "asc" as const } },
  attachments: { orderBy: { uploadedAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

type BookingDetailWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingDetailInclude;
}>;

function toBookingDTO(booking: BookingWithRelations): BookingDTO {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    trackingToken: booking.trackingToken,
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
    ...(booking.assignedAgent
      ? {
          assignedAgentId: booking.assignedAgent.id,
          assignedAgentName: booking.assignedAgent.fullName,
        }
      : {}),
    ...(booking.supplierReference ? { supplierReference: booking.supplierReference } : {}),
    ...(booking.supplierStatus ? { supplierStatus: booking.supplierStatus } : {}),
  };
}

function toEventDTO(event: {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
}): BookingEventDTO {
  return {
    id: event.id,
    type: event.type,
    message: event.message,
    createdAt: event.createdAt.toISOString(),
  };
}

function toNoteDTO(note: { id: string; content: string; createdAt: Date }): BookingNoteDTO {
  return { id: note.id, content: note.content, createdAt: note.createdAt.toISOString() };
}

function toAttachmentDTO(att: {
  id: string;
  filename: string;
  url: string;
  uploadedAt: Date;
}): BookingAttachmentDTO {
  return {
    id: att.id,
    filename: att.filename,
    url: att.url,
    uploadedAt: att.uploadedAt.toISOString(),
  };
}

function toBookingDetailDTO(booking: BookingDetailWithRelations): BookingDetailDTO {
  return {
    ...toBookingDTO(booking),
    ...(booking.assignedAgent
      ? { assignedAgent: { id: booking.assignedAgent.id, name: booking.assignedAgent.fullName } }
      : {}),
    events: booking.events.map(toEventDTO),
    notes: booking.notes.map(toNoteDTO),
    attachments: booking.attachments.map(toAttachmentDTO),
  };
}

function generateReference(): string {
  return `MV-${Math.floor(10000 + Math.random() * 89999)}`;
}

async function ensureConversation(bookingId: string) {
  const existing = await db.bookingConversation.findUnique({ where: { bookingId } });
  if (existing) return existing;
  return db.bookingConversation.create({ data: { bookingId } });
}

async function systemMessage(bookingId: string, text: string) {
  const conversation = await ensureConversation(bookingId);
  await db.bookingMessage.create({
    data: {
      conversationId: conversation.id,
      senderType: "SYSTEM",
      senderName: "System",
      message: text,
      isInternal: false,
    },
  });
}

export async function createBookingRecord(
  input: CreateBookingInput,
): Promise<BookingWithRelations> {
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

  // Dynamic markup — the agency's sell-through margin, applied consistently with quotes.
  const markupPercent = await getEffectiveMarkup({
    propertyId: property.id,
    propertyType: property.type,
    ...(property.supplierId ? { supplierId: property.supplierId } : {}),
  });
  const totalPrice = applyMarkup(price.total, markupPercent);

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
      totalPrice,
      ...(input.specialRequests ? { specialRequests: input.specialRequests } : {}),
      addons: {
        create: addons.map((a) => ({ addonId: a.id, priceSnapshot: a.amount })),
      },
    },
    include: bookingInclude,
  });

  await db.bookingEvent.create({
    data: { bookingId: booking.id, type: "BOOKING_CREATED", message: "Booking created" },
  });
  await systemMessage(booking.id, `Booking ${reference} created.`);

  return booking;
}

export const createBooking = createServerFn({ method: "POST" })
  .validator((input: CreateBookingInput) => input)
  .handler(async ({ data: input }) => {
    return toBookingDTO(await createBookingRecord(input));
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

export const getBooking = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const booking = await db.booking.findUnique({
      where: { id },
      include: bookingDetailInclude,
    });
    return booking ? toBookingDetailDTO(booking) : null;
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: BookingStatus }) => input)
  .handler(async ({ data: { id, status } }) => {
    const booking = await db.booking.update({
      where: { id },
      data: { status },
      include: bookingInclude,
    });
    await db.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: "STATUS_CHANGED",
        message: `Status changed to ${status}`,
      },
    });
    await systemMessage(booking.id, `Booking status changed to ${status}.`);
    await notifyStatusChanged({ bookingId: booking.id, statusLabel: portalStatusLabel(status) });
    return toBookingDTO(booking);
  });

export const assignBooking = createServerFn({ method: "POST" })
  .validator((input: { id: string; agentId: string }) => input)
  .handler(async ({ data: { id, agentId } }) => {
    const agent = await db.user.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error("Agent not found.");
    const booking = await db.booking.update({
      where: { id },
      data: { assignedAgentId: agent.id },
      include: bookingInclude,
    });
    await db.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: "ASSIGNED",
        message: `Assigned to ${agent.fullName}`,
      },
    });
    return toBookingDTO(booking);
  });

export const unassignBooking = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const booking = await db.booking.update({
      where: { id },
      data: { assignedAgentId: null },
      include: bookingInclude,
    });
    await db.bookingEvent.create({
      data: { bookingId: booking.id, type: "UNASSIGNED", message: "Unassigned from agent" },
    });
    return toBookingDTO(booking);
  });

export const addBookingNote = createServerFn({ method: "POST" })
  .validator((input: { bookingId: string; content: string }) => input)
  .handler(async ({ data: { bookingId, content } }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Note cannot be empty.");
    const note = await db.bookingNote.create({
      data: { bookingId, content: trimmed },
    });
    await db.bookingEvent.create({
      data: { bookingId, type: "NOTE_ADDED", message: "Note added" },
    });
    return toNoteDTO(note);
  });

async function storeAttachment(filename: string, buffer: Buffer): Promise<string> {
  const { url } = await uploadObject({
    key: `attachments/${filename}`,
    buffer,
    contentType: "application/octet-stream",
  });
  return url;
}

export const addBookingAttachment = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const bookingId = String(data.get("bookingId") ?? "");
    const file = data.get("file");
    if (!file || typeof file === "string") throw new Error("No file provided.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await storeAttachment(file.name, buffer);
    const attachment = await db.bookingAttachment.create({
      data: { bookingId, filename: file.name, url },
    });
    await db.bookingEvent.create({
      data: {
        bookingId,
        type: "ATTACHMENT_UPLOADED",
        message: `Attachment uploaded: ${file.name}`,
      },
    });
    await notifyAttachmentAdded({ bookingId, filename: file.name });
    return toAttachmentDTO(attachment);
  });

export const updateBookingSupplier = createServerFn({ method: "POST" })
  .validator((input: { id: string; reference?: string; status?: string }) => input)
  .handler(async ({ data: { id, reference, status } }) => {
    const booking = await db.booking.update({
      where: { id },
      data: {
        ...(reference !== undefined ? { supplierReference: reference } : {}),
        ...(status !== undefined ? { supplierStatus: status } : {}),
      },
      include: bookingInclude,
    });
    await db.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: "SUPPLIER_UPDATED",
        message: `Supplier ${booking.supplierReference ? `reference ${booking.supplierReference}` : "details"} (${booking.supplierStatus ?? "pending"})`,
      },
    });
    return toBookingDTO(booking);
  });

export const listAgents = createServerFn({ method: "GET" }).handler(async () => {
  const agents = await db.user.findMany({
    where: { role: { in: ["BOOKING_AGENT", "SUPER_ADMIN"] } },
    orderBy: { fullName: "asc" },
  });
  return agents.map((a) => ({ id: a.id, name: a.fullName }) satisfies AgentDTO);
});
