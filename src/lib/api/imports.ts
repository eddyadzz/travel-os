import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { parseSheet } from "@/lib/imports/excel";
import { mapRowsToAvailability, mapRowsToRates } from "@/lib/imports/mappers";
import { importAvailability, importRates } from "@/lib/imports/importers";
import { validateAvailabilityRows, validateRateRows } from "@/lib/imports/validators";
import type { AvailabilityPreview, ImportJobDTO, RatePreview } from "@/lib/imports/types";
import type { Prisma } from "@/generated/prisma/client";

function toImportJobDTO(
  job: Prisma.ImportJobGetPayload<{ include: { _count: { select: { errors: true } } } }>,
): ImportJobDTO {
  return {
    id: job.id,
    type: job.type,
    filename: job.filename,
    status: job.status,
    totalRows: job.totalRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
    createdAt: job.createdAt.toISOString(),
    errorCount: job._count.errors,
  };
}

export const previewImport = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const type = String(data.get("type") ?? "");
    const file = data.get("file");
    if (!file || typeof file === "string") throw new Error("No file provided.");
    const filename = file.name;
    const rows = parseSheet(await file.arrayBuffer());

    if (type === "RATES") {
      const { valid, errors } = await validateRateRows(mapRowsToRates(rows));
      const preview: RatePreview = {
        type: "RATES",
        filename,
        totalRows: rows.length,
        validRows: valid,
        errors,
      };
      return preview;
    }
    if (type === "AVAILABILITY") {
      const { valid, errors } = await validateAvailabilityRows(mapRowsToAvailability(rows));
      const preview: AvailabilityPreview = {
        type: "AVAILABILITY",
        filename,
        totalRows: rows.length,
        validRows: valid,
        errors,
      };
      return preview;
    }
    throw new Error("Unknown import type. Expected RATES or AVAILABILITY.");
  });

export const runImport = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const type = String(data.get("type") ?? "");
    const file = data.get("file");
    if (!file || typeof file === "string") throw new Error("No file provided.");
    const filename = file.name;
    const rows = parseSheet(await file.arrayBuffer());

    if (type === "RATES") {
      return importRates(mapRowsToRates(rows), filename);
    }
    if (type === "AVAILABILITY") {
      return importAvailability(mapRowsToAvailability(rows), filename);
    }
    throw new Error("Unknown import type. Expected RATES or AVAILABILITY.");
  });

export const listImportJobs = createServerFn({ method: "GET" }).handler(async () => {
  const jobs = await db.importJob.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { errors: true } } },
  });
  return jobs.map(toImportJobDTO);
});

export const getImportJob = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const job = await db.importJob.findUnique({
      where: { id },
      include: { errors: { orderBy: { rowNumber: "asc" } }, _count: { select: { errors: true } } },
    });
    if (!job) return null;
    return {
      ...toImportJobDTO(job),
      errors: job.errors.map((e) => ({ rowNumber: e.rowNumber, message: e.message })),
    };
  });
