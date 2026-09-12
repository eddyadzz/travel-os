import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/lib/db.server";

export const BASE_DOMAIN = process.env["TENANT_BASE_DOMAIN"] ?? "oceanatlas.mv";
export const DEFAULT_TENANT_SLUG = "ocean-atlas";
export const DEFAULT_TENANT_NAME = "TravelOS by Boliflow";

const storage = new AsyncLocalStorage<string>();

const cache = new Map<string, { tenantId: string | null; at: number }>();
const CACHE_TTL_MS = 60_000;

/** Tenant id active for the current request/async context, if any. */
export function getTenantContext(): string | undefined {
  return storage.getStore();
}

/** Run a function with a tenant context active (used by middleware + tests). */
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run(tenantId, fn);
}

/**
 * Resolve a tenant from an incoming Host header.
 * 1. Exact match against a tenant's customDomain.
 * 2. Subdomain match: <slug>.<baseDomain>.
 * 3. Nothing — the caller falls back to the default tenant.
 * Results are cached per host for a short TTL to keep per-request cost negligible.
 */
export async function resolveTenantIdFromHost(host: string | undefined): Promise<string | null> {
  if (!host) return null;
  const hostname = host.split(":")[0]!.toLowerCase();

  const cached = cache.get(hostname);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.tenantId;

  let tenantId: string | null = null;
  const byDomain = await db.tenant.findFirst({ where: { customDomain: hostname } });
  if (byDomain) {
    tenantId = byDomain.id;
  } else {
    const base = BASE_DOMAIN.toLowerCase();
    if (hostname.endsWith(`.${base}`)) {
      const slug = hostname.slice(0, -(base.length + 1));
      if (slug) {
        const bySlug = await db.tenant.findFirst({ where: { slug } });
        if (bySlug) tenantId = bySlug.id;
      }
    }
  }

  cache.set(hostname, { tenantId, at: Date.now() });
  return tenantId;
}

let cachedDefaultTenantId: string | undefined;

/**
 * The platform's own agency — the tenant that owns all pre-Phase-24 data.
 * Lazily creates the default tenant if it is missing, so a fresh install never
 * fails with "Default tenant not found".
 */
export async function getDefaultTenantId(): Promise<string> {
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  let tenant = await db.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_NAME, plan: "PROFESSIONAL" },
    });
  }
  cachedDefaultTenantId = tenant.id;
  return tenant.id;
}
