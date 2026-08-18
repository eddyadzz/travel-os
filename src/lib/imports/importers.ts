import { db } from "@/lib/db.server";
import type {
  ImportRowError,
  MappedAvailabilityRow,
  MappedRateRow,
  ValidAvailabilityRow,
  ValidRateRow,
} from "./types";
import { validateAvailabilityRows, validateRateRows } from "./validators";

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
    persist: async () => {
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
    persist: async () => {
      if (valid.length > 0) {
        await db.availability.createMany({
          data: valid.map((r) => ({
            propertyId: r.propertyId,
            roomId: r.roomId,
            date: new Date(`${r.date}T00:00:00.000Z`),
            inventory: r.inventory,
          })),
          skipDuplicates: true,
        });
      }
      return { status: "COMPLETED", imported: valid };
    },
  });
}
