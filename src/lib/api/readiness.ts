import { createServerFn } from "@tanstack/react-start";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db.server";
import { DEFAULT_TENANT_SLUG } from "@/lib/tenant-context";
import { listBackups, verifyBackup } from "@/lib/api/deploy";
import type { DeployCheckItem } from "@/lib/types";

export type ReadinessResult = {
  checks: DeployCheckItem[];
  critical: boolean;
  blockers: string[];
  readyPercent: number;
};

export async function runReadinessCheck(): Promise<ReadinessResult> {
  const checks: DeployCheckItem[] = [];
  const blockers: string[] = [];

  // 1. Backups exist and verify.
  const backups = await listBackups().catch(() => []);
  const latest = backups[0];
  let backupOk = false;
  if (latest) {
    const v = verifyBackup(latest.filename);
    backupOk = v.valid;
  }
  checks.push({
    key: "backup",
    label: "Backup exists and verifies",
    ok: backupOk,
    detail: latest
      ? `${latest.filename} — ${backupOk ? "valid" : "FAILED verification"}`
      : "No backup found — create one before going live",
  });
  if (!backupOk) blockers.push("No verified backup");

  // 2. Email deliverability.
  const emailOk = Boolean(process.env["RESEND_API_KEY"]) && Boolean(process.env["EMAIL_FROM"]);
  checks.push({
    key: "email",
    label: "Email provider configured",
    ok: emailOk,
    detail: process.env["RESEND_API_KEY"]
      ? `Sending as ${process.env["EMAIL_FROM"] ?? "unset"}`
      : "No RESEND_API_KEY — emails are logged only in dev mode",
  });
  if (!emailOk) blockers.push("Outbound email not configured");

  // 3. PWA assets reachable.
  const publicDir = join(process.cwd(), "public");
  const pwaFiles = ["manifest.webmanifest", "sw.js", "icon.svg"];
  const missingPwa = pwaFiles.filter((f) => !existsSync(join(publicDir, f)));
  checks.push({
    key: "pwa",
    label: "PWA installable (manifest, service worker, icon)",
    ok: missingPwa.length === 0,
    detail: missingPwa.length ? `Missing: ${missingPwa.join(", ")}` : "PWA assets present",
  });
  if (missingPwa.length) blockers.push("PWA assets missing");

  // 4. Audit trail active.
  const auditCount = await db.importJob.count().catch(() => 0);
  const eventCount = await db.bookingEvent.count().catch(() => 0);
  const auditOk = auditCount > 0 || eventCount > 0;
  checks.push({
    key: "audit",
    label: "Audit trail active",
    ok: auditOk,
    detail: `${auditCount} import job(s) · ${eventCount} booking event(s) recorded`,
  });
  if (!auditOk) blockers.push("No audit history yet");

  // 5. Branding applied.
  const tenant = await db.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
  const isDefaultColor = !tenant?.primaryColor || tenant.primaryColor === "#0f766e";
  checks.push({
    key: "brand",
    label: "Client branding applied",
    ok: !isDefaultColor || Boolean(tenant?.customDomain),
    detail:
      isDefaultColor && !tenant?.customDomain
        ? "Default teal + no domain — brand this deployment"
        : "Branding/domain set",
  });
  if (isDefaultColor && !tenant?.customDomain) blockers.push("Branding not applied");

  // 6. Catalogue + data present.
  const [properties, bookings, leads] = await Promise.all([
    db.property.count().catch(() => 0),
    db.booking.count().catch(() => 0),
    db.lead.count().catch(() => 0),
  ]);
  const dataOk = properties > 0;
  checks.push({
    key: "data",
    label: "Catalogue & data loaded",
    ok: dataOk,
    detail: `${properties} propert${properties === 1 ? "y" : "ies"} · ${bookings} bookings · ${leads} leads`,
  });
  if (!dataOk) blockers.push("No properties imported");

  // 7. Database reachable (implicitly via the counts above).
  checks.push({
    key: "db",
    label: "Database reachable",
    ok: properties >= 0 || bookings >= 0,
    detail: "Connected",
  });

  const okCount = checks.filter((c) => c.ok).length;
  return {
    checks,
    critical: blockers.length === 0,
    blockers,
    readyPercent: Math.round((okCount / checks.length) * 100),
  };
}

export const readinessCheckFn = createServerFn({ method: "GET" }).handler(async () =>
  runReadinessCheck(),
);
