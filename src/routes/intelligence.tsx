import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  TrendingUp,
  CalendarCheck,
  Users2,
  ShieldAlert,
  RefreshCw,
  Wallet,
  Percent,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getPredictiveDashboard } from "@/lib/api/predictive";
import type { PredictiveDashboardDTO } from "@/lib/types";

export const Route = createFileRoute("/intelligence")({
  loader: async () => getPredictiveDashboard(),
  head: () => ({
    meta: [
      { title: "Predictive Intelligence | Ocean Atlas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligencePage,
});

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function IntelligencePage() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<PredictiveDashboardDTO>(initial);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      setData(await getPredictiveDashboard());
    } finally {
      setBusy(false);
    }
  };

  const r = data.revenue;
  const b = data.bookings;

  const chartData = r.monthly.map((m) => ({
    name: m.month,
    Confirmed: m.confirmed,
    Expected: m.expected,
  }));

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-display text-lg font-semibold">Ocean Atlas</span>
          </Link>
          <Link to="/agent" className="text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Predictive intelligence</h1>
            <p className="mt-2 text-muted-foreground">
              Forecasts and risk signals across the next {r.windowDays} days — decision support, not
              just history
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        {/* Revenue forecast */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <TrendingUp className="size-5 text-primary" /> Revenue forecast · next {r.windowDays}{" "}
            days
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              label="Confirmed revenue"
              value={money(r.confirmedRevenue)}
              sub="bookings already locked in"
            />
            <Card
              label="Pipeline revenue"
              value={money(r.pipelineRevenue)}
              sub="quotes + unconfirmed × conversion"
            />
            <Card
              label="Expected collections"
              value={money(r.expectedCollections)}
              icon={<Wallet className="size-4" />}
            />
            <Card
              label="Expected profit"
              value={money(r.expectedProfit)}
              sub={`at ${r.projectedMarginPercent}% margin`}
              icon={<Percent className="size-4" />}
            />
          </div>
          {chartData.length > 0 && (
            <div className="mt-4 rounded-2xl border bg-card p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="Confirmed" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                    <Bar
                      dataKey="Expected"
                      fill="var(--lagoon)"
                      radius={[6, 6, 0, 0]}
                      opacity={0.7}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        {/* Booking forecast */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CalendarCheck className="size-5 text-primary" /> Booking forecast
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Open quotes" value={b.openQuotes} />
            <Card label="Historic quote conversion" value={`${b.quoteConversionRate}%`} />
            <Card
              label="Expected confirmations"
              value={b.expectedConfirmations}
              icon={<CalendarCheck className="size-4" />}
            />
            <Card
              label="Expected cancellations"
              value={b.expectedCancellations}
              sub="from confirmed pipeline"
              icon={<AlertTriangle className="size-4" />}
            />
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Lead intelligence */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users2 className="size-5 text-primary" /> Lead intelligence
            </h2>
            {data.leads.bestSource && (
              <p className="mt-1 text-sm text-muted-foreground">
                Best source:{" "}
                <Badge className="bg-success text-success-foreground">
                  {data.leads.bestSource}
                </Badge>{" "}
                · {data.leads.overallConversionRate}% overall · avg value{" "}
                {money(data.leads.avgLeadValue)}
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Quote rate</TableHead>
                    <TableHead>Conversion</TableHead>
                    <TableHead>Avg value</TableHead>
                    <TableHead>Expected rev</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leads.bySource.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No leads yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.leads.bySource.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className="font-medium">{s.source}</TableCell>
                      <TableCell>{s.leads}</TableCell>
                      <TableCell className="text-muted-foreground">{s.quoteRate}%</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.conversionRate}%</Badge>
                      </TableCell>
                      <TableCell>{money(s.avgBookingValue)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {money(s.expectedRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Supplier risk */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="size-5 text-primary" /> Supplier risk
            </h2>
            <div className="mt-4 space-y-2">
              {data.supplierRisks.length === 0 && (
                <p className="text-muted-foreground">No suppliers with properties yet.</p>
              )}
              {data.supplierRisks.map((s) => (
                <div
                  key={s.supplierId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                >
                  <p className="flex-1 font-medium">{s.name}</p>
                  <span className="text-sm text-muted-foreground">
                    {s.recentResponseHours != null ? `${s.recentResponseHours}h recent` : "no data"}
                  </span>
                  <ResponseTrend trend={s.responseTrend} />
                  {s.contractExpiryDays != null && (
                    <Badge variant={s.contractExpiryDays <= 90 ? "destructive" : "outline"}>
                      contract {s.contractExpiryDays}d
                    </Badge>
                  )}
                  {s.atRisk && (
                    <Badge variant="destructive">
                      <ShieldAlert className="size-3" /> at risk
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-display text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ResponseTrend({ trend }: { trend: "improving" | "stable" | "slowing" }) {
  if (trend === "slowing")
    return (
      <Badge variant="destructive">
        <AlertTriangle className="size-3" /> slowing
      </Badge>
    );
  if (trend === "improving")
    return (
      <Badge className="bg-success text-success-foreground">
        <CheckCircle2 className="size-3" /> improving
      </Badge>
    );
  return <Badge variant="outline">stable</Badge>;
}
