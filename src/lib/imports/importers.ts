import { db } from "@/lib/db.server";
import type {
  ImportRowError,
  MappedAvailabilityRow,
  MappedRateRow,
  ValidAvailabilityRow,
  ValidRateRow,
} from "./types";
import { validateAvailabilityRows, validateRateRows } from "./validators";
import { markSupplierRequestsImported } from "@/lib/api/supplier-updates";

export type ImportResult<T> = {
  jobId: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: ImportRowError[];
  imported: T[];
};

async function createJob<T>(args: {
  type: "RATES" | "AVAILABILITY";
  filename: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: ImportRowError[];
  persist: (jobId: string) => Promise<{ status: string; imported: T[] }>;
}): Promise<ImportResult<T>> {
  const { type, filename, totalRows, successRows, failedRows, errors, persist } = args;
  const job = await db.importJob.create({
    data: { type, filename, status: "IMPORTING", totalRows, successRows, failedRows },
  });

  try {
    if (errors.length > 0) {
      await db.importError.createMany({
        data: errors.map((e) => ({
          importJobId: job.id,
          rowNumber: e.rowNumber,
          message: e.message,
        })),
      });
    }
    const { status, imported } = await persist(job.id);
    const finalStatus = status === "FAILED" ? "FAILED" : successRows > 0 ? "COMPLETED" : "FAILED";
    const updated = await db.importJob.update({
      where: { id: job.id },
      data: { status: finalStatus },
    });
    return {
      jobId: updated.id,
      status: updated.status,
      totalRows: updated.totalRows,
      successRows: updated.successRows,
      failedRows: updated.failedRows,
      errors,
      imported,
    };
  } catch (error) {
    await db.importJob
      .update({ where: { id: job.id }, data: { status: "FAILED" } })
      .catch(() => {});
    throw error;
  }
}

export async function importRates(
  rows: MappedRateRow[],
  filename: string,
): Promise<ImportResult<ValidRateRow>> {
  const { valid, errors } = await validateRateRows(rows);
  return createJob<ValidRateRow>({
    type: "RATES",
    filename,
    totalRows: rows.length,
    successRows: valid.length,
    failedRows: errors.length,
    errors,
    persist: async (jobId) => {
      if (valid.length > 0) {
        await db.rate.createMany({
          data: valid.map((r) => ({
            propertyId: r.propertyId,
            roomId: r.roomId,
            validFrom: new Date(`${r.validFrom}T00:00:00.000Z`),
            validTo: new Date(`${r.validTo}T00:00:00.000Z`),
            amount: r.amount,
            currency: r.currency,
            season: r.season ?? null,
          })),
        });
        // Audit: every imported rate is a new row (no overwrite yet — see
        // rate versioning). Record the created values for the audit trail.
        await db.importChange.createMany({
          data: valid.map((r) => ({
            importJobId: jobId,
            type: "RATE",
            propertyId: r.propertyId,
            roomId: r.roomId,
            date: `${r.validFrom}..${r.validTo}`,
            field: "amount",
            beforeValue: null,
            afterValue: String(r.amount),
          })),
        });
        // Close the loop: mark open RATES update requests as IMPORTED.
        await markSupplierRequestsImported("RATES", [...new Set(valid.map((r) => r.propertyId))]);
      }
      return { status: "COMPLETED", imported: valid };
    },
  });
}

export async function importAvailability(
  rows: MappedAvailabilityRow[],
  filename: string,
): Promise<ImportResult<ValidAvailabilityRow>> {
  const { valid, errors } = await validateAvailabilityRows(rows);
  return createJob<ValidAvailabilityRow>({
    type: "AVAILABILITY",
    filename,
    totalRows: rows.length,
    successRows: valid.length,
    failedRows: errors.length,
    errors,
    persist: async (jobId) => {
      const changes: Array<{
        importJobId: string;
        type: string;
        propertyId: string;
        roomId: string;
        date: string;
        field: string;
        beforeValue: string | null;
        afterValue: string;
      }> = [];
      if (valid.length > 0) {
        // Smart merge + audit: never wipe data. For each (roomId, date) row,
        // compare with the existing value and record a before→after change.
        for (const r of valid) {
          const date = new Date(`${r.date}T00:00:00.000Z`);
          const existing = await db.availability.findUnique({
            where: { roomId_date: { roomId: r.roomId, date } },
          });
          if (existing) {
            if (existing.inventory !== r.inventory) {
              changes.push({
                importJobId: jobId,
                type: "AVAILABILITY",
                propertyId: r.propertyId,
                roomId: r.roomId,
                date: r.date,
                field: "inventory",
                beforeValue: String(existing.inventory),
                afterValue: String(r.inventory),
              });
            }
            await db.availability.update({
              where: { id: existing.id },
              data: { inventory: r.inventory, propertyId: r.propertyId },
            });
          } else {
            await db.availability.create({
              data: {
                propertyId: r.propertyId,
                roomId: r.roomId,
                date,
                inventory: r.inventory,
              },
            });
            changes.push({
              importJobId: jobId,
              type: "AVAILABILITY",
              propertyId: r.propertyId,
              roomId: r.roomId,
              date: r.date,
              field: "inventory",
              beforeValue: null,
              afterValue: String(r.inventory),
            });
          }
        }
      }
      if (changes.length > 0) {
        await db.importChange.createMany({ data: changes });
      }
      // Close the loop: mark open AVAILABILITY update requests as IMPORTED.
      await markSupplierRequestsImported("AVAILABILITY", [
        ...new Set(valid.map((r) => r.propertyId)),
      ]);
      return { status: "COMPLETED", imported: valid };
    },
  });
}
