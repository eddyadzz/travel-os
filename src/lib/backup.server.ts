import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db.server";
import type { BackupInfo } from "@/lib/types";

const BACKUP_DIR = join(process.cwd(), "data", "backups");

// Master-data tables that are backed up and restored by id.
const BACKUP_MODELS = [
  "tenant",
  "user",
  "supplier",
  "supplierContact",
  "contractRate",
  "supplierUpdateRequest",
  "property",
  "room",
  "addon",
  "rate",
  "availability",
  "promotion",
  "package",
  "allocation",
  "blackoutDate",
  "markupRule",
  "customer",
  "lead",
  "quote",
  "quoteEvent",
  "booking",
  "payment",
  "supplierConfirmation",
  "bookingDocument",
  "bookingNote",
  "importJob",
  "automationLog",
  "jobRun",
  "exportFile",
  "supplierChannel",
] as const;

function ensureBackupDir() {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

async function dumpAll(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  const client = db as unknown as Record<string, { findMany: () => Promise<unknown[]> }>;
  for (const model of BACKUP_MODELS) {
    const rows = await client[model]?.findMany();
    out[model] = rows ?? [];
  }
  return out;
}

export async function createBackup(): Promise<BackupInfo> {
  ensureBackupDir();
  const data = await dumpAll();
  const rows = Object.values(data).reduce((s, rows) => s + rows.length, 0);
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(join(BACKUP_DIR, filename), JSON.stringify(data, null, 0));
  const stat = statSync(join(BACKUP_DIR, filename));
  return {
    filename,
    sizeBytes: stat.size,
    tables: BACKUP_MODELS.length,
    rows,
    createdAt: new Date().toISOString(),
  };
}

export async function listBackups(): Promise<BackupInfo[]> {
  ensureBackupDir();
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const stat = statSync(join(BACKUP_DIR, f));
      return {
        filename: f,
        sizeBytes: stat.size,
        tables: 0,
        rows: 0,
        createdAt: new Date(stat.mtimeMs).toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreBackup(filename: string): Promise<{ restored: number }> {
  const data = JSON.parse(readFileSync(join(BACKUP_DIR, filename), "utf8")) as Record<
    string,
    unknown[]
  >;
  let restored = 0;
  for (const [model, rows] of Object.entries(data)) {
    const client = (db as unknown as Record<string, { upsert: (a: unknown) => Promise<unknown> }>)[
      model
    ];
    if (!client?.upsert) continue;
    for (const row of rows as Array<Record<string, unknown>>) {
      const id = row["id"] as string | undefined;
      if (!id) continue;
      await client.upsert({ where: { id }, create: row, update: row });
      restored += 1;
    }
  }
  return { restored };
}

export function verifyBackup(filename: string): {
  valid: boolean;
  tables: number;
  rows: number;
  error?: string;
} {
  try {
    const data = JSON.parse(readFileSync(join(BACKUP_DIR, filename), "utf8")) as Record<
      string,
      unknown[]
    >;
    if (!data || typeof data !== "object") throw new Error("Backup is not an object");
    const rows = Object.values(data).reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0);
    const allRowsHaveIds = Object.entries(data).every(([, rows]) =>
      (rows as Array<Record<string, unknown>>).every((row) => typeof row?.["id"] === "string"),
    );
    if (!allRowsHaveIds) throw new Error("Some rows are missing an id — backup may be corrupt");
    return { valid: true, tables: Object.keys(data).length, rows };
  } catch (error) {
    return {
      valid: false,
      tables: 0,
      rows: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// PWA assets required for an installable app. Returns the list of missing files.
const PWA_FILES = ["manifest.webmanifest", "sw.js", "icon.svg"];

export function checkPwaAssets(): string[] {
  const publicDir = join(process.cwd(), "public");
  return PWA_FILES.filter((f) => !existsSync(join(publicDir, f)));
}
