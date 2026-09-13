import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { Plus, ArrowRight, Inbox, FileText, Clock4, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLead, getCrmMetrics, listLeads } from "@/lib/api/leads";
import type { LeadSource, LeadStatus } from "@/lib/types";

const SOURCES: LeadSource[] = [
  "WEBSITE",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "WALK_IN",
  "REFERRAL",
  "FACEBOOK",
  "INSTAGRAM",
];
const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUOTED", "FOLLOW_UP", "WON", "LOST"];

const STATUS_BADGE: Record<LeadStatus, string> = {
  NEW: "bg-warning text-warning-foreground hover:bg-warning",
  CONTACTED: "bg-secondary text-secondary-foreground hover:bg-secondary",
  QUOTED: "bg-primary text-primary-foreground hover:bg-primary",
  FOLLOW_UP: "bg-warning text-warning-foreground hover:bg-warning",
  WON: "bg-success text-success-foreground hover:bg-success",
  LOST: "bg-destructive text-destructive-foreground hover:bg-destructive",
};

export const Route = createFileRoute("/leads/")({
  beforeLoad: requireAuth,
  loader: async () => {
    const [leads, metrics] = await Promise.all([listLeads(), getCrmMetrics()]);
    return { leads, metrics };
  },
  component: LeadsPage,
});

function LeadsPage() {
  const { leads: initial, metrics: initialMetrics } = Route.useLoaderData();
  const [leads, setLeads] = useState(initial);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    source: "WEBSITE",
    fullName: "",
    email: "",
    phone: "",
    destination: "",
    notes: "",
  });

  const refresh = async () => {
    const [ls, m] = await Promise.all([listLeads(), getCrmMetrics()]);
    setLeads(ls);
    setMetrics(m);
  };

  const filtered = leads.filter(
    (l) =>
      (statusFilter === "all" || l.status === statusFilter) &&
      (sourceFilter === "all" || l.source === sourceFilter),
  );

  const handleCreate = async () => {
    if (!form.fullName.trim()) return;
    setBusy(true);
    try {
      await createLead({
        data: {
          source: form.source as LeadSource,
          fullName: form.fullName.trim(),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.destination.trim() ? { destination: form.destination.trim() } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        },
      });
      setOpen(false);
      setForm({
        source: "WEBSITE",
        fullName: "",
        email: "",
        phone: "",
        destination: "",
        notes: "",
      });
      await refresh();
      toast.success("Lead created");
    } catch (error) {
      toast.error(
        "Could not create lead",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    {
      icon: Inbox,
      label: "New leads",
      value: metrics.new,
      cls: "bg-warning text-warning-foreground",
    },
    {
      icon: FileText,
      label: "Quotes sent",
      value: metrics.quoted,
      cls: "bg-primary text-primary-foreground",
    },
    {
      icon: Clock4,
      label: "Follow-ups due",
      value: metrics.followUpsDue,
      cls: "bg-warning text-warning-foreground",
    },
    {
      icon: CheckCircle2,
      label: "Won",
      value: metrics.won,
      cls: "bg-success text-success-foreground",
    },
    {
      icon: XCircle,
      label: "Lost",
      value: metrics.lost,
      cls: "bg-destructive text-destructive-foreground",
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Leads & CRM</h1>
          <p className="mt-2 text-muted-foreground">Inquiry → quote → booking pipeline</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New lead
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5">
            <c.icon className={`size-5 ${c.cls.split(" ")[1]}`} />
            <p className="mt-3 text-display text-2xl font-semibold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No leads match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <p className="font-medium">{l.fullName}</p>
                    {l.email && <p className="text-xs text-muted-foreground">{l.email}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[l.status]}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.destination ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.checkIn ? `${l.checkIn} → ${l.checkOut ?? ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.assignedAgentName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/leads/$leadId" params={{ leadId: l.id }}>
                        Open <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Input
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={!form.fullName.trim() || busy}
              onClick={handleCreate}
            >
              Create lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
