export type AvailabilityRecord = {
  date: Date;
  inventory: number;
};

export type AvailabilityLookup = (args: {
  roomId: string;
  date: Date;
}) => Promise<AvailabilityRecord | null>;

export type CheckAvailabilityResult = {
  available: boolean;
  reason?: string;
  blockedDates: string[];
};

/**
 * Checks whether a room has enough inventory for the full requested stay,
 * night by night. `rooms` defaults to 1. Missing records are treated as
 * available (no data = not sold out).
 */
export async function checkAvailability(opts: {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  rooms?: number;
  lookup: AvailabilityLookup;
}): Promise<CheckAvailabilityResult> {
  const { roomId, checkIn, checkOut, lookup } = opts;
  const rooms = opts.rooms ?? 1;
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights <= 0) {
    return { available: false, reason: "Invalid date range", blockedDates: [] };
  }

  const blockedDates: string[] = [];
  for (let i = 0; i < nights; i++) {
    const date = new Date(checkIn.getTime() + i * 86_400_000);
    const record = await lookup({ roomId, date });
    if (record && record.inventory < rooms) {
      blockedDates.push(date.toISOString().slice(0, 10));
    }
  }

  if (blockedDates.length > 0) {
    return {
      available: false,
      reason: `Insufficient inventory on ${blockedDates.join(", ")}`,
      blockedDates,
    };
  }
  return { available: true, blockedDates };
}
