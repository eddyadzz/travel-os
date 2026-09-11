import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assignLead,
  completeLeadTask,
  convertLeadToBooking,
  createLead,
  createLeadTask,
  createQuote,
  getCrmMetrics,
  getLead,
  getLeadSourceAnalytics,
  listLeads,
  updateLeadStatus,
} from "@/lib/api/leads";
import * as bookings from "@/lib/api/bookings";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    lead: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    quote: { create: vi.fn() },
    leadTask: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/api/bookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/bookings")>();
  return { ...actual, createBookingRecord: vi.fn() };
});
vi.mock("@tanstack/react-start", () => {
  const handler = (h: (ctx: { data: unknown }) => unknown) => async (opts?: { data: unknown }) =>
    h({ data: opts?.data });
  return {
    createServerFn: () => ({
      validator: () => ({ handler }),
      handler,
    }),
  };
});

function leadRow(overrides = {}) {
  return {
    id: "l1",
    source: "WHATSAPP",
    status: "NEW",
    fullName: "Omar Farouk",
    email: "omar@mail.com",
    phone: null,
    destination: null,
    checkIn: null,
    checkOut: null,
    adults: 2,
    children: 0,
    notes: null,
    assignedAgentId: null,
    assignedAgent: null,
    bookingId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.lead.findMany.mockResolvedValue([leadRow()]);
  mockDb.lead.findUnique.mockResolvedValue(leadRow());
  mockDb.lead.create.mockResolvedValue(leadRow());
  mockDb.lead.update.mockResolvedValue(leadRow({ status: "CONTACTED" }));
  mockDb.quote.create.mockResolvedValue({
    id: "q1",
    leadId: "l1",
    totalPrice: 5000,
    validUntil: new Date("2026-09-30"),
    notes: null,
    createdAt: new Date(),
  });
  mockDb.leadTask.create.mockResolvedValue({
    id: "t1",
    leadId: "l1",
    dueAt: new Date("2026-08-25"),
    completed: false,
    note: "Follow up",
    createdAt: new Date(),
  });
  mockDb.leadTask.update.mockResolvedValue({
    id: "t1",
    leadId: "l1",
    dueAt: new Date("2026-08-25"),
    completed: true,
    note: "Follow up",
    createdAt: new Date(),
  });
  mockDb.lead.count.mockResolvedValue(1);
  mockDb.leadTask.count.mockResolvedValue(1);
  (bookings.createBookingRecord as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "b1",
    reference: "MV-99999",
  });
});

describe("listLeads", () => {
  it("returns leads, optionally filtered by status", async () => {
    const all = await listLeads();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "l1", source: "WHATSAPP", status: "NEW" });

    mockDb.lead.findMany.mockClear();
    await listLeads({ data: "NEW" });
    expect(mockDb.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "NEW" } }),
    );
  });
});

describe("getLead", () => {
  it("returns a lead with quotes and tasks", async () => {
    mockDb.lead.findUnique.mockResolvedValue({
      ...leadRow(),
      quotes: [
        {
          id: "q1",
          leadId: "l1",
          totalPrice: 5000,
          validUntil: new Date("2026-09-30"),
          notes: null,
          createdAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t1",
          leadId: "l1",
          dueAt: new Date(),
          completed: false,
          note: "n",
          createdAt: new Date(),
        },
      ],
    });
    const result = await getLead({ data: "l1" });
    expect(result).toMatchObject({ id: "l1" });
    expect(result.quotes).toHaveLength(1);
    expect(result.tasks).toHaveLength(1);
  });

  it("returns null when not found", async () => {
    mockDb.lead.findUnique.mockResolvedValue(null);
    expect(await getLead({ data: "nope" })).toBeNull();
  });
});

describe("createLead", () => {
  it("creates a NEW lead", async () => {
    const result = await createLead({ data: { source: "WEBSITE", fullName: "Jane" } });
    expect(mockDb.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "WEBSITE",
        fullName: "Jane",
        status: "NEW",
        adults: 2,
        children: 0,
      }),
      include: expect.anything(),
    });
    expect(result.status).toBe("NEW");
  });
});

describe("updateLeadStatus / assignLead", () => {
  it("updates status", async () => {
    const result = await updateLeadStatus({ data: { id: "l1", status: "CONTACTED" } });
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "CONTACTED" },
      include: expect.anything(),
    });
    expect(result.status).toBe("CONTACTED");
  });

  it("assigns an agent", async () => {
    await assignLead({ data: { id: "l1", agentId: "a1" } });
    expect(mockDb.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignedAgentId: "a1" } }),
    );
  });
});

describe("createQuote", () => {
  it("creates a quote and moves the lead to QUOTED", async () => {
    const result = await createQuote({
      data: { leadId: "l1", totalPrice: 5000, validUntil: "2026-09-30" },
    });
    expect(result.totalPrice).toBe(5000);
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "QUOTED" },
    });
  });

  it("rejects a non-positive quote", async () => {
    await expect(
      createQuote({ data: { leadId: "l1", totalPrice: 0, validUntil: "2026-09-30" } }),
    ).rejects.toThrow(/greater than zero/);
  });
});

describe("createLeadTask / completeLeadTask", () => {
  it("creates a follow-up task", async () => {
    const result = await createLeadTask({
      data: { leadId: "l1", dueAt: "2026-08-25", note: "Follow up" },
    });
    expect(result.note).toBe("Follow up");
    expect(result.completed).toBe(false);
  });

  it("completes a task", async () => {
    const result = await completeLeadTask({ data: "t1" });
    expect(result.completed).toBe(true);
  });
});

describe("convertLeadToBooking", () => {
  it("creates a booking from a lead and marks it WON", async () => {
    mockDb.lead.findUnique.mockResolvedValue(leadRow());
    const result = await convertLeadToBooking({
      data: {
        leadId: "l1",
        propertyId: "p1",
        roomId: "r1",
        checkIn: "2026-09-10",
        checkOut: "2026-09-15",
        adults: 2,
        children: 0,
      },
    });
    expect(bookings.createBookingRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: "p1",
        roomId: "r1",
        customer: expect.objectContaining({ fullName: "Omar Farouk" }),
      }),
    );
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "WON", bookingId: "b1" },
    });
    expect(result).toMatchObject({ bookingId: "b1", reference: "MV-99999" });
  });

  it("rejects an already-converted lead", async () => {
    mockDb.lead.findUnique.mockResolvedValue(leadRow({ bookingId: "b1" }));
    await expect(
      convertLeadToBooking({
        data: {
          leadId: "l1",
          propertyId: "p1",
          roomId: "r1",
          checkIn: "x",
          checkOut: "y",
          adults: 2,
          children: 0,
        },
      }),
    ).rejects.toThrow(/already converted/);
  });
});

describe("getCrmMetrics", () => {
  it("returns pipeline counts and follow-ups due", async () => {
    mockDb.lead.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    const m = await getCrmMetrics();
    expect(m).toMatchObject({
      new: 2,
      contacted: 1,
      quoted: 1,
      followUp: 1,
      won: 1,
      lost: 1,
      followUpsDue: 1,
    });
  });
});

describe("getLeadSourceAnalytics", () => {
  it("aggregates leads by source with bookings and revenue", async () => {
    mockDb.lead.findMany.mockResolvedValue([
      { source: "INSTAGRAM", status: "WON", booking: { totalPrice: 8200 } },
      { source: "INSTAGRAM", status: "NEW", booking: null },
      { source: "WHATSAPP", status: "QUOTED", booking: null },
    ]);
    const rows = await getLeadSourceAnalytics();
    expect(rows).toHaveLength(2);
    const instagram = rows.find((r) => r.source === "INSTAGRAM");
    expect(instagram).toMatchObject({ leads: 2, quoted: 1, bookings: 1, revenue: 8200 });
  });
});
