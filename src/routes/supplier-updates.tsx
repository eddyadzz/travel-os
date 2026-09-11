import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, RefreshCw, CheckCircle2, XCircle, Download, Inbox, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createSupplierUpdateRequest,
  getSupplierScorecard,
  getSupplierUpdateMetrics,
  listSupplierUpdateRequests,
  runSupplierUpdateScanFn,
  updateSupplierUpdateRequest,
} from "@/lib/api/supplier-updates";
import {
  listSuppliers,
  getSupplierPortalAccess,
  sendSupplierPortalAccess,
} from "@/lib/api/suppliers";
import type {
  SupplierScorecardRow,
  SupplierUpdateMetricsDTO,
  SupplierUpdateRequestDTO,
  SupplierUpdateType,
} from "@/lib/types";

const STATUS_BADGE: Record<string, string> = {
  REQUESTED: "bg-warning text-warning-foreground hover:bg-warning",
  RECEIVED: "bg-primary text-primary-foreground hover:bg-primary",
  IMPORTED: "bg-success text-success-foreground hover:bg-success",
  CANCELLED: "bg-muted text-muted-foreground hover:bg-muted",
  OVERDUE: "bg-destructive text-destructive-foreground hover:bg-destructive",
};

export const Route = createFileRoute("/supplier-updates")({
  loader: async () => {
    const [requests, metrics, scorecard, suppliers] = await Promise.all([
      listSupplierUpdateRequests(),
      getSupplierUpdateMetrics(),
      getSupplierScorecard(),
      listSuppliers(),
    ]);
    return { requests, metrics, scorecard, suppliers };
  },
  head: () => ({
    meta: [{ title: "Supplier Updates | Ocean Atlas" }, { name: "robots", content: "noindex" }],
  }),
  component: SupplierUpdatesPage,
});

function SupplierUpdatesPage() {
  const {
    requests: initial,
    metrics: initialMetrics,
    scorecard: initialScorecard,
    suppliers,
  } = Route.useLoaderData();
  const [requests, setRequests] = useState(initial);
  const [metrics, setMetrics] = useState<SupplierUpdateMetricsDTO>(initialMetrics);
  const [scorecard, setScorecard] = useState<SupplierScorecardRow[]>(initialScorecard);
  const [busy, setBusy] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [newType, setNewType] = useState<SupplierUpdateType>("AVAILABILITY");
  const [portalSupplier, setPortalSupplier] = useState("");
  const [portalLink, setPortalLink] = useState<string | null>(null);

  const handlePortalLink = async () => {
    if (!portalSupplier) return;
    const res = await getSupplierPortalAccess({ data: portalSupplier });
    if (!res) return;
    setPortalLink(res.link);
    await navigator.clipboard?.writeText(window.location.origin + res.link);
    toast.success("Portal link copied to clipboard");
  };

  const handleSendPortal = async () => {
    if (!portalSupplier) return;
    setBusy(true);
    try {
      const res = await sendSupplierPortalAccess({ data: portalSupplier });
      setPortalLink(res.link);
      toast.success(`Access email sent to ${res.email}`);
    } catch (error) {
      toast.error("Could not send", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    const [rs, m, sc] = await Promise.all([
      listSupplierUpdateRequests(),
      getSupplierUpdateMetrics(),
      getSupplierScorecard(),
    ]);
    setRequests(rs);
    setMetrics(m);
    setScorecard(sc);
  };

  const handleRequest = async () => {
    if (!newSupplier) return;
    setBusy(true);
    try {
      await createSupplierUpdateRequest({ data: { supplierId: newSupplier, type: newType } });
      setNewSupplier("");
      await refresh();
      toast.success("Update request sent");
    } catch (error) {
      toast.error(
        "Could not request",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (id: string, status: "RECEIVED" | "IMPORTED" | "CANCELLED") => {
    await updateSupplierUpdateRequest({ data: { id, status } });
    await refresh();
  };

  const handleScan = async () => {
    setBusy(true);
    try {
      const result = await runSupplierUpdateScanFn({ data: 7 });
      await refresh();
      toast.success(`Scan complete — ${result.created} new request(s)`);
    } catch (error) {
      toast.error("Scan failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    { label: "Pending requests", value: metrics.pending, cls: "bg-warning/60" },
    { label: "Overdue", value: metrics.overdue, cls: "bg-destructive/60" },
    { label: "Received today", value: metrics.receivedToday, cls: "bg-primary/60" },
    { label: "Imported today", value: metrics.importedToday, cls: "bg-success/60" },
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
            <h1 className="text-4xl">Supplier updates</h1>
            <p className="mt-2 text-muted-foreground">
              Chase resorts for fresh availability & rates
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={handleScan}>
            <RefreshCw className="size-4" /> Run scan
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-2xl border p-5 ${c.cls}`}>
              <p className="text-display text-2xl font-semibold">{c.value}</p>
              <p className="text-sm opacity-80">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5">
          <div className="w-64 space-y-1.5">
            <p className="text-sm text-muted-foreground">Supplier</p>
            <Select value={newSupplier} onValueChange={setNewSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40 space-y-1.5">
            <p className="text-sm text-muted-foreground">Type</p>
            <Select value={newType} onValueChange={(v) => setNewType(v as SupplierUpdateType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABILITY">Availability</SelectItem>
                <SelectItem value="RATES">Rates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!newSupplier || busy} onClick={handleRequest}>
            <Mail className="size-4" /> Request update
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5">
          <div className="w-64 space-y-1.5">
            <p className="text-sm text-muted-foreground">Supplier portal</p>
            <Select
              value={portalSupplier}
              onValueChange={(v) => {
                setPortalSupplier(v);
                setPortalLink(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={!portalSupplier || busy} onClick={handlePortalLink}>
            <LinkIcon className="size-4" /> Copy portal link
          </Button>
          <Button variant="outline" disabled={!portalSupplier || busy} onClick={handleSendPortal}>
            <Mail className="size-4" /> Email access link
          </Button>
          {portalLink && (
            <p className="text-sm text-muted-foreground">
              <Link to={portalLink} className="underline">
                Open portal
              </Link>
            </p>
          )}
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Requests</h2>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      <Inbox className="mx-auto mb-2 size-5" /> No update requests yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.supplierName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.dueAt}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === "REQUESTED" || r.status === "OVERDUE" ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(r.id, "RECEIVED")}
                            >
                              <CheckCircle2 className="size-4" /> Received
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(r.id, "CANCELLED")}
                            >
                              <XCircle className="size-4" /> Cancel
                            </Button>
                          </div>
                        ) : r.status === "RECEIVED" ? (
                          <Button size="sm" onClick={() => handleStatus(r.id, "IMPORTED")}>
                            <Download className="size-4" /> Imported
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {scorecard.length > 0 && (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Supplier scorecard</h2>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Avg response</TableHead>
                    <TableHead>Overdue %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scorecard.map((s) => (
                    <TableRow key={s.supplierId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.total}</TableCell>
                      <TableCell>{s.avgResponseHours}h</TableCell>
                      <TableCell>{s.overduePercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
