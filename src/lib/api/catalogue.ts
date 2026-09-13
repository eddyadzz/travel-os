import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Admin catalogue detail (all rooms incl. closed, all rates, all addons)
// ---------------------------------------------------------------------------

export const getPropertyAdmin = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const property = await db.property.findUnique({
      where: { id },
      include: {
        rooms: {
          orderBy: { sortOrder: "asc" },
          include: { rates: { orderBy: { validFrom: "asc" } } },
        },
        addons: { orderBy: { sortOrder: "asc" } },
        supplier: true,
      },
    });
    if (!property) return null;
    return {
      ...property,
      transferPricePerPerson: Number(property.transferPricePerPerson),
      rating: Number(property.rating),
      rooms: property.rooms.map((r) => ({
        ...r,
        extraGuestRate: r.extraGuestRate ? Number(r.extraGuestRate) : null,
        rates: r.rates.map((rate) => ({
          ...rate,
          amount: Number(rate.amount),
          validFrom: rate.validFrom.toISOString().slice(0, 10),
          validTo: rate.validTo.toISOString().slice(0, 10),
        })),
      })),
      addons: property.addons.map((a) => ({ ...a, amount: Number(a.amount) })),
    };
  });

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const createRoom = createServerFn({ method: "POST" })
  .validator(
    (input: {
      propertyId: string;
      name: string;
      maxAdults?: number;
      maxChildren?: number;
      extraGuestRate?: number;
      boardBasis?: string;
      size?: string;
      description?: string;
      pricingMethod?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const room = await db.room.create({
      data: {
        propertyId: data.propertyId,
        name: data.name,
        ...(data.maxAdults !== undefined ? { maxAdults: data.maxAdults } : {}),
        ...(data.maxChildren !== undefined ? { maxChildren: data.maxChildren } : {}),
        ...(data.extraGuestRate !== undefined ? { extraGuestRate: data.extraGuestRate } : {}),
        ...(data.boardBasis ? { boardBasis: data.boardBasis } : {}),
        ...(data.size ? { size: data.size } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.pricingMethod ? { pricingMethod: data.pricingMethod as Prisma.RoomCreateInput["pricingMethod"] } : {}),
      } as Prisma.RoomUncheckedCreateInput,
    });
    return { id: room.id };
  });

export const updateRoom = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      name?: string;
      maxAdults?: number;
      maxChildren?: number;
      extraGuestRate?: number;
      boardBasis?: string;
      size?: string;
      description?: string;
      status?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const room = await db.room.update({
      where: { id: data.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.maxAdults !== undefined ? { maxAdults: data.maxAdults } : {}),
        ...(data.maxChildren !== undefined ? { maxChildren: data.maxChildren } : {}),
        ...(data.extraGuestRate !== undefined ? { extraGuestRate: data.extraGuestRate } : {}),
        ...(data.boardBasis !== undefined ? { boardBasis: data.boardBasis } : {}),
        ...(data.size !== undefined ? { size: data.size } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status as Prisma.RoomUpdateInput["status"] } : {}),
      } as Prisma.RoomUncheckedUpdateInput,
    });
    return { id: room.id };
  });

// Soft delete: a room with bookings cannot be hard-deleted (FK), so close it.
export const deleteRoom = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.room.update({ where: { id }, data: { status: "CLOSED" } });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

export const createRate = createServerFn({ method: "POST" })
  .validator(
    (input: {
      propertyId: string;
      roomId: string;
      validFrom: string;
      validTo: string;
      amount: number;
      currency?: string;
      season?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const rate = await db.rate.create({
      data: {
        propertyId: data.propertyId,
        roomId: data.roomId,
        validFrom: new Date(data.validFrom),
        validTo: new Date(data.validTo),
        amount: data.amount,
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.season ? { season: data.season } : {}),
      } as Prisma.RateUncheckedCreateInput,
    });
    return { id: rate.id };
  });

export const updateRate = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      validFrom?: string;
      validTo?: string;
      amount?: number;
      currency?: string;
      season?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const rate = await db.rate.update({
      where: { id: data.id },
      data: {
        ...(data.validFrom ? { validFrom: new Date(data.validFrom) } : {}),
        ...(data.validTo ? { validTo: new Date(data.validTo) } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.season !== undefined ? { season: data.season } : {}),
      } as Prisma.RateUncheckedUpdateInput,
    });
    return { id: rate.id };
  });

export const deleteRate = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.rate.delete({ where: { id } });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

export const createAddon = createServerFn({ method: "POST" })
  .validator(
    (input: {
      propertyId?: string;
      name: string;
      description?: string;
      pricingType: string;
      amount: number;
      category: string;
      active?: boolean;
      sortOrder?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const addon = await db.addon.create({
      data: {
        ...(data.propertyId ? { propertyId: data.propertyId } : {}),
        name: data.name,
        description: data.description ?? "",
        pricingType: data.pricingType as Prisma.AddonCreateInput["pricingType"],
        amount: data.amount,
        category: data.category as Prisma.AddonCreateInput["category"],
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      } as Prisma.AddonUncheckedCreateInput,
    });
    return { id: addon.id };
  });

export const updateAddon = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      name?: string;
      description?: string;
      pricingType?: string;
      amount?: number;
      category?: string;
      active?: boolean;
      sortOrder?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const addon = await db.addon.update({
      where: { id: data.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.pricingType !== undefined ? { pricingType: data.pricingType as Prisma.AddonUpdateInput["pricingType"] } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.category !== undefined ? { category: data.category as Prisma.AddonUpdateInput["category"] } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      } as Prisma.AddonUncheckedUpdateInput,
    });
    return { id: addon.id };
  });

// Soft delete: add-ons are referenced by booking snapshots.
export const deleteAddon = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.addon.update({ where: { id }, data: { active: false } });
    return { ok: true };
  });
