import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

function formatUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalizes a cell value into a YYYY-MM-DD date string, or null. */
export function toISODate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatUtc(value);
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Excel serial date: days since 1899-12-30
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    if (!Number.isNaN(date.getTime())) return formatUtc(date);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(t)) {
      const parts = t.split(/[-/]/);
      return `${parts[0]}-${parts[1]!.padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
    }
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(t)) {
      const parts = t.split(/[-/]/);
      const a = parts[0]!;
      const b = parts[1]!;
      const year = parts[2]!;
      // Disambiguate: if only one side can be a month, it wins. Otherwise
      // default to DD/MM/YYYY (the Maldives / European convention).
      const aMonth = Number(a) <= 12;
      const bMonth = Number(b) <= 12;
      if (aMonth && !bMonth) return `${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`; // MM/DD/YYYY
      if (bMonth && !aMonth) return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`; // DD/MM/YYYY
      return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`; // ambiguous -> DD/MM/YYYY
    }
    const date = new Date(t);
    if (!Number.isNaN(date.getTime())) return formatUtc(date);
  }
  return null;
}

/** Parses the first worksheet of an Excel/CSV buffer into header-keyed rows. */
export function parseSheet(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(buffer, { cellDates: true, type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => {
    const clean: RawRow = {};
    for (const [key, value] of Object.entries(row)) clean[String(key).trim()] = value;
    return clean;
  });
}
