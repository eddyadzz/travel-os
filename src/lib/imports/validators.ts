import { db } from "@/lib/db.server";
import type {
  ImportRowError,
  MappedAvailabilityRow,
  MappedRateRow,
  ValidAvailabilityRow,
  ValidRateRow,
} from "./types";

type RateValidation = { valid: ValidRateRow[]; errors: ImportRowError[] };
type AvailabilityValidation = { valid: ValidAvailabilityRow[]; errors: ImportRowError[] };

/** Loads active properties + rooms once, keyed by name/slug for validation. */
async function loadPropertyIndex() {
  const properties = await db.property.findMany({
    where: { status: "ACTIVE" },
    include: { rooms: true },
  });
  const byName = new Map<string, (typeof properties)[number]>();
  for (const p of properties) {
    byName.set(p.name.toLowerCase(), p);
    byName.set(p.slug.toLowerCase(), p);
  }
  return { properties, byName };
}

export async function validateRateRows(rows: MappedRateRow[]): Promise<RateValidation> {
  const { byName } = await loadPropertyIndex();
  const valid: ValidRateRow[] = [];
  const errors: ImportRowError[] = [];

  for (const row of rows) {
    const problems: string[] = [];
    const property = row.propertyName ? byName.get(row.propertyName.toLowerCase()) : undefined;
    if (!property) {
      problems.push(`Unknown property: "${row.propertyName || "(empty)"}"`);
    }
    const room = property?.rooms.find((r) => r.name.toLowerCase() === row.roomName.toLowerCase());
    if (property && !room) {
      problems.push(`Unknown room: "${row.roomName}" for "${property.name}"`);
    }
    if (!row.validFrom) problems.push("Invalid or missing From date");
    if (!row.validTo) problems.push("Invalid or missing To date");
    if (row.validFrom && row.validTo && row.validFrom > row.validTo) {
      problems.push(`From date (${row.validFrom}) is after To date (${row.validTo})`);
    }
    if (row.amount === null) problems.push("Invalid or missing Rate");
    else if (row.amount <= 0) problems.push(`Rate must be greater than zero (got ${row.amount})`);

    if (problems.length > 0) {
      errors.push({ rowNumber: row.rowNumber, message: problems.join("; ") });
    } else if (property && room && row.validFrom && row.validTo && row.amount !== null) {
      valid.push({
        rowNumber: row.rowNumber,
        propertyName: property.name,
        roomName: room.name,
        validFrom: row.validFrom,
        validTo: row.validTo,
        amount: row.amount,
        ...(row.season ? { season: row.season } : {}),
        currency: row.currency ?? "USD",
        propertyId: property.id,
        roomId: room.id,
      });
    }
  }

  return { valid, errors };
}

export async function validateAvailabilityRows(
  rows: MappedAvailabilityRow[],
): Promise<AvailabilityValidation> {
  const { byName } = await loadPropertyIndex();
  const valid: ValidAvailabilityRow[] = [];
  const errors: ImportRowError[] = [];

  for (const row of rows) {
    const problems: string[] = [];
    const property = row.propertyName ? byName.get(row.propertyName.toLowerCase()) : undefined;
    if (!property) {
      problems.push(`Unknown property: "${row.propertyName || "(empty)"}"`);
    }
    const room = property?.rooms.find((r) => r.name.toLowerCase() === row.roomName.toLowerCase());
    if (property && !room) {
      problems.push(`Unknown room: "${row.roomName}" for "${property.name}"`);
    }
    if (!row.date) problems.push("Invalid or missing Date");
    if (row.inventory === null) problems.push("Invalid or missing Inventory");
    else if (row.inventory < 0)
      problems.push(`Inventory cannot be negative (got ${row.inventory})`);

    if (problems.length > 0) {
      errors.push({ rowNumber: row.rowNumber, message: problems.join("; ") });
    } else if (property && room && row.date && row.inventory !== null) {
      valid.push({
        rowNumber: row.rowNumber,
        propertyName: property.name,
        roomName: room.name,
        date: row.date,
        inventory: row.inventory,
        propertyId: property.id,
        roomId: room.id,
      });
    }
  }

  return { valid, errors };
}
