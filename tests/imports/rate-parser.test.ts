import { describe, expect, it } from "vitest";
import { parseSheet } from "@/lib/imports/excel";
import { mapRowsToAvailability, mapRowsToRates } from "@/lib/imports/mappers";
import { buildWorkbookBuffer } from "./helpers";

const rowsOf = (rows: Array<Record<string, unknown>>) => parseSheet(buildWorkbookBuffer(rows));

describe("rate parser — supplier header variations", () => {
  it("parses Supplier A: Property/Room/From/To/Rate", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        { Property: "Velaa", Room: "Overwater", From: "2026-05-01", To: "2026-10-31", Rate: 500 },
      ]),
    );
    expect(mapped[0]).toMatchObject({
      propertyName: "Velaa",
      roomName: "Overwater",
      validFrom: "2026-05-01",
      validTo: "2026-10-31",
      amount: 500,
    });
  });

  it("parses Supplier B: Hotel/Room Type/Start Date/End Date/Sell Rate", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        {
          Hotel: "Velaa",
          "Room Type": "Beach Villa",
          "Start Date": "2026-06-01",
          "End Date": "2026-09-30",
          "Sell Rate": 620,
        },
      ]),
    );
    expect(mapped[0]).toMatchObject({
      propertyName: "Velaa",
      roomName: "Beach Villa",
      validFrom: "2026-06-01",
      validTo: "2026-09-30",
      amount: 620,
    });
  });

  it("parses Supplier C: Accommodation/Unit/Valid From/Valid To/Tariff", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        {
          Accommodation: "Velaa",
          Unit: "Cabin",
          "Valid From": "2026-01-01",
          "Valid To": "2026-03-31",
          Tariff: 300,
        },
      ]),
    );
    expect(mapped[0]).toMatchObject({
      propertyName: "Velaa",
      roomName: "Cabin",
      validFrom: "2026-01-01",
      validTo: "2026-03-31",
      amount: 300,
    });
  });

  it("maps season and currency when present", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        {
          Property: "Velaa",
          Room: "Villa",
          From: "2026-05-01",
          To: "2026-10-31",
          Rate: 400,
          Season: "Low",
          Cur: "EUR",
        },
      ]),
    );
    expect(mapped[0]).toMatchObject({ season: "Low", currency: "EUR" });
  });
});

describe("rate parser — date parsing", () => {
  it("parses Excel serial dates", () => {
    // 2026-05-01 as an Excel serial (days since 1899-12-30)
    const serial = (Date.UTC(2026, 4, 1) / 86_400_000 + 25569).toFixed(0);
    const mapped = mapRowsToRates(
      rowsOf([
        {
          Property: "Velaa",
          Room: "Villa",
          From: Number(serial),
          To: Number(serial) + 30,
          Rate: 400,
        },
      ]),
    );
    expect(mapped[0].validFrom).toBe("2026-05-01");
  });

  it("parses ISO dates", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        { Property: "Velaa", Room: "Villa", From: "2026-05-01", To: "2026-05-10", Rate: 400 },
      ]),
    );
    expect(mapped[0].validFrom).toBe("2026-05-01");
    expect(mapped[0].validTo).toBe("2026-05-10");
  });

  it("parses DD/MM/YYYY", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        { Property: "Velaa", Room: "Villa", From: "01/05/2026", To: "31/10/2026", Rate: 400 },
      ]),
    );
    expect(mapped[0].validFrom).toBe("2026-05-01");
    expect(mapped[0].validTo).toBe("2026-10-31");
  });

  it("parses MM/DD/YYYY when unambiguous", () => {
    // 30 can't be a month, so 05/30 is clearly MM/DD = May 30, 07/30 = July 30
    const mapped = mapRowsToRates(
      rowsOf([
        { Property: "Velaa", Room: "Villa", From: "05/30/2026", To: "07/30/2026", Rate: 400 },
      ]),
    );
    expect(mapped[0].validFrom).toBe("2026-05-30");
    expect(mapped[0].validTo).toBe("2026-07-30");
  });

  it("defaults ambiguous dates to DD/MM/YYYY", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        { Property: "Velaa", Room: "Villa", From: "01/05/2026", To: "10/05/2026", Rate: 400 },
      ]),
    );
    expect(mapped[0].validFrom).toBe("2026-05-01");
    expect(mapped[0].validTo).toBe("2026-05-10");
  });

  it("returns null for invalid dates", () => {
    const mapped = mapRowsToRates(
      rowsOf([
        { Property: "Velaa", Room: "Villa", From: "not-a-date", To: "2026-05-10", Rate: 400 },
      ]),
    );
    expect(mapped[0].validFrom).toBeNull();
    expect(mapped[0].validTo).toBe("2026-05-10");
  });
});

describe("rate parser — errors", () => {
  it("throws when required columns are missing", () => {
    expect(() =>
      mapRowsToRates(rowsOf([{ Property: "Velaa", Room: "Villa", From: "2026-05-01" }])),
    ).toThrow(/missing required columns/i);
  });
});

describe("availability parser", () => {
  it("maps Property/Room/Date/Inventory", () => {
    const mapped = mapRowsToAvailability(
      rowsOf([{ Property: "Velaa", Room: "Villa", Date: "2026-08-20", Inventory: 3 }]),
    );
    expect(mapped[0]).toMatchObject({
      propertyName: "Velaa",
      roomName: "Villa",
      date: "2026-08-20",
      inventory: 3,
    });
  });

  it("accepts flexible inventory column names", () => {
    const mapped = mapRowsToAvailability(
      rowsOf([{ Hotel: "Velaa", "Room Type": "Villa", Date: "2026-08-20", "Available Units": 5 }]),
    );
    expect(mapped[0]).toMatchObject({ inventory: 5 });
  });

  it("returns null for invalid date/inventory", () => {
    const mapped = mapRowsToAvailability(
      rowsOf([{ Property: "Velaa", Room: "Villa", Date: "bad", Inventory: "nope" }]),
    );
    expect(mapped[0].date).toBeNull();
    expect(mapped[0].inventory).toBeNull();
  });
});
