import { db } from "@/lib/db.server";

/** Prisma PropertyType enum values. */
export type PropertyTypeEnum = "RESORT" | "HOTEL" | "GUESTHOUSE" | "SAFARI_BOAT";

/** Default agency margin by property type when no rule overrides. */
export const DEFAULT_MARKUP: Record<PropertyTypeEnum, number> = {
  RESORT: 22,
  HOTEL: 22,
  GUESTHOUSE: 18,
  SAFARI_BOAT: 25,
};

/**
 * Effective sell-through markup (%) for a property. Precedence:
 * property-specific rule > supplier rule > property-type rule > default.
 * Rules are scoped to a tenant when one is supplied; otherwise global rules apply.
 */
export async function getEffectiveMarkup(opts: {
  propertyId: string;
  propertyType: PropertyTypeEnum;
  supplierId?: string;
  season?: string;
  tenantId?: string;
}): Promise<number> {
  const rules = await db.markupRule.findMany({
    where: {
      active: true,
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const propertyRule = rules.find((r) => r.propertyId === opts.propertyId);
  if (propertyRule) return Number(propertyRule.markupPercent);

  const supplierRule = rules.find((r) => r.supplierId === opts.supplierId && !r.propertyId);
  if (supplierRule) return Number(supplierRule.markupPercent);

  const typeRule = rules.find(
    (r) => r.propertyType === opts.propertyType && !r.supplierId && !r.propertyId,
  );
  if (typeRule) return Number(typeRule.markupPercent);

  return DEFAULT_MARKUP[opts.propertyType] ?? 0;
}

/** Apply a markup % to a base total, returning the rounded sale price. */
export function applyMarkup(total: number, markupPercent: number): number {
  return Math.round(total * (1 + markupPercent / 100));
}
