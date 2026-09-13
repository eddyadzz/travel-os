import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { resolveTenantIdFromHost, getDefaultTenantId } from "@/lib/tenant-context.server";
import type { TenantBrandingDTO } from "@/lib/types";

// ---------------------------------------------------------------------------
// White label & domain resolution
//
// This is a single-deployment product: there is exactly one "tenant" — the
// agency/deployment itself — looked up by host for branding. There is no
// multi-tenant admin surface.
// ---------------------------------------------------------------------------

export const getTenantByHost = createServerFn({ method: "GET" })
  .validator((host: string) => host)
  .handler(async ({ data: host }): Promise<TenantBrandingDTO | null> => {
    const tenantId = (await resolveTenantIdFromHost(host)) ?? (await getDefaultTenantId());
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;
    return {
      tenantId: tenant.id,
      name: tenant.name,
      ...(tenant.logoUrl ? { logoUrl: tenant.logoUrl } : {}),
      ...(tenant.primaryColor ? { primaryColor: tenant.primaryColor } : {}),
      ...(tenant.accentColor ? { accentColor: tenant.accentColor } : {}),
      ...(tenant.fontFamily ? { fontFamily: tenant.fontFamily } : {}),
      ...(tenant.emailFrom ? { emailFrom: tenant.emailFrom } : {}),
    };
  });
