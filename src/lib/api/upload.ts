import { createServerFn } from "@tanstack/react-start";
import { uploadObject } from "@/lib/storage/object-storage.server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return "jpg";
}

/**
 * Uploads an image (R2 when configured, local disk otherwise) and returns its
 * public URL. Used by the logo dropzone and the property gallery manager.
 */
export const uploadImage = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const file = data.get("file");
    const folder = String(data.get("folder") ?? "images");
    if (!file || typeof file === "string") throw new Error("No file provided.");
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Unsupported image type — use JPEG, PNG, WebP, GIF or SVG.");
    }
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is larger than 8 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\- ]/g, "_") || `image.${extFor(file.type)}`;
    const { url } = await uploadObject({
      key: `${folder}/${safeName}`,
      buffer,
      contentType: file.type,
    });
    return { url, filename: file.name, size: file.size };
  });
