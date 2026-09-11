import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import {
  runArrivalAutomation,
  runDailyReport,
  runPaymentAutomation,
  runSupplierAutomation,
} from "@/lib/api/automation";
import { runSupplierUpdateScan } from "@/lib/api/supplier-updates";
import { runAccountingSync } from "@/lib/api/accounting-sync";
import { syncChannel } from "@/lib/api/channels";
import { notifyJobFailed } from "@/lib/notifications/service";
import type { JobDefinitionDTO, JobRunDTO } from "@/lib/types";

type RunnerResult = { output?: string } | void;

type JobDef = {
  key: string;
  name: string;
  schedule: string;
  description: string;
  runner: () => Promise<RunnerResult>;
  maxRetries?: number;
  retryMinutes?: number[];
};

// ---------------------------------------------------------------------------
// Job registry
// ---------------------------------------------------------------------------

const jobs: JobDef[] = [
  {
    key: "supplier-scan",
    name: "Supplier update scan",
    schedule: "0 */6 * * *",
    description: "Scan for suppliers with stale availability and open a new update request.",
    runner: async () => {
      const r = await runSupplierUpdateScan(7);
      return { output: `Scanned ${r.scanned} suppliers — ${r.created} new request(s)` };
    },
    maxRetries: 2,
    retryMinutes: [5, 30],
  },
  {
    key: "payment-automation",
    name: "Payment reminders",
    schedule: "0 */2 * * *",
    description: "Deposit reminders and balance reminders for overdue/upcoming payments.",
    runner: async () => {
      const s = await runPaymentAutomation();
      return {
        output: `Deposit reminders: ${s.depositReminders} · balance reminders: ${s.balanceReminders}`,
      };
    },
    maxRetries: 2,
    retryMinutes: [5, 30],
  },
  {
    key: "supplier-escalation",
    name: "Supplier escalation",
    schedule: "0 * * * *",
    description:
      "First reminder and escalation for supplier update requests that have gone unanswered.",
    runner: async () => {
      const s = await runSupplierAutomation();
      return {
        output: `Reminders: ${s.supplierReminders} · escalations: ${s.supplierEscalations}`,
      };
    },
    maxRetries: 2,
    retryMinutes: [5, 30],
  },
  {
    key: "arrival-automation",
    name: "Arrival automation",
    schedule: "0 * * * *",
    description:
      "T-7 summary, T-3 voucher generation and T-1 arrival instructions for upcoming bookings.",
    runner: async () => {
      const s = await runArrivalAutomation();
      return {
        output: `Summaries: ${s.arrivalSummaries} · vouchers: ${s.vouchersGenerated} · instructions: ${s.arrivalInstructions}`,
      };
    },
    maxRetries: 2,
    retryMinutes: [5, 30],
  },
  {
    key: "daily-report",
    name: "Daily management report",
    schedule: "0 8 * * *",
    description:
      "Daily operations report — leads, quotes, bookings, revenue, outstanding, supplier pending.",
    runner: async () => {
      const s = await runDailyReport();
      return { output: s.dailyReportSent ? "Report sent" : "Already sent today — skipped" };
    },
    maxRetries: 1,
    retryMinutes: [15],
  },
  {
    key: "accounting-sync",
    name: "Accounting sync",
    schedule: "30 6 * * *",
    description: "One-click Xero & QuickBooks journal export, synced and stored daily.",
    runner: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 90 * 86_400_000);
      const result = await runAccountingSync(
        { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        "scheduler",
      );
      return { output: `Synced ${result.entries} journal entries (Xero + QuickBooks)` };
    },
    maxRetries: 1,
    retryMinutes: [15],
  },
  {
    key: "channel-sync",
    name: "Supplier channel sync",
    schedule: "15 */3 * * *",
    description: "Pull live availability and rates from every enabled supplier channel.",
    runner: async () => {
      const channels = await db.supplierChannel.findMany({ where: { enabled: true } });
      const results: string[] = [];
      for (const channel of channels) {
        const r = await syncChannel(channel.id);
        results.push(`${channel.name}: ${r.result}`);
      }
      return { output: results.join(" · ") || "No enabled channels" };
    },
    maxRetries: 1,
    retryMinutes: [30],
  },
];

function getJob(key: string): JobDef {
  const job = jobs.find((j) => j.key === key);
  if (!job) throw new Error(`Unknown job: ${key}`);
  return job;
}

// ---------------------------------------------------------------------------
// Minimal cron matcher (minute hour day-of-month month day-of-week)
// Supports *, */n, single values and comma lists.
// ---------------------------------------------------------------------------

function parseField(field: string, max: number): Set<number> | null {
  if (field === "*") return null;
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2));
    const set = new Set<number>();
    for (let i = 0; i <= max; i += step) set.add(i);
    return set;
  }
  return new Set(field.split(",").map((p) => Number(p)));
}

export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const m = parseField(parts[0]!, 59);
  const h = parseField(parts[1]!, 23);
  const d = parseField(parts[2]!, 31);
  const mo = parseField(parts[3]!, 12);
  const dw = parseField(parts[4]!, 6);
  if (m && !m.has(date.getMinutes())) return false;
  if (h && !h.has(date.getHours())) return false;
  if (d && !d.has(date.getDate())) return false;
  if (mo && !mo.has(date.getMonth() + 1)) return false;
  if (dw && !dw.has(date.getDay())) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Execution + history + retry
// ---------------------------------------------------------------------------

function toRunDTO(r: {
  id: string;
  jobKey: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  output: string | null;
  error: string | null;
}): JobRunDTO {
  return {
    id: r.id,
    jobKey: r.jobKey,
    status: r.status as JobRunDTO["status"],
    startedAt: r.startedAt.toISOString(),
    ...(r.finishedAt ? { finishedAt: r.finishedAt.toISOString() } : {}),
    ...(r.durationMs != null ? { durationMs: r.durationMs } : {}),
    ...(r.output ? { output: r.output } : {}),
    ...(r.error ? { error: r.error } : {}),
  };
}

export async function runJobNow(key: string): Promise<JobRunDTO> {
  return executeJob(getJob(key), 1);
}

async function executeJob(job: JobDef, attempt: number): Promise<JobRunDTO> {
  const startedAt = new Date();
  const run = await db.jobRun.create({
    data: { jobKey: job.key, status: "RUNNING", startedAt },
  });
  try {
    const result = await job.runner();
    const finishedAt = new Date();
    const updated = await db.jobRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        output: result?.output ?? "Completed",
      },
    });
    return toRunDTO(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const maxRetries = job.maxRetries ?? 2;
    if (attempt < maxRetries) {
      const delayMs = (job.retryMinutes?.[attempt - 1] ?? 5) * 60_000;
      const updated = await db.jobRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: message,
          output: `Attempt ${attempt} of ${maxRetries} — retrying in ${delayMs / 60_000}m`,
        },
      });
      // In-memory retry queue with backoff. History rows show each attempt.
      setTimeout(() => void executeJob(job, attempt + 1), delayMs);
      return toRunDTO(updated);
    }
    const finishedAt = new Date();
    const updated = await db.jobRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        error: message,
        output: `Failed after ${maxRetries} attempt(s)`,
      },
    });
    await alertOnFailure(job, message);
    return toRunDTO(updated);
  }
}

async function alertOnFailure(job: JobDef, error: string) {
  try {
    const agent = await db.user.findFirst({
      where: { role: { in: ["BOOKING_AGENT", "SUPER_ADMIN"] } },
      orderBy: { createdAt: "asc" },
    });
    if (agent) {
      await notifyJobFailed({
        recipient: agent.email,
        jobName: job.name,
        jobKey: job.key,
        error,
      });
    }
  } catch {
    // Never let the alert break the scheduler loop.
  }
}

// ---------------------------------------------------------------------------
// Scheduler loop
// ---------------------------------------------------------------------------

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
const lastFiredAt = new Map<string, number>();
const MIN_FIRE_INTERVAL_MS = 60_000;

export async function startScheduler(): Promise<void> {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void tick();
  }, 60_000);
  // Fire immediately once on startup so nothing waits for the first minute.
  await tick();
}

export function stopScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

async function tick(): Promise<void> {
  const now = new Date();
  for (const job of jobs) {
    if (!cronMatches(job.schedule, now)) continue;
    const last = lastFiredAt.get(job.key) ?? 0;
    if (Date.now() - last < MIN_FIRE_INTERVAL_MS) continue;
    lastFiredAt.set(job.key, Date.now());
    void executeJob(job, 1).catch(() => {
      // Already recorded as a FAILED run + alert; nothing more to do here.
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const listJobDefinitions = createServerFn({ method: "GET" }).handler(
  async (): Promise<JobDefinitionDTO[]> => {
    const runs = await db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 500 });
    return jobs.map((job) => {
      const jobRuns = runs.filter((r) => r.jobKey === job.key);
      const lastRun = jobRuns[0] ?? null;
      const succeeded = jobRuns.filter((r) => r.status === "SUCCESS").length;
      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        description: job.description,
        enabled: true,
        ...(lastRun ? { lastRun: toRunDTO(lastRun) } : {}),
        totalRuns: jobRuns.length,
        successRate: jobRuns.length === 0 ? 100 : Math.round((succeeded / jobRuns.length) * 100),
      };
    });
  },
);

export const listJobRuns = createServerFn({ method: "GET" }).handler(async () => {
  const runs = await db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
  return runs.map(toRunDTO);
});

export const runJobNowFn = createServerFn({ method: "POST" })
  .validator((key: string) => key)
  .handler(async ({ data: key }) => runJobNow(key));

export const getJobStats = createServerFn({ method: "GET" }).handler(async () => {
  const [success, failed, running, last24h] = await Promise.all([
    db.jobRun.count({ where: { status: "SUCCESS" } }),
    db.jobRun.count({ where: { status: "FAILED" } }),
    db.jobRun.count({ where: { status: "RUNNING" } }),
    db.jobRun.count({ where: { startedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  return { success, failed, running, last24h };
});
