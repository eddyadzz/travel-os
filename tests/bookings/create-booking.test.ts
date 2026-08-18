import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBooking, getBookingByReference, updateBookingStatus } from "@/lib/api/bookings";
import type { Booking, BookingStatus, Customer } from "@/generated/prisma/client";

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
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator: () => ({
      handler: (h: (ctx: { data: unknown }) => unknown) => async (opts: { data: unknown }) =>
        h({ data: opts.data }),
    }),
  }),
}));

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
});
