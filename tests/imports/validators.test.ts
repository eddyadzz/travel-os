import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateRateRows, validateAvailabilityRows } from "@/lib/imports/validators";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    property: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({
  db: mockDb,
}));

const props = [
  {
    id: "p1",
    name: "Velaa Lagoon Resort & Spa",
    slug: "velaa-lagoon-resort",
    status: "ACTIVE",
    rooms: [
      { id: "r1", name: "Overwater Villa" },
      { id: "r2", name: "Beach Villa with Pool" },
    ],
  },
  {
    id: "p2",
    name: "Kaani Beach Hotel",
    slug: "kaani-beach-hotel",
    status: "ACTIVE",
    rooms: [{ id: "r3", name: "Deluxe Sea View" }],
  },
];

beforeEach(() => {
  mockDb.property.findMany.mockReset();
  mockDb.property.findMany.mockResolvedValue(props);
});

describe("validateRateRows", () => {
  it("accepts a valid row and resolves ids", async () => {
    const { valid, errors } = await validateRateRows([
      {
        rowNumber: 2,
        propertyName: "Velaa Lagoon Resort & Spa",
        roomName: "Overwater Villa",
        validFrom: "2026-05-01",
        validTo: "2026-10-31",
        amount: 500,
      },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({ propertyId: "p1", roomId: "r1", amount: 500 });
    expect(errors).toHaveLength(0);
  });

  it("flags unknown property", async () => {
    const { valid, errors } = await validateRateRows([
      {
        rowNumber: 2,
        propertyName: "Not A Resort",
        roomName: "Villa",
        validFrom: "2026-05-01",
        validTo: "2026-10-31",
        amount: 500,
      },
    ]);
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("Unknown property");
  });

  it("flags unknown room within a known property", async () => {
    const { errors } = await validateRateRows([
      {
        rowNumber: 3,
        propertyName: "Velaa Lagoon Resort & Spa",
        roomName: "Presidential Villa",
        validFrom: "2026-05-01",
        validTo: "2026-10-31",
        amount: 500,
      },
    ]);
    expect(errors[0].message).toContain("Unknown room");
  });

  it("flags a negative rate", async () => {
    const { valid, errors } = await validateRateRows([
      {
        rowNumber: 2,
        propertyName: "Velaa Lagoon Resort & Spa",
        roomName: "Overwater Villa",
        validFrom: "2026-05-01",
        validTo: "2026-10-31",
        amount: -50,
      },
    ]);
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("greater than zero");
  });

  it("flags an invalid date range (from after to)", async () => {
    const { errors } = await validateRateRows([
      {
        rowNumber: 4,
        propertyName: "Velaa Lagoon Resort & Spa",
        roomName: "Overwater Villa",
        validFrom: "2026-11-01",
        validTo: "2026-04-01",
        amount: 500,
      },
    ]);
    expect(errors[0].message).toContain("after To date");
  });
});

describe("validateAvailabilityRows", () => {
  it("accepts a valid row", async () => {
    const { valid, errors } = await validateAvailabilityRows([
      {
        rowNumber: 2,
        propertyName: "Kaani Beach Hotel",
        roomName: "Deluxe Sea View",
        date: "2026-08-20",
        inventory: 3,
      },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({ propertyId: "p2", roomId: "r3", inventory: 3 });
    expect(errors).toHaveLength(0);
  });

  it("flags negative inventory", async () => {
    const { valid, errors } = await validateAvailabilityRows([
      {
        rowNumber: 5,
        propertyName: "Kaani Beach Hotel",
        roomName: "Deluxe Sea View",
        date: "2026-08-20",
        inventory: -1,
      },
    ]);
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("negative");
  });

  it("flags unknown property", async () => {
    const { errors } = await validateAvailabilityRows([
      {
        rowNumber: 6,
        propertyName: "Ghost Resort",
        roomName: "Room",
        date: "2026-08-20",
        inventory: 2,
      },
    ]);
    expect(errors[0].message).toContain("Unknown property");
  });
});
