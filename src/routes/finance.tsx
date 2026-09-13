import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, BookOpen, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportAccounting,
  exportFinanceCSV,
  exportFinanceExcel,
  getFinanceReport,
} from "@/lib/api/finance";
import {
  getAccountingExportContent,
  listAccountingExports,
  runAccountingSyncFn,
} from "@/lib/api/accounting-sync";
import type { FinanceDashboardDTO, FinanceReportType } from "@/lib/types";

export const Route = createFileRoute("/finance")({
  beforeLoad: requireAuth,
  loader: async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    const filter = { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    const report = await getFinanceReport({ data: filter });
    return { filter, report };
  },
  head: () => ({
    meta: [{ title: "Finance & Exports | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: FinancePage,
});

const TABS: { key: FinanceReportType; label: string }[] = [
  { key: "P&L", label: "Profit & Loss" },
  { key: "OUTSTANDING", label: "Outstanding" },
  { key: "DEPOSITS", label: "Deposits" },
  { key: "LEDGER", label: "Payments" },
  { key: "AGENTS", label: "Agents" },
];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function FinancePage() {
  const { filter: initial, report: initialReport } = Route.useLoaderData();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<FinanceDashboardDTO>(initialReport);
  const [tab, setTab] = useState<FinanceReportType>("P&L");
  const [busy, setBusy] = useState<string | null>(null);
  const [syncs, setSyncs] = useState<Awaited<ReturnType<typeof listAccountingExports>>>([]);

  const refreshSyncs = async () => setSyncs(await listAccountingExports());

  useEffect(() => {
    void refreshSyncs();
  }, []);

  const handleSync = async () => {
    setBusy("sync");
    try {
      const result = await runAccountingSyncFn({ data: { from, to, createdBy: "agent" } });
      await refreshSyncs();
      toast.success(`Synced — ${result.entries} journal entries (Xero + QuickBooks)`);
    } catch (error) {
      toast.error("Sync failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(null);
    }
  };

  const downloadSynced = async (id: string) => {
    const res = await getAccountingExportContent({ data: id });
    if (!res) return;
    download(res.filename, res.content, "text/csv");
  };

  const refresh = async () => {
    setBusy("refresh");
    try {
      const r = await getFinanceReport({ data: { from, to } });
      setReport(r);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doExport = async (
    name: string,
    run: () => Promise<{ filename: string; content: string }>,
  ) => {
    setBusy(name);
    try {
      const res = await run();
      download(res.filename, res.content, "text/csv");
      toast.success(`Exported ${res.filename}`);
    } catch (error) {
      toast.error("Export failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(null);
    }
  };

  const exportXlsx = async (
    name: string,
    run: () => Promise<{ filename: string; base64: string }>,
  ) => {
    setBusy(name);
    try {
      const res = await run();
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.filename}`);
    } catch (error) {
      toast.error("Export failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(null);
    }
  };

  const filter = { from, to };

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Finance & exports</h1>
            <p className="mt-2 text-muted-foreground">
              Revenue, costs, profit, outstanding balances, deposits, payments and agent performance
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={refresh} disabled={busy !== null}>
              {busy === "refresh" ? <Loader2 className="size-4 animate-spin" /> : null} Apply
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Revenue" value={money(report.pandl.totalRevenue)} />
          <Stat label="Supplier cost" value={money(report.pandl.totalCost)} />
          <Stat label="Gross profit" value={money(report.pandl.totalProfit)} />
          <Stat label="Outstanding" value={money(report.outstanding.totalOutstanding)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                doExport("csv", () => exportFinanceCSV({ data: { report: tab, ...filter } }))
              }
              disabled={busy !== null}
            >
              <FileText className="size-4" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportXlsx("xlsx", () => exportFinanceExcel({ data: { report: tab, ...filter } }))
              }
              disabled={busy !== null}
            >
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                doExport("qb", () =>
                  exportAccounting({ data: { format: "QUICKBOOKS", ...filter } }),
                )
              }
              disabled={busy !== null}
            >
              <BookOpen className="size-4" /> QuickBooks
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                doExport("xero", () => exportAccounting({ data: { format: "XERO", ...filter } }))
              }
              disabled={busy !== null}
            >
              <Download className="size-4" /> Xero
            </Button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Accounting sync</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                One-click Xero & QuickBooks journals for the selected period — stored and
                downloadable.
              </p>
            </div>
            <Button onClick={handleSync} disabled={busy !== null}>
              {busy === "sync" ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <BookOpen className="size-4" />
              )}
              Sync now
            </Button>
          </div>
          {syncs.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {syncs.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => downloadSynced(s.id)}
                  className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-1.5 text-xs hover:bg-secondary/60"
                >
                  <FileText className="size-3.5" />
                  {s.format} · {s.periodFrom} → {s.periodTo}
                  <Download className="size-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border bg-card p-6">
          <Preview tab={tab} report={report} />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Preview({ tab, report }: { tab: FinanceReportType; report: FinanceDashboardDTO }) {
  if (tab === "P&L") {
    return (
      <div>
        <h2 className="font-semibold">Profit & Loss</h2>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Supplier cost</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.pandl.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No bookings in range.
                  </TableCell>
                </TableRow>
              )}
              {report.pandl.rows.map((r) => (
                <TableRow key={r.reference}>
                  <TableCell className="font-medium">{r.reference}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{r.property}</TableCell>
                  <TableCell className="text-muted-foreground">{r.checkIn}</TableCell>
                  <TableCell>{money(r.revenue)}</TableCell>
                  <TableCell className="text-muted-foreground">{money(r.supplierCost)}</TableCell>
                  <TableCell>{money(r.grossProfit)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.marginPercent}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (tab === "OUTSTANDING") {
    return (
      <div>
        <h2 className="font-semibold">Outstanding balances</h2>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.outstanding.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nothing outstanding.
                  </TableCell>
                </TableRow>
              )}
              {report.outstanding.rows.map((r) => (
                <TableRow key={r.reference}>
                  <TableCell className="font-medium">{r.reference}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{r.property}</TableCell>
                  <TableCell className="text-muted-foreground">{r.checkIn}</TableCell>
                  <TableCell>{money(r.totalPrice)}</TableCell>
                  <TableCell className="text-muted-foreground">{money(r.paid)}</TableCell>
                  <TableCell>
                    {r.outstanding > 0 ? (
                      <Badge variant="destructive">{money(r.outstanding)}</Badge>
                    ) : (
                      <Badge variant="outline">Paid</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (tab === "DEPOSITS") {
    return (
      <div>
        <h2 className="font-semibold">Deposits</h2>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.deposits.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No deposits in range.
                  </TableCell>
                </TableRow>
              )}
              {report.deposits.rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{r.date}</TableCell>
                  <TableCell className="font-medium">{r.reference}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell>{money(r.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (tab === "LEDGER") {
    return (
      <div>
        <h2 className="font-semibold">Payment ledger</h2>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.ledger.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No payments in range.
                  </TableCell>
                </TableRow>
              )}
              {report.ledger.rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{r.date}</TableCell>
                  <TableCell className="font-medium">{r.reference}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{r.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell>{money(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-semibold">Agent performance</h2>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Bookings</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Average value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.agents.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No assigned bookings in range.
                </TableCell>
              </TableRow>
            )}
            {report.agents.rows.map((r) => (
              <TableRow key={r.agentId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.bookings}</TableCell>
                <TableCell>{money(r.revenue)}</TableCell>
                <TableCell>{money(r.profit)}</TableCell>
                <TableCell className="text-muted-foreground">{money(r.averageValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
