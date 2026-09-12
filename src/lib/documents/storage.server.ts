import { uploadObject } from "@/lib/storage/object-storage.server";

/**
 * Stores a generated PDF and returns its public URL (R2 when configured, local
 * filesystem otherwise).
 */
export async function storeDocument(opts: {
  filename: string;
  buffer: Buffer;
}): Promise<{ url: string }> {
  return uploadObject({
    key: `documents/${opts.filename}`,
    buffer: opts.buffer,
    contentType: "application/pdf",
  });
}
