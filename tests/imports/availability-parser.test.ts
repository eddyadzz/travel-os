import { describe, expect, it } from "vitest";
import { parseSheet } from "@/lib/imports/excel";
import { mapRowsToAvailability } from "@/lib/imports/mappers";
import { buildWorkbookBuffer } from "./helpers";

const rowsOf = (rows: Array<Record<string, unknown>>) => parseSheet(buildWorkbookBuffer(rows));

describe("availability parser", () => {
  it("maps standard Property/Room/Date/Inventory headers", () => {
    const mapped = mapRowsToAvailability(
      rowsOf([{ Property: "Velaa", Room: "Villa", Date: "2026-08-20", Inventory: 4 }]),
    );
    expect(mapped[0]).toMatchObject({
      propertyName: "Velaa",
      roomName: "Villa",
      date: "2026-08-20",
      inventory: 4,
    });
  });

  it("parses an Excel serial date for the availability date", () => {
    const serial = Number((Date.UTC(2026, 7, 20) / 86_400_000 + 25569).toFixed(0));
    const mapped = mapRowsToAvailability(
      rowsOf([{ Property: "Velaa", Room: "Villa", Date: serial, Inventory: 2 }]),
    );
    expect(mapped[0].date).toBe("2026-08-20");
  });

  it("returns null inventory when the cell is not numeric", () => {
    const mapped = mapRowsToAvailability(
      rowsOf([{ Property: "Velaa", Room: "Villa", Date: "2026-08-20", Inventory: "on request" }]),
    );
    expect(mapped[0].inventory).toBeNull();
  });

  it("throws when required columns are missing", () => {
    expect(() =>
      mapRowsToAvailability(rowsOf([{ Property: "Velaa", Room: "Villa", Date: "2026-08-20" }])),
    ).toThrow(/missing required columns/i);
  });
});
