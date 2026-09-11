import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  acceptQuote,
  declineQuote,
  getQuoteByToken,
  requestQuoteChanges,
} from "@/lib/api/quote-portal";
import * as bookings from "@/lib/api/bookings";
import * as payments from "@/lib/api/payments";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    quote: { findUnique: vi.fn(), update: vi.fn() },
    quoteEvent: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/api/bookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/bookings")>();
  return { ...actual, createBookingRecord: vi.fn() };
});
vi.mock("@/lib/api/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/payments")>();
  return { ...actual, requestPayment: vi.fn() };
});
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

function quoteRow(overrides = {}) {
  return {
    id: "q1",
    reference: "QT-12345",
    token: "tok123",
    leadId: null,
    propertyId: "p1",
    roomId: "r1",
    checkIn: new Date("2026-09-12"),
    checkOut: new Date("2026-09-17"),
    adults: 2,
    children: 0,
    addonIds: [],
    customerName: "Jane Doe",
    customerEmail: "jane@mail.com",
    totalPrice: 5900,
    validUntil: new Date(Date.now() + 3 * 86_400_000),
    notes: null,
    documentUrl: null,
    documentFilename: null,
    bookingLink: "/quote/tok123",
    status: "PENDING",
    bookingId: null,
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
    createdAt: new Date(),
    lead: null,
    property: { name: "Velaa" },
    room: { name: "Overwater Villa" },
    activity: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.quote.findUnique.mockResolvedValue(quoteRow());
  mockDb.quote.update.mockImplementation(({ data }) => Promise.resolve({ ...quoteRow(), ...data }));
  mockDb.quoteEvent.create.mockResolvedValue({
    id: "e1",
    quoteId: "q1",
    type: "x",
    message: "x",
    createdAt: new Date(),
  });
  mockDb.quoteEvent.findMany.mockResolvedValue([]);
  (bookings.createBookingRecord as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "b1",
    reference: "MV-77777",
    trackingToken: "portaltok",
  });
  (payments.requestPayment as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "pay1" });
});

describe("getQuoteByToken", () => {
  it("returns quote details with breakdown and activity", async () => {
    mockDb.quote.findUnique.mockResolvedValue(
      quoteRow({
        activity: [
          { id: "e1", quoteId: "q1", type: "OPENED", message: "opened", createdAt: new Date() },
        ],
      }),
    );
    const dto = await getQuoteByToken({ data: "tok123" });
    expect(dto).not.toBeNull();
    expect(dto.propertyName).toBe("Velaa");
    expect(dto.roomName).toBe("Overwater Villa");
    expect(dto.nights).toBe(5);
    expect(dto.expired).toBe(false);
    expect(dto.activity).toHaveLength(1);
  });

  it("flags expired quotes", async () => {
    mockDb.quote.findUnique.mockResolvedValue(
      quoteRow({ validUntil: new Date(Date.now() - 86_400_000) }),
    );
    const dto = await getQuoteByToken({ data: "tok123" });
    expect(dto.expired).toBe(true);
  });

  it("returns null for an unknown token", async () => {
    mockDb.quote.findUnique.mockResolvedValue(null);
    expect(await getQuoteByToken({ data: "nope" })).toBeNull();
  });
});

describe("acceptQuote", () => {
  it("creates a booking, marks quote ACCEPTED and generates a deposit request", async () => {
    const res = await acceptQuote({ data: "tok123" });
    expect(bookings.createBookingRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: "p1",
        roomId: "r1",
        checkIn: "2026-09-12",
        adults: 2,
        customer: expect.objectContaining({ fullName: "Jane Doe", email: "jane@mail.com" }),
      }),
    );
    expect(mockDb.quote.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({ status: "ACCEPTED", bookingId: "b1" }),
    });
    expect(payments.requestPayment).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", type: "DEPOSIT", amount: 2950 }),
    });
    expect(mockDb.quoteEvent.create).toHaveBeenCalled();
    expect(res).toMatchObject({
      reference: "MV-77777",
      deposit: 2950,
      portalUrl: "/track/MV-77777?token=portaltok",
    });
  });

  it("rejects an already-accepted quote", async () => {
    mockDb.quote.findUnique.mockResolvedValue(quoteRow({ status: "ACCEPTED" }));
    await expect(acceptQuote({ data: "tok123" })).rejects.toThrow(/already accepted/i);
  });

  it("rejects an expired quote", async () => {
    mockDb.quote.findUnique.mockResolvedValue(
      quoteRow({ validUntil: new Date(Date.now() - 86_400_000) }),
    );
    await expect(acceptQuote({ data: "tok123" })).rejects.toThrow(/expired/i);
  });
});

describe("declineQuote / requestQuoteChanges", () => {
  it("marks a quote DECLINED with reason and records activity", async () => {
    await declineQuote({ data: { token: "tok123", reason: "Too expensive" } });
    expect(mockDb.quote.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({ status: "DECLINED", declineReason: "Too expensive" }),
    });
    expect(mockDb.quoteEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "DECLINED",
        message: "Quote declined — Too expensive",
      }),
    });
  });

  it("marks a quote MODIFIED when changes are requested", async () => {
    await requestQuoteChanges({ data: { token: "tok123", message: "Can we change dates?" } });
    expect(mockDb.quote.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({ status: "MODIFIED" }),
    });
    expect(mockDb.quoteEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CHANGES_REQUESTED" }),
    });
  });
});
