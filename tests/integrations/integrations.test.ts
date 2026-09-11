import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyMarkup, getEffectiveMarkup } from "@/lib/markup";
import { buildBookingIcs, getBookingCalendar } from "@/lib/api/calendar";
import { ingestInboundEmail, parseInboundRecipient } from "@/lib/api/email-ingest";
import { runAccountingSync } from "@/lib/api/accounting-sync";
import { computeAgentPerformance, setAgentCommissionRate } from "@/lib/api/finance";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    markupRule: { findMany: vi.fn() },
    booking: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    bookingConversation: { findUnique: vi.fn(), create: vi.fn() },
    bookingMessage: { create: vi.fn() },
    bookingEvent: { create: vi.fn() },
    supplier: { findUnique: vi.fn() },
    supplierUpdateRequest: { updateMany: vi.fn() },
    exportFile: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    contractRate: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    user: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
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

const FILTER = { from: "2026-01-01", to: "2026-12-31" };

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.markupRule.findMany.mockResolvedValue([]);
  mockDb.booking.findUnique.mockResolvedValue({
    id: "b1",
    reference: "MV-24081",
    trackingToken: "tok1",
    checkIn: new Date("2026-09-12T00:00:00.000Z"),
    checkOut: new Date("2026-09-17T00:00:00.000Z"),
    totalPrice: 6410,
    property: { name: "Velaa", supplierId: "sup1" },
    room: { name: "Overwater Villa" },
  });
  mockDb.booking.findMany.mockResolvedValue([
    {
      reference: "MV-24081",
      checkIn: new Date("2026-09-12"),
      checkOut: new Date("2026-09-17"),
      status: "CONFIRMED",
      property: { name: "Velaa" },
      room: { name: "Overwater Villa" },
    },
  ]);
  mockDb.bookingConversation.findUnique.mockResolvedValue({ id: "conv1", bookingId: "b1" });
  mockDb.bookingMessage.create.mockResolvedValue({ id: "m1" });
  mockDb.bookingEvent.create.mockResolvedValue({ id: "e1" });
  mockDb.supplier.findUnique.mockResolvedValue({ id: "sup1", email: "res@velaa.com" });
  mockDb.supplierUpdateRequest.updateMany.mockResolvedValue({ count: 1 });
  mockDb.exportFile.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: "f1", ...data, createdAt: new Date() }),
  );
  mockDb.contractRate.findMany.mockResolvedValue([]);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.user.findMany.mockResolvedValue([{ id: "agent1", fullName: "Amina", commissionRate: 10 }]);
  mockDb.user.update.mockResolvedValue({ id: "agent1", commissionRate: 12 });
});

describe("markup engine", () => {
  it("applies the property-type default when no rules exist", async () => {
    mockDb.markupRule.findMany.mockResolvedValue([]);
    expect(await getEffectiveMarkup({ propertyId: "p1", propertyType: "GUESTHOUSE" })).toBe(18);
    expect(await getEffectiveMarkup({ propertyId: "p1", propertyType: "SAFARI_BOAT" })).toBe(25);
    expect(await getEffectiveMarkup({ propertyId: "p1", propertyType: "RESORT" })).toBe(22);
  });

  it("prefers property > supplier > type rules", async () => {
    mockDb.markupRule.findMany.mockResolvedValue([
      {
        id: "r1",
        propertyType: "RESORT",
        supplierId: null,
        propertyId: null,
        markupPercent: 22,
        priority: 0,
      },
      {
        id: "r2",
        propertyType: null,
        supplierId: "sup1",
        propertyId: null,
        markupPercent: 20,
        priority: 0,
      },
      {
        id: "r3",
        propertyType: null,
        supplierId: null,
        propertyId: "p1",
        markupPercent: 15,
        priority: 0,
      },
    ]);
    const m = await getEffectiveMarkup({
      propertyId: "p1",
      propertyType: "RESORT",
      supplierId: "sup1",
    });
    expect(m).toBe(15); // property rule wins
  });

  it("applies markup to a base total", () => {
    expect(applyMarkup(5900, 22)).toBe(7198);
    expect(applyMarkup(100, 0)).toBe(100);
  });
});

describe("calendar sync", () => {
  it("builds a valid .ics with arrival + departure events", async () => {
    const ics = buildBookingIcs({
      reference: "MV-24081",
      checkIn: new Date("2026-09-12T00:00:00.000Z"),
      checkOut: new Date("2026-09-17T00:00:00.000Z"),
      propertyName: "Velaa",
      roomName: "Overwater Villa",
      totalPrice: 6410,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("Arrival — MV-24081 Velaa");
    expect(ics).toContain("Departure — MV-24081 Velaa");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("returns a Google Calendar URL for a booking", async () => {
    const res = await getBookingCalendar({ data: "b1" });
    expect(res?.googleUrl).toContain("calendar.google.com");
    expect(res?.googleUrl).toContain("action=TEMPLATE");
    expect(res?.filename).toBe("MV-24081_calendar.ics");
  });
});

describe("email ingestion", () => {
  it("parses a booking reference from a plus address", () => {
    expect(parseInboundRecipient("bookings+MV-24081@mail.oceanatlas.mv")).toEqual({
      reference: "MV-24081",
    });
    expect(parseInboundRecipient("bookings+abc@mail.oceanatlas.mv")).toEqual({ token: "abc" });
    expect(parseInboundRecipient("sales@oceanatlas.mv")).toBeNull();
  });

  it("links an inbound email to a booking and appends a message", async () => {
    const result = await ingestInboundEmail({
      to: "bookings+MV-24081@mail.oceanatlas.mv",
      from: "res@velaa.com",
      subject: "Re: Availability",
      body: "We confirm 5 nights.",
    });
    expect(result.linked).toBe(true);
    expect((result as { reference: string }).reference).toBe("MV-24081");
    expect(mockDb.bookingMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderType: "SUPPLIER",
        message: expect.stringContaining("We confirm 5 nights."),
      }),
    });
    expect(mockDb.supplierUpdateRequest.updateMany).toHaveBeenCalled();
  });

  it("returns unlinked when no booking matches", async () => {
    mockDb.booking.findFirst.mockResolvedValue(null);
    mockDb.booking.findUnique.mockResolvedValue(null);
    const result = await ingestInboundEmail({
      to: "bookings+MV-99999@mail.oceanatlas.mv",
      body: "hi",
    });
    expect(result.linked).toBe(false);
  });
});

describe("accounting sync", () => {
  it("generates and stores Xero + QuickBooks journals", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        reference: "MV-24081",
        totalPrice: 6410,
        nights: 5,
        status: "CONFIRMED",
        checkIn: new Date("2026-03-01"),
        checkOut: new Date("2026-03-06"),
        createdAt: new Date("2026-02-01"),
        property: { name: "Velaa", supplierId: "sup1", supplier: { id: "sup1" } },
        room: { name: "Overwater Villa" },
        customer: { fullName: "Jane Doe" },
        assignedAgent: { id: "agent1" },
      },
    ]);
    mockDb.contractRate.findMany.mockResolvedValue([
      {
        id: "cr",
        supplierId: "sup1",
        roomId: null,
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2026-12-31"),
        netRate: 800,
      },
    ]);
    const result = await runAccountingSync(FILTER, "agent");
    expect(result.files).toHaveLength(2);
    expect(mockDb.exportFile.create).toHaveBeenCalledTimes(2);
    const formats = result.files.map((f) => f.format);
    expect(formats).toContain("XERO");
    expect(formats).toContain("QUICKBOOKS");
  });
});

describe("agent commissions", () => {
  it("computes commission as % of gross profit", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        reference: "MV-1",
        totalPrice: 6410,
        nights: 5,
        status: "CONFIRMED",
        checkIn: new Date("2026-03-01"),
        checkOut: new Date("2026-03-06"),
        createdAt: new Date("2026-02-01"),
        property: { name: "Velaa", supplierId: "sup1", supplier: { id: "sup1" } },
        room: { name: "OV" },
        customer: { fullName: "Jane" },
        assignedAgent: { id: "agent1" },
      },
    ]);
    mockDb.contractRate.findMany.mockResolvedValue([
      {
        id: "cr",
        supplierId: "sup1",
        roomId: null,
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2026-12-31"),
        netRate: 800,
      },
    ]);
    const report = await computeAgentPerformance(FILTER);
    expect(report.rows[0]).toMatchObject({
      name: "Amina",
      bookings: 1,
      revenue: 6410,
      commissionRate: 10,
    });
    // grossProfit = 6410 - (800*5) = 2410 → commission 241
    expect(report.rows[0].commission).toBe(241);
  });

  it("updates an agent's commission rate", async () => {
    await setAgentCommissionRate({ data: { agentId: "agent1", rate: 12 } });
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "agent1" },
      data: { commissionRate: 12 },
    });
  });
});
