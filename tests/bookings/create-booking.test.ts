import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  addBookingAttachment,
  addBookingNote,
  assignBooking,
  createBooking,
  getBooking,
  getBookingByReference,
  unassignBooking,
  updateBookingStatus,
  updateBookingSupplier,
} from "@/lib/api/bookings";
import type { Booking, BookingStatus, Customer } from "@/generated/prisma/client";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const property = {
  id: "p1",
  name: "Velaa Lagoon Resort & Spa",
  transferPricePerPerson: 545,
};
const room = {
  id: "r1",
  name: "Overwater Villa",
  maxAdults: 2,
  maxChildren: 0,
  extraGuestRate: 165,
};
const rate = { id: "rate1", roomId: "r1", amount: 890 };
const addons = [
  { id: "a1", name: "Sunset Spa Ritual", pricingType: "PER_PERSON", amount: 180, active: true },
  { id: "a2", name: "Dive", pricingType: "PER_PERSON", amount: 320, active: true },
];

const baseInput = {
  propertyId: "p1",
  roomId: "r1",
  checkIn: "2026-06-01",
  checkOut: "2026-06-05",
  adults: 2,
  children: 1,
  addonIds: ["a1", "a2"],
  customer: { fullName: "Jane Doe", email: "jane@example.com", phone: "+1", country: "US" },
};

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    property: { findUnique: vi.fn() },
    room: { findUnique: vi.fn() },
    rate: { findFirst: vi.fn() },
    availability: { findUnique: vi.fn() },
    addon: { findMany: vi.fn() },
    customer: { upsert: vi.fn() },
    booking: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    bookingEvent: { create: vi.fn() },
    bookingNote: { create: vi.fn() },
    bookingAttachment: { create: vi.fn() },
    bookingConversation: { findUnique: vi.fn(), create: vi.fn() },
    bookingMessage: { create: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    markupRule: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));

vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
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

function mockBookingRow() {
  return {
    id: "b1",
    reference: "MV-12345",
    status: "NEW" as BookingStatus,
    property: { name: property.name },
    room: { name: room.name },
    checkIn: new Date("2026-06-01T00:00:00.000Z"),
    checkOut: new Date("2026-06-05T00:00:00.000Z"),
    nights: 4,
    adults: 2,
    children: 1,
    totalPrice: 1000,
    customer: { fullName: "Jane Doe", email: "jane@example.com", phone: "+1", country: "US" },
    submittedAt: new Date(),
    specialRequests: null,
    addons: [],
  } as unknown as Booking & {
    property: { name: string };
    room: { name: string };
    customer: Customer;
    addons: Array<{ addon: { name: string } }>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.property.findUnique.mockResolvedValue(property);
  mockDb.room.findUnique.mockResolvedValue(room);
  mockDb.rate.findFirst.mockResolvedValue(rate);
  mockDb.availability.findUnique.mockResolvedValue({ id: "av", date: new Date(), inventory: 3 });
  mockDb.addon.findMany.mockResolvedValue(addons);
  mockDb.customer.upsert.mockResolvedValue({ id: "c1", email: "jane@example.com" });
  mockDb.booking.findUnique.mockResolvedValue(null);
  mockDb.booking.create.mockResolvedValue(mockBookingRow());
  mockDb.bookingConversation.findUnique.mockResolvedValue({ id: "conv1", bookingId: "b1" });
  mockDb.markupRule.findMany.mockResolvedValue([]);
});

describe("createBooking", () => {
  it("creates a booking with a generated MV-XXXXX reference on the happy path", async () => {
    const result = await createBooking({ data: baseInput });

    expect(mockDb.booking.create).toHaveBeenCalled();
    const createCall = mockDb.booking.create.mock.calls[0][0].data;
    expect(createCall.reference).toMatch(/^MV-\d{5}$/);
    expect(createCall.adults).toBe(2);
    expect(createCall.children).toBe(1);
    expect(createCall.totalPrice).toBeGreaterThan(0);
    expect(createCall.addons.create).toHaveLength(2);
  });

  it("records addon price snapshots", async () => {
    await createBooking({ data: baseInput });
    const createCall = mockDb.booking.create.mock.calls[0][0].data;
    expect(createCall.addons.create).toEqual([
      { addonId: "a1", priceSnapshot: 180 },
      { addonId: "a2", priceSnapshot: 320 },
    ]);
  });

  it("reuses an existing customer (upsert, no duplicate)", async () => {
    await createBooking({ data: baseInput });
    expect(mockDb.customer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "jane@example.com" } }),
    );
  });

  it("throws when availability fails for a night", async () => {
    mockDb.availability.findUnique.mockResolvedValue({
      id: "av",
      date: new Date("2026-06-02"),
      inventory: 0,
    });
    await expect(createBooking({ data: baseInput })).rejects.toThrow(/inventory/i);
    expect(mockDb.booking.create).not.toHaveBeenCalled();
  });

  it("throws when no rate covers the dates", async () => {
    mockDb.rate.findFirst.mockResolvedValue(null);
    await expect(createBooking({ data: baseInput })).rejects.toThrow(/No rate/i);
  });

  it("rejects an inverted date range", async () => {
    await expect(
      createBooking({ data: { ...baseInput, checkIn: "2026-06-05", checkOut: "2026-06-01" } }),
    ).rejects.toThrow(/after check-in/i);
  });

  it("retries the reference when the generated one collides", async () => {
    mockDb.booking.findUnique.mockResolvedValueOnce({ id: "existing" }).mockResolvedValueOnce(null);
    const result = await createBooking({ data: baseInput });
    expect(result.reference).toMatch(/^MV-\d{5}$/);
  });

  it("maps the created booking into a BookingDTO", async () => {
    const result = await createBooking({ data: baseInput });
    expect(result).toMatchObject({
      id: "b1",
      reference: "MV-12345",
      status: "NEW",
      property: "Velaa Lagoon Resort & Spa",
      room: "Overwater Villa",
      checkIn: "2026-06-01",
      checkOut: "2026-06-05",
      nights: 4,
      adults: 2,
      children: 1,
      customer: { name: "Jane Doe", email: "jane@example.com" },
    });
    expect(typeof result.submittedAt).toBe("string");
    expect(result.total).toBe(1000);
  });

  it("maps a booking fetched by reference", async () => {
    mockDb.booking.findUnique.mockResolvedValue(mockBookingRow());
    const result = await getBookingByReference({ data: "MV-12345" });
    expect(result).toMatchObject({ reference: "MV-12345", property: "Velaa Lagoon Resort & Spa" });
  });

  it("returns null when a reference is not found", async () => {
    mockDb.booking.findUnique.mockResolvedValue(null);
    const result = await getBookingByReference({ data: "MV-NOPE" });
    expect(result).toBeNull();
  });

  it("updates a booking status via updateBookingStatus", async () => {
    const updated = mockBookingRow();
    updated.status = "CONFIRMED";
    mockDb.booking.update.mockResolvedValue(updated);
    const result = await updateBookingStatus({ data: { id: "b1", status: "CONFIRMED" } });
    expect(mockDb.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1" }, data: { status: "CONFIRMED" } }),
    );
    expect(result.status).toBe("CONFIRMED");
  });

  it("records a STATUS_CHANGED event when a booking status changes", async () => {
    mockDb.bookingConversation.findUnique.mockResolvedValue({ id: "conv1", bookingId: "b1" });
    const updated = mockBookingRow();
    updated.status = "AWAITING_PAYMENT";
    mockDb.booking.update.mockResolvedValue(updated);
    await updateBookingStatus({ data: { id: "b1", status: "AWAITING_PAYMENT" } });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "b1",
        type: "STATUS_CHANGED",
        message: "Status changed to AWAITING_PAYMENT",
      }),
    });
    // SYSTEM message automation
    expect(mockDb.bookingMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderType: "SYSTEM",
        message: "Booking status changed to AWAITING_PAYMENT.",
      }),
    });
  });

  it("records a BOOKING_CREATED event when a booking is created", async () => {
    await createBooking({ data: baseInput });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "BOOKING_CREATED" }),
    });
  });

  it("assigns a booking to an agent and records an event", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "agent1", fullName: "Ahmed Hassan" });
    mockDb.booking.update.mockResolvedValue(mockBookingRow());
    const result = await assignBooking({ data: { id: "b1", agentId: "agent1" } });
    expect(mockDb.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1" }, data: { assignedAgentId: "agent1" } }),
    );
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "ASSIGNED", message: "Assigned to Ahmed Hassan" }),
    });
    expect(result).toBeTruthy();
  });

  it("throws when assigning to an unknown agent", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    await expect(assignBooking({ data: { id: "b1", agentId: "nope" } })).rejects.toThrow(
      /Agent not found/,
    );
  });

  it("unassigns a booking and records an event", async () => {
    mockDb.booking.update.mockResolvedValue(mockBookingRow());
    await unassignBooking({ data: "b1" });
    expect(mockDb.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1" }, data: { assignedAgentId: null } }),
    );
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "UNASSIGNED" }),
    });
  });

  it("adds an internal note and records an event", async () => {
    mockDb.bookingNote.create.mockResolvedValue({
      id: "n1",
      content: "Customer prefers upper deck",
      createdAt: new Date(),
    });
    const result = await addBookingNote({
      data: { bookingId: "b1", content: "Customer prefers upper deck" },
    });
    expect(mockDb.bookingNote.create).toHaveBeenCalledWith({
      data: { bookingId: "b1", content: "Customer prefers upper deck" },
    });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", type: "NOTE_ADDED" }),
    });
    expect(result.content).toBe("Customer prefers upper deck");
  });

  it("rejects an empty note", async () => {
    await expect(addBookingNote({ data: { bookingId: "b1", content: "   " } })).rejects.toThrow(
      /cannot be empty/i,
    );
  });

  it("uploads an attachment and records an event", async () => {
    const form = new FormData();
    form.append("bookingId", "b1");
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "quote.pdf", { type: "application/pdf" }),
    );
    mockDb.bookingAttachment.create.mockResolvedValue({
      id: "att1",
      filename: "quote.pdf",
      url: "/uploads/1-quote.pdf",
      uploadedAt: new Date(),
    });
    const result = await addBookingAttachment({ data: form });
    expect(result).toMatchObject({ filename: "quote.pdf", url: "/uploads/1-quote.pdf" });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", type: "ATTACHMENT_UPLOADED" }),
    });
  });

  it("updates supplier reference/status and records an event", async () => {
    mockDb.booking.update.mockResolvedValue(mockBookingRow());
    await updateBookingSupplier({
      data: { id: "b1", reference: "VELAA-2026-9981", status: "Confirmed" },
    });
    expect(mockDb.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        data: { supplierReference: "VELAA-2026-9981", supplierStatus: "Confirmed" },
      }),
    );
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "SUPPLIER_UPDATED" }),
    });
  });

  it("fetches a full booking detail with timeline, notes and attachments", async () => {
    const detail = {
      ...mockBookingRow(),
      assignedAgent: { id: "agent1", fullName: "Ahmed Hassan" },
      supplierReference: "VELAA-2026-9981",
      supplierStatus: "Confirmed",
      events: [
        { id: "e1", type: "BOOKING_CREATED", message: "Booking created", createdAt: new Date() },
      ],
      notes: [{ id: "n1", content: "internal", createdAt: new Date() }],
      attachments: [
        { id: "att1", filename: "quote.pdf", url: "/uploads/1.pdf", uploadedAt: new Date() },
      ],
    };
    mockDb.booking.findUnique.mockResolvedValue(detail);
    const result = await getBooking({ data: "b1" });
    expect(result).toMatchObject({
      reference: "MV-12345",
      assignedAgent: { id: "agent1", name: "Ahmed Hassan" },
      supplierReference: "VELAA-2026-9981",
      events: [{ id: "e1", type: "BOOKING_CREATED", message: "Booking created" }],
      notes: [{ id: "n1", content: "internal" }],
      attachments: [{ id: "att1", filename: "quote.pdf", url: "/uploads/1.pdf" }],
    });
  });
});
