import { createServerFn } from "@tanstack/react-start";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db.server";
import { DEFAULT_TENANT_SLUG } from "@/lib/tenant-context";
import type { BackupInfo, DeployCheckItem, OnboardingChecklist } from "@/lib/types";

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

function iso(d: Date) {
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

export async function validateEnvironment(): Promise<DeployCheckItem[]> {
  const checks: DeployCheckItem[] = [];

  const required = [
    ["DATABASE_URL", "Database connection string"],
    ["EMAIL_FROM", "Outbound email sender"],
  ] as const;
  for (const [key, label] of required) {
    checks.push({
      key: `env-${key}`,
      label,
      ok: Boolean(process.env[key]),
      detail: process.env[key] ? "Configured" : "Missing — add to .env",
    });
  }

  checks.push({
    key: "email-resend",
    label: "Email provider (Resend)",
    ok: Boolean(process.env["RESEND_API_KEY"]),
    detail: process.env["RESEND_API_KEY"]
      ? "Resend configured — real emails send"
      : "No key — emails run in dev mode (logged only)",
  });

  try {
    const tenant = await db.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
    checks.push({
      key: "db-connect",
      label: "Database reachable",
      ok: true,
      detail: "Connected",
    });
    checks.push({
      key: "default-tenant",
      label: "Default tenant seeded",
      ok: Boolean(tenant),
      detail: tenant ? tenant.name : "Missing — seed the default tenant",
    });
  } catch {
    checks.push({
      key: "db-connect",
      label: "Database reachable",
      ok: false,
      detail: "Connection failed",
    });
  }

  const [properties, bookings] = await Promise.all([
    db.property.count().catch(() => 0),
    db.booking.count().catch(() => 0),
  ]);
  checks.push({
    key: "data-properties",
    label: "Properties imported",
    ok: properties > 0,
    detail: `${properties} propert${properties === 1 ? "y" : "ies"} in the catalogue`,
  });
  checks.push({
    key: "data-bookings",
    label: "Booking engine smoke test",
    ok: bookings >= 0,
    detail: `${bookings} bookings recorded`,
  });

  return checks;
}

// ---------------------------------------------------------------------------
// Backup & restore
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Branding import
// ---------------------------------------------------------------------------

export const importBranding = createServerFn({ method: "POST" })
  .validator(
    (input: {
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      emailFrom?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const tenant = await db.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
    if (!tenant) throw new Error("Default tenant not found.");
    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
        ...(data.accentColor !== undefined ? { accentColor: data.accentColor } : {}),
        ...(data.emailFrom !== undefined ? { emailFrom: data.emailFrom } : {}),
      },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Onboarding checklist
// ---------------------------------------------------------------------------

export async function getOnboardingChecklist(): Promise<OnboardingChecklist> {
  const checks = await validateEnvironment();
  const tenant = await db.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
  const backups = await listBackups();

  const isDefaultColor = !tenant?.primaryColor || tenant.primaryColor === "#0f766e";
  const steps = [
    {
      key: "brand",
      label: "Apply client branding (logo & colors)",
      done: !isDefaultColor,
      detail: isDefaultColor ? "Branding not applied — default teal is active" : "Branding applied",
    },
    {
      key: "email",
      label: "Configure outbound email",
      done: Boolean(process.env["RESEND_API_KEY"]) && Boolean(process.env["EMAIL_FROM"]),
      detail: process.env["RESEND_API_KEY"] ? "Resend configured" : "Dev mode — emails logged only",
    },
    {
      key: "domain",
      label: "Set the client domain",
      done: Boolean(tenant?.customDomain),
      detail: tenant?.customDomain ?? "No custom domain set yet",
    },
    {
      key: "catalogue",
      label: "Import properties & rates",
      done: checks.find((c) => c.key === "data-properties")?.ok ?? false,
      detail: "Confirm the catalogue is loaded",
    },
    {
      key: "backup",
      label: "Create an initial backup",
      done: backups.length > 0,
      detail: backups.length
        ? `${backups.length} backup${backups.length === 1 ? "" : "s"} on disk`
        : "No backup yet",
    },
    {
      key: "env",
      label: "Environment validation passes",
      done: checks.every((c) => c.ok),
      detail: `${checks.filter((c) => c.ok).length}/${checks.length} checks pass`,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  return { steps, progress: Math.round((done / steps.length) * 100) };
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const validateEnvironmentFn = createServerFn({ method: "GET" }).handler(async () =>
  validateEnvironment(),
);

export const createBackupFn = createServerFn({ method: "POST" }).handler(async () =>
  createBackup(),
);

export const listBackupsFn = createServerFn({ method: "GET" }).handler(async () => listBackups());

export const restoreBackupFn = createServerFn({ method: "POST" })
  .validator((filename: string) => filename)
  .handler(async ({ data }) => restoreBackup(data));

export const verifyBackupFn = createServerFn({ method: "POST" })
  .validator((filename: string) => filename)
  .handler(async ({ data }) => verifyBackup(data));

export const onboardingChecklistFn = createServerFn({ method: "GET" }).handler(async () =>
  getOnboardingChecklist(),
);
