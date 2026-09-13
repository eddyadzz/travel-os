import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type { AddonDTO, PropertyDTO, PropertyType, RoomDTO } from "@/lib/types";
import type { Prisma, Addon } from "@/generated/prisma/client";

export const PROPERTY_TYPE_LABELS: Record<string, PropertyType> = {
  RESORT: "Resort",
  HOTEL: "Hotel",
  GUESTHOUSE: "Guesthouse",
  SAFARI_BOAT: "Safari Boat",
};

const ADDON_PRICING_LABELS: Record<string, AddonDTO["pricing"]> = {
  PER_PERSON: "Per Person",
  PER_ROOM: "Per Room",
  FIXED: "Fixed Amount",
};

function toRoomDTO(
  room: {
    maxAdults: number;
    maxChildren: number;
    extraGuestRate: { toNumber(): number } | null;
    boardBasis: string | null;
    size: string | null;
    rates: Array<{ amount: { toNumber(): number } }>;
    availabilities: Array<{ inventory: number }>;
  } & { id: string; name: string },
): RoomDTO {
  const lowRate =
    room.rates.length > 0 ? Math.min(...room.rates.map((r) => r.amount.toNumber())) : 0;
  return {
    id: room.id,
    name: room.name,
    maxGuests: room.maxAdults + room.maxChildren,
    baseGuests: room.maxAdults,
    nightlyRate: room.rates.length > 0 ? lowRate : 0,
    extraGuestRate: Number(room.extraGuestRate ?? 0),
    boardBasis: room.boardBasis ?? "",
    size: room.size ?? "",
    availableUnits: room.availabilities[0]?.inventory ?? 0,
  };
}

function toAddonDTO(addon: Addon): AddonDTO {
  return {
    id: addon.id,
    name: addon.name,
    description: addon.description,
    pricing: ADDON_PRICING_LABELS[addon.pricingType] ?? "Fixed Amount",
    price: Number(addon.amount),
    category: addon.category,
  };
}

type PropertyWithRelations = Prisma.PropertyGetPayload<{
  include: {
    rooms: { include: { rates: true; availabilities: { orderBy: { date: "desc" }; take: 1 } } };
    addons: { where: { active: true } };
  };
}>;

function toPropertyDTO(property: PropertyWithRelations): PropertyDTO {
  const rates = property.rooms.flatMap((r) => r.rates);
  const fromPrice = rates.length > 0 ? Math.min(...rates.map((r) => Number(r.amount))) : 0;

  return {
    id: property.id,
    slug: property.slug,
    name: property.name,
    type: PROPERTY_TYPE_LABELS[property.type] ?? "Hotel",
    location: property.island,
    atoll: property.atoll,
    description: property.description,
    highlights: property.highlights,
    image: property.gallery[0] ?? "",
    gallery: property.gallery,
    amenities: property.amenities,
    transfer: {
      method: property.transferMethod,
      duration: property.transferDuration,
      pricePerPerson: Number(property.transferPricePerPerson),
    },
    featured: property.featured,
    rating: Number(property.rating),
    fromPrice,
    rooms: property.rooms.map(toRoomDTO),
    addons: property.addons.map(toAddonDTO),
  };
}

const propertyInclude = {
  rooms: {
    include: { rates: true, availabilities: { orderBy: { date: "desc" as const }, take: 1 } },
  },
  addons: { where: { active: true } },
} satisfies Prisma.PropertyInclude;

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const listProperties = createServerFn({ method: "GET" }).handler(async () => {
  const properties = await db.property.findMany({
    where: { status: "ACTIVE" },
    include: propertyInclude,
    orderBy: [{ featured: "desc" }, { rating: "desc" }],
  });
  return properties.map(toPropertyDTO);
});

export const getPropertyById = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const property = await db.property.findFirst({
      where: { id, status: "ACTIVE" },
      include: propertyInclude,
    });
    return property ? toPropertyDTO(property) : null;
  });

export const listPropertiesAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const properties = await db.property.findMany({
    include: propertyInclude,
    orderBy: [{ featured: "desc" }, { rating: "desc" }],
  });
  return properties.map((p) => ({ ...toPropertyDTO(p), status: p.status }));
});

// Soft delete: properties hold booking history, so hide rather than destroy.
export const deleteProperty = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.property.update({ where: { id }, data: { status: "HIDDEN" } });
    return { ok: true };
  });

export type CreatePropertyInput = {
  slug: string;
  name: string;
  type: string;
  atoll: string;
  island: string;
  description: string;
  highlights: string[];
  amenities: string[];
  gallery: string[];
  transferMethod: string;
  transferDuration: string;
  transferPricePerPerson: number;
  featured?: boolean;
  rating?: number;
  status?: string;
  addonIds?: string[];
  seoTitle?: string;
  seoDescription?: string;
  latitude?: number | null;
  longitude?: number | null;
  supplierId?: string | null;
};

export type UpdatePropertyInput = { id: string; data: Partial<CreatePropertyInput> };

export const createProperty = createServerFn({ method: "POST" })
  .validator((input: CreatePropertyInput) => input)
  .handler(async ({ data: input }) => {
    const property = await db.property.create({
      data: {
        slug: input.slug,
        name: input.name,
        type: input.type as Prisma.PropertyCreateInput["type"],
        atoll: input.atoll,
        island: input.island,
        description: input.description,
        highlights: input.highlights,
        amenities: input.amenities,
        gallery: input.gallery,
        transferMethod: input.transferMethod,
        transferDuration: input.transferDuration,
        transferPricePerPerson: input.transferPricePerPerson,
        featured: input.featured ?? false,
        rating: input.rating ?? 0,
        ...(input.status ? { status: input.status as Prisma.PropertyCreateInput["status"] } : {}),
        ...(input.addonIds ? { addons: { connect: input.addonIds.map((id) => ({ id })) } } : {}),
        ...(input.seoTitle ? { seoTitle: input.seoTitle } : {}),
        ...(input.seoDescription ? { seoDescription: input.seoDescription } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      } as Prisma.PropertyCreateInput,
      include: propertyInclude,
    });
    return toPropertyDTO(property);
  });

export const updateProperty = createServerFn({ method: "POST" })
  .validator((input: UpdatePropertyInput) => input)
  .handler(async ({ data: { id, data } }) => {
    const property = await db.property.update({
      where: { id },
      data: {
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined
          ? { type: data.type as Prisma.PropertyUpdateInput["type"] }
          : {}),
        ...(data.atoll !== undefined ? { atoll: data.atoll } : {}),
        ...(data.island !== undefined ? { island: data.island } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.highlights !== undefined ? { highlights: data.highlights } : {}),
        ...(data.amenities !== undefined ? { amenities: data.amenities } : {}),
        ...(data.gallery !== undefined ? { gallery: data.gallery } : {}),
        ...(data.transferMethod !== undefined ? { transferMethod: data.transferMethod } : {}),
        ...(data.transferDuration !== undefined ? { transferDuration: data.transferDuration } : {}),
        ...(data.transferPricePerPerson !== undefined
          ? { transferPricePerPerson: data.transferPricePerPerson }
          : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.status !== undefined
          ? { status: data.status as Prisma.PropertyUpdateInput["status"] }
          : {}),
        ...(data.addonIds ? { addons: { set: data.addonIds.map((id) => ({ id })) } } : {}),
        ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle } : {}),
        ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        ...(data.supplierId !== undefined ? { supplierId: data.supplierId || null } : {}),
      } as Prisma.PropertyUpdateInput,
      include: propertyInclude,
    });
    return toPropertyDTO(property);
  });
