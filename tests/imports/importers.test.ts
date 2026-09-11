import { describe, expect, it, vi, beforeEach } from "vitest";
import { importRates, importAvailability } from "@/lib/imports/importers";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    importJob: { create: vi.fn(), update: vi.fn() },
    importError: { createMany: vi.fn() },
    importChange: { createMany: vi.fn() },
    rate: { createMany: vi.fn() },
    availability: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    property: { findMany: vi.fn() },
    supplierUpdateRequest: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));

const props = [
  {
    id: "p1",
    name: "Velaa Lagoon Resort & Spa",
    slug: "velaa-lagoon-resort",
    status: "ACTIVE",
    rooms: [{ id: "r1", name: "Overwater Villa" }],
  },
];

const rateRows = [
  {
    rowNumber: 2,
    propertyName: "Velaa Lagoon Resort & Spa",
    roomName: "Overwater Villa",
    validFrom: "2026-05-01",
    validTo: "2026-10-31",
    amount: 500,
  },
  {
    rowNumber: 3,
    propertyName: "Ghost Resort",
    roomName: "Villa",
    validFrom: "2026-05-01",
    validTo: "2026-10-31",
    amount: 100,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.property.findMany.mockResolvedValue(props);
  mockDb.importJob.create.mockResolvedValue({
    id: "job1",
    type: "RATES",
    filename: "x",
    status: "IMPORTING",
    totalRows: 2,
    successRows: 1,
    failedRows: 1,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockDb.importJob.update.mockImplementation(({ where, data }) =>
    Promise.resolve({
      id: where.id,
      type: "RATES",
      filename: "x",
      ...data,
      totalRows: 2,
      successRows: 1,
      failedRows: 1,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  mockDb.importError.createMany.mockResolvedValue({ count: 0 });
  mockDb.importChange.createMany.mockResolvedValue({ count: 0 });
  mockDb.rate.createMany.mockResolvedValue({ count: 1 });
  mockDb.availability.findUnique.mockResolvedValue({ id: "av1", inventory: 6 });
  mockDb.availability.create.mockResolvedValue({ id: "av1" });
  mockDb.availability.update.mockResolvedValue({ id: "av1" });
  // Validators query properties with full fields; markSupplierRequestsImported
  // queries with a select. Branch on the call shape.
  mockDb.property.findMany.mockImplementation((args?: { select?: unknown }) =>
    args?.select ? Promise.resolve([{ id: "p1", supplierId: "s1" }]) : Promise.resolve(props),
  );
  mockDb.supplierUpdateRequest.updateMany.mockResolvedValue({ count: 0 });
});

describe("importRates", () => {
  it("creates a job, persists valid rates, and records errors", async () => {
    const result = await importRates(rateRows, "rates.xlsx");

    expect(mockDb.importJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "RATES",
        filename: "rates.xlsx",
        totalRows: 2,
        successRows: 1,
        failedRows: 1,
        status: "IMPORTING",
      }),
    });
    expect(mockDb.importError.createMany).toHaveBeenCalled();
    expect(mockDb.rate.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ propertyId: "p1", roomId: "r1", amount: 500 }),
      ]),
    });
    expect(mockDb.importJob.update).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: { status: "COMPLETED" },
    });
    expect(result).toMatchObject({ status: "COMPLETED", successRows: 1, failedRows: 1 });
    expect(result.imported).toHaveLength(1);
    expect(result.errors[0].message).toContain("Unknown property");
    // Audit: rate creations are recorded as changes.
    expect(mockDb.importChange.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ type: "RATE", field: "amount", afterValue: "500" })],
    });
  });
});

describe("importAvailability", () => {
  it("creates a job and persists availability with skipDuplicates", async () => {
    mockDb.importJob.create.mockResolvedValue({
      id: "job1",
      type: "AVAILABILITY",
      filename: "avail.xlsx",
      status: "IMPORTING",
      totalRows: 1,
      successRows: 1,
      failedRows: 0,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.importJob.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        id: where.id,
        type: "AVAILABILITY",
        filename: "avail.xlsx",
        ...data,
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await importAvailability(
      [
        {
          rowNumber: 2,
          propertyName: "Velaa Lagoon Resort & Spa",
          roomName: "Overwater Villa",
          date: "2026-08-20",
          inventory: 3,
        },
      ],
      "avail.xlsx",
    );

    // Smart merge + audit: existing row (inventory 6) is updated to 3, and a
    // before→after change is recorded.
    expect(mockDb.availability.findUnique).toHaveBeenCalledWith({
      where: { roomId_date: { roomId: "r1", date: new Date("2026-08-20T00:00:00.000Z") } },
    });
    expect(mockDb.availability.update).toHaveBeenCalledWith({
      where: { id: "av1" },
      data: expect.objectContaining({ inventory: 3, propertyId: "p1" }),
    });
    expect(mockDb.importChange.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          importJobId: "job1",
          type: "AVAILABILITY",
          roomId: "r1",
          date: "2026-08-20",
          field: "inventory",
          beforeValue: "6",
          afterValue: "3",
        }),
      ],
    });
    expect(result).toMatchObject({ status: "COMPLETED", successRows: 1, failedRows: 0 });
  });

  it("records a change for a newly inserted availability date", async () => {
    mockDb.availability.findUnique.mockResolvedValue(null);
    mockDb.importJob.create.mockResolvedValue({
      id: "job1",
      type: "AVAILABILITY",
      filename: "avail.xlsx",
      status: "IMPORTING",
      totalRows: 1,
      successRows: 1,
      failedRows: 0,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.importJob.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        id: where.id,
        type: "AVAILABILITY",
        filename: "avail.xlsx",
        ...data,
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await importAvailability(
      [
        {
          rowNumber: 2,
          propertyName: "Velaa Lagoon Resort & Spa",
          roomName: "Overwater Villa",
          date: "2026-08-21",
          inventory: 4,
        },
      ],
      "avail.xlsx",
    );
    expect(mockDb.availability.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ inventory: 4 }) }),
    );
    expect(mockDb.importChange.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ beforeValue: null, afterValue: "4" })],
    });
  });

  it("marks the job FAILED when no rows are valid", async () => {
    const result = await importAvailability(
      [
        {
          rowNumber: 2,
          propertyName: "Ghost Resort",
          roomName: "Room",
          date: "2026-08-20",
          inventory: 1,
        },
      ],
      "bad.xlsx",
    );
    expect(result.status).toBe("FAILED");
    expect(mockDb.importJob.update).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: { status: "FAILED" },
    });
  });
});
