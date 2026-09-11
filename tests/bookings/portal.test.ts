import { describe, expect, it, vi, beforeEach } from "vitest";
import { getPortalBooking, portalStatusLabel } from "@/lib/api/portal";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findUnique: vi.fn() },
    bookingPortalView: { create: vi.fn() },
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

function bookingRow(overrides = {}) {
  return {
    id: "b1",
    reference: "MV-24081",
    trackingToken: "ab12cd34",
    status: "PENDING_SUPPLIER",
    property: { name: "Velaa Lagoon Resort & Spa" },
    room: { name: "Overwater Villa" },
    customer: { fullName: "Amelia Rossi" },
    checkIn: new Date("2026-09-12T00:00:00.000Z"),
    checkOut: new Date("2026-09-17T00:00:00.000Z"),
    nights: 5,
    adults: 2,
    children: 0,
    totalPrice: 6410,
    specialRequests: null,
    addons: [{ addon: { name: "Sunset Spa Ritual" } }],
    events: [
      { id: "e1", type: "BOOKING_CREATED", message: "Booking created", createdAt: new Date() },
      { id: "e2", type: "ASSIGNED", message: "Assigned to Ahmed Hassan", createdAt: new Date() },
      {
        id: "e3",
        type: "STATUS_CHANGED",
        message: "Status changed to PENDING_SUPPLIER",
        createdAt: new Date(),
      },
    ],
    conversation: {
      messages: [
        {
          id: "m1",
          senderType: "CUSTOMER",
          senderName: "Amelia",
          message: "hi",
          isInternal: false,
          createdAt: new Date(),
        },
        {
          id: "m2",
          senderType: "AGENT",
          senderName: "Ahmed",
          message: "hello",
          isInternal: true,
          createdAt: new Date(),
        },
      ],
    },
    attachments: [
      { id: "a1", filename: "voucher.pdf", url: "/uploads/voucher.pdf", uploadedAt: new Date() },
    ],
    payments: [],
    documents: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPortalBooking", () => {
  it("returns the portal DTO for a valid reference + token", async () => {
    mockDb.booking.findUnique.mockResolvedValue(bookingRow());
    mockDb.bookingPortalView.create.mockResolvedValue({ id: "v1" });

    const result = await getPortalBooking({ data: { reference: "MV-24081", token: "ab12cd34" } });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      reference: "MV-24081",
      status: "PENDING_SUPPLIER",
      property: "Velaa Lagoon Resort & Spa",
      customerName: "Amelia Rossi",
      total: 6410,
    });
    // internal events are hidden; ASSIGNED excluded, MESSAGE_SENT/STATUS/BOOKING_CREATED shown
    expect(result.timeline.map((e) => e.type)).toEqual(["BOOKING_CREATED", "STATUS_CHANGED"]);
    // internal messages are hidden
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].message).toBe("hi");
    expect(result.attachments).toHaveLength(1);
  });

  it("records a portal view with ip/userAgent", async () => {
    mockDb.booking.findUnique.mockResolvedValue(bookingRow());
    mockDb.bookingPortalView.create.mockResolvedValue({ id: "v1" });
    await getPortalBooking({
      data: { reference: "MV-24081", token: "ab12cd34", ip: "1.2.3.4", userAgent: "Mozilla" },
    });
    expect(mockDb.bookingPortalView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", ip: "1.2.3.4", userAgent: "Mozilla" }),
    });
  });

  it("returns null when the token does not match (prevents enumeration)", async () => {
    mockDb.booking.findUnique.mockResolvedValue(bookingRow({ trackingToken: "different-token" }));
    const result = await getPortalBooking({ data: { reference: "MV-24081", token: "WRONG" } });
    expect(result).toBeNull();
    expect(mockDb.bookingPortalView.create).not.toHaveBeenCalled();
  });

  it("returns null when the reference does not exist", async () => {
    mockDb.booking.findUnique.mockResolvedValue(null);
    const result = await getPortalBooking({ data: { reference: "MV-NOPE", token: "x" } });
    expect(result).toBeNull();
  });
});

describe("portalStatusLabel", () => {
  it("maps workflow states to friendly labels", () => {
    expect(portalStatusLabel("PENDING_SUPPLIER")).toBe("Awaiting supplier confirmation");
    expect(portalStatusLabel("AWAITING_PAYMENT")).toBe("Awaiting payment");
    expect(portalStatusLabel("CONFIRMED")).toBe("Booking confirmed");
    expect(portalStatusLabel("COMPLETED")).toBe("Completed");
  });
});
