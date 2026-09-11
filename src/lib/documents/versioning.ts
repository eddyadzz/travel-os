import type { DocumentType } from "./types";

/**
 * Computes the next document version for a booking + type. Because PDFs are
 * immutable once stored, re-generating creates a new version rather than
 * overwriting (v1, v2, …).
 */
export async function nextVersion(existingCount: number, type: DocumentType): Promise<number> {
  return existingCount + 1;
}

export function filenameWithVersion(base: string, version: number): string {
  return base.replace(/\.pdf$/, "") + `_v${version}.pdf`;
}
