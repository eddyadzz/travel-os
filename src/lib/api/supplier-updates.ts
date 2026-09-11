import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { notifySupplierUpdateRequest } from "@/lib/notifications/service";
import type {
  SupplierScorecardRow,
  SupplierUpdateMetricsDTO,
  SupplierUpdateRequestDTO,
  SupplierUpdateStatus,
  SupplierUpdateType,
} from "@/lib/types";

const OVERDUE_THRESHOLD_DAYS = 7;

function computeStatus(request: {
  status: string;
  dueAt: Date;
  receivedAt: Date | null;
  importedAt: Date | null;
}): SupplierUpdateRequestDTO["status"] {
  // A request that was received or imported is never OVERDUE.
  if (
    request.status === "REQUESTED" &&
    !request.receivedAt &&
    !request.importedAt &&
    request.dueAt.getTime() < Date.now()
  ) {
    return "OVERDUE";
  }
  return request.status as SupplierUpdateRequestDTO["status"];
}

function toDTO(r: {
  id: string;
  supplierId: string;
  type: string;
  requestedAt: Date;
  dueAt: Date;
  status: string;
  requestedBy: string | null;
  notes: string | null;
  receivedAt: Date | null;
  importedAt: Date | null;
  supplier: { name: string };
}): SupplierUpdateRequestDTO {
  return {
    id: r.id,
    supplierId: r.supplierId,
    supplierName: r.supplier.name,
    type: r.type as SupplierUpdateType,
    requestedAt: r.requestedAt.toISOString(),
    dueAt: r.dueAt.toISOString().slice(0, 10),
    status: computeStatus(r),
    ...(r.requestedBy ? { requestedBy: r.requestedBy } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.receivedAt ? { receivedAt: r.receivedAt.toISOString() } : {}),
    ...(r.importedAt ? { importedAt: r.importedAt.toISOString() } : {}),
  };
}

export const listSupplierUpdateRequests = createServerFn({ method: "GET" }).handler(async () => {
  const requests = await db.supplierUpdateRequest.findMany({
    include: { supplier: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
  });
  return requests.map(toDTO);
});

export const createSupplierUpdateRequest = createServerFn({ method: "POST" })
  .validator(
    (input: { supplierId: string; type: SupplierUpdateType; dueAt?: string; notes?: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw new Error("Supplier not found.");

    const dueAt = data.dueAt ? new Date(data.dueAt) : new Date(Date.now() + 3 * 86_400_000);

    const request = await db.supplierUpdateRequest.create({
      data: {
        supplierId: data.supplierId,
        type: data.type,
        dueAt,
        requestedBy: "agent",
        ...(data.notes ? { notes: data.notes } : {}),
      },
      include: { supplier: { select: { name: true } } },
    });

    if (supplier.email) {
      const age = await computeSupplierDataAge(data.supplierId, data.type);
      await notifySupplierUpdateRequest({
        recipient: supplier.email,
        supplier: supplier.name,
        type: data.type,
        daysOld: age,
      });
    }
    return toDTO(request);
  });

export const updateSupplierUpdateRequest = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: "RECEIVED" | "IMPORTED" | "CANCELLED" }) => input)
  .handler(async ({ data: { id, status } }) => {
    const request = await db.supplierUpdateRequest.update({
      where: { id },
      data: {
        status,
        ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}),
        ...(status === "IMPORTED" ? { importedAt: new Date() } : {}),
      },
      include: { supplier: { select: { name: true } } },
    });
    return toDTO(request);
  });

export const getSupplierUpdateMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [pending, overdue, receivedToday, importedToday] = await Promise.all([
    db.supplierUpdateRequest.count({
      where: { status: "REQUESTED", dueAt: { gte: new Date(now) } },
    }),
    db.supplierUpdateRequest.count({
      where: { status: "REQUESTED", dueAt: { lt: new Date(now) } },
    }),
    db.supplierUpdateRequest.count({ where: { receivedAt: { gte: dayStart } } }),
    db.supplierUpdateRequest.count({ where: { importedAt: { gte: dayStart } } }),
  ]);
  const metrics: SupplierUpdateMetricsDTO = { pending, overdue, receivedToday, importedToday };
  return metrics;
});

/** Newest availability/rate data age (in days) for a supplier's properties. */
async function computeSupplierDataAge(
  supplierId: string,
  type: SupplierUpdateType,
): Promise<number> {
  if (type === "AVAILABILITY") {
    const agg = await db.availability.aggregate({
      where: { property: { supplierId } },
      _max: { updatedAt: true },
    });
    const latest = agg._max.updatedAt;
    if (!latest) return 999;
    return Math.floor((Date.now() - latest.getTime()) / 86_400_000);
  }
  // RATES: use the most recent RATES import for any of the supplier's properties.
  const propertyIds = await db.property.findMany({
    where: { supplierId },
    select: { id: true },
  });
  const imports = await db.importJob.findFirst({
    where: { type: "RATES", status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });
  return imports ? Math.floor((Date.now() - imports.createdAt.getTime()) / 86_400_000) : 999;
}

/**
 * Automatic detection: creates REQUESTED requests (and emails) for suppliers
 * whose availability data is older than the threshold. Safe to run repeatedly —
 * it skips suppliers that already have an open request.
 */
export async function runSupplierUpdateScan(thresholdDays = OVERDUE_THRESHOLD_DAYS) {
  const suppliers = await db.supplier.findMany({
    where: { active: true, properties: { some: {} } },
    include: { properties: { select: { id: true } } },
  });

  let created = 0;
  for (const supplier of suppliers) {
    const age = await computeSupplierDataAge(supplier.id, "AVAILABILITY");
    if (age <= thresholdDays) continue;

    const open = await db.supplierUpdateRequest.findFirst({
      where: {
        supplierId: supplier.id,
        type: "AVAILABILITY",
        status: { in: ["REQUESTED", "RECEIVED"] },
      },
    });
    if (open) continue;

    await db.supplierUpdateRequest.create({
      data: {
        supplierId: supplier.id,
        type: "AVAILABILITY",
        dueAt: new Date(Date.now() + 3 * 86_400_000),
        requestedBy: "system",
        notes: `Availability data ${age} days old (threshold ${thresholdDays})`,
      },
    });
    created += 1;
    if (supplier.email) {
      await notifySupplierUpdateRequest({
        recipient: supplier.email,
        supplier: supplier.name,
        type: "AVAILABILITY",
        daysOld: age,
      });
    }
  }
  return { created, scanned: suppliers.length };
}

export const runSupplierUpdateScanFn = createServerFn({ method: "POST" })
  .validator((thresholdDays?: number) => thresholdDays)
  .handler(async ({ data }) => runSupplierUpdateScan(data ?? OVERDUE_THRESHOLD_DAYS));

/**
 * Closes the loop: marks open SupplierUpdateRequests as IMPORTED when a file
 * from that supplier is imported. Called by the importers.
 */
export async function markSupplierRequestsImported(
  type: SupplierUpdateType,
  propertyIds: string[],
): Promise<number> {
  if (propertyIds.length === 0) return 0;
  const properties = await db.property.findMany({
    where: { id: { in: propertyIds }, supplierId: { not: null } },
    select: { supplierId: true },
  });
  const supplierIds = [...new Set(properties.map((p) => p.supplierId!))];
  if (supplierIds.length === 0) return 0;

  const result = await db.supplierUpdateRequest.updateMany({
    where: { supplierId: { in: supplierIds }, type, status: { in: ["REQUESTED", "RECEIVED"] } },
    data: { status: "IMPORTED", importedAt: new Date() },
  });
  return result.count;
}

export const getSupplierScorecard = createServerFn({ method: "GET" }).handler(async () => {
  const requests = await db.supplierUpdateRequest.findMany({
    include: { supplier: { select: { name: true } } },
  });

  const bySupplier = new Map<
    string,
    { name: string; total: number; overdueCount: number; responseMs: number; responded: number }
  >();
  for (const r of requests) {
    const entry = bySupplier.get(r.supplierId) ?? {
      name: r.supplier.name,
      total: 0,
      overdueCount: 0,
      responseMs: 0,
      responded: 0,
    };
    entry.total += 1;
    if (computeStatus(r) === "OVERDUE") entry.overdueCount += 1;
    if (r.receivedAt || r.importedAt) {
      const resolvedAt = r.importedAt ?? r.receivedAt!;
      entry.responseMs += resolvedAt.getTime() - r.requestedAt.getTime();
      entry.responded += 1;
    }
    bySupplier.set(r.supplierId, entry);
  }

  return [...bySupplier.values()].map(
    (s) =>
      ({
        supplierId: s.name,
        name: s.name,
        total: s.total,
        avgResponseHours:
          s.responded > 0 ? Math.round((s.responseMs / s.responded / 3_600_000) * 10) / 10 : 0,
        overdueCount: s.overdueCount,
        overduePercent: s.total > 0 ? Math.round((s.overdueCount / s.total) * 1000) / 10 : 0,
      }) satisfies SupplierScorecardRow,
  );
});
