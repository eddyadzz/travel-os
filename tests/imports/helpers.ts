import * as XLSX from "xlsx";

/** Builds an in-memory .xlsx ArrayBuffer from header-keyed rows. */
export function buildWorkbookBuffer(rows: Array<Record<string, unknown>>): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
