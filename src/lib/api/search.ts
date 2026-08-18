import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { nightsBetween } from "@/lib/pricing";
import { PROPERTY_TYPE_LABELS } from "@/lib/api/properties";
import type { Availability, Rate } from "@/generated/prisma/client";

export type AvailabilityStatus = "AVAILABLE" | "LOW_AVAILABILITY" | "ON_REQUEST" | "SOLD_OUT";

export type SearchRoomResult = {
  roomId: string;
  roomName: string;
  nightlyRate: number;
  status: AvailabilityStatus;
  minInventory: number | null;
};

export type SearchPropertyResult = {
  id: string;
  slug: string;
  name: string;
  type: string;
  location: string;
  atoll: string;
  image: string;
  rating: number;
  transfer: { method: string; duration: string; pricePerPerson: number };
  fromPrice: number;
  bestStatus: AvailabilityStatus;
  roomCount: number;
  rooms: SearchRoomResult[];
};

export type SearchParams = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  propertyType?: string;
  transfer?: string;
};

const STATUS_SEVERITY: Record<AvailabilityStatus, number> = {
  AVAILABLE: 0,
  LOW_AVAILABILITY: 1,
  ON_REQUEST: 2,
  SOLD_OUT: 3,
};

/** Among a room's matching rates, picks the one the booking engine would use (latest season wins). */
function pickApplicableRate(rates: Rate[]): Rate | undefined {
  if (rates.length === 0) return undefined;
  return rates.reduce((best, r) => (r.validFrom > best.validFrom ? r : best));
}

/**
 * Searches properties that can host the requested guests for the full stay.
 * For each room: valid rate for the dates must exist, the room must fit the
 * guests, and minimum inventory across the stay must be >= 1. `fromPrice` is
 * the lowest actual nightly rate for the selected dates (not marketing data).
 */
export const searchAvailableProperties = createServerFn({ method: "GET" })
  .validator((input: SearchParams) => input)
  .handler(async ({ data }) => {
    const nights = nightsBetween(data.checkIn, data.checkOut);
    if (nights <= 0) return [];

    const checkIn = new Date(`${data.checkIn}T00:00:00.000Z`);
    const checkOut = new Date(`${data.checkOut}T00:00:00.000Z`);
    const guests = data.adults + data.children;

    const properties = await db.property.findMany({
      where: { status: "ACTIVE" },
      include: { rooms: { where: { status: "ACTIVE" } } },
      orderBy: [{ featured: "desc" }, { rating: "desc" }],
    });

    const roomIds = properties.flatMap((p) => p.rooms).map((r) => r.id);

    const [rates, availability] = await Promise.all([
      db.rate.findMany({
        where: { roomId: { in: roomIds }, validFrom: { lte: checkIn }, validTo: { gte: checkOut } },
      }),
      db.availability.findMany({
        where: { roomId: { in: roomIds }, date: { gte: checkIn, lt: checkOut } },
      }),
    ]);

    const ratesByRoom = new Map<string, Rate[]>();
    for (const rate of rates) {
      const list = ratesByRoom.get(rate.roomId) ?? [];
      list.push(rate);
      ratesByRoom.set(rate.roomId, list);
    }

    const availabilityByRoom = new Map<string, Availability[]>();
    for (const record of availability) {
      const list = availabilityByRoom.get(record.roomId) ?? [];
      list.push(record);
      availabilityByRoom.set(record.roomId, list);
    }

    const results: SearchPropertyResult[] = [];
    for (const property of properties) {
      if (data.transfer && data.transfer !== "all") {
        const method = property.transferMethod.toLowerCase();
        const wanted = data.transfer.toLowerCase();
        if (!method.includes(wanted)) continue;
      }
      if (data.propertyType && data.propertyType !== "all") {
        if (PROPERTY_TYPE_LABELS[property.type] !== data.propertyType) continue;
      }

      const roomResults: SearchRoomResult[] = [];
      for (const room of property.rooms) {
        if (guests > room.maxAdults + room.maxChildren) continue;

        const applicable = pickApplicableRate(ratesByRoom.get(room.id) ?? []);
        if (!applicable) continue;

        const records = availabilityByRoom.get(room.id) ?? [];
        let status: AvailabilityStatus;
        let minInventory: number | null;
        if (records.length === 0) {
          status = "ON_REQUEST";
          minInventory = null;
        } else {
          minInventory = Math.min(...records.map((a) => a.inventory));
          status =
            minInventory >= 1 ? (minInventory > 5 ? "AVAILABLE" : "LOW_AVAILABILITY") : "SOLD_OUT";
        }
        if (status === "SOLD_OUT") continue;

        roomResults.push({
          roomId: room.id,
          roomName: room.name,
          nightlyRate: Number(applicable.amount),
          status,
          minInventory,
        });
      }

      if (roomResults.length === 0) continue;

      const fromPrice = Math.min(...roomResults.map((r) => r.nightlyRate));
      const bestStatus = roomResults.reduce<AvailabilityStatus>(
        (best, r) => (STATUS_SEVERITY[r.status] < STATUS_SEVERITY[best] ? r.status : best),
        "SOLD_OUT",
      );

      results.push({
        id: property.id,
        slug: property.slug,
        name: property.name,
        type: PROPERTY_TYPE_LABELS[property.type] ?? "Hotel",
        location: property.island,
        atoll: property.atoll,
        image: property.gallery[0] ?? "",
        rating: Number(property.rating),
        transfer: {
          method: property.transferMethod,
          duration: property.transferDuration,
          pricePerPerson: Number(property.transferPricePerPerson),
        },
        fromPrice,
        bestStatus,
        roomCount: roomResults.length,
        rooms: roomResults,
      });
    }

    await db.searchLog.create({
      data: {
        checkIn,
        checkOut,
        adults: data.adults,
        children: data.children,
        ...(data.propertyType ? { propertyType: data.propertyType } : {}),
        ...(data.transfer ? { transfer: data.transfer } : {}),
        resultCount: results.length,
      },
    });

    return results;
  });
