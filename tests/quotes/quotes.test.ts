import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateAutoQuote, getQuote, listQuotes, sendQuoteEmail } from "@/lib/api/quotes";
import { generateQuotePdf } from "@/lib/documents/generator";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    property: { findUnique: vi.fn() },
    room: { findUnique: vi.fn() },
    rate: { findFirst: vi.fn() },
    addon: { findMany: vi.fn() },
    quote: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    lead: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
    markupRule: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/documents/storage.server", () => ({
  storeDocument: vi.fn().mockResolvedValue({ url: "/uploads/documents/q.pdf" }),
}));
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

const property = {
  id: "p1",
  name: "Velaa Lagoon Resort & Spa",
  transferPricePerPerson: 545,
  type: "RESORT",
  supplierId: null,
};
const room = {
  id: "r1",
  name: "Overwater Villa",
  maxAdults: 2,
  maxChildren: 0,
  extraGuestRate: 165,
};
const rate = { id: "rate1", roomId: "r1", amount: 890 };
const addons = [{ id: "a1", name: "Spa", pricingType: "PER_PERSON", amount: 180, active: true }];

const baseInput = {
  propertyId: "p1",
  roomId: "r1",
  checkIn: "2026-09-12",
  checkOut: "2026-09-17",
  adults: 2,
  children: 0,
  addonIds: ["a1"],
  customerName: "Jane Doe",
  customerEmail: "jane@mail.com",
  validUntil: "2026-09-30",
};

function quoteRow(overrides = {}) {
  return {
    id: "q1",
    reference: "QT-12345",
    leadId: null,
    propertyId: "p1",
    roomId: "r1",
    checkIn: new Date("2026-09-12"),
    checkOut: new Date("2026-09-17"),
    adults: 2,
    children: 0,
    customerName: "Jane Doe",
    totalPrice: 5450,
    validUntil: new Date("2026-09-30"),
    notes: null,
    documentUrl: "/uploads/documents/q.pdf",
    documentFilename: "QT-12345_Quote.pdf",
    bookingLink: "/properties/p1",
    createdAt: new Date(),
    lead: null,
    property: { name: "Velaa Lagoon Resort & Spa" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.property.findUnique.mockResolvedValue(property);
  mockDb.room.findUnique.mockResolvedValue(room);
  mockDb.rate.findFirst.mockResolvedValue(rate);
  mockDb.addon.findMany.mockResolvedValue(addons);
  mockDb.quote.create.mockResolvedValue(quoteRow());
  mockDb.quote.findMany.mockResolvedValue([quoteRow()]);
  mockDb.quote.findUnique.mockResolvedValue(quoteRow());
  mockDb.lead.findUnique.mockResolvedValue({
    id: "l1",
    fullName: "Jane Doe",
    email: "jane@mail.com",
  });
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
  mockDb.markupRule.findMany.mockResolvedValue([]);
});

describe("generateAutoQuote", () => {
  it("computes price, generates a PDF and stores a quote record", async () => {
    const result = await generateAutoQuote({ data: baseInput });
    // 5 nights x 890 = 4450 + transfers 545x2=1090 + addon 180x2=360 = 5900 base.
    // Velaa is a RESORT → 22% default markup → total 7198.
    expect(result.breakdown.accommodation).toBe(4450);
    expect(result.breakdown.markupPercent).toBe(22);
    expect(result.breakdown.total).toBe(7198);
    expect(result.quote.documentUrl).toBe("/uploads/documents/q.pdf");
    expect(result.quote.propertyName).toBe("Velaa Lagoon Resort & Spa");
  });

  it("creates a standalone quote when no lead is linked", async () => {
    await generateAutoQuote({ data: baseInput });
    expect(mockDb.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reference: expect.stringMatching(/^QT-\d{5}$/),
          customerName: "Jane Doe",
          token: expect.any(String),
          bookingLink: expect.stringMatching(/^\/quote\//),
        }),
      }),
    );
    expect(mockDb.lead.update).not.toHaveBeenCalled();
  });

  it("links a lead and moves it to QUOTED when leadId is provided", async () => {
    mockDb.lead.findUnique.mockResolvedValue({
      id: "l1",
      fullName: "Jane Doe",
      email: "jane@mail.com",
    });
    await generateAutoQuote({ data: { ...baseInput, leadId: "l1" } });
    expect(mockDb.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadId: "l1" }) }),
    );
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "QUOTED" },
    });
  });

  it("rejects an inverted date range", async () => {
    await expect(
      generateAutoQuote({ data: { ...baseInput, checkIn: "2026-09-17", checkOut: "2026-09-12" } }),
    ).rejects.toThrow(/after check-in/i);
  });
});

describe("listQuotes / getQuote", () => {
  it("lists quotes", async () => {
    const result = await listQuotes();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reference: "QT-12345",
      propertyName: "Velaa Lagoon Resort & Spa",
    });
  });

  it("gets a single quote", async () => {
    const result = await getQuote({ data: "q1" });
    expect(result).toMatchObject({ id: "q1", totalPrice: 5450 });
  });

  it("returns null when not found", async () => {
    mockDb.quote.findUnique.mockResolvedValue(null);
    expect(await getQuote({ data: "nope" })).toBeNull();
  });
});

describe("sendQuoteEmail", () => {
  it("sends a quote email and returns sent status", async () => {
    mockDb.quote.findUnique.mockResolvedValue(
      quoteRow({ lead: { fullName: "Jane Doe" }, leadId: "l1" }),
    );
    mockDb.lead.findUnique.mockResolvedValue({ id: "l1", email: "jane@mail.com" });
    const result = await sendQuoteEmail({ data: "q1" });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: "jane@mail.com",
        subject: expect.stringContaining("QT-"),
      }),
    });
    expect(result.sent).toBe(true);
  });

  it("throws when no customer email exists", async () => {
    mockDb.quote.findUnique.mockResolvedValue(
      quoteRow({ lead: null, leadId: null, customerName: "X" }),
    );
    mockDb.lead.findUnique.mockResolvedValue(null);
    await expect(sendQuoteEmail({ data: "q1" })).rejects.toThrow(/no customer email/i);
  });
});

describe("generateQuotePdf", () => {
  it("produces a valid PDF buffer", async () => {
    const { buffer, filename } = await generateQuotePdf({
      reference: "QT-12345",
      customerName: "Jane Doe",
      property: "Velaa",
      room: "Overwater Villa",
      checkIn: "2026-09-12",
      checkOut: "2026-09-17",
      nights: 5,
      adults: 2,
      children: 0,
      addons: ["Spa"],
      breakdown: { accommodation: 4450, extraGuests: 0, transfers: 1090, addons: 360, total: 5900 },
      validUntil: "2026-09-30",
      bookingLink: "/properties/p1",
    });
    expect(filename).toBe("QT-12345_Quote.pdf");
    expect(buffer[0]).toBe(0x25); // '%'
    expect(buffer[1]).toBe(0x50); // 'P'
    expect(buffer[2]).toBe(0x44); // 'D'
    expect(buffer[3]).toBe(0x46); // 'F'
  });
});
