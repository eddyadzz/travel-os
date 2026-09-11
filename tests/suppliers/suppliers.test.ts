import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeBookingCosting,
  createSupplier,
  createSupplierConfirmation,
  getSupplier,
  listSuppliers,
  listSupplierConfirmations,
  updateSupplierConfirmation,
  getSupplierDashboard,
} from "@/lib/api/suppliers";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    supplier: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    contractRate: { findFirst: vi.fn() },
    supplierContact: { createMany: vi.fn() },
    supplierConfirmation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    booking: { findUnique: vi.fn() },
    bookingEvent: { create: vi.fn() },
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
    totalPrice: 6410,
    nights: 5,
    roomId: "r1",
    checkIn: new Date("2026-09-12"),
    checkOut: new Date("2026-09-17"),
    property: {
      supplier: { id: "sup1", name: "Velaa Private Island" },
    },
    ...overrides,
  };
}

function confirmationRow(overrides = {}) {
  return {
    id: "c1",
    bookingId: "b1",
    supplierId: "sup1",
    reference: null,
    notes: null,
    confirmedAt: null,
    createdAt: new Date(),
    supplier: { name: "Velaa Private Island" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findUnique.mockResolvedValue(bookingRow());
  mockDb.contractRate.findFirst.mockResolvedValue({ id: "rate1", netRate: 620 });
  mockDb.supplier.findMany.mockResolvedValue([
    { id: "sup1", name: "Velaa Private Island", type: "RESORT", active: true },
  ]);
  mockDb.supplier.create.mockResolvedValue({
    id: "sup1",
    name: "Velaa",
    type: "RESORT",
    active: true,
  });
  mockDb.supplierConfirmation.findMany.mockResolvedValue([
    confirmationRow({ status: "REQUESTED" }),
  ]);
  mockDb.supplierConfirmation.findUnique.mockResolvedValue(null);
  mockDb.supplierConfirmation.create.mockResolvedValue(confirmationRow({ status: "REQUESTED" }));
  mockDb.supplierConfirmation.update.mockResolvedValue(
    confirmationRow({ status: "CONFIRMED", confirmedAt: new Date() }),
  );
  mockDb.supplierConfirmation.count.mockResolvedValue(1);
  mockDb.supplierConfirmation.groupBy.mockResolvedValue([
    { supplierId: "sup1", _count: { _all: 2 } },
  ]);
});

describe("computeBookingCosting", () => {
  it("computes revenue, supplier cost and gross profit", async () => {
    const costing = await computeBookingCosting("b1");
    expect(costing).toMatchObject({
      reference: "MV-24081",
      revenue: 6410,
      supplierCost: 3100, // 620 net x 5 nights
      grossProfit: 3310,
    });
    expect(costing.marginPercent).toBeGreaterThan(0);
  });

  it("returns zero supplier cost when no net rate exists", async () => {
    mockDb.contractRate.findFirst.mockResolvedValue(null);
    const costing = await computeBookingCosting("b1");
    expect(costing.supplierCost).toBe(0);
    expect(costing.grossProfit).toBe(6410);
  });

  it("returns null when the booking is not found", async () => {
    mockDb.booking.findUnique.mockResolvedValue(null);
    const costing = await computeBookingCosting("nope");
    expect(costing).toBeNull();
  });
});

describe("listSuppliers", () => {
  it("returns active suppliers", async () => {
    const result = await listSuppliers();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "sup1", name: "Velaa Private Island", type: "RESORT" });
  });
});

describe("getSupplier", () => {
  it("returns a supplier with contacts and contract rates", async () => {
    mockDb.supplier.findUnique.mockResolvedValue({
      id: "sup1",
      name: "Velaa",
      type: "RESORT",
      email: "r@velaa.com",
      active: true,
      contacts: [
        {
          id: "c1",
          supplierId: "sup1",
          name: "Reservations",
          role: "Reservations",
          email: "r@velaa.com",
        },
      ],
      contractRates: [
        {
          id: "r1",
          supplierId: "sup1",
          validFrom: new Date("2026-04-01"),
          validTo: new Date("2027-03-31"),
          netRate: 620,
        },
      ],
    });
    const result = await getSupplier({ data: "sup1" });
    expect(result).toMatchObject({ id: "sup1", name: "Velaa" });
    expect(result.contacts).toHaveLength(1);
    expect(result.contractRates).toHaveLength(1);
    expect(result.contractRates[0]).toMatchObject({ netRate: 620 });
  });

  it("returns null when not found", async () => {
    mockDb.supplier.findUnique.mockResolvedValue(null);
    const result = await getSupplier({ data: "nope" });
    expect(result).toBeNull();
  });
});

describe("createSupplier", () => {
  it("creates a supplier", async () => {
    const result = await createSupplier({ data: { name: "Velaa", type: "RESORT" } });
    expect(mockDb.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Velaa", type: "RESORT" }),
    });
    expect(result.name).toBe("Velaa");
  });
});

describe("listSupplierConfirmations", () => {
  it("returns confirmations for a booking", async () => {
    const result = await listSupplierConfirmations({ data: "b1" });
    expect(mockDb.supplierConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingId: "b1" } }),
    );
    expect(result[0]).toMatchObject({ supplierName: "Velaa Private Island", status: "REQUESTED" });
  });
});

describe("createSupplierConfirmation", () => {
  it("creates a REQUESTED confirmation and records an event", async () => {
    mockDb.supplierConfirmation.findUnique.mockResolvedValue(null);
    const result = await createSupplierConfirmation({
      data: { bookingId: "b1", supplierId: "sup1" },
    });
    expect(mockDb.supplierConfirmation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", supplierId: "sup1", status: "REQUESTED" }),
      include: expect.anything(),
    });
    expect(mockDb.bookingEvent.create).toHaveBeenCalled();
    expect(result.status).toBe("REQUESTED");
  });

  it("rejects a duplicate confirmation", async () => {
    mockDb.supplierConfirmation.findUnique.mockResolvedValue(confirmationRow());
    await expect(
      createSupplierConfirmation({ data: { bookingId: "b1", supplierId: "sup1" } }),
    ).rejects.toThrow(/already exists/i);
  });
});

describe("updateSupplierConfirmation", () => {
  it("updates status to CONFIRMED and records an event", async () => {
    mockDb.supplierConfirmation.findUnique.mockResolvedValue(
      confirmationRow({ status: "REQUESTED" }),
    );
    const result = await updateSupplierConfirmation({ data: { id: "c1", status: "CONFIRMED" } });
    expect(mockDb.supplierConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONFIRMED", confirmedAt: expect.any(Date) }),
      }),
    );
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "SUPPLIER_UPDATED" }),
    });
    expect(result.status).toBe("CONFIRMED");
  });
});

describe("getSupplierDashboard", () => {
  it("returns confirmation counts by status", async () => {
    const result = await getSupplierDashboard();
    expect(result).toMatchObject({
      awaitingConfirmation: 1,
      confirmed: 1,
      pendingResponse: 1,
    });
    expect(result.bySupplier[0]).toMatchObject({ supplierId: "sup1", count: 2 });
  });
});
