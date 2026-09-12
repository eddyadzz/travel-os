import { createServerFn } from "@tanstack/react-start";
import { randomToken } from "@/lib/crypto.server";
import { db } from "@/lib/db.server";
import type {
  BookingCostingDTO,
  ContractRateDTO,
  SupplierConfirmationDTO,
  SupplierContactDTO,
  SupplierDTO,
  SupplierDashboardDTO,
  SupplierStatus,
  SupplierType,
} from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import { notifySupplierPortalAccess } from "@/lib/notifications/service";

// Costing engine --------------------------------------------------------------------------

/**
 * Computes booking revenue / supplier cost / gross profit.
 * revenue = booking.totalPrice
 * supplierCost = net rate from the property's linked supplier for the stay
 * grossProfit = revenue - supplierCost
 */
export async function computeBookingCosting(bookingId: string): Promise<BookingCostingDTO | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { property: { include: { supplier: true } } },
  });
  if (!booking) return null;

  const revenue = Number(booking.totalPrice);

  // Find the supplier net rate covering the stay for the booked room.
  let supplierCost = 0;
  if (booking.property.supplier) {
    const rate = await db.contractRate.findFirst({
      where: {
        supplierId: booking.property.supplier.id,
        validFrom: { lte: booking.checkIn },
        validTo: { gte: booking.checkOut },
        ...(booking.roomId ? { roomId: booking.roomId } : {}),
      },
      orderBy: { validFrom: "desc" },
    });
    if (rate) {
      supplierCost = Number(rate.netRate) * booking.nights;
    }
  }

  const grossProfit = revenue - supplierCost;
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    bookingId: booking.id,
    reference: booking.reference,
    revenue,
    supplierCost,
    grossProfit,
    marginPercent: Math.round(marginPercent * 100) / 100,
  };
}

export const getBookingCosting = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    return computeBookingCosting(bookingId);
  });

// Supplier CRUD -----------------------------------------------------------------------------

function toSupplierDTO(s: Prisma.SupplierGetPayload<Record<string, never>>): SupplierDTO {
  return {
    id: s.id,
    name: s.name,
    type: s.type as SupplierType,
    ...(s.email ? { email: s.email } : {}),
    ...(s.phone ? { phone: s.phone } : {}),
    ...(s.contactPerson ? { contactPerson: s.contactPerson } : {}),
    active: s.active,
  };
}

export const listSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const suppliers = await db.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return suppliers.map(toSupplierDTO);
});

export const getSupplier = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: { contacts: true, contractRates: true },
    });
    if (!supplier) return null;
    return {
      ...toSupplierDTO(supplier),
      contacts: supplier.contacts.map(
        (c) =>
          ({
            id: c.id,
            supplierId: c.supplierId,
            name: c.name,
            role: c.role,
            ...(c.email ? { email: c.email } : {}),
            ...(c.phone ? { phone: c.phone } : {}),
          }) satisfies SupplierContactDTO,
      ),
      contractRates: supplier.contractRates.map(
        (r) =>
          ({
            id: r.id,
            supplierId: r.supplierId,
            ...(r.roomId ? { roomId: r.roomId } : {}),
            validFrom: r.validFrom.toISOString().slice(0, 10),
            validTo: r.validTo.toISOString().slice(0, 10),
            netRate: Number(r.netRate),
          }) satisfies ContractRateDTO,
      ),
    };
  });

export const createSupplier = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      type: SupplierType;
      email?: string;
      phone?: string;
      contactPerson?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const supplier = await db.supplier.create({
      data: {
        name: data.name,
        type: data.type,
        ...(data.email ? { email: data.email } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.contactPerson ? { contactPerson: data.contactPerson } : {}),
      },
    });
    return toSupplierDTO(supplier);
  });

// Supplier portal access ------------------------------------------------------------------------

function portalLinkFor(token: string) {
  return `/supplier/${token}`;
}

async function ensureSupplierToken(supplierId: string): Promise<string> {
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");
  if (supplier.accessToken) return supplier.accessToken;
  const token = randomToken(16);
  await db.supplier.update({ where: { id: supplierId }, data: { accessToken: token } });
  return token;
}

export const getSupplierPortalAccess = createServerFn({ method: "GET" })
  .validator((supplierId: string) => supplierId)
  .handler(async ({ data: supplierId }) => {
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return null;
    const token = await ensureSupplierToken(supplierId);
    return {
      token,
      link: portalLinkFor(token),
      ...(supplier.email ? { email: supplier.email } : {}),
    };
  });

export const sendSupplierPortalAccess = createServerFn({ method: "POST" })
  .validator((supplierId: string) => supplierId)
  .handler(async ({ data: supplierId }) => {
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error("Supplier not found");
    if (!supplier.email) throw new Error("Supplier has no email address");
    const token = await ensureSupplierToken(supplierId);
    const link = portalLinkFor(token);
    await notifySupplierPortalAccess({
      recipient: supplier.email,
      supplier: supplier.name,
      link,
    });
    return { sent: true, link, email: supplier.email };
  });

// Supplier confirmations ----------------------------------------------------------------------

function toConfirmationDTO(
  c: Prisma.SupplierConfirmationGetPayload<{ include: { supplier: true } }>,
): SupplierConfirmationDTO {
  return {
    id: c.id,
    bookingId: c.bookingId,
    supplierId: c.supplierId,
    supplierName: c.supplier.name,
    status: c.status as SupplierStatus,
    ...(c.reference ? { reference: c.reference } : {}),
    ...(c.notes ? { notes: c.notes } : {}),
    ...(c.confirmedAt ? { confirmedAt: c.confirmedAt.toISOString() } : {}),
    createdAt: c.createdAt.toISOString(),
  };
}

export const listSupplierConfirmations = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    const confirmations = await db.supplierConfirmation.findMany({
      where: { bookingId },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return confirmations.map(toConfirmationDTO);
  });

export const createSupplierConfirmation = createServerFn({ method: "POST" })
  .validator((input: { bookingId: string; supplierId: string; notes?: string }) => input)
  .handler(async ({ data }) => {
    const existing = await db.supplierConfirmation.findUnique({
      where: { bookingId_supplierId: { bookingId: data.bookingId, supplierId: data.supplierId } },
    });
    if (existing) throw new Error("A confirmation already exists for this supplier.");

    const confirmation = await db.supplierConfirmation.create({
      data: {
        bookingId: data.bookingId,
        supplierId: data.supplierId,
        status: "REQUESTED",
        ...(data.notes ? { notes: data.notes } : {}),
      },
      include: { supplier: true },
    });
    await db.bookingEvent.create({
      data: {
        bookingId: data.bookingId,
        type: "SUPPLIER_UPDATED",
        message: `Confirmation requested from ${confirmation.supplier.name}`,
      },
    });
    return toConfirmationDTO(confirmation);
  });

export const updateSupplierConfirmation = createServerFn({ method: "POST" })
  .validator(
    (input: { id: string; status?: SupplierStatus; reference?: string; notes?: string }) => input,
  )
  .handler(async ({ data }) => {
    const existing = await db.supplierConfirmation.findUnique({
      where: { id: data.id },
      include: { supplier: true },
    });
    if (!existing) throw new Error("Confirmation not found.");

    const confirmation = await db.supplierConfirmation.update({
      where: { id: data.id },
      data: {
        ...(data.status
          ? {
              status: data.status,
              ...(data.status === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
            }
          : {}),
        ...(data.reference ? { reference: data.reference } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
      },
      include: { supplier: true },
    });
    if (data.status) {
      await db.bookingEvent.create({
        data: {
          bookingId: existing.bookingId,
          type: "SUPPLIER_UPDATED",
          message: `${existing.supplier.name} confirmation ${data.status.toLowerCase()}`,
        },
      });
    }
    return toConfirmationDTO(confirmation);
  });

// Dashboard -----------------------------------------------------------------------------------

export const getSupplierDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const [awaiting, confirmed, pending, bySupplier] = await Promise.all([
    db.supplierConfirmation.count({ where: { status: "REQUESTED" } }),
    db.supplierConfirmation.count({ where: { status: "CONFIRMED" } }),
    db.supplierConfirmation.count({ where: { status: "REQUESTED" } }),
    db.supplierConfirmation.groupBy({
      by: ["supplierId"],
      _count: { _all: true },
    }),
  ]);

  const suppliers = await db.supplier.findMany({
    where: { id: { in: bySupplier.map((g) => g.supplierId) } },
  });
  const byName = new Map(suppliers.map((s) => [s.id, s.name]));

  const dashboard: SupplierDashboardDTO = {
    awaitingConfirmation: awaiting,
    confirmed,
    pendingResponse: pending,
    bySupplier: bySupplier.map((g) => ({
      supplierId: g.supplierId,
      name: byName.get(g.supplierId) ?? "Unknown",
      count: g._count._all,
    })),
  };
  return dashboard;
});
