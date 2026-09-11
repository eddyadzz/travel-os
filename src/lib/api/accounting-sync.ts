import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { buildJournal, buildQuickBooksCSV, buildXeroCSV } from "@/lib/api/finance";
import type { ReportFilter } from "@/lib/types";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toExportDTO(e: {
  id: string;
  format: string;
  filename: string;
  periodFrom: Date;
  periodTo: Date;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    format: e.format,
    filename: e.filename,
    periodFrom: iso(e.periodFrom),
    periodTo: iso(e.periodTo),
    ...(e.createdBy ? { createdBy: e.createdBy } : {}),
    createdAt: e.createdAt.toISOString(),
  };
}

/**
 * One-click accounting sync — generates both the Xero and QuickBooks journals for
 * a period and records them as synced export files (downloadable anytime).
 */
export async function runAccountingSync(filter: ReportFilter, createdBy?: string) {
  const entries = await buildJournal(filter);
  const from = new Date(`${filter.from}T00:00:00.000Z`);
  const to = new Date(`${filter.to}T23:59:59.999Z`);
  const results = [];

  for (const [format, build] of [
    ["XERO", buildXeroCSV],
    ["QUICKBOOKS", buildQuickBooksCSV],
  ] as const) {
    const content = build(entries);
    const record = await db.exportFile.create({
      data: {
        format,
        filename: `${format.toLowerCase()}-journal-${filter.from}-${filter.to}.csv`,
        content,
        periodFrom: from,
        periodTo: to,
        ...(createdBy ? { createdBy } : {}),
      },
    });
    results.push(toExportDTO(record));
  }
  return { files: results, entries: entries.length };
}

export const runAccountingSyncFn = createServerFn({ method: "POST" })
  .validator((input: { from: string; to: string; createdBy?: string }) => input)
  .handler(async ({ data }) => runAccountingSync({ from: data.from, to: data.to }, data.createdBy));

export const listAccountingExports = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await db.exportFile.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(toExportDTO);
});

export const getAccountingExportContent = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const record = await db.exportFile.findUnique({ where: { id } });
    return record ? { filename: record.filename, content: record.content } : null;
  });
