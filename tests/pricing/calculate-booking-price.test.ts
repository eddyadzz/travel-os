import { describe, expect, it } from "vitest";
import { calculatePrice, money, nightsBetween } from "@/lib/pricing";

const room = { nightlyRate: 500, baseGuests: 2, extraGuestRate: 100 };

describe("calculatePrice — accommodation", () => {
  it("prices accommodation only: 2 nights x $500 = $1000", () => {
    const price = calculatePrice({
      transferPricePerPerson: 0,
      room,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 2,
      children: 0,
      addons: [],
    });
    expect(price.nights).toBe(2);
    expect(price.accommodation).toBe(1000);
    expect(price.total).toBe(1000);
  });
});

describe("calculatePrice — transfers", () => {
  it("charges transfer per guest: 2 guests x $40 = $80", () => {
    const price = calculatePrice({
      transferPricePerPerson: 40,
      room,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 2,
      children: 0,
      addons: [],
    });
    expect(price.transfers).toBe(80);
  });
});

describe("calculatePrice — addons", () => {
  it("prices a Per Person addon by guest count: 2 x $120 = $240", () => {
    const price = calculatePrice({
      transferPricePerPerson: 0,
      room,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 2,
      children: 0,
      addons: [{ pricing: "Per Person", price: 120 }],
    });
    expect(price.addons).toBe(240);
  });

  it("prices a Per Room addon by room count: 2 rooms x $50 = $100", () => {
    const price = calculatePrice({
      transferPricePerPerson: 0,
      room,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 2,
      children: 0,
      rooms: 2,
      addons: [{ pricing: "Per Room", price: 50 }],
    });
    expect(price.addons).toBe(100);
  });

  it("prices a Fixed addon once regardless of guests/rooms", () => {
    const price = calculatePrice({
      transferPricePerPerson: 0,
      room,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 4,
      children: 2,
      addons: [{ pricing: "Fixed Amount", price: 250 }],
    });
    expect(price.addons).toBe(250);
  });
});

describe("calculatePrice — extra guests", () => {
  it("charges extraGuestRate per extra guest per night", () => {
    // 3 guests in a base-2 room for 2 nights, extra rate $100
    const price = calculatePrice({
      transferPricePerPerson: 0,
      room,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 3,
      children: 0,
      addons: [],
    });
    expect(price.extraGuests).toBe(1 * 100 * 2);
  });
});

describe("calculatePrice — combined realistic Maldives booking", () => {
  it("computes a full package: 4 nights, water villa, 2 adults + 1 child, transfers, spa + dive", () => {
    const villa = { nightlyRate: 890, baseGuests: 2, extraGuestRate: 165 };
    const price = calculatePrice({
      transferPricePerPerson: 545,
      room: villa,
      checkIn: "2026-06-01",
      checkOut: "2026-06-05",
      adults: 2,
      children: 1,
      addons: [
        { pricing: "Per Person", price: 180 }, // spa, 3 guests
        { pricing: "Per Person", price: 320 }, // dive, 3 guests
      ],
    });

    // accommodation: 890 * 4 = 3560
    // extra guests: 1 extra (3 guests - 2 base) * 165 * 4 = 660
    // transfers: 545 * 3 = 1635
    // addons: (180 + 320) * 3 = 1500
    expect(price.nights).toBe(4);
    expect(price.guests).toBe(3);
    expect(price.accommodation).toBe(3560);
    expect(price.extraGuests).toBe(660);
    expect(price.transfers).toBe(1635);
    expect(price.addons).toBe(1500);
    expect(price.total).toBe(3560 + 660 + 1635 + 1500);
  });
});

describe("calculatePrice — edge cases", () => {
  it("returns zeros when no room selected", () => {
    const price = calculatePrice({
      transferPricePerPerson: 40,
      room: undefined,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      adults: 2,
      children: 0,
      addons: [],
    });
    expect(price.total).toBe(0);
    expect(price.accommodation).toBe(0);
  });

  it("returns zeros for invalid date range", () => {
    const price = calculatePrice({
      transferPricePerPerson: 40,
      room,
      checkIn: "2026-05-05",
      checkOut: "2026-05-03",
      adults: 2,
      children: 0,
      addons: [],
    });
    expect(price.nights).toBe(0);
    expect(price.total).toBe(0);
  });
});

describe("nightsBetween", () => {
  it("computes nights across a date range", () => {
    expect(nightsBetween("2026-05-01", "2026-05-03")).toBe(2);
  });
  it("returns 0 for missing or inverted dates", () => {
    expect(nightsBetween("", "")).toBe(0);
    expect(nightsBetween("2026-05-03", "2026-05-01")).toBe(0);
  });
});

describe("money", () => {
  it("formats USD with no decimals", () => {
    expect(money(3560)).toBe("$3,560");
  });
});
