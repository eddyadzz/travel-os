import { toISODate } from "./excel";
import type { RawRow } from "./excel";
import { ImportFormatError, type MappedAvailabilityRow, type MappedRateRow } from "./types";

const norm = (h: string) => h.toLowerCase().replace(/[\s_-]+/g, "");

const RATE_HEADER_ALIASES: Record<string, readonly string[]> = {
  property: ["property", "propertyname", "hotel", "resort", "hotelname", "accommodation", "island"],
  room: ["room", "roomtype", "roomname", "roomcategory", "category", "villa", "villatype", "cabin", "unit"],
  from: ["from", "validfrom", "startdate", "datefrom", "fromdate", "validfromdate"],
  to: ["to", "validto", "enddate", "dateto", "todate", "validtodate", "validuntil"],
  rate: [
    "rate",
    "amount",
    "sellrate",
    "price",
    "nightlyrate",
    "tariff",
    "rateamount",
    "ratepernight",
  ],
  season: ["season", "period", "seasonname"],
  currency: ["currency", "cur"],
};

const AVAILABILITY_HEADER_ALIASES: Record<string, readonly string[]> = {
  property: ["property", "propertyname", "hotel", "resort", "hotelname", "accommodation", "island"],
  room: ["room", "roomtype", "roomname", "roomcategory", "category", "villa", "villatype", "cabin"],
  date: ["date", "day", "availabledate", "availabilitydate", "dateofstay", "night"],
  inventory: [
    "inventory",
    "units",
    "available",
    "availableunits",
    "stock",
    "roomsavailable",
    "inventoryavailable",
  ],
};

function resolveColumns(
  headers: string[],
  aliases: Record<string, readonly string[]>,
): Record<string, string | undefined> {
  const normalizedHeaders = headers.map(norm);
  const out: Record<string, string | undefined> = {};
  for (const [key, aliasList] of Object.entries(aliases)) {
    out[key] = undefined;
    for (const alias of aliasList) {
      const idx = normalizedHeaders.indexOf(norm(alias));
      if (idx >= 0) {
        out[key] = headers[idx];
        break;
      }
    }
  }
  return out;
}

function cell(row: RawRow, header: string | undefined): unknown {
  return header ? row[header] : undefined;
}

function requireColumns(
  columns: Record<string, string | undefined>,
  required: string[],
  headers: string[],
  type: string,
): void {
  const missing = required.filter((k) => !columns[k]);
  if (missing.length > 0) {
    const found = headers.map((h) => `"${h}"`).join(", ") || "no columns";
    throw new ImportFormatError(
      `${type} import is missing required columns: ${missing
        .map((m) => m.toUpperCase())
        .join(", ")}. Found: ${found}.`,
    );
  }
}

/** Maps raw spreadsheet rows into normalized rate rows (row numbers are 1-based, header is row 1). */
export function mapRowsToRates(rows: RawRow[]): MappedRateRow[] {
  const headers = Object.keys(rows[0] ?? {});
  const columns = resolveColumns(headers, RATE_HEADER_ALIASES);
  requireColumns(columns, ["property", "room", "from", "to", "rate"], headers, "Rate");

  return rows.map((row, i) => {
    const rawAmount = cell(row, columns["rate"]);
    const amount =
      rawAmount === "" || rawAmount === null || rawAmount === undefined ? null : Number(rawAmount);
    const season = cell(row, columns["season"]);
    const currency = cell(row, columns["currency"]);
    return {
      rowNumber: i + 2,
      propertyName: String(cell(row, columns["property"]) ?? "").trim(),
      roomName: String(cell(row, columns["room"]) ?? "").trim(),
      validFrom: toISODate(cell(row, columns["from"])),
      validTo: toISODate(cell(row, columns["to"])),
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      ...(season ? { season: String(season).trim() } : {}),
      ...(currency ? { currency: String(currency).trim() } : {}),
    };
  });
}

/** Maps raw spreadsheet rows into normalized availability rows. */
export function mapRowsToAvailability(rows: RawRow[]): MappedAvailabilityRow[] {
  const headers = Object.keys(rows[0] ?? {});
  const columns = resolveColumns(headers, AVAILABILITY_HEADER_ALIASES);
  requireColumns(columns, ["property", "room", "date", "inventory"], headers, "Availability");

  return rows.map((row, i) => {
    const rawInventory = cell(row, columns["inventory"]);
    const inventory =
      rawInventory === "" || rawInventory === null || rawInventory === undefined
        ? null
        : Number(rawInventory);
    return {
      rowNumber: i + 2,
      propertyName: String(cell(row, columns["property"]) ?? "").trim(),
      roomName: String(cell(row, columns["room"]) ?? "").trim(),
      date: toISODate(cell(row, columns["date"])),
      inventory: Number.isFinite(inventory as number) ? (inventory as number) : null,
    };
  });
}
