import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { createBookingRecord } from "@/lib/api/bookings";
import type {
  CreateLeadInput,
  CrmMetricsDTO,
  LeadDetailDTO,
  LeadDTO,
  LeadSource,
  LeadSourceAnalyticsDTO,
  LeadStatus,
  LeadTaskDTO,
  QuoteDTO,
} from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

function toLeadDTO(lead: Prisma.LeadGetPayload<{ include: { assignedAgent: true } }>): LeadDTO {
  return {
    id: lead.id,
    source: lead.source as LeadSource,
    status: lead.status as LeadStatus,
    fullName: lead.fullName,
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.phone ? { phone: lead.phone } : {}),
    ...(lead.destination ? { destination: lead.destination } : {}),
    ...(lead.checkIn ? { checkIn: lead.checkIn.toISOString().slice(0, 10) } : {}),
    ...(lead.checkOut ? { checkOut: lead.checkOut.toISOString().slice(0, 10) } : {}),
    adults: lead.adults,
    children: lead.children,
    ...(lead.notes ? { notes: lead.notes } : {}),
    ...(lead.assignedAgentId ? { assignedAgentId: lead.assignedAgentId } : {}),
    ...(lead.assignedAgent ? { assignedAgentName: lead.assignedAgent.fullName } : {}),
    ...(lead.bookingId ? { bookingId: lead.bookingId } : {}),
    createdAt: lead.createdAt.toISOString(),
  };
}

function toQuoteDTO(quote: {
  id: string;
  leadId: string | null;
  totalPrice: { toNumber(): number } | number;
  validUntil: Date;
  notes: string | null;
  createdAt: Date;
}): QuoteDTO {
  return {
    id: quote.id,
    ...(quote.leadId ? { leadId: quote.leadId } : {}),
    totalPrice:
      typeof quote.totalPrice === "number" ? quote.totalPrice : quote.totalPrice.toNumber(),
    validUntil: quote.validUntil.toISOString().slice(0, 10),
    ...(quote.notes ? { notes: quote.notes } : {}),
    createdAt: quote.createdAt.toISOString(),
  };
}

function toTaskDTO(task: {
  id: string;
  leadId: string;
  dueAt: Date;
  completed: boolean;
  note: string;
  createdAt: Date;
}): LeadTaskDTO {
  return {
    id: task.id,
    leadId: task.leadId,
    dueAt: task.dueAt.toISOString(),
    completed: task.completed,
    note: task.note,
    createdAt: task.createdAt.toISOString(),
  };
}

const leadInclude = { assignedAgent: true } satisfies Prisma.LeadInclude;
const leadDetailInclude = {
  assignedAgent: true,
  quotes: { orderBy: { createdAt: "desc" as const } },
  tasks: { orderBy: { dueAt: "asc" as const } },
} satisfies Prisma.LeadInclude;

// Lead CRUD -----------------------------------------------------------------------------------

export const listLeads = createServerFn({ method: "GET" })
  .validator((status?: LeadStatus) => status)
  .handler(async ({ data: status }) => {
    const leads = await db.lead.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: "desc" },
      include: leadInclude,
    });
    return leads.map(toLeadDTO);
  });

export const getLead = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const lead = await db.lead.findUnique({ where: { id }, include: leadDetailInclude });
    if (!lead) return null;
    const dto: LeadDetailDTO = {
      ...toLeadDTO(lead),
      quotes: lead.quotes.map(toQuoteDTO),
      tasks: lead.tasks.map(toTaskDTO),
    };
    return dto;
  });

export const createLead = createServerFn({ method: "POST" })
  .validator((input: CreateLeadInput) => input)
  .handler(async ({ data }) => {
    const lead = await db.lead.create({
      data: {
        source: data.source,
        fullName: data.fullName,
        ...(data.email ? { email: data.email } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.destination ? { destination: data.destination } : {}),
        ...(data.checkIn ? { checkIn: new Date(data.checkIn) } : {}),
        ...(data.checkOut ? { checkOut: new Date(data.checkOut) } : {}),
        adults: data.adults ?? 2,
        children: data.children ?? 0,
        ...(data.notes ? { notes: data.notes } : {}),
        status: "NEW",
      },
      include: leadInclude,
    });
    return toLeadDTO(lead);
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: LeadStatus }) => input)
  .handler(async ({ data: { id, status } }) => {
    const lead = await db.lead.update({
      where: { id },
      data: { status },
      include: leadInclude,
    });
    return toLeadDTO(lead);
  });

export const assignLead = createServerFn({ method: "POST" })
  .validator((input: { id: string; agentId: string }) => input)
  .handler(async ({ data: { id, agentId } }) => {
    const lead = await db.lead.update({
      where: { id },
      data: { assignedAgentId: agentId },
      include: leadInclude,
    });
    return toLeadDTO(lead);
  });

// Quotes ---------------------------------------------------------------------------------------

export const createQuote = createServerFn({ method: "POST" })
  .validator(
    (input: { leadId: string; totalPrice: number; validUntil: string; notes?: string }) => input,
  )
  .handler(async ({ data }) => {
    if (data.totalPrice <= 0) throw new Error("Quote total must be greater than zero.");
    const quote = await db.quote.create({
      data: {
        leadId: data.leadId,
        totalPrice: data.totalPrice,
        validUntil: new Date(data.validUntil),
        ...(data.notes ? { notes: data.notes } : {}),
      },
    });
    // A quote pushes the lead into QUOTED.
    await db.lead.update({ where: { id: data.leadId }, data: { status: "QUOTED" } });
    return toQuoteDTO(quote);
  });

// Tasks -----------------------------------------------------------------------------------------

export const createLeadTask = createServerFn({ method: "POST" })
  .validator((input: { leadId: string; dueAt: string; note: string }) => input)
  .handler(async ({ data }) => {
    const task = await db.leadTask.create({
      data: {
        leadId: data.leadId,
        dueAt: new Date(data.dueAt),
        note: data.note,
      },
    });
    return toTaskDTO(task);
  });

export const completeLeadTask = createServerFn({ method: "POST" })
  .validator((taskId: string) => taskId)
  .handler(async ({ data: taskId }) => {
    const task = await db.leadTask.update({
      where: { id: taskId },
      data: { completed: true },
    });
    return toTaskDTO(task);
  });

// Convert to booking ----------------------------------------------------------------------------

export const convertLeadToBooking = createServerFn({ method: "POST" })
  .validator(
    (input: {
      leadId: string;
      propertyId: string;
      roomId: string;
      checkIn: string;
      checkOut: string;
      adults: number;
      children: number;
      addonIds?: string[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new Error("Lead not found.");
    if (lead.bookingId) throw new Error("This lead is already converted.");

    const booking = await createBookingRecord({
      propertyId: data.propertyId,
      roomId: data.roomId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: data.adults,
      children: data.children,
      addonIds: data.addonIds ?? [],
      customer: {
        fullName: lead.fullName,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        country: "",
      },
    });

    await db.lead.update({
      where: { id: lead.id },
      data: { status: "WON", bookingId: booking.id },
    });

    return { bookingId: booking.id, reference: booking.reference };
  });

// CRM metrics -----------------------------------------------------------------------------------

export const getCrmMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const [newCount, contacted, quoted, followUp, won, lost, followUpsDue] = await Promise.all([
    db.lead.count({ where: { status: "NEW" } }),
    db.lead.count({ where: { status: "CONTACTED" } }),
    db.lead.count({ where: { status: "QUOTED" } }),
    db.lead.count({ where: { status: "FOLLOW_UP" } }),
    db.lead.count({ where: { status: "WON" } }),
    db.lead.count({ where: { status: "LOST" } }),
    db.leadTask.count({ where: { completed: false, dueAt: { lte: new Date() } } }),
  ]);
  const metrics: CrmMetricsDTO = {
    new: newCount,
    contacted,
    quoted,
    followUp,
    won,
    lost,
    followUpsDue,
  };
  return metrics;
});

// Source analytics (feeds Sprint 15) --------------------------------------------------------------

export const getLeadSourceAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const leads = await db.lead.findMany({
    include: {
      booking: { select: { totalPrice: true } },
    },
  });

  const bySource = new Map<
    string,
    { leads: number; quoted: number; bookings: number; revenue: number }
  >();
  for (const lead of leads) {
    const entry = bySource.get(lead.source) ?? { leads: 0, quoted: 0, bookings: 0, revenue: 0 };
    entry.leads += 1;
    if (lead.status === "QUOTED" || lead.status === "FOLLOW_UP" || lead.status === "WON")
      entry.quoted += 1;
    if (lead.booking) {
      entry.bookings += 1;
      entry.revenue += Number(lead.booking.totalPrice);
    }
    bySource.set(lead.source, entry);
  }

  return [...bySource.entries()].map(
    ([source, v]) =>
      ({
        source: source as LeadSource,
        leads: v.leads,
        quoted: v.quoted,
        bookings: v.bookings,
        revenue: Math.round(v.revenue * 100) / 100,
      }) satisfies LeadSourceAnalyticsDTO,
  );
});
