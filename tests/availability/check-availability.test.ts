import { describe, expect, it } from "vitest";
import { checkAvailability } from "@/lib/availability";

const day = (offset: number) => new Date(Date.UTC(2026, 4, 1 + offset));

// lookup helper: map of day-offset -> inventory
const makeLookup =
  (inv: Record<number, number>) =>
  async ({ date }: { date: Date }) => {
    const offset = Math.round((date.getTime() - day(0).getTime()) / 86_400_000);
    const inventory = inv[offset];
    return inventory === undefined ? null : { date, inventory };
  };

describe("checkAvailability", () => {
  it("returns available when inventory covers the stay", async () => {
    const result = await checkAvailability({
      roomId: "r1",
      checkIn: day(0),
      checkOut: day(3),
      lookup: makeLookup({ 0: 3, 1: 3, 2: 3 }),
    });
    expect(result.available).toBe(true);
    expect(result.blockedDates).toEqual([]);
  });

  it("returns unavailable when inventory is 0 (sold out)", async () => {
    const result = await checkAvailability({
      roomId: "r1",
      checkIn: day(0),
      checkOut: day(2),
      lookup: makeLookup({ 0: 0 }),
    });
    expect(result.available).toBe(false);
    expect(result.reason).toContain("Insufficient inventory");
  });

  it("blocks the stay when a middle night is sold out (partial stay)", async () => {
    const result = await checkAvailability({
      roomId: "r1",
      checkIn: day(0),
      checkOut: day(3),
      lookup: makeLookup({ 0: 5, 1: 0, 2: 5 }),
    });
    expect(result.available).toBe(false);
    expect(result.blockedDates).toEqual(["2026-05-02"]);
  });

  it("rejects multi-room request exceeding inventory", async () => {
    const result = await checkAvailability({
      roomId: "r1",
      checkIn: day(0),
      checkOut: day(2),
      rooms: 3,
      lookup: makeLookup({ 0: 2 }),
    });
    expect(result.available).toBe(false);
  });

  it("treats missing availability records as available", async () => {
    const result = await checkAvailability({
      roomId: "r1",
      checkIn: day(0),
      checkOut: day(2),
      lookup: async () => null,
    });
    expect(result.available).toBe(true);
  });

  it("rejects an invalid date range", async () => {
    const result = await checkAvailability({
      roomId: "r1",
      checkIn: day(3),
      checkOut: day(1),
      lookup: makeLookup({}),
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("Invalid date range");
  });
});
