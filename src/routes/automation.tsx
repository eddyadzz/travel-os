import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { Zap, Mail, CalendarDays, Wallet, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAutomationLogs,
  runAllAutomation,
  runArrivalAutomationFn,
  runDailyReportFn,
  runPaymentAutomationFn,
  runSupplierAutomationFn,
} from "@/lib/api/automation";
import type { AutomationLogDTO, AutomationRunSummary } from "@/lib/types";

export const Route = createFileRoute("/automation")({
  beforeLoad: requireAuth,
  loader: async () => {
    const logs = await listAutomationLogs();
    return { logs };
  },
  head: () => ({
    meta: [{ title: "Automation | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const { logs: initialLogs } = Route.useLoaderData();
  const [logs, setLogs] = useState<AutomationLogDTO[]>(initialLogs);
  const [summary, setSummary] = useState<AutomationRunSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshLogs = async () => setLogs(await listAutomationLogs());

  const run = async (name: string, fn: () => Promise<AutomationRunSummary>) => {
    setBusy(name);
    try {
      const s = await fn();
      setSummary(s);
      await refreshLogs();
      toast.success(`Automation complete — ${s.total} action(s)`);
    } catch (error) {
      toast.error(
        "Automation failed",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(null);
    }
  };

  const cards = [
    { icon: Zap, label: "Run all", run: "all", fn: () => run("all", () => runAllAutomation()) },
    {
      icon: Wallet,
      label: "Payments",
      run: "payment",
      fn: () => run("payment", () => runPaymentAutomationFn()),
    },
    {
      icon: Mail,
      label: "Suppliers",
      run: "supplier",
      fn: () => run("supplier", () => runSupplierAutomationFn()),
    },
    {
      icon: CalendarDays,
      label: "Arrivals",
      run: "arrival",
      fn: () => run("arrival", () => runArrivalAutomationFn()),
    },
    {
      icon: FileText,
      label: "Daily report",
      run: "daily",
      fn: () => run("daily", () => runDailyReportFn()),
    },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
          </Link>
          <Link to="/agent" className="text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Automation</h1>
            <p className="mt-2 text-muted-foreground">
              Recurring operational follow-ups, run on demand
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.run} className="rounded-2xl border bg-card p-5">
              <c.icon className="size-5 text-primary" />
              <p className="mt-3 font-semibold">{c.label}</p>
              <Button
                className="mt-3 w-full"
                size="sm"
                disabled={busy !== null}
                onClick={() => c.fn()}
              >
                {busy === c.run ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4" />
                )}
                Run
              </Button>
            </div>
          ))}
        </div>

        {summary && (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Last run</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <Stat label="Deposit reminders" value={summary.depositReminders} />
              <Stat label="Balance reminders" value={summary.balanceReminders} />
              <Stat
                label="Supplier follow-ups"
                value={summary.supplierReminders + summary.supplierEscalations}
              />
              <Stat
                label="Arrival actions"
                value={
                  summary.arrivalSummaries + summary.vouchersGenerated + summary.arrivalInstructions
                }
              />
              <Stat label="Vouchers generated" value={summary.vouchersGenerated} />
              <Stat label="Daily report sent" value={summary.dailyReportSent ? 1 : 0} />
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Automation log</h2>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No automation has run yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.slice(0, 50).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant="outline">{l.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.targetType}</TableCell>
                      <TableCell className="text-muted-foreground">{l.message}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-lg font-semibold">{value}</p>
    </div>
  );
}
