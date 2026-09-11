import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type { AvailabilityHealthDTO, ExpiringRateDTO, RoomCalendarDTO } from "@/lib/types";

const FRESH_DAYS = 3;
const EXPIRED_DAYS = 14;

function dayStatus(inventory: number | null): RoomCalendarDTO["days"][number]["status"] {
  if (inventory === null) return "NO_DATA";
  if (inventory === 0) return "SOLD_OUT";
  if (inventory <= 5) return "LOW";
  return "AVAILABLE";
}

/**
 * Availability Health — how fresh each property's inventory is, based on the
 * most recent availability record update per property.
 */
export async function computeAvailabilityHealth(): Promise<AvailabilityHealthDTO> {
  const properties = await db.property.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  });

  // Latest availability update per property (aggregate max updatedAt per property).
  const rows = await db.availability.groupBy({
    by: ["propertyId"],
    _max: { updatedAt: true },
  });
  const latestByProperty = new Map(rows.map((r) => [r.propertyId, r._max.updatedAt]));

  const now = Date.now();
  let fresh = 0;
  let needsUpdate = 0;
  let expired = 0;
  let noData = 0;
  const healthRows = properties.map((p) => {
    const last = latestByProperty.get(p.id);
    if (!last) {
      noData += 1;
      return { propertyId: p.id, name: p.name, status: "NO_DATA" as const };
    }
    const daysSince = Math.floor((now - last.getTime()) / 86_400_000);
    const status =
      daysSince < FRESH_DAYS ? "FRESH" : daysSince < EXPIRED_DAYS ? "NEEDS_UPDATE" : "EXPIRED";
    if (status === "FRESH") fresh += 1;
    else if (status === "NEEDS_UPDATE") needsUpdate += 1;
    else expired += 1;
    return {
      propertyId: p.id,
      name: p.name,
      status: status as "FRESH" | "NEEDS_UPDATE" | "EXPIRED",
      lastImportedAt: last.toISOString(),
      daysSince,
    };
  });

  healthRows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalProperties: properties.length,
    fresh,
    needsUpdate,
    expired,
    noData,
    rows: healthRows,
  };
}

export const getAvailabilityHealth = createServerFn({ method: "GET" }).handler(async () =>
  computeAvailabilityHealth(),
);

/**
 * Expiring Rates — rates whose validity ends within the next `days` (default 30).
 * Guards against quotes being generated from expired rates.
 */
export async function computeExpiringRates(days = 30): Promise<ExpiringRateDTO[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86_400_000);

  const rates = await db.rate.findMany({
    where: { validTo: { gte: now, lte: horizon } },
    include: { property: { select: { name: true } }, room: { select: { name: true } } },
    orderBy: { validTo: "asc" },
  });

  return rates.map((r) => ({
    rateId: r.id,
    propertyName: r.property.name,
    roomName: r.room.name,
    amount: Number(r.amount),
    validTo: r.validTo.toISOString().slice(0, 10),
    daysRemaining: Math.max(0, Math.round((r.validTo.getTime() - now.getTime()) / 86_400_000)),
  }));
}

export const getExpiringRates = createServerFn({ method: "GET" })
  .validator((days?: number) => days)
  .handler(async ({ data }) => computeExpiringRates(data ?? 30));

/**
 * Room Calendar — inventory for a room over the next `days` (default 30),
 * color-coded by availability.
 */
export async function computeRoomCalendar(opts: {
  roomId: string;
  days?: number;
}): Promise<RoomCalendarDTO | null> {
  const room = await db.room.findUnique({
    where: { id: opts.roomId },
    include: { property: { select: { name: true } } },
  });
  if (!room) return null;

  const horizon = opts.days ?? 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + horizon * 86_400_000);

  const records = await db.availability.findMany({
    where: { roomId: room.id, date: { gte: start, lt: end } },
    select: { date: true, inventory: true },
  });
  const byDate = new Map(records.map((r) => [r.date.toISOString().slice(0, 10), r.inventory]));

  const days = Array.from({ length: horizon }, (_, i) => {
    const date = new Date(start.getTime() + i * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const inventory = byDate.get(key) ?? null;
    return {
      date: key,
      inventory,
      status: dayStatus(inventory),
    };
  });

  return {
    roomId: room.id,
    roomName: room.name,
    propertyName: room.property.name,
    days,
  };
}

export const getRoomCalendar = createServerFn({ method: "GET" })
  .validator((input: { roomId: string; days?: number }) => input)
  .handler(async ({ data }) => computeRoomCalendar(data));
