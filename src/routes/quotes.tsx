import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { Plus, Send, Download, FileText } from "lucide-react";
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
import { listProperties } from "@/lib/api/properties";
import { generateAutoQuote, listQuotes, sendQuoteEmail } from "@/lib/api/quotes";
import type { QuoteDTO } from "@/lib/types";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/quotes")({
  beforeLoad: requireAuth,
  loader: async () => {
    const quotes = await listQuotes();
    return { quotes };
  },
  head: () => ({
    meta: [{ title: "Quotes | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: QuotesPage,
});

function QuotesPage() {
  const { quotes: initial } = Route.useLoaderData();
  const [quotes, setQuotes] = useState<QuoteDTO[]>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [properties, setProperties] = useState<
    Array<{ id: string; name: string; rooms: Array<{ id: string; name: string }> }>
  >([]);
  const [form, setForm] = useState({
    propertyId: "",
    roomId: "",
    checkIn: "",
    checkOut: "",
    adults: "2",
    children: "0",
    validUntil: "",
    customerName: "",
    customerEmail: "",
    notes: "",
  });

  const refresh = async () => setQuotes(await listQuotes());

  const loadProperties = async () => {
    if (properties.length > 0) return;
    const list = await listProperties();
    setProperties(list.map((p) => ({ id: p.id, name: p.name, rooms: p.rooms })));
  };

  const selectedProperty = properties.find((p) => p.id === form.propertyId);

  const handleGenerate = async () => {
    if (!form.propertyId || !form.roomId || !form.checkIn || !form.checkOut || !form.validUntil) {
      toast.error("Fill in property, room, dates and validity");
      return;
    }
    setBusy(true);
    try {
      await generateAutoQuote({
        data: {
          propertyId: form.propertyId,
          roomId: form.roomId,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: Number(form.adults) || 2,
          children: Number(form.children) || 0,
          validUntil: form.validUntil,
          ...(form.customerName.trim() ? { customerName: form.customerName.trim() } : {}),
          ...(form.customerEmail.trim() ? { customerEmail: form.customerEmail.trim() } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        },
      });
      setOpen(false);
      setForm({
        propertyId: "",
        roomId: "",
        checkIn: "",
        checkOut: "",
        adults: "2",
        children: "0",
        validUntil: "",
        customerName: "",
        customerEmail: "",
        notes: "",
      });
      await refresh();
      toast.success("Quote generated");
    } catch (error) {
      toast.error(
        "Could not generate quote",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      const result = await sendQuoteEmail({ data: id });
      await refresh();
      toast.success(
        result.sent ? "Quote emailed to customer" : "Quote queued (no email provider configured)",
      );
    } catch (error) {
      toast.error(
        "Could not send quote",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setSending(null);
    }
  };

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
            <h1 className="text-4xl">Quotes</h1>
            <p className="mt-2 text-muted-foreground">Generate professional quotes in seconds</p>
          </div>
          <Button
            onClick={() => {
              void loadProperties();
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New quote
          </Button>
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-6">
          {quotes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No quotes yet. Generate your first quote to send a customer.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.reference ?? q.id.slice(-5)}</TableCell>
                    <TableCell>{q.leadName ?? q.customerName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{q.propertyName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.checkIn ? `${q.checkIn} → ${q.checkOut ?? ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{money(q.totalPrice)}</TableCell>
                    <TableCell className="text-muted-foreground">{q.validUntil}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {q.documentUrl && (
                          <Button asChild size="sm" variant="outline">
                            <a href={q.documentUrl} target="_blank" rel="noreferrer">
                              <Download className="size-4" /> PDF
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={sending === q.id}
                          onClick={() => handleSend(q.id)}
                        >
                          <Send className="size-4" /> {sending === q.id ? "Sending…" : "Send"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={form.propertyId}
                onValueChange={(v) => setForm({ ...form, propertyId: v, roomId: "" })}
              >
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
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room…" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedProperty?.rooms ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Check-in</Label>
                <Input
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Adults</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.adults}
                  onChange={(e) => setForm({ ...form, adults: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.children}
                  onChange={(e) => setForm({ ...form, children: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valid until</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer name</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Customer email</Label>
                <Input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={handleGenerate}>
              <FileText className="size-4" /> Generate quote
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
