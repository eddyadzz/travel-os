import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeAvailabilityHealth,
  computeExpiringRates,
  computeRoomCalendar,
} from "@/lib/api/availability";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    property: { findMany: vi.fn() },
    availability: { groupBy: vi.fn(), findMany: vi.fn() },
    rate: { findMany: vi.fn() },
    room: { findUnique: vi.fn() },
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

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.property.findMany.mockResolvedValue([
    { id: "p1", name: "Velaa" },
    { id: "p2", name: "Kaani" },
    { id: "p3", name: "Dhigurah" },
  ]);
  mockDb.availability.groupBy.mockResolvedValue([
    { propertyId: "p1", _max: { updatedAt: daysAgo(1) } },
    { propertyId: "p2", _max: { updatedAt: daysAgo(7) } },
  ]);
  mockDb.availability.findMany.mockResolvedValue([
    { date: new Date(Date.now()), inventory: 6 },
    { date: new Date(Date.now() + 86_400_000), inventory: 0 },
    { date: new Date(Date.now() + 2 * 86_400_000), inventory: 3 },
  ]);
  mockDb.rate.findMany.mockResolvedValue([
    {
      id: "r1",
      amount: 500,
      validTo: new Date(Date.now() + 2 * 86_400_000),
      property: { name: "Velaa" },
      room: { name: "Beach Villa" },
    },
    {
      id: "r2",
      amount: 700,
      validTo: new Date(Date.now() + 6 * 86_400_000),
      property: { name: "Kaani" },
      room: { name: "Deluxe" },
    },
  ]);
  mockDb.room.findUnique.mockResolvedValue({
    id: "r1",
    name: "Beach Villa",
    property: { name: "Velaa" },
  });
});

describe("computeAvailabilityHealth", () => {
  it("classifies properties by freshness", async () => {
    const h = await computeAvailabilityHealth();
    expect(h.totalProperties).toBe(3);
    expect(h.fresh).toBe(1); // p1 (1 day)
    expect(h.needsUpdate).toBe(1); // p2 (7 days)
    expect(h.expired).toBe(0);
    expect(h.noData).toBe(1); // p3 (no availability)
    const velaa = h.rows.find((r) => r.name === "Velaa");
    expect(velaa.status).toBe("FRESH");
    expect(velaa.daysSince).toBe(1);
  });

  it("marks old data as expired", async () => {
    mockDb.availability.groupBy.mockResolvedValue([
      { propertyId: "p1", _max: { updatedAt: daysAgo(30) } },
    ]);
    const h = await computeAvailabilityHealth();
    expect(h.expired).toBe(1);
    const velaa = h.rows.find((r) => r.name === "Velaa");
    expect(velaa.status).toBe("EXPIRED");
  });
});

describe("computeExpiringRates", () => {
  it("returns rates expiring within the horizon with days remaining", async () => {
    const rates = await computeExpiringRates(30);
    expect(rates).toHaveLength(2);
    expect(rates[0]).toMatchObject({
      propertyName: "Velaa",
      roomName: "Beach Villa",
      daysRemaining: 2,
    });
    // sorted by validTo ascending
    expect(rates[0].daysRemaining).toBeLessThan(rates[1].daysRemaining);
  });

  it("returns empty when no rates expire soon", async () => {
    mockDb.rate.findMany.mockResolvedValue([]);
    expect(await computeExpiringRates(30)).toEqual([]);
  });
});

describe("computeRoomCalendar", () => {
  it("returns 30 color-coded days with inventory", async () => {
    const cal = await computeRoomCalendar({ roomId: "r1", days: 30 });
    expect(cal).not.toBeNull();
    expect(cal.roomName).toBe("Beach Villa");
    expect(cal.propertyName).toBe("Velaa");
    expect(cal.days).toHaveLength(30);
    // Timezone-robust: the mocked records (6, 0, 3) should appear somewhere
    // in the 30-day window with the correct classification.
    expect(cal.days.some((d) => d.inventory === 6 && d.status === "AVAILABLE")).toBe(true);
    expect(cal.days.some((d) => d.inventory === 0 && d.status === "SOLD_OUT")).toBe(true);
    expect(cal.days.some((d) => d.inventory === 3 && d.status === "LOW")).toBe(true);
    expect(cal.days.some((d) => d.inventory === null && d.status === "NO_DATA")).toBe(true);
  });

  it("returns null for an unknown room", async () => {
    mockDb.room.findUnique.mockResolvedValue(null);
    expect(await computeRoomCalendar({ roomId: "nope" })).toBeNull();
  });
});
