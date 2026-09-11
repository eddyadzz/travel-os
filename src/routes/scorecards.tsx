import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Timer,
  BadgeCheck,
  DollarSign,
  FileWarning,
  RefreshCw,
  Building2,
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
import { getSupplierPerformance } from "@/lib/api/scorecards";
import type { SupplierInsightRow } from "@/lib/types";

export const Route = createFileRoute("/scorecards")({
  loader: async () => getSupplierPerformance(),
  head: () => ({
    meta: [{ title: "Supplier Scorecards | Ocean Atlas" }, { name: "robots", content: "noindex" }],
  }),
  component: ScorecardsPage,
});

function money(n: number) {
  return `$${(n / 1000).toFixed(1)}k`;
}

function fmtResponse(hours: number | null) {
  if (hours == null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function tierBadge(tier: SupplierInsightRow["tier"]) {
  if (tier === "Reliable")
    return (
      <Badge className="bg-success text-success-foreground">
        <ShieldCheck className="size-3" /> Reliable
      </Badge>
    );
  if (tier === "Needs Attention")
    return (
      <Badge className="bg-warning text-warning-foreground">
        <AlertTriangle className="size-3" /> Needs attention
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <FileWarning className="size-3" /> At risk
    </Badge>
  );
}

function ScorecardsPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState<SupplierInsightRow[]>(initial.rows);
  const [summary, setSummary] = useState(initial.summary);
  const [tier, setTier] = useState<"ALL" | "Reliable" | "Needs Attention" | "At Risk">("ALL");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await getSupplierPerformance();
      setRows(res.rows);
      setSummary(res.summary);
    } finally {
      setBusy(false);
    }
  };

  const filtered = tier === "ALL" ? rows : rows.filter((r) => r.tier === tier);
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  const cards = [
    { label: "Reliable", value: summary.reliable, icon: ShieldCheck, cls: "bg-success/60" },
    {
      label: "Needs attention",
      value: summary.needsAttention,
      icon: AlertTriangle,
      cls: "bg-warning/60",
    },
    { label: "At risk", value: summary.atRisk, icon: FileWarning, cls: "bg-destructive/60" },
    {
      label: "Contracts renewing ≤90d",
      value: summary.renewalDue,
      icon: Timer,
      cls: "bg-primary/60",
    },
  ];

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
            <h1 className="text-4xl">Supplier scorecards</h1>
            <p className="mt-2 text-muted-foreground">
              Reliability, response speed, profitability and contract intelligence — ranked
              automatically
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-2xl border bg-card p-5 ${c.cls}`}>
              <c.icon className="size-4" />
              <p className="mt-2 text-sm opacity-80">{c.label}</p>
              <p className="mt-1 text-display text-2xl font-semibold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          {(["ALL", "Reliable", "Needs Attention", "At Risk"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tier === t ? "default" : "outline"}
              onClick={() => setTier(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border bg-card p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Confirmation</TableHead>
                  <TableHead>Avg response</TableHead>
                  <TableHead>Cancellation</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Contract</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No suppliers with properties yet.
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((r) => (
                  <TableRow key={r.supplierId}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-muted-foreground" /> {r.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ScoreMeter score={r.score} />
                    </TableCell>
                    <TableCell>{tierBadge(r.tier)}</TableCell>
                    <TableCell>
                      {r.confirmationRate != null ? `${r.confirmationRate}%` : "—"}
                    </TableCell>
                    <TableCell className="flex items-center gap-1 text-muted-foreground">
                      <Timer className="size-3.5" /> {fmtResponse(r.avgResponseHours)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.cancellationRate != null ? `${r.cancellationRate}%` : "—"}
                    </TableCell>
                    <TableCell>{r.bookingVolume}</TableCell>
                    <TableCell>{money(r.revenue)}</TableCell>
                    <TableCell>
                      {r.profit > 0 ? (
                        <Badge className="bg-success text-success-foreground">
                          {money(r.profit)}
                        </Badge>
                      ) : (
                        money(r.profit)
                      )}
                    </TableCell>
                    <TableCell>
                      {r.contractExpiryDays != null ? (
                        r.contractExpiryDays <= 90 ? (
                          <Badge variant="destructive">
                            <Timer className="size-3" /> {r.contractExpiryDays}d left
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <BadgeCheck className="size-3" /> {r.contractExpiryDays}d
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-semibold">{score}</span>
    </div>
  );
}
