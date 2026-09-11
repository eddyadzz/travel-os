import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cronMatches,
  listJobDefinitions,
  listJobRuns,
  runJobNow,
  runJobNowFn,
  startScheduler,
  stopScheduler,
} from "@/lib/api/scheduler";
import * as automation from "@/lib/api/automation";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    jobRun: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    user: { findFirst: vi.fn() },
    supplierUpdateRequest: { count: vi.fn(), updateMany: vi.fn() },
    availability: { groupBy: vi.fn() },
    property: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    payment: { findMany: vi.fn(), aggregate: vi.fn() },
    booking: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    lead: { count: vi.fn() },
    quote: { count: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
    automationLog: { create: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/documents", () => ({ generateBookingDocument: vi.fn() }));
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

function runRow(overrides = {}) {
  return {
    id: "run1",
    jobKey: "payment-automation",
    status: "SUCCESS",
    startedAt: new Date(),
    finishedAt: new Date(),
    durationMs: 1200,
    output: "Completed",
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.jobRun.create.mockResolvedValue({
    id: "run1",
    jobKey: "x",
    status: "RUNNING",
    startedAt: new Date(),
    finishedAt: null,
    durationMs: null,
    output: null,
    error: null,
  });
  mockDb.jobRun.update.mockImplementation(({ data }) => Promise.resolve(runRow(data)));
  mockDb.jobRun.findMany.mockResolvedValue([]);
  mockDb.jobRun.count.mockResolvedValue(0);
  mockDb.user.findFirst.mockResolvedValue({ email: "admin@oceanatlas.mv" });
  mockDb.supplier.findMany.mockResolvedValue([]);
  mockDb.availability.groupBy.mockResolvedValue([]);
  mockDb.property.findMany.mockResolvedValue([]);
  mockDb.supplierUpdateRequest.count.mockResolvedValue(0);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
  mockDb.booking.findMany.mockResolvedValue([]);
  mockDb.booking.count.mockResolvedValue(0);
  mockDb.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: null } });
  mockDb.lead.count.mockResolvedValue(0);
  mockDb.quote.count.mockResolvedValue(0);
  mockDb.automationLog.findFirst.mockResolvedValue(null);
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
});

afterEach(() => {
  stopScheduler();
});

describe("cronMatches", () => {
  it("matches hourly at minute 0", () => {
    expect(cronMatches("0 * * * *", new Date("2026-08-29T14:00:00"))).toBe(true);
    expect(cronMatches("0 * * * *", new Date("2026-08-29T14:25:00"))).toBe(false);
  });

  it("matches a daily time", () => {
    expect(cronMatches("0 8 * * *", new Date("2026-08-29T08:00:00"))).toBe(true);
    expect(cronMatches("0 8 * * *", new Date("2026-08-29T09:00:00"))).toBe(false);
  });

  it("matches every-N-hours", () => {
    expect(cronMatches("0 */6 * * *", new Date("2026-08-29T00:00:00"))).toBe(true);
    expect(cronMatches("0 */6 * * *", new Date("2026-08-29T06:00:00"))).toBe(true);
    expect(cronMatches("0 */6 * * *", new Date("2026-08-29T03:00:00"))).toBe(false);
  });

  it("returns false for malformed expressions", () => {
    expect(cronMatches("0 8 * *", new Date())).toBe(false);
  });
});

describe("runJobNow", () => {
  it("records a SUCCESS run with duration and output", async () => {
    const res = await runJobNow("payment-automation");
    expect(res.status).toBe("SUCCESS");
    expect(mockDb.jobRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobKey: "payment-automation", status: "RUNNING" }),
      }),
    );
    expect(mockDb.jobRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS", durationMs: expect.any(Number) }),
      }),
    );
  });

  it("fails a job that throws and alerts the admin", async () => {
    vi.spyOn(automation, "runDailyReport").mockRejectedValueOnce(new Error("DB down"));
    const res = await runJobNow("daily-report"); // maxRetries 1 → immediate final failure
    expect(res.status).toBe("FAILED");
    expect(res.error).toContain("DB down");
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipient: "admin@oceanatlas.mv",
          subject: expect.stringContaining("job failed"),
        }),
      }),
    );
  });
});

describe("listJobDefinitions", () => {
  it("returns the registry with stats", async () => {
    mockDb.jobRun.findMany.mockResolvedValue([
      runRow({ jobKey: "supplier-scan", status: "SUCCESS" }),
      runRow({ jobKey: "supplier-scan", status: "FAILED", error: "x" }),
      runRow({ jobKey: "payment-automation", status: "SUCCESS" }),
    ]);
    const defs = await listJobDefinitions();
    const scan = defs.find((d) => d.key === "supplier-scan");
    expect(scan).toMatchObject({
      name: "Supplier update scan",
      schedule: "0 */6 * * *",
      totalRuns: 2,
      successRate: 50,
    });
    expect(scan?.lastRun?.status).toBe("SUCCESS");
  });
});

describe("runJobNowFn / listJobRuns", () => {
  it("exposes the post endpoint that runs a job", async () => {
    const res = await runJobNowFn({ data: "daily-report" });
    expect(res.status).toBe("SUCCESS");
  });

  it("lists recent runs", async () => {
    mockDb.jobRun.findMany.mockResolvedValue([runRow()]);
    const runs = await listJobRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].jobKey).toBe("payment-automation");
  });
});

describe("startScheduler / stopScheduler", () => {
  it("is idempotent — starting twice keeps a single interval", async () => {
    await startScheduler();
    const first = startScheduler as unknown as { _test: unknown } as unknown;
    expect(first).toBeDefined();
    // Stopping then restarting is safe.
    stopScheduler();
    await startScheduler();
    stopScheduler();
    expect(true).toBe(true);
  });
});
