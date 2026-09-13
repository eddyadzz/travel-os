import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  completeLeadTask,
  convertLeadToBooking,
  createLeadTask,
  createQuote,
  getLead,
  updateLeadStatus,
} from "@/lib/api/leads";
import type { LeadDetailDTO, LeadStatus } from "@/lib/types";
import { money } from "@/lib/pricing";

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUOTED", "FOLLOW_UP", "WON", "LOST"];

const STATUS_BADGE: Record<LeadStatus, string> = {
  NEW: "bg-warning text-warning-foreground hover:bg-warning",
  CONTACTED: "bg-secondary text-secondary-foreground hover:bg-secondary",
  QUOTED: "bg-primary text-primary-foreground hover:bg-primary",
  FOLLOW_UP: "bg-warning text-warning-foreground hover:bg-warning",
  WON: "bg-success text-success-foreground hover:bg-success",
  LOST: "bg-destructive text-destructive-foreground hover:bg-destructive",
};

export const Route = createFileRoute("/leads/$leadId")({
  beforeLoad: requireAuth,
  loader: async ({ params }) => {
    const lead = await getLead({ data: params.leadId });
    if (!lead) throw notFound();
    return { lead };
  },
  head: () => ({
    meta: [{ title: "Lead detail | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadDetailPage,
});

function LeadDetailPage() {
  const { lead: initial } = Route.useLoaderData();
  const [lead, setLead] = useState<LeadDetailDTO>(initial);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteValid, setQuoteValid] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskNote, setTaskNote] = useState("");

  // Convert-to-booking form
  const [propertyId, setPropertyId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState(lead.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(lead.checkOut ?? "");
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; propertyId: string }>>([]);

  const refresh = async () => {
    const updated = await getLead({ data: lead.id });
    if (updated) setLead(updated);
  };

  const changeStatus = async (status: LeadStatus) => {
    await updateLeadStatus({ data: { id: lead.id, status } });
    await refresh();
  };

  const handleQuote = async () => {
    const amount = Number(quoteAmount);
    if (!amount || !quoteValid) return;
    await createQuote({
      data: {
        leadId: lead.id,
        totalPrice: amount,
        validUntil: quoteValid,
        ...(quoteNotes.trim() ? { notes: quoteNotes.trim() } : {}),
      },
    });
    setQuoteAmount("");
    setQuoteValid("");
    setQuoteNotes("");
    await refresh();
    toast.success("Quote created");
  };

  const handleTask = async () => {
    if (!taskDue || !taskNote.trim()) return;
    await createLeadTask({ data: { leadId: lead.id, dueAt: taskDue, note: taskNote.trim() } });
    setTaskDue("");
    setTaskNote("");
    await refresh();
    toast.success("Follow-up scheduled");
  };

  const selectProperty = async (pid: string) => {
    setPropertyId(pid);
    setRoomId("");
    // fetch rooms for the property via the existing properties API
    const { getPropertyById } = await import("@/lib/api/properties");
    const property = await getPropertyById({ data: pid });
    setRooms(property?.rooms.map((r) => ({ id: r.id, name: r.name, propertyId: pid })) ?? []);
  };

  const handleConvert = async () => {
    if (!propertyId || !roomId || !checkIn || !checkOut) return;
    try {
      const result = await convertLeadToBooking({
        data: {
          leadId: lead.id,
          propertyId,
          roomId,
          checkIn,
          checkOut,
          adults: lead.adults,
          children: lead.children,
        },
      });
      await refresh();
      toast.success(`Booking created — ${result.reference}`);
    } catch (error) {
      toast.error(
        "Could not convert",
        error instanceof Error ? { description: error.message } : {},
      );
    }
  };

  return (
    <>
      <Link
        to="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to leads
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{lead.fullName}</h1>
        <Badge variant="outline">{lead.source}</Badge>
        <Badge className={STATUS_BADGE[lead.status]}>{lead.status}</Badge>
        {lead.bookingId && (
          <Link
            to="/agent/bookings/$bookingId"
            params={{ bookingId: lead.bookingId }}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            View converted booking →
          </Link>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        {lead.email && <span>{lead.email}</span>}
        {lead.phone && <span> · {lead.phone}</span>}
        {lead.assignedAgentName && <span> · Assigned: {lead.assignedAgentName}</span>}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* Status workflow */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Pipeline</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={lead.status === s ? "default" : "outline"}
                  disabled={lead.status === s}
                  onClick={() => changeStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </section>

          {/* Quotes */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Quotes</h2>
            {lead.quotes.length > 0 && (
              <div className="mt-4 space-y-2">
                {lead.quotes.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between rounded-xl border p-3 text-sm"
                  >
                    <span className="font-medium">{money(q.totalPrice)}</span>
                    <span className="text-muted-foreground">valid until {q.validUntil}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                type="number"
                placeholder="Quote amount (USD)"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
              />
              <Input
                type="date"
                value={quoteValid}
                onChange={(e) => setQuoteValid(e.target.value)}
              />
              <Button disabled={!quoteAmount || !quoteValid} onClick={handleQuote}>
                Create quote
              </Button>
            </div>
            <Textarea
              rows={2}
              className="mt-3"
              placeholder="Quote notes (optional)"
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
            />
          </section>

          {/* Tasks */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Follow-ups</h2>
            {lead.tasks.length > 0 && (
              <div className="mt-4 space-y-2">
                {lead.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border p-3 text-sm"
                  >
                    <div>
                      <p className={t.completed ? "line-through text-muted-foreground" : ""}>
                        {t.note}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        due {new Date(t.dueAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!t.completed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await completeLeadTask({ data: t.id });
                          await refresh();
                        }}
                      >
                        <CheckCircle2 className="size-4" /> Done
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
              <Input
                placeholder="Follow-up note"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
              />
              <Button disabled={!taskDue || !taskNote.trim()} onClick={handleTask}>
                <Plus className="size-4" /> Schedule
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Lead details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Destination" value={lead.destination ?? "—"} />
              <Row
                label="Dates"
                value={lead.checkIn ? `${lead.checkIn} → ${lead.checkOut ?? ""}` : "—"}
              />
              <Row label="Guests" value={`${lead.adults} adults, ${lead.children} children`} />
              {lead.notes && <Row label="Notes" value={lead.notes} />}
            </dl>
          </section>

          {/* Convert to booking */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Convert to booking</h2>
            {lead.bookingId ? (
              <p className="mt-3 text-sm text-muted-foreground">Already converted.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <PropertyPicker onSelect={selectProperty} />
                {propertyId && (
                  <div className="space-y-1.5">
                    <Label>Room</Label>
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select room…" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Check-in</Label>
                    <Input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Check-out</Label>
                    <Input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!propertyId || !roomId || !checkIn || !checkOut}
                  onClick={handleConvert}
                >
                  <CheckCircle2 className="size-4" /> Convert to booking
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function PropertyPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (loaded) return;
    const { listProperties } = await import("@/lib/api/properties");
    const list = await listProperties();
    setProperties(list.map((p) => ({ id: p.id, name: p.name })));
    setLoaded(true);
  };

  return (
    <div className="space-y-1.5">
      <Label>Property</Label>
      <Select onValueChange={onSelect} onOpenChange={(o) => o && load()}>
        <SelectTrigger>
          <SelectValue placeholder="Select property…" />
        </SelectTrigger>
        <SelectContent>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
