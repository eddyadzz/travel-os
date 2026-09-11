import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateBookingDocument, listBookingDocuments } from "@/lib/api/documents";
import { documentFilename } from "@/lib/documents/generator";
import { nextVersion } from "@/lib/documents/versioning";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findUnique: vi.fn() },
    bookingDocument: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/documents/storage", () => ({
  storeDocument: vi.fn().mockResolvedValue({ url: "/uploads/documents/test.pdf" }),
}));
vi.mock("@/lib/documents/generator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/documents/generator")>();
  return {
    ...actual,
    generateDocument: vi.fn().mockResolvedValue({ buffer: Buffer.from("PDF"), filename: "x.pdf" }),
  };
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

function bookingRow() {
  return {
    id: "b1",
    reference: "MV-24081",
    trackingToken: "tok123",
    totalPrice: 6410,
    specialRequests: null,
    supplierReference: "VELAA-1",
    checkIn: new Date("2026-09-12"),
    checkOut: new Date("2026-09-17"),
    nights: 5,
    adults: 2,
    children: 0,
    property: {
      name: "Velaa Lagoon Resort & Spa",
      transferMethod: "Seaplane",
      transferDuration: "35 min",
    },
    room: { name: "Overwater Villa", boardBasis: "Half Board" },
    customer: { fullName: "Amelia Rossi", email: "amelia@mail.com", emailNotifications: true },
    addons: [{ addon: { name: "Spa" } }],
    payments: [],
    documents: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findUnique.mockResolvedValue(bookingRow());
  mockDb.bookingDocument.count.mockResolvedValue(0);
  mockDb.bookingDocument.create.mockResolvedValue({
    id: "d1",
    type: "RESORT_VOUCHER",
    filename: "MV-24081_Resort-Voucher_v1.pdf",
    url: "/uploads/documents/test.pdf",
    version: 1,
    createdAt: new Date(),
  });
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
});

describe("generateBookingDocument", () => {
  it("generates a resort voucher as version 1", async () => {
    const doc = await generateBookingDocument({
      data: { bookingId: "b1", type: "RESORT_VOUCHER" },
    });
    expect(mockDb.bookingDocument.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: "b1",
          type: "RESORT_VOUCHER",
        }),
      }),
    );
    expect(mockDb.bookingDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: "b1",
          type: "RESORT_VOUCHER",
          version: 1,
        }),
      }),
    );
    expect(doc.version).toBe(1);
    expect(doc.type).toBe("RESORT_VOUCHER");
  });

  it("versions a re-generated voucher as v2 when one already exists", async () => {
    mockDb.bookingDocument.count.mockResolvedValue(1);
    mockDb.bookingDocument.create.mockResolvedValue({
      id: "d2",
      type: "RESORT_VOUCHER",
      filename: "MV-24081_Resort-Voucher_v2.pdf",
      url: "/uploads/documents/test2.pdf",
      version: 2,
      createdAt: new Date(),
    });
    const doc = await generateBookingDocument({
      data: { bookingId: "b1", type: "RESORT_VOUCHER" },
    });
    expect(doc.version).toBe(2);
    expect(mockDb.bookingDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 2 }) }),
    );
  });

  it("triggers an ATTACHMENT_ADDED notification on generation", async () => {
    await generateBookingDocument({ data: { bookingId: "b1", type: "INVOICE" } });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "b1",
        type: "ATTACHMENT_ADDED",
      }),
    });
  });
});

describe("listBookingDocuments", () => {
  it("returns documents for a booking", async () => {
    mockDb.bookingDocument.findMany.mockResolvedValue([
      {
        id: "d1",
        type: "RESORT_VOUCHER",
        filename: "v1.pdf",
        url: "/u/v1.pdf",
        version: 1,
        createdAt: new Date(),
      },
    ]);
    const result = await listBookingDocuments({ data: "b1" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "RESORT_VOUCHER", version: 1 });
  });
});

describe("document versioning & naming", () => {
  it("computes the next version", async () => {
    expect(await nextVersion(0, "RESORT_VOUCHER")).toBe(1);
    expect(await nextVersion(2, "RESORT_VOUCHER")).toBe(3);
  });

  it("builds versioned filenames", () => {
    expect(documentFilename("RESORT_VOUCHER", "MV-24081", 2)).toBe(
      "MV-24081_Resort-Voucher_v2.pdf",
    );
    expect(documentFilename("INVOICE", "MV-24081", 1)).toBe("MV-24081_Invoice_v1.pdf");
  });
});
