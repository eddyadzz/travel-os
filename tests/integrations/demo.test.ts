import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadDemoData } from "@/lib/api/demo";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    siteContent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    cmsPage: { count: vi.fn(), create: vi.fn() },
    property: { findMany: vi.fn() },
    room: { findFirst: vi.fn() },
    rate: { findFirst: vi.fn() },
    addon: { findFirst: vi.fn(), create: vi.fn() },
    lead: { count: vi.fn(), create: vi.fn() },
    quote: { count: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
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

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.tenant.findUnique.mockResolvedValue({
    id: "t1",
    name: "Ocean Atlas",
    slug: "ocean-atlas",
    primaryColor: "#0f766e",
    accentColor: null,
    fontFamily: null,
    emailFrom: null,
    customDomain: null,
  });
  mockDb.siteContent.findUnique.mockResolvedValue(null);
  mockDb.cmsPage.count.mockResolvedValue(0);
  mockDb.property.findMany.mockResolvedValue([
    { id: "p1", name: "Velaa" },
    { id: "p2", name: "Kaani" },
  ]);
  mockDb.addon.findFirst.mockResolvedValue(null);
  mockDb.addon.create.mockResolvedValue({ id: "a1" });
  mockDb.lead.count.mockResolvedValue(1);
  mockDb.lead.create.mockResolvedValue({ id: "l1" });
  mockDb.quote.count.mockResolvedValue(0);
  mockDb.room.findFirst.mockResolvedValue({ id: "r1" });
  mockDb.rate.findFirst.mockResolvedValue({ id: "rt1", roomId: "r1", amount: 500 });
  mockDb.quote.create.mockResolvedValue({ id: "q1" });
});

describe("loadDemoData", () => {
  it("brands a default deployment and tops up demo content", async () => {
    const r = await loadDemoData();
    expect(r.branded).toBe(true);
    expect(mockDb.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Paradise Holidays Maldives" }),
      }),
    );
    expect(r.content).toBe("created");
    expect(r.pagesCreated).toBe(2);
    expect(r.addonsAdded).toBe(2); // one excursion per property
    expect(r.leadsAdded).toBe(3);
    expect(r.quotesAdded).toBe(1);
  });

  it("does not rebrand an already-branded deployment", async () => {
    mockDb.tenant.findUnique.mockResolvedValue({
      id: "t1",
      name: "Real Client",
      slug: "ocean-atlas",
      primaryColor: "#7c3aed",
      accentColor: null,
      fontFamily: null,
      emailFrom: "x@y.mv",
      customDomain: "travel.client.mv",
    });
    mockDb.siteContent.findUnique.mockResolvedValue({
      id: "sc1",
      tenantId: "t1",
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const r = await loadDemoData();
    expect(r.branded).toBe(false);
    expect(mockDb.tenant.update).not.toHaveBeenCalled();
    expect(r.content).toBe("updated");
  });

  it("skips top-ups that already exist", async () => {
    mockDb.lead.count.mockResolvedValue(20);
    mockDb.quote.count.mockResolvedValue(5);
    mockDb.addon.findFirst.mockResolvedValue({ id: "a0" });
    mockDb.cmsPage.count.mockResolvedValue(3);
    const r = await loadDemoData();
    expect(r.pagesCreated).toBe(0);
    expect(r.addonsAdded).toBe(0);
    expect(r.leadsAdded).toBe(0);
    expect(r.quotesAdded).toBe(0);
  });
});
