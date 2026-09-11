import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Unified object storage for the platform. Uploads go to Cloudflare R2 (an
 * S3-compatible store) when the R2_* environment variables are configured, and
 * fall back to the local filesystem (public/uploads) otherwise — so development,
 * tests and pre-configuration deployments keep working unchanged.
 *
 * Environment variables:
 *   R2_ACCOUNT_ID         your Cloudflare account id
 *   R2_ACCESS_KEY_ID      R2 API token access key id
 *   R2_SECRET_ACCESS_KEY  R2 API token secret
 *   R2_BUCKET             bucket name
 *   R2_PUBLIC_URL         public base URL bound to the bucket (e.g. https://cdn.client.com)
 */

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  const bucket = process.env["R2_BUCKET"];
  const publicUrl = process.env["R2_PUBLIC_URL"];
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

let cachedClient: S3Client | null | undefined;

function r2Client(config: R2Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  return cachedClient;
}

function sanitizeKey(key: string): string {
  return key
    .split("/")
    .map((seg) => seg.replace(/[^\w.\- ]/g, "_"))
    .join("/");
}

/**
 * Uploads an object and returns its public URL. Falls back to local disk when
 * R2 is not configured.
 */
export async function uploadObject(opts: {
  key: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ url: string }> {
  const config = getR2Config();
  const safeKey = sanitizeKey(opts.key);
  const unique = `${Date.now()}-${path.basename(safeKey)}`;
  const key = path.dirname(safeKey) === "." ? unique : `${path.dirname(safeKey)}/${unique}`;

  if (config) {
    await r2Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.contentType,
      }),
    );
    return { url: `${config.publicUrl.replace(/\/$/, "")}/${key}` };
  }

  const dir = path.resolve(process.cwd(), "public", "uploads", path.dirname(key));
  await mkdir(dir, { recursive: true });
  await writeFile(path.resolve(process.cwd(), "public", "uploads", key), opts.buffer);
  return { url: `/uploads/${key}` };
}
