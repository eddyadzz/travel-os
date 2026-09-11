import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  clearBlackout,
  deletePromotion,
  getAllocations,
  getPackages,
  getPortalAvailability,
  getPortalRates,
  getPromotions,
  getSupplierPortal,
  saveAllocation,
  savePackage,
  savePortalAvailability,
  savePortalRate,
  savePromotion,
  setBlackout,
} from "@/lib/api/supplier-portal";
import { getSupplierPortalAccess, sendSupplierPortalAccess } from "@/lib/api/suppliers";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    supplier: { findUnique: vi.fn(), update: vi.fn() },
    property: { findMany: vi.fn(), findUnique: vi.fn() },
    room: { findUnique: vi.fn(), findMany: vi.fn() },
    availability: { groupBy: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    blackoutDate: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    supplierUpdateRequest: { count: vi.fn(), updateMany: vi.fn() },
    rate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    promotion: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    package: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    allocation: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications/service")>();
  return { ...actual, notifySupplierPortalAccess: vi.fn().mockResolvedValue({ id: "n1" }) };
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

const supplierRow = {
  id: "sup1",
  name: "Velaa Private Island",
  type: "RESORT",
  email: "res@velaa.com",
  phone: null,
  contactPerson: null,
  active: true,
  accessToken: "tok123",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const propertyRow = {
  id: "p1",
  name: "Velaa",
  slug: "velaa",
  atoll: "Noonu",
  island: "Velaa",
  supplierId: "sup1",
  rooms: [{ id: "r1", name: "Beach Villa", boardBasis: "BB", maxAdults: 2 }],
};

const roomRow = {
  id: "r1",
  propertyId: "p1",
  name: "Beach Villa",
  property: {
    id: "p1",
    supplierId: "sup1",
    name: "Velaa",
    slug: "velaa",
    atoll: "Noonu",
    island: "Velaa",
  },
};

function otherRoomRow() {
  return {
    ...roomRow,
    id: "r2",
    property: { ...roomRow.property, id: "p9", supplierId: "sup999" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.supplier.findUnique.mockResolvedValue(supplierRow);
  mockDb.supplier.update.mockResolvedValue(supplierRow);
  mockDb.property.findMany.mockResolvedValue([propertyRow]);
  mockDb.property.findUnique.mockResolvedValue({ id: "p1", supplierId: "sup1" });
  mockDb.room.findUnique.mockResolvedValue(roomRow);
  mockDb.room.findMany.mockResolvedValue([{ id: "r1" }]);
  mockDb.availability.groupBy.mockResolvedValue([
    { propertyId: "p1", _max: { updatedAt: new Date() } },
  ]);
  mockDb.supplierUpdateRequest.count.mockResolvedValue(2);
  mockDb.availability.findMany.mockResolvedValue([{ date: new Date(), inventory: 4 }]);
  mockDb.blackoutDate.findMany.mockResolvedValue([]);
  mockDb.supplierUpdateRequest.updateMany.mockResolvedValue({ count: 1 });
  mockDb.rate.findMany.mockResolvedValue([]);
  mockDb.promotion.findMany.mockResolvedValue([]);
  mockDb.package.findMany.mockResolvedValue([]);
  mockDb.allocation.findMany.mockResolvedValue([]);
  mockDb.rate.create.mockResolvedValue({ id: "rate1" });
  mockDb.rate.update.mockResolvedValue({ id: "rate1" });
  mockDb.rate.findUnique.mockResolvedValue({ id: "rate1", roomId: "r1" });
  mockDb.rate.delete.mockResolvedValue({});
  mockDb.promotion.create.mockResolvedValue({ id: "promo1" });
  mockDb.promotion.update.mockResolvedValue({ id: "promo1" });
  mockDb.promotion.delete.mockResolvedValue({});
  mockDb.package.create.mockResolvedValue({ id: "pkg1" });
  mockDb.package.update.mockResolvedValue({ id: "pkg1" });
  mockDb.package.delete.mockResolvedValue({});
  mockDb.allocation.upsert.mockResolvedValue({ id: "alloc1" });
  mockDb.availability.upsert.mockResolvedValue({});
  mockDb.blackoutDate.upsert.mockResolvedValue({});
  mockDb.blackoutDate.deleteMany.mockResolvedValue({ count: 1 });
});

describe("getSupplierPortal", () => {
  it("returns null for an invalid token", async () => {
    mockDb.supplier.findUnique.mockResolvedValue(null);
    expect(await getSupplierPortal({ data: "nope" })).toBeNull();
  });

  it("returns the dashboard with properties and stats", async () => {
    const portal = await getSupplierPortal({ data: "tok123" });
    expect(portal).not.toBeNull();
    expect(portal?.supplier.name).toBe("Velaa Private Island");
    expect(portal?.properties).toHaveLength(1);
    expect(portal?.openRequests).toBe(2);
    expect(portal?.staleProperties).toBe(0);
  });
});

describe("ownership validation", () => {
  it("rejects saving availability for a room the supplier does not own", async () => {
    mockDb.room.findUnique.mockResolvedValue(otherRoomRow());
    await expect(
      savePortalAvailability({
        data: { token: "tok123", entries: [{ roomId: "r2", date: "2026-09-01", inventory: 5 }] },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects portal access for a non-owned property in promotions", async () => {
    mockDb.property.findUnique.mockResolvedValue({ id: "p9", supplierId: "sup999" });
    await expect(
      savePromotion({
        data: {
          token: "tok123",
          propertyId: "p9",
          name: "Test",
          discountType: "PERCENTAGE",
          value: 10,
          validFrom: "2026-09-01",
          validTo: "2026-10-01",
          active: true,
        },
      }),
    ).rejects.toThrow(/property not found/i);
  });
});

describe("savePortalAvailability", () => {
  it("upserts inventory and closes open availability requests", async () => {
    const res = await savePortalAvailability({
      data: { token: "tok123", entries: [{ roomId: "r1", date: "2026-09-01", inventory: 3 }] },
    });
    expect(res.updated).toBe(1);
    expect(mockDb.availability.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId_date: { roomId: "r1", date: expect.any(Date) } } }),
    );
    expect(mockDb.supplierUpdateRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ supplierId: "sup1", type: "AVAILABILITY" }),
      }),
    );
  });
});

describe("blackout dates", () => {
  it("sets a blackout and zeroes inventory", async () => {
    await setBlackout({
      data: { token: "tok123", roomId: "r1", date: "2026-09-05", reason: "Maintenance" },
    });
    expect(mockDb.blackoutDate.upsert).toHaveBeenCalled();
    expect(mockDb.availability.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { inventory: 0 } }),
    );
  });

  it("clears a blackout", async () => {
    await clearBlackout({ data: { token: "tok123", roomId: "r1", date: "2026-09-05" } });
    expect(mockDb.blackoutDate.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: "r1", date: expect.any(Date) } }),
    );
  });
});

describe("rates", () => {
  it("creates a rate for an owned room", async () => {
    await savePortalRate({
      data: {
        token: "tok123",
        roomId: "r1",
        validFrom: "2026-09-01",
        validTo: "2026-09-30",
        amount: 420,
      },
    });
    expect(mockDb.rate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roomId: "r1", amount: 420, propertyId: "p1" }),
      }),
    );
  });

  it("updates an existing rate", async () => {
    await savePortalRate({
      data: {
        token: "tok123",
        id: "rate1",
        roomId: "r1",
        validFrom: "2026-09-01",
        validTo: "2026-09-30",
        amount: 500,
      },
    });
    expect(mockDb.rate.update).toHaveBeenCalledWith({
      where: { id: "rate1" },
      data: expect.any(Object),
    });
  });

  it("rejects a rate on a foreign room", async () => {
    mockDb.room.findUnique.mockResolvedValue(otherRoomRow());
    await expect(
      savePortalRate({
        data: {
          token: "tok123",
          roomId: "r2",
          validFrom: "2026-09-01",
          validTo: "2026-09-30",
          amount: 400,
        },
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("promotions / packages / allocations", () => {
  it("lists promotions", async () => {
    mockDb.promotion.findMany.mockResolvedValue([
      {
        id: "promo1",
        name: "Summer",
        roomId: "r1",
        room: { name: "Beach Villa" },
        discountType: "PERCENTAGE",
        value: 10,
        validFrom: new Date(),
        validTo: new Date(),
        active: true,
      },
    ]);
    const list = await getPromotions({ data: "tok123" });
    expect(list).toHaveLength(1);
    expect(list[0].roomName).toBe("Beach Villa");
  });

  it("lists packages and creates one", async () => {
    mockDb.package.findMany.mockResolvedValue([
      {
        id: "pkg1",
        name: "Honeymoon",
        description: null,
        price: 900,
        validFrom: new Date(),
        validTo: new Date(),
        included: ["Transfer"],
        active: true,
      },
    ]);
    expect(await getPackages({ data: "tok123" })).toHaveLength(1);
    await savePackage({
      data: {
        token: "tok123",
        propertyId: "p1",
        name: "Dive",
        price: 700,
        validFrom: "2026-09-01",
        validTo: "2026-12-01",
        included: ["Dives"],
        active: true,
      },
    });
    expect(mockDb.package.create).toHaveBeenCalled();
  });

  it("lists and saves allocations", async () => {
    mockDb.allocation.findMany.mockResolvedValue([
      { id: "alloc1", roomId: "r1", room: { name: "Beach Villa" }, date: new Date(), units: 2 },
    ]);
    const list = await getAllocations({ data: "tok123" });
    expect(list).toHaveLength(1);
    expect(list[0].roomName).toBe("Beach Villa");
    await saveAllocation({ data: { token: "tok123", roomId: "r1", date: "2026-09-10", units: 3 } });
    expect(mockDb.allocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ units: 3 }) }),
    );
  });

  it("deletes a promotion", async () => {
    await deletePromotion({ data: { token: "tok123", id: "promo1" } });
    expect(mockDb.promotion.delete).toHaveBeenCalledWith({ where: { id: "promo1" } });
  });
});

describe("portal access helpers", () => {
  it("returns an existing token and link", async () => {
    const res = await getSupplierPortalAccess({ data: "sup1" });
    expect(res).toMatchObject({ token: "tok123", link: "/supplier/tok123" });
  });

  it("generates a token when missing", async () => {
    mockDb.supplier.findUnique.mockResolvedValue({ ...supplierRow, accessToken: null });
    mockDb.supplier.update.mockResolvedValue({ ...supplierRow, accessToken: "gen" });
    const res = await getSupplierPortalAccess({ data: "sup1" });
    expect(mockDb.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accessToken: expect.any(String) }),
      }),
    );
    expect(res?.link).toMatch(/^\/supplier\//);
  });

  it("emails the portal access link", async () => {
    const res = await sendSupplierPortalAccess({ data: "sup1" });
    expect(res).toMatchObject({ sent: true, email: "res@velaa.com" });
    const { notifySupplierPortalAccess } = await import("@/lib/notifications/service");
    expect(notifySupplierPortalAccess as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "res@velaa.com", link: "/supplier/tok123" }),
    );
  });
});
