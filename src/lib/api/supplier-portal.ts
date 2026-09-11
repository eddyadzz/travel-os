import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type {
  AllocationDTO,
  PackageDTO,
  PromotionDTO,
  SupplierPortalAvailabilityRow,
  SupplierPortalDTO,
  SupplierPortalRateDTO,
} from "@/lib/types";

const DAY = 86_400_000;

async function supplierFromToken(token: string) {
  return db.supplier.findUnique({ where: { accessToken: token } });
}

async function assertOwnedRoom(supplierId: string, roomId: string) {
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: {
      property: {
        select: { id: true, supplierId: true, name: true, slug: true, atoll: true, island: true },
      },
    },
  });
  if (!room || room.property.supplierId !== supplierId) throw new Error("Room not found");
  return room;
}

async function assertOwnedProperty(supplierId: string, propertyId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, supplierId: true },
  });
  if (!property || property.supplierId !== supplierId) throw new Error("Property not found");
  return property;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Dashboard -------------------------------------------------------------------------------------

export const getSupplierPortal = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<SupplierPortalDTO | null> => {
    const supplier = await supplierFromToken(token);
    if (!supplier) return null;

    const properties = await db.property.findMany({
      where: { supplierId: supplier.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        atoll: true,
        island: true,
        rooms: {
          select: { id: true, name: true, boardBasis: true, maxAdults: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    const [openRequests, availabilityRows] = await Promise.all([
      db.supplierUpdateRequest.count({
        where: { supplierId: supplier.id, status: { in: ["REQUESTED", "RECEIVED"] } },
      }),
      db.availability.groupBy({
        by: ["propertyId"],
        _max: { updatedAt: true },
      }),
    ]);

    const latestByProperty = new Map(availabilityRows.map((r) => [r.propertyId, r._max.updatedAt]));
    const staleProperties = properties.filter((p) => {
      const last = latestByProperty.get(p.id);
      if (!last) return true;
      return Date.now() - last.getTime() > 3 * DAY;
    }).length;

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        type: supplier.type,
        ...(supplier.email ? { email: supplier.email } : {}),
      },
      properties,
      openRequests,
      staleProperties,
    };
  });

// Availability ----------------------------------------------------------------------------------

export const getPortalAvailability = createServerFn({ method: "GET" })
  .validator((input: { token: string; roomId: string; days?: number }) => input)
  .handler(async ({ data }): Promise<SupplierPortalAvailabilityRow[] | null> => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) return null;
    await assertOwnedRoom(supplier.id, data.roomId);

    const horizon = data.days ?? 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + horizon * DAY);

    const [avail, blackouts] = await Promise.all([
      db.availability.findMany({
        where: { roomId: data.roomId, date: { gte: start, lt: end } },
        select: { date: true, inventory: true },
      }),
      db.blackoutDate.findMany({
        where: { roomId: data.roomId, date: { gte: start, lt: end } },
        select: { date: true },
      }),
    ]);
    const byDate = new Map(avail.map((r) => [iso(r.date), r.inventory]));
    const blacked = new Set(blackouts.map((b) => iso(b.date)));

    return Array.from({ length: horizon }, (_, i) => {
      const key = iso(new Date(start.getTime() + i * DAY));
      return {
        roomId: data.roomId,
        date: key,
        inventory: byDate.get(key) ?? 0,
        blackedOut: blacked.has(key),
      };
    });
  });

export const savePortalAvailability = createServerFn({ method: "POST" })
  .validator(
    (input: { token: string; entries: { roomId: string; date: string; inventory: number }[] }) =>
      input,
  )
  .handler(async ({ data }): Promise<{ updated: number }> => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");

    let updated = 0;
    for (const e of data.entries) {
      const room = await assertOwnedRoom(supplier.id, e.roomId);
      const date = new Date(`${e.date}T00:00:00.000Z`);
      const inventory = Math.max(0, Math.floor(e.inventory));
      await db.availability.upsert({
        where: { roomId_date: { roomId: e.roomId, date } },
        create: { propertyId: room.propertyId, roomId: e.roomId, date, inventory },
        update: { inventory },
      });
      updated += 1;
    }

    // Real-time updates close the availability loop — no spreadsheet import needed.
    await db.supplierUpdateRequest.updateMany({
      where: {
        supplierId: supplier.id,
        type: "AVAILABILITY",
        status: { in: ["REQUESTED", "RECEIVED"] },
      },
      data: { status: "IMPORTED", importedAt: new Date() },
    });
    return { updated };
  });

// Blackout dates --------------------------------------------------------------------------------

export const setBlackout = createServerFn({ method: "POST" })
  .validator((input: { token: string; roomId: string; date: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    const room = await assertOwnedRoom(supplier.id, data.roomId);
    const date = new Date(`${data.date}T00:00:00.000Z`);
    await db.blackoutDate.upsert({
      where: { roomId_date: { roomId: data.roomId, date } },
      create: {
        roomId: data.roomId,
        date,
        ...(data.reason ? { reason: data.reason } : {}),
      },
      update: data.reason ? { reason: data.reason } : {},
    });
    await db.availability.upsert({
      where: { roomId_date: { roomId: data.roomId, date } },
      create: { propertyId: room.propertyId, roomId: data.roomId, date, inventory: 0 },
      update: { inventory: 0 },
    });
    return { ok: true };
  });

export const clearBlackout = createServerFn({ method: "POST" })
  .validator((input: { token: string; roomId: string; date: string }) => input)
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    await assertOwnedRoom(supplier.id, data.roomId);
    const date = new Date(`${data.date}T00:00:00.000Z`);
    await db.blackoutDate.deleteMany({ where: { roomId: data.roomId, date } });
    return { ok: true };
  });

// Rates -----------------------------------------------------------------------------------------

export const getPortalRates = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<SupplierPortalRateDTO[]> => {
    const supplier = await supplierFromToken(token);
    if (!supplier) return [];

    const propertyIds = await db.property.findMany({
      where: { supplierId: supplier.id },
      select: { id: true },
    });
    const rates = await db.rate.findMany({
      where: { propertyId: { in: propertyIds.map((p) => p.id) } },
      include: {
        property: { select: { name: true } },
        room: { select: { name: true } },
      },
      orderBy: { validFrom: "desc" },
      take: 500,
    });
    return rates.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      roomName: r.room.name,
      propertyId: r.propertyId,
      propertyName: r.property.name,
      validFrom: iso(r.validFrom),
      validTo: iso(r.validTo),
      amount: Number(r.amount),
      currency: r.currency,
      ...(r.season ? { season: r.season } : {}),
    }));
  });

export const savePortalRate = createServerFn({ method: "POST" })
  .validator(
    (input: {
      token: string;
      id?: string;
      roomId: string;
      validFrom: string;
      validTo: string;
      amount: number;
      season?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    const room = await assertOwnedRoom(supplier.id, data.roomId);
    const validFrom = new Date(`${data.validFrom}T00:00:00.000Z`);
    const validTo = new Date(`${data.validTo}T00:00:00.000Z`);
    const amount = Number(data.amount);
    if (!(amount > 0)) throw new Error("Amount must be positive");

    if (data.id) {
      const existing = await db.rate.findUnique({ where: { id: data.id } });
      if (!existing || existing.roomId !== data.roomId) throw new Error("Rate not found");
      await db.rate.update({
        where: { id: data.id },
        data: { validFrom, validTo, amount, ...(data.season ? { season: data.season } : {}) },
      });
    } else {
      await db.rate.create({
        data: {
          propertyId: room.propertyId,
          roomId: data.roomId,
          validFrom,
          validTo,
          amount,
          ...(data.season ? { season: data.season } : {}),
        },
      });
    }
    await db.supplierUpdateRequest.updateMany({
      where: { supplierId: supplier.id, type: "RATES", status: { in: ["REQUESTED", "RECEIVED"] } },
      data: { status: "IMPORTED", importedAt: new Date() },
    });
    return { ok: true };
  });

export const deletePortalRate = createServerFn({ method: "POST" })
  .validator((input: { token: string; id: string }) => input)
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    const rate = await db.rate.findUnique({ where: { id: data.id } });
    if (!rate) throw new Error("Rate not found");
    await assertOwnedRoom(supplier.id, rate.roomId);
    await db.rate.delete({ where: { id: data.id } });
    return { ok: true };
  });

// Promotions ------------------------------------------------------------------------------------

export const getPromotions = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<PromotionDTO[]> => {
    const supplier = await supplierFromToken(token);
    if (!supplier) return [];
    const propertyIds = await db.property.findMany({
      where: { supplierId: supplier.id },
      select: { id: true },
    });
    const rows = await db.promotion.findMany({
      where: { propertyId: { in: propertyIds.map((p) => p.id) } },
      include: { room: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ...(r.roomId && r.room ? { roomId: r.roomId, roomName: r.room.name } : {}),
      discountType: r.discountType,
      value: Number(r.value),
      validFrom: iso(r.validFrom),
      validTo: iso(r.validTo),
      active: r.active,
    }));
  });

export const savePromotion = createServerFn({ method: "POST" })
  .validator(
    (input: {
      token: string;
      id?: string;
      propertyId: string;
      roomId?: string;
      name: string;
      discountType: string;
      value: number;
      validFrom: string;
      validTo: string;
      active: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    await assertOwnedProperty(supplier.id, data.propertyId);
    if (data.roomId) await assertOwnedRoom(supplier.id, data.roomId);
    const discountType: "PERCENTAGE" | "FIXED" =
      data.discountType === "FIXED" ? "FIXED" : "PERCENTAGE";
    const payload = {
      propertyId: data.propertyId,
      ...(data.roomId ? { roomId: data.roomId } : {}),
      name: data.name,
      discountType,
      value: Number(data.value),
      validFrom: new Date(`${data.validFrom}T00:00:00.000Z`),
      validTo: new Date(`${data.validTo}T00:00:00.000Z`),
      active: data.active,
    };
    if (data.id) {
      await db.promotion.update({ where: { id: data.id }, data: payload });
    } else {
      await db.promotion.create({ data: payload });
    }
    return { ok: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .validator((input: { token: string; id: string }) => input)
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    await db.promotion.delete({ where: { id: data.id } });
    return { ok: true };
  });

// Packages --------------------------------------------------------------------------------------

export const getPackages = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<PackageDTO[]> => {
    const supplier = await supplierFromToken(token);
    if (!supplier) return [];
    const propertyIds = await db.property.findMany({
      where: { supplierId: supplier.id },
      select: { id: true },
    });
    const rows = await db.package.findMany({
      where: { propertyId: { in: propertyIds.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ...(r.description ? { description: r.description } : {}),
      price: Number(r.price),
      validFrom: iso(r.validFrom),
      validTo: iso(r.validTo),
      included: r.included,
      active: r.active,
    }));
  });

export const savePackage = createServerFn({ method: "POST" })
  .validator(
    (input: {
      token: string;
      id?: string;
      propertyId: string;
      name: string;
      description?: string;
      price: number;
      validFrom: string;
      validTo: string;
      included: string[];
      active: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    await assertOwnedProperty(supplier.id, data.propertyId);
    const payload = {
      propertyId: data.propertyId,
      name: data.name,
      ...(data.description ? { description: data.description } : {}),
      price: Number(data.price),
      validFrom: new Date(`${data.validFrom}T00:00:00.000Z`),
      validTo: new Date(`${data.validTo}T00:00:00.000Z`),
      included: data.included,
      active: data.active,
    };
    if (data.id) {
      await db.package.update({ where: { id: data.id }, data: payload });
    } else {
      await db.package.create({ data: payload });
    }
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .validator((input: { token: string; id: string }) => input)
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    await db.package.delete({ where: { id: data.id } });
    return { ok: true };
  });

// Allocations -----------------------------------------------------------------------------------

export const getAllocations = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<AllocationDTO[]> => {
    const supplier = await supplierFromToken(token);
    if (!supplier) return [];
    const roomIds = await db.room.findMany({
      where: { property: { supplierId: supplier.id } },
      select: { id: true },
    });
    const rows = await db.allocation.findMany({
      where: { roomId: { in: roomIds.map((r) => r.id) } },
      include: { room: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      roomName: r.room.name,
      date: iso(r.date),
      units: r.units,
    }));
  });

export const saveAllocation = createServerFn({ method: "POST" })
  .validator((input: { token: string; roomId: string; date: string; units: number }) => input)
  .handler(async ({ data }) => {
    const supplier = await supplierFromToken(data.token);
    if (!supplier) throw new Error("Invalid access token");
    await assertOwnedRoom(supplier.id, data.roomId);
    const date = new Date(`${data.date}T00:00:00.000Z`);
    const units = Math.max(0, Math.floor(data.units));
    await db.allocation.upsert({
      where: { roomId_date: { roomId: data.roomId, date } },
      create: { roomId: data.roomId, date, units },
      update: { units },
    });
    return { ok: true };
  });
