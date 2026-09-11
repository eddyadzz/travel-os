import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Users2,
  ShieldAlert,
  Banknote,
  CalendarCheck,
  FileWarning,
  Trophy,
  RefreshCw,
  ArrowRight,
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
import { getCommandCenter } from "@/lib/api/command";
import type { CommandCenterDTO } from "@/lib/types";

export const Route = createFileRoute("/command")({
  loader: async () => getCommandCenter(),
  head: () => ({
    meta: [{ title: "Command Center | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: CommandCenterPage,
});

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function CommandCenterPage() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<CommandCenterDTO>(initial);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      setData(await getCommandCenter());
    } finally {
      setBusy(false);
    }
  };

  const a = data.attention;

  const revenueCards = [
    {
      label: `Expected revenue · ${data.month}`,
      value: money(data.monthRevenue.expected),
      icon: TrendingUp,
    },
    {
      label: "Confirmed this month",
      value: money(data.monthRevenue.confirmed),
      icon: CalendarCheck,
    },
    { label: "Expected profit", value: money(data.monthRevenue.profit), icon: Banknote },
  ];

  const attentionCards = [
    { label: "Leads to follow up", value: a.newLeads, icon: Users2, to: "/leads" as const },
    { label: "Open quotes", value: a.openQuotes, icon: FileWarning, to: "/quotes" as const },
    { label: "Overdue deposits", value: a.overdueDeposits, icon: Banknote, to: "/agent" as const },
    {
      label: "Supplier requests",
      value: a.supplierRequests,
      icon: ShieldAlert,
      to: "/supplier-updates" as const,
    },
    {
      label: "Suppliers at risk",
      value: a.atRiskSuppliers,
      icon: ShieldAlert,
      to: "/scorecards" as const,
    },
    {
      label: "Contracts renewing",
      value: a.renewingContracts,
      icon: FileWarning,
      to: "/scorecards" as const,
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-4xl">
              <LayoutDashboard className="size-8 text-primary" /> Command center
            </h1>
            <p className="mt-2 text-muted-foreground">
              Revenue, attention, risk and performance — at a glance
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">This month</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {revenueCards.map((c) => (
              <div key={c.label} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-sm">{c.label}</span>
                  <c.icon className="size-4" />
                </div>
                <p className="mt-2 text-display text-2xl font-semibold">{c.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Needs attention</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attentionCards.map((c) => (
              <Link
                key={c.label}
                to={c.to}
                className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex items-center justify-between">
                  <c.icon className="size-5 text-primary" />
                  <span className="flex items-center gap-1 text-sm text-primary">
                    Open <ArrowRight className="size-4" />
                  </span>
                </div>
                <p className="mt-3 text-display text-3xl font-semibold">{c.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarCheck className="size-5 text-primary" /> Arrivals · next 14 days
            </h2>
            <div className="mt-4 space-y-2">
              {data.arrivals.length === 0 && (
                <p className="text-sm text-muted-foreground">No confirmed arrivals.</p>
              )}
              {data.arrivals.map((x) => (
                <div
                  key={x.reference}
                  className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{x.reference}</span>
                  <span className="text-muted-foreground">{x.customer}</span>
                  <span className="text-muted-foreground">{x.property}</span>
                  <span className="ml-auto text-muted-foreground">
                    {x.checkIn} · {x.nights}n
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FileWarning className="size-5 text-primary" /> Contracts renewing · ≤90 days
            </h2>
            <div className="mt-4 space-y-2">
              {data.contractsRenewing.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing renewing soon.</p>
              )}
              {data.contractsRenewing.map((c) => (
                <div
                  key={c.supplierId}
                  className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="destructive">{c.expiryDays}d left</Badge>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users2 className="size-5 text-primary" /> Leads to follow up
            </h2>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nothing pending.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">{l.source}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.createdAt.slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Banknote className="size-5 text-primary" /> Overdue deposits
            </h2>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueDeposits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No overdue deposits.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.overdueDeposits.map((p) => (
                    <TableRow key={p.paymentId}>
                      <TableCell className="font-medium">{p.reference}</TableCell>
                      <TableCell>{p.customer}</TableCell>
                      <TableCell>{money(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{p.ageDays}d</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="size-5 text-primary" /> Agent performance · this year
          </h2>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No assigned bookings.
                    </TableCell>
                  </TableRow>
                )}
                {data.agents.map((x) => (
                  <TableRow key={x.agentId}>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell>{x.bookings}</TableCell>
                    <TableCell>{money(x.revenue)}</TableCell>
                    <TableCell>{money(x.profit)}</TableCell>
                    <TableCell>{money(x.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  );
}
