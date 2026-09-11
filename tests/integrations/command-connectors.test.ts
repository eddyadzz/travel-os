import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeCommandCenter } from "@/lib/api/command";
import { getChannelMappingData, saveChannelMapping, syncChannel } from "@/lib/api/channels";
import { mockBedsConnector } from "@/lib/connectors/mockbeds";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findMany: vi.fn(), count: vi.fn() },
    quote: { findMany: vi.fn(), count: vi.fn() },
    lead: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    supplierUpdateRequest: { findMany: vi.fn(), count: vi.fn() },
    contractRate: { findMany: vi.fn() },
    property: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
    supplierChannel: { findUnique: vi.fn(), update: vi.fn() },
    availability: { findUnique: vi.fn(), upsert: vi.fn() },
    rate: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    importJob: { create: vi.fn() },
    channelMapping: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/tenant-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant-context")>();
  return { ...actual, getDefaultTenantId: vi.fn().mockResolvedValue("tnt_default") };
});
vi.mock("@/lib/api/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance")>();
  return {
    ...actual,
    computePandL: vi.fn().mockResolvedValue({
      rows: [],
      totalRevenue: 100,
      totalCost: 50,
      totalProfit: 50,
      marginPercent: 50,
    }),
    computeAgentPerformance: vi.fn().mockResolvedValue({ rows: [] }),
  };
});
vi.mock("@/lib/api/predictive", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/predictive")>();
  return {
    ...actual,
    computeRevenueForecast: vi.fn().mockResolvedValue({
      windowDays: 30,
      confirmedRevenue: 5000,
      pipelineRevenue: 3000,
      expectedCollections: 7000,
      expectedProfit: 3000,
      projectedMarginPercent: 42,
      monthly: [{ month: new Date().toISOString().slice(0, 7), confirmed: 5000, expected: 6500 }],
    }),
  };
});
vi.mock("@/lib/api/scorecards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/scorecards")>();
  return {
    ...actual,
    computeSupplierScorecards: vi
      .fn()
      .mockResolvedValue([
        { supplierId: "sup1", name: "Velaa", tier: "At Risk", score: 40, contractExpiryDays: 30 },
      ]),
  };
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

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findMany.mockResolvedValue([]);
  mockDb.booking.count.mockResolvedValue(0);
  mockDb.quote.findMany.mockResolvedValue([]);
  mockDb.quote.count.mockResolvedValue(0);
  mockDb.lead.findMany.mockResolvedValue([]);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.supplier.findMany.mockResolvedValue([]);
  mockDb.supplierUpdateRequest.count.mockResolvedValue(0);
  mockDb.contractRate.findMany.mockResolvedValue([
    { supplierId: "sup1", validTo: new Date(Date.now() + 30 * 86_400_000) },
  ]);
  mockDb.tenant.findUnique.mockResolvedValue({ id: "tnt_default" });
  mockDb.property.findMany.mockResolvedValue([
    { id: "p1", rooms: [{ id: "r1", name: "Beach Villa" }] },
  ]);
  mockDb.supplierChannel.findUnique.mockResolvedValue({
    id: "ch1",
    name: "MockBeds",
    provider: "MOCKBEDS",
    baseUrl: null,
    apiKey: null,
    config: {},
    tenantId: null,
  });
  mockDb.supplierChannel.update.mockResolvedValue({ id: "ch1" });
  mockDb.availability.findUnique.mockResolvedValue(null);
  mockDb.availability.upsert.mockResolvedValue({ id: "av1" });
  mockDb.rate.findFirst.mockResolvedValue(null);
  mockDb.rate.create.mockResolvedValue({ id: "rate1" });
  mockDb.importJob.create.mockResolvedValue({ id: "job1" });
});

describe("computeCommandCenter", () => {
  it("aggregates month revenue, attention counts and lists", async () => {
    mockDb.lead.findMany.mockResolvedValue([
      { id: "l1", fullName: "Jane", source: "WEBSITE", status: "NEW", createdAt: new Date() },
    ]);
    mockDb.payment.findMany.mockResolvedValue([
      {
        id: "pay1",
        amount: 1475,
        createdAt: new Date(Date.now() - 5 * 86_400_000),
        booking: { reference: "MV-1", customer: { fullName: "Jane" } },
      },
    ]);
    mockDb.booking.findMany.mockResolvedValue([
      {
        reference: "MV-2",
        customer: { fullName: "Omar" },
        property: { name: "Velaa" },
        checkIn: new Date(Date.now() + 3 * 86_400_000),
        nights: 4,
        status: "CONFIRMED",
      },
    ]);
    mockDb.booking.count.mockResolvedValue(1);
    mockDb.supplierUpdateRequest.count.mockResolvedValue(2);
    mockDb.quote.count.mockResolvedValue(3);
    mockDb.quote.findMany.mockResolvedValue([]);

    const c = await computeCommandCenter();
    expect(c.monthRevenue.expected).toBe(6500);
    expect(c.attention).toMatchObject({
      newLeads: 1,
      openQuotes: 3,
      overdueDeposits: 1,
      supplierRequests: 2,
      atRiskSuppliers: 1,
      renewingContracts: 1,
    });
    expect(c.arrivals).toHaveLength(1);
    expect(c.arrivals[0].reference).toBe("MV-2");
    expect(c.overdueDeposits[0].ageDays).toBe(5);
    expect(c.contractsRenewing[0].expiryDays).toBe(30);
  });
});

describe("mockBedsConnector", () => {
  it("generates 90 days of availability and a rate per room with external refs", async () => {
    const out = await mockBedsConnector.sync({ config: { tenantId: "tnt_default" } });
    expect(out.availability.length).toBe(90); // 1 room × 90 days
    expect(out.rates).toHaveLength(1);
    expect(out.availability[0].propertyRef).toBe("mb-p-p1");
    expect(out.availability[0].roomRef).toBe("mb-r-r1");
    expect(out.availability[0].inventory).toBeGreaterThanOrEqual(0);
    expect(out.rates[0].amount).toBeGreaterThan(0);
  });

  it("exposes a catalog of external properties and rooms", async () => {
    const catalog = await mockBedsConnector.fetchCatalog!({ config: { tenantId: "tnt_default" } });
    expect(catalog.properties).toHaveLength(1);
    expect(catalog.properties[0].propertyRef).toBe("mb-p-p1");
    expect(catalog.properties[0].rooms[0].roomRef).toBe("mb-r-r1");
  });
});

describe("syncChannel", () => {
  it("pulls normalized inventory, maps external refs and upserts availability + rates", async () => {
    mockDb.channelMapping.findMany.mockResolvedValue([]);
    mockDb.room.findMany.mockResolvedValue([{ id: "r1", propertyId: "p1" }]);
    const r = await syncChannel("ch1");
    expect(r.ok).toBe(true);
    // External refs decoded to internal → upsert called with internal room id.
    expect(mockDb.availability.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ roomId: "r1", propertyId: "p1" }),
      }),
    );
    expect(mockDb.rate.create).toHaveBeenCalled();
    expect(mockDb.importJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "AVAILABILITY", status: "COMPLETED" }),
      }),
    );
    expect(mockDb.supplierChannel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncStatus: "SUCCESS", lastSyncAt: expect.any(Date) }),
      }),
    );
  });

  it("marks a channel failed when the connector throws", async () => {
    mockDb.property.findMany.mockResolvedValue([]); // connector throws "No properties available"
    await expect(syncChannel("ch1")).rejects.toThrow(/no properties/i);
    expect(mockDb.supplierChannel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncStatus: "FAILED", lastError: expect.any(String) }),
      }),
    );
  });
});

describe("channel mapping", () => {
  it("saves an external→internal room mapping", async () => {
    mockDb.channelMapping.upsert.mockResolvedValue({
      id: "m1",
      channelId: "ch1",
      externalPropertyRef: "mb-p-p1",
      externalRoomRef: "mb-r-r1",
      internalPropertyId: "p1",
      internalRoomId: "r1",
      active: true,
    });
    const m = await saveChannelMapping({
      data: {
        channelId: "ch1",
        externalPropertyRef: "mb-p-p1",
        externalRoomRef: "mb-r-r1",
        internalPropertyId: "p1",
        internalRoomId: "r1",
      },
    });
    expect(m.internalRoomId).toBe("r1");
    expect(mockDb.channelMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          channelId_externalPropertyRef_externalRoomRef: {
            channelId: "ch1",
            externalPropertyRef: "mb-p-p1",
            externalRoomRef: "mb-r-r1",
          },
        },
      }),
    );
  });

  it("returns the catalog, internal properties and existing mappings for the mapping UI", async () => {
    mockDb.supplierChannel.findUnique.mockResolvedValue({
      id: "ch1",
      name: "MockBeds",
      provider: "MOCKBEDS",
      config: {},
    });
    mockDb.property.findMany.mockResolvedValue([
      { id: "p1", name: "Velaa", atoll: "Noonu", rooms: [{ id: "r1", name: "Beach Villa" }] },
    ]);
    mockDb.channelMapping.findMany.mockResolvedValue([
      {
        id: "m1",
        channelId: "ch1",
        externalPropertyRef: "mb-p-p1",
        externalRoomRef: "mb-r-r1",
        internalPropertyId: "p1",
        internalRoomId: "r1",
        active: true,
      },
    ]);
    const data = await getChannelMappingData({ data: "ch1" });
    expect(data?.catalog.properties[0].propertyRef).toBe("mb-p-p1");
    expect(data?.internalProperties).toHaveLength(1);
    expect(data?.mappings).toHaveLength(1);
  });
});
