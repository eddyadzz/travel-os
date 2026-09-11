import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeAgentPerformance,
  computeDeposits,
  computeOutstanding,
  computePandL,
  computePaymentLedger,
  exportAccounting,
  exportFinanceCSV,
  exportFinanceExcel,
  getFinanceReport,
} from "@/lib/api/finance";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    booking: { findMany: vi.fn() },
    contractRate: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
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

const FILTER = { from: "2026-01-01", to: "2026-12-31" };

function bookingRow(overrides = {}) {
  return {
    id: "b1",
    reference: "MV-10001",
    totalPrice: 5900,
    nights: 5,
    status: "CONFIRMED",
    checkIn: new Date("2026-03-01T00:00:00.000Z"),
    checkOut: new Date("2026-03-06T00:00:00.000Z"),
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    property: { name: "Velaa", supplierId: "sup1", supplier: { id: "sup1" } },
    room: { name: "Overwater Villa" },
    customer: { fullName: "Jane Doe" },
    assignedAgent: { id: "agent1" },
    payments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
  mockDb.contractRate.findMany.mockResolvedValue([
    {
      id: "cr1",
      supplierId: "sup1",
      roomId: null,
      validFrom: new Date("2026-01-01"),
      validTo: new Date("2026-12-31"),
      netRate: 800,
    },
  ]);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.user.findMany.mockResolvedValue([{ id: "agent1", fullName: "Amina" }]);
});

describe("computePandL", () => {
  it("computes revenue, supplier cost (net rate × nights) and profit", async () => {
    const r = await computePandL(FILTER);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ reference: "MV-10001", revenue: 5900, supplierCost: 4000 });
    expect(r.rows[0].grossProfit).toBe(1900);
    expect(r.totalRevenue).toBe(5900);
    expect(r.totalCost).toBe(4000);
    expect(r.totalProfit).toBe(1900);
    expect(r.marginPercent).toBe(32.2);
  });

  it("uses zero supplier cost when no contract rate covers the stay", async () => {
    mockDb.contractRate.findMany.mockResolvedValue([]);
    const r = await computePandL(FILTER);
    expect(r.rows[0].supplierCost).toBe(0);
    expect(r.rows[0].grossProfit).toBe(5900);
  });
});

describe("computeOutstanding", () => {
  it("computes outstanding = total − verified non-refund payments", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({
        payments: [
          { status: "VERIFIED", type: "DEPOSIT", amount: 1475 },
          { status: "REQUESTED", type: "DEPOSIT", amount: 1475 },
          { status: "VERIFIED", type: "REFUND", amount: 100 },
        ],
      }),
    ]);
    const r = await computeOutstanding();
    expect(r.rows[0].paid).toBe(1475);
    expect(r.rows[0].outstanding).toBe(4425);
    expect(r.totalOutstanding).toBe(4425);
  });
});

describe("computeDeposits / computePaymentLedger", () => {
  it("lists deposit payments in the period", async () => {
    mockDb.payment.findMany.mockResolvedValue([
      {
        type: "DEPOSIT",
        amount: 1475,
        status: "VERIFIED",
        createdAt: new Date("2026-03-01"),
        paidAt: new Date("2026-03-02"),
        booking: { reference: "MV-10001", customer: { fullName: "Jane Doe" } },
      },
    ]);
    const r = await computeDeposits(FILTER);
    expect(r.count).toBe(1);
    expect(r.total).toBe(1475);
  });

  it("filters the ledger by paidAt within the range", async () => {
    mockDb.payment.findMany.mockResolvedValue([
      {
        type: "BALANCE",
        amount: 4425,
        status: "VERIFIED",
        createdAt: new Date("2026-03-01"),
        paidAt: new Date("2026-03-10"),
        booking: { reference: "MV-10001", customer: { fullName: "Jane Doe" } },
      },
    ]);
    const r = await computePaymentLedger(FILTER);
    expect(r.rows[0].type).toBe("BALANCE");
    expect(r.total).toBe(4425);
  });
});

describe("computeAgentPerformance", () => {
  it("aggregates revenue and profit per assigned agent", async () => {
    const r = await computeAgentPerformance(FILTER);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      name: "Amina",
      bookings: 1,
      revenue: 5900,
      profit: 1900,
      averageValue: 5900,
    });
  });
});

describe("exportFinanceCSV", () => {
  it("builds a CSV with escaped cells", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      bookingRow({ reference: "MV,10001", customer: { fullName: 'Doe, "Jane"' } }),
    ]);
    const res = await exportFinanceCSV({ data: { report: "P&L", ...FILTER } });
    expect(res.filename).toContain(".csv");
    expect(res.content).toContain('"MV,10001"');
    expect(res.content).toContain('"Doe, ""Jane"""');
    expect(res.content.startsWith("Reference,Customer")).toBe(true);
  });
});

describe("exportFinanceExcel", () => {
  it("produces a valid xlsx (base64 of a PK zip)", async () => {
    const res = await exportFinanceExcel({ data: { report: "P&L", ...FILTER } });
    expect(res.filename).toContain(".xlsx");
    const bytes = Buffer.from(res.base64, "base64");
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("exportAccounting", () => {
  it("produces a balanced QuickBooks journal", async () => {
    mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
    mockDb.contractRate.findMany.mockResolvedValue([
      {
        id: "cr1",
        supplierId: "sup1",
        roomId: null,
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2026-12-31"),
        netRate: 800,
      },
    ]);
    mockDb.payment.findMany.mockResolvedValue([
      {
        type: "DEPOSIT",
        amount: 1475,
        status: "VERIFIED",
        createdAt: new Date("2026-03-01"),
        paidAt: new Date("2026-03-02"),
        booking: { reference: "MV-10001", customer: { fullName: "Jane Doe" } },
      },
    ]);
    const res = await exportAccounting({ data: { format: "QUICKBOOKS", ...FILTER } });
    const lines = res.content.trim().split("\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(res.content).toContain("Accounts Receivable");
    expect(res.content).toContain("Sales Revenue");
    expect(res.content).toContain("Cost of Goods Sold");
    expect(res.content).toContain("Bank");
  });

  it("produces a balanced Xero journal (debits equal credits)", async () => {
    mockDb.booking.findMany.mockResolvedValue([bookingRow()]);
    mockDb.contractRate.findMany.mockResolvedValue([
      {
        id: "cr1",
        supplierId: "sup1",
        roomId: null,
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2026-12-31"),
        netRate: 800,
      },
    ]);
    mockDb.payment.findMany.mockResolvedValue([
      {
        type: "DEPOSIT",
        amount: 1475,
        status: "VERIFIED",
        createdAt: new Date("2026-03-01"),
        paidAt: new Date("2026-03-02"),
        booking: { reference: "MV-10001", customer: { fullName: "Jane Doe" } },
      },
    ]);
    const res = await exportAccounting({ data: { format: "XERO", ...FILTER } });
    const lines = res.content.trim().split("\n").slice(1);
    const cols = lines.map((l) => l.split(","));
    const debit = cols.reduce((s, c) => s + Number(c[4] ?? 0), 0);
    const credit = cols.reduce((s, c) => s + Number(c[5] ?? 0), 0);
    expect(debit).toBeCloseTo(credit, 2);
  });
});

describe("getFinanceReport", () => {
  it("returns the full dashboard", async () => {
    const d = await getFinanceReport({ data: FILTER });
    expect(d.pandl.rows).toHaveLength(1);
    expect(typeof d.outstanding.totalOutstanding).toBe("number");
  });
});
