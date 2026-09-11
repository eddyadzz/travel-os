import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSupplierUpdateRequest,
  getSupplierScorecard,
  getSupplierUpdateMetrics,
  listSupplierUpdateRequests,
  markSupplierRequestsImported,
  runSupplierUpdateScan,
  updateSupplierUpdateRequest,
} from "@/lib/api/supplier-updates";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    supplier: { findMany: vi.fn(), findUnique: vi.fn() },
    supplierUpdateRequest: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    availability: { aggregate: vi.fn() },
    property: { findMany: vi.fn() },
    importJob: { findFirst: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));
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

function requestRow(overrides = {}) {
  return {
    id: "u1",
    supplierId: "s1",
    type: "AVAILABILITY",
    requestedAt: new Date("2026-08-25"),
    dueAt: new Date("2026-08-28"),
    status: "REQUESTED",
    requestedBy: "system",
    notes: null,
    receivedAt: null,
    importedAt: null,
    supplier: { name: "Velaa" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.supplier.findMany.mockResolvedValue([
    { id: "s1", name: "Velaa", email: "res@velaa.com", active: true, properties: [{ id: "p1" }] },
    { id: "s2", name: "Kaani", email: "res@kaani.com", active: true, properties: [{ id: "p2" }] },
  ]);
  mockDb.supplier.findUnique.mockResolvedValue({ id: "s1", name: "Velaa", email: "res@velaa.com" });
  mockDb.supplierUpdateRequest.findMany.mockResolvedValue([requestRow()]);
  mockDb.supplierUpdateRequest.create.mockResolvedValue(requestRow());
  mockDb.supplierUpdateRequest.update.mockResolvedValue(requestRow({ status: "RECEIVED" }));
  mockDb.supplierUpdateRequest.updateMany.mockResolvedValue({ count: 1 });
  mockDb.supplierUpdateRequest.count.mockResolvedValue(1);
  mockDb.supplierUpdateRequest.findFirst.mockResolvedValue(null);
  mockDb.availability.aggregate.mockResolvedValue({
    _max: { updatedAt: new Date(Date.now() - 10 * 86_400_000) },
  });
  mockDb.property.findMany.mockResolvedValue([{ id: "p1", supplierId: "s1" }]);
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
});

describe("listSupplierUpdateRequests", () => {
  it("returns requests with computed OVERDUE status", async () => {
    mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
      requestRow({ status: "REQUESTED", dueAt: new Date(Date.now() - 86_400_000) }), // past due
      requestRow({ id: "u2", status: "REQUESTED", dueAt: new Date(Date.now() + 86_400_000) }),
    ]);
    const rows = await listSupplierUpdateRequests();
    expect(rows[0].status).toBe("OVERDUE");
    expect(rows[1].status).toBe("REQUESTED");
    expect(rows[0].supplierName).toBe("Velaa");
  });
});

describe("createSupplierUpdateRequest", () => {
  it("creates a request and emails the supplier", async () => {
    await createSupplierUpdateRequest({ data: { supplierId: "s1", type: "AVAILABILITY" } });
    expect(mockDb.supplierUpdateRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierId: "s1",
          type: "AVAILABILITY",
          requestedBy: "agent",
        }),
      }),
    );
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: "res@velaa.com",
        type: "SUPPLIER_UPDATE",
        subject: expect.stringContaining("Update Request"),
      }),
    });
  });
});

describe("updateSupplierUpdateRequest", () => {
  it("marks a request IMPORTED with importedAt", async () => {
    await updateSupplierUpdateRequest({ data: { id: "u1", status: "IMPORTED" } });
    expect(mockDb.supplierUpdateRequest.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ status: "IMPORTED", importedAt: expect.any(Date) }),
      include: expect.anything(),
    });
  });
});

describe("getSupplierUpdateMetrics", () => {
  it("returns pending, overdue, received and imported counts", async () => {
    const m = await getSupplierUpdateMetrics();
    expect(m).toMatchObject({ pending: 1, overdue: 1, receivedToday: 1, importedToday: 1 });
  });
});

describe("runSupplierUpdateScan", () => {
  it("creates REQUESTED requests only for stale suppliers", async () => {
    mockDb.availability.aggregate.mockResolvedValue({
      _max: { updatedAt: new Date(Date.now() - 20 * 86_400_000) }, // 20 days old -> stale
    });
    const result = await runSupplierUpdateScan(7);
    expect(result.created).toBe(2); // both suppliers stale
    expect(mockDb.supplierUpdateRequest.create).toHaveBeenCalledTimes(2);
    expect(mockDb.supplierUpdateRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "AVAILABILITY", requestedBy: "system" }),
      }),
    );
  });

  it("skips suppliers that already have an open request", async () => {
    mockDb.supplierUpdateRequest.findFirst.mockResolvedValue(requestRow());
    const result = await runSupplierUpdateScan(7);
    expect(result.created).toBe(0);
    expect(mockDb.supplierUpdateRequest.create).not.toHaveBeenCalled();
  });

  it("skips suppliers whose data is fresh", async () => {
    mockDb.availability.aggregate.mockResolvedValue({
      _max: { updatedAt: new Date(Date.now() - 1 * 86_400_000) }, // 1 day old -> fresh
    });
    const result = await runSupplierUpdateScan(7);
    expect(result.created).toBe(0);
  });
});

describe("markSupplierRequestsImported", () => {
  it("marks open requests IMPORTED for the affected suppliers", async () => {
    const count = await markSupplierRequestsImported("AVAILABILITY", ["p1"]);
    expect(mockDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["p1"] } }) }),
    );
    expect(mockDb.supplierUpdateRequest.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ supplierId: { in: ["s1"] }, type: "AVAILABILITY" }),
      data: expect.objectContaining({ status: "IMPORTED" }),
    });
    expect(count).toBe(1);
  });

  it("returns 0 when no properties map to suppliers", async () => {
    mockDb.property.findMany.mockResolvedValue([]);
    expect(await markSupplierRequestsImported("RATES", ["p9"])).toBe(0);
  });
});

describe("getSupplierScorecard", () => {
  it("computes avg response hours and overdue percent", async () => {
    mockDb.supplierUpdateRequest.findMany.mockResolvedValue([
      requestRow({
        requestedAt: new Date(Date.now() - 5 * 86_400_000),
        dueAt: new Date(Date.now() - 3 * 86_400_000),
        receivedAt: new Date(Date.now() - 4 * 86_400_000),
      }),
      requestRow({ id: "u2", status: "REQUESTED", dueAt: new Date(Date.now() - 2 * 86_400_000) }), // overdue
    ]);
    const rows = await getSupplierScorecard();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Velaa", total: 2, overdueCount: 1, overduePercent: 50 });
    expect(rows[0].avgResponseHours).toBe(24); // 1 day response
  });
});
