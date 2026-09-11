import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, TrendingUp, Wallet, CheckCircle2, BarChart3 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAgentPerformance,
  getExecutiveMetrics,
  getPaymentAnalytics,
  getProfitAnalytics,
  getPropertyPerformance,
  getRevenueAnalytics,
  getSearchFunnel,
  getSupplierPerformance,
} from "@/lib/api/analytics";
import type { DateRange } from "@/lib/types";
import { money } from "@/lib/pricing";

type RangePreset = "30d" | "90d" | "ytd";

function presetRange(preset: RangePreset): DateRange {
  const to = new Date();
  const from =
    preset === "30d"
      ? new Date(to.getTime() - 30 * 86_400_000)
      : preset === "90d"
        ? new Date(to.getTime() - 90 * 86_400_000)
        : new Date(to.getFullYear(), 0, 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    range: (typeof search["range"] === "string" ? search["range"] : "30d") as RangePreset,
  }),
  loader: async ({ location }) => {
    const range = (location.search as { range?: string })?.range as RangePreset | undefined;
    const preset = range ?? "30d";
    const rangeDto = presetRange(preset);
    const [executive, revenue, profit, properties, suppliers, agents, funnel, payments] =
      await Promise.all([
        getExecutiveMetrics({ data: rangeDto }),
        getRevenueAnalytics({ data: rangeDto }),
        getProfitAnalytics({ data: rangeDto }),
        getPropertyPerformance({ data: rangeDto }),
        getSupplierPerformance({ data: rangeDto }),
        getAgentPerformance({ data: rangeDto }),
        getSearchFunnel({ data: rangeDto }),
        getPaymentAnalytics({ data: rangeDto }),
      ]);
    return { executive, revenue, profit, properties, suppliers, agents, funnel, payments, preset };
  },
  head: () => ({
    meta: [
      { title: "Analytics & Reporting | Ocean Atlas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const loaderData = Route.useLoaderData();
  const [preset, setPreset] = useState<RangePreset>(loaderData.preset);

  // Client-side navigation on range change
  const navigate = Route.useNavigate();
  const updateRange = (p: RangePreset) => {
    setPreset(p);
    void navigate({ search: { range: p } });
  };

  const { executive, revenue, profit, properties, suppliers, agents, funnel, payments } =
    loaderData;

  const maxRevenue = useMemo(
    () => Math.max(1, ...revenue.monthlyTrend.map((t) => t.revenue)),
    [revenue.monthlyTrend],
  );
  const maxProfit = useMemo(
    () => Math.max(1, ...profit.monthlyTrend.map((t) => Math.max(t.revenue, t.cost))),
    [profit.monthlyTrend],
  );

  const funnelSteps = [
    { label: "Searches", value: funnel.searches },
    { label: "With results", value: funnel.searchesWithResults },
    { label: "Booking requests", value: funnel.bookingRequests },
    { label: "Confirmed", value: funnel.confirmedBookings },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Analytics</h1>
            <p className="mt-2 text-muted-foreground">
              Executive dashboard · business intelligence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={preset} onValueChange={(v) => updateRange(v as RangePreset)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">This year</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv("executive", revenue.monthlyTrend)}
            >
              <Download className="size-4" /> CSV
            </Button>
          </div>
        </div>

        {/* Executive cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard icon={TrendingUp} label="Revenue" value={money(executive.revenue)} />
          <MetricCard icon={Wallet} label="Gross profit" value={money(executive.grossProfit)} />
          <MetricCard icon={BarChart3} label="Bookings" value={String(executive.bookings)} />
          <MetricCard
            icon={CheckCircle2}
            label="Confirmed"
            value={String(executive.confirmedBookings)}
          />
          <MetricCard
            icon={Wallet}
            label="Avg booking value"
            value={money(executive.averageBookingValue)}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Revenue by month */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Revenue by month</h2>
            <div className="mt-4 flex h-48 items-end gap-2">
              {revenue.monthlyTrend.map((t) => (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{money(t.revenue)}</span>
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.max(2, (t.revenue / maxRevenue) * 120)}px` }}
                    title={`${t.month}: ${money(t.revenue)} (${t.bookings} bookings)`}
                  />
                  <span className="text-[10px] text-muted-foreground">{t.month.slice(2)}</span>
                </div>
              ))}
              {revenue.monthlyTrend.length === 0 && (
                <p className="text-sm text-muted-foreground">No revenue in this range.</p>
              )}
            </div>
          </section>

          {/* Profit by month */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Profit vs cost by month</h2>
            <div className="mt-4 flex h-48 items-end gap-2">
              {profit.monthlyTrend.map((t) => (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{money(t.profit)}</span>
                  <div
                    className="w-full rounded-t bg-success/70"
                    style={{ height: `${Math.max(2, (t.revenue / maxProfit) * 120)}px` }}
                    title={`${t.month}: revenue ${money(t.revenue)}, cost ${money(t.cost)}, profit ${money(t.profit)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{t.month.slice(2)}</span>
                </div>
              ))}
              {profit.monthlyTrend.length === 0 && (
                <p className="text-sm text-muted-foreground">No profit data in this range.</p>
              )}
            </div>
          </section>
        </div>

        {/* Funnel */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Search → Booking funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversion rate: <strong>{funnel.conversionRate}%</strong>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {funnelSteps.map((s, i) => (
              <div key={s.label} className="rounded-xl border p-4 text-center">
                <p className="text-display text-2xl font-semibold">{s.value.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Step {i + 1}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Property performance */}
          <AnalyticsTable
            title="Property performance"
            headers={["Property", "Bookings", "Revenue", "Profit"]}
            rows={properties.map((p) => [
              p.name,
              String(p.bookings),
              money(p.revenue),
              money(p.profit),
            ])}
          />

          {/* Supplier performance */}
          <AnalyticsTable
            title="Supplier performance"
            headers={["Supplier", "Bookings", "Revenue", "Conf. rate"]}
            rows={suppliers.map((s) => [
              s.name,
              String(s.bookings),
              money(s.revenue),
              `${s.confirmationRate}%`,
            ])}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Agent performance */}
          <AnalyticsTable
            title="Agent performance"
            headers={["Agent", "Assigned", "Confirmed", "Revenue"]}
            rows={agents.map((a) => [
              a.name,
              String(a.assigned),
              String(a.confirmed),
              money(a.revenue),
            ])}
          />

          {/* Payment analytics */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Payment analytics</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <MiniStat label="Requested" value={String(payments.requested)} />
              <MiniStat label="Submitted" value={String(payments.submitted)} />
              <MiniStat
                label="Verified"
                value={`${payments.verified} (${money(payments.verifiedAmount)})`}
              />
              <MiniStat label="Outstanding" value={money(payments.outstanding)} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-display text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function AnalyticsTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="text-center text-sm text-muted-foreground"
                >
                  No data in this range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className={j === 0 ? "font-medium" : ""}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function downloadCsv(name: string, rows: Array<Record<string, number | string>>) {
  const first = rows[0];
  if (!first) return;
  const headers = Object.keys(first);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => r[h] ?? "").join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
