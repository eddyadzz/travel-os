import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { getEffectiveMarkup } from "@/lib/markup";
import type { PropertyTypeEnum } from "@/lib/markup";

export type MarkupRuleDTO = {
  id: string;
  propertyType?: string;
  supplierId?: string;
  supplierName?: string;
  propertyId?: string;
  propertyName?: string;
  season?: string;
  markupPercent: number;
  active: boolean;
  priority: number;
};

function toDTO(r: {
  id: string;
  propertyType: string | null;
  supplierId: string | null;
  supplier?: { name: string } | null;
  propertyId: string | null;
  property?: { name: string } | null;
  season: string | null;
  markupPercent: { toString(): string } | number;
  active: boolean;
  priority: number;
}): MarkupRuleDTO {
  return {
    id: r.id,
    ...(r.propertyType ? { propertyType: r.propertyType } : {}),
    ...(r.supplierId ? { supplierId: r.supplierId } : {}),
    ...(r.supplier ? { supplierName: r.supplier.name } : {}),
    ...(r.propertyId ? { propertyId: r.propertyId } : {}),
    ...(r.property ? { propertyName: r.property.name } : {}),
    ...(r.season ? { season: r.season } : {}),
    markupPercent: Number(r.markupPercent),
    active: r.active,
    priority: r.priority,
  };
}

export const listMarkupRules = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarkupRuleDTO[]> => {
    const rules = await db.markupRule.findMany({
      include: { supplier: { select: { name: true } }, property: { select: { name: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return rules.map(toDTO);
  },
);

export const createMarkupRule = createServerFn({ method: "POST" })
  .validator(
    (input: {
      propertyType?: PropertyTypeEnum;
      supplierId?: string;
      propertyId?: string;
      season?: string;
      markupPercent: number;
      priority?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!(data.markupPercent >= 0)) throw new Error("Markup must be 0 or more.");
    const rule = await db.markupRule.create({
      data: {
        ...(data.propertyType ? { propertyType: data.propertyType } : {}),
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
        ...(data.propertyId ? { propertyId: data.propertyId } : {}),
        ...(data.season ? { season: data.season } : {}),
        markupPercent: data.markupPercent,
        ...(data.priority != null ? { priority: data.priority } : {}),
      },
      include: { supplier: { select: { name: true } }, property: { select: { name: true } } },
    });
    return toDTO(rule);
  });

export const updateMarkupRule = createServerFn({ method: "POST" })
  .validator(
    (input: { id: string; markupPercent?: number; active?: boolean; priority?: number }) => input,
  )
  .handler(async ({ data }) => {
    const rule = await db.markupRule.update({
      where: { id: data.id },
      data: {
        ...(data.markupPercent !== undefined ? { markupPercent: data.markupPercent } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
      },
      include: { supplier: { select: { name: true } }, property: { select: { name: true } } },
    });
    return toDTO(rule);
  });

export const deleteMarkupRule = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.markupRule.delete({ where: { id } });
    return { ok: true };
  });

export const effectiveMarkupFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      propertyId: string;
      propertyType: PropertyTypeEnum;
      supplierId?: string;
      season?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const markupPercent = await getEffectiveMarkup({
      propertyId: data.propertyId,
      propertyType: data.propertyType,
      ...(data.supplierId ? { supplierId: data.supplierId } : {}),
      ...(data.season ? { season: data.season } : {}),
    });
    return { markupPercent };
  });
