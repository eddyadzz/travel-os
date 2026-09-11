import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Paperclip,
  StickyNote,
  History,
  MessageSquare,
  UserCircle2,
  Truck,
  UploadCloud,
  Banknote,
  FileText,
  CalendarDays,
  ExternalLink,
  Download,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookingStatusBadge,
  BOOKING_STATUSES,
  NEXT_STATUS,
} from "@/components/booking-status-badge";
import { ConversationPanel } from "@/components/conversation-panel";
import { PaymentsPanel } from "@/components/payments-panel";
import { SupplierPanel } from "@/components/supplier-panel";
import { listPayments } from "@/lib/api/payments";
import { generateBookingDocument, listBookingDocuments } from "@/lib/api/documents";
import type { BookingDocumentDTO } from "@/lib/api/documents";
import type { DocumentType } from "@/lib/documents/types";
import {
  addBookingAttachment,
  addBookingNote,
  assignBooking,
  getBooking,
  listAgents,
  unassignBooking,
  updateBookingStatus,
  updateBookingSupplier,
} from "@/lib/api/bookings";
import { getBookingCalendar } from "@/lib/api/calendar";
import { getInboundAddressForBooking, ingestInboundEmailFn } from "@/lib/api/email-ingest";
import type { AgentDTO, BookingDetailDTO } from "@/lib/types";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/agent/bookings/$bookingId")({
  loader: async ({ params }) => {
    const booking = await getBooking({ data: params.bookingId });
    if (!booking) throw notFound();
    const agents = await listAgents();
    const payments = await listPayments({ data: params.bookingId });
    const documents = await listBookingDocuments({ data: params.bookingId });
    return { booking, agents, payments, documents };
  },
  head: () => ({
    meta: [{ title: "Booking detail | Ocean Atlas Agent" }, { name: "robots", content: "noindex" }],
  }),
  component: BookingDetailPage,
});

function BookingDetailPage() {
  const {
    booking: initial,
    agents,
    payments: initialPayments,
    documents: initialDocuments,
  } = Route.useLoaderData();
  const [detail, setDetail] = useState<BookingDetailDTO>(initial);
  const [payments, setPayments] = useState(initialPayments);
  const [documents, setDocuments] = useState<BookingDocumentDTO[]>(initialDocuments);
  const [generating, setGenerating] = useState<DocumentType | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supplierRef, setSupplierRef] = useState(detail.supplierReference ?? "");
  const [supplierStatus, setSupplierStatus] = useState(detail.supplierStatus ?? "");
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [inboundFrom, setInboundFrom] = useState("");
  const [inboundSubject, setInboundSubject] = useState("");
  const [inboundBody, setInboundBody] = useState("");
  const [inboundBusy, setInboundBusy] = useState(false);

  const ingestEmail = async () => {
    setInboundBusy(true);
    try {
      const inbound = await getInboundAddressForBooking({ data: detail.reference });
      const result = await ingestInboundEmailFn({
        data: {
          to: inbound.address,
          ...(inboundFrom ? { from: inboundFrom } : {}),
          ...(inboundSubject ? { subject: inboundSubject } : {}),
          body: inboundBody,
        },
      });
      if (result.linked) {
        toast.success(`Linked from ${result.sender} — conversation updated`);
        setInboundFrom("");
        setInboundSubject("");
        setInboundBody("");
      } else {
        toast.error("Not linked", { description: result.reason });
      }
    } catch (error) {
      toast.error("Ingest failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setInboundBusy(false);
    }
  };
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof getBookingCalendar>>>(null);

  const loadCalendar = async () => {
    try {
      setCalendar(await getBookingCalendar({ data: detail.id }));
    } catch {
      toast.error("Could not load calendar");
    }
  };

  const downloadIcs = () => {
    if (!calendar) return;
    const blob = new Blob([calendar.ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = calendar.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refresh = async () => {
    const updated = await getBooking({ data: detail.id });
    if (updated) setDetail(updated);
  };

  const refreshPayments = async () => {
    setPayments(await listPayments({ data: detail.id }));
  };

  const handleGenerateDocument = async (type: DocumentType) => {
    setGenerating(type);
    try {
      const document = await generateBookingDocument({ data: { bookingId: detail.id, type } });
      setDocuments((prev) => [document, ...prev]);
      toast.success("Document generated");
    } catch (error) {
      toast.error(
        "Failed to generate document",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setGenerating(null);
    }
  };

  const changeStatus = async (status: string) => {
    setStatusBusy(true);
    try {
      await updateBookingStatus({
        data: { id: detail.id, status: status as BookingDetailDTO["status"] },
      });
      await refresh();
      toast.success(`Booking moved to ${status.replaceAll("_", " ").toLowerCase()}`);
    } catch (error) {
      toast.error(
        "Could not update status",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setStatusBusy(false);
    }
  };

  const handleAssign = async (agentId: string) => {
    setAssignBusy(true);
    try {
      await assignBooking({ data: { id: detail.id, agentId } });
      await refresh();
      toast.success("Booking assigned");
    } catch (error) {
      toast.error("Could not assign", error instanceof Error ? { description: error.message } : {});
    } finally {
      setAssignBusy(false);
    }
  };

  const handleUnassign = async () => {
    setAssignBusy(true);
    try {
      await unassignBooking({ data: detail.id });
      await refresh();
      toast.success("Booking unassigned");
    } catch (error) {
      toast.error(
        "Could not unassign",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setAssignBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setNoteBusy(true);
    try {
      await addBookingNote({ data: { bookingId: detail.id, content: note } });
      setNote("");
      await refresh();
    } catch (error) {
      toast.error(
        "Could not add note",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setNoteBusy(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("bookingId", detail.id);
      form.append("file", file);
      await addBookingAttachment({ data: form });
      await refresh();
      toast.success("Attachment uploaded");
    } catch (error) {
      toast.error("Could not upload", error instanceof Error ? { description: error.message } : {});
    } finally {
      setUploading(false);
    }
  };

  const handleSupplierSave = async () => {
    setSupplierBusy(true);
    try {
      await updateBookingSupplier({
        data: {
          id: detail.id,
          ...(supplierRef.trim() ? { reference: supplierRef.trim() } : {}),
          ...(supplierStatus.trim() ? { status: supplierStatus.trim() } : {}),
        },
      });
      await refresh();
      toast.success("Supplier details saved");
    } catch (error) {
      toast.error("Could not save", error instanceof Error ? { description: error.message } : {});
    } finally {
      setSupplierBusy(false);
    }
  };

  const nextStatus = NEXT_STATUS[detail.status];

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Link
          to="/agent"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{detail.reference}</h1>
          <BookingStatusBadge status={detail.status} />
          {detail.assignedAgent && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <UserCircle2 className="size-4" /> {detail.assignedAgent.name}
            </span>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">
          {detail.customer.name} · {detail.property}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadCalendar}>
            <CalendarDays className="size-4" /> Calendar sync
          </Button>
          {calendar?.googleUrl && (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={calendar.googleUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Add to Google Calendar
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={downloadIcs}>
                <Download className="size-4" /> Download .ics
              </Button>
            </>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Tabs defaultValue="conversation">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="conversation">
                  <MessageSquare className="size-4" /> Conversation
                </TabsTrigger>
                <TabsTrigger value="payments">
                  <Banknote className="size-4" /> Payments
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <History className="size-4" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="notes">
                  <StickyNote className="size-4" /> Notes
                </TabsTrigger>
                <TabsTrigger value="attachments">
                  <Paperclip className="size-4" /> Attachments
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="size-4" /> Documents
                </TabsTrigger>
                <TabsTrigger value="supplier">
                  <Truck className="size-4" /> Supplier
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conversation" className="mt-4 rounded-2xl border bg-card p-6">
                <ConversationPanel
                  bookingId={detail.id}
                  agentName={detail.assignedAgent?.name ?? "Agent"}
                />
              </TabsContent>

              <TabsContent value="payments" className="mt-4 rounded-2xl border bg-card p-6">
                <h2 className="flex items-center gap-2 text-xl">
                  <Banknote className="size-5 text-primary" /> Payments
                </h2>
                <div className="mt-4">
                  <PaymentsPanel
                    bookingId={detail.id}
                    payments={payments}
                    onRefresh={refreshPayments}
                  />
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-4 rounded-2xl border bg-card p-6">
                <h2 className="flex items-center gap-2 text-xl">
                  <FileText className="size-5 text-primary" /> Documents
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={generating !== null}
                    onClick={() => handleGenerateDocument("RESORT_VOUCHER")}
                  >
                    {generating === "RESORT_VOUCHER" ? "Generating…" : "Generate Resort Voucher"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating !== null}
                    onClick={() => handleGenerateDocument("TRANSFER_VOUCHER")}
                  >
                    {generating === "TRANSFER_VOUCHER"
                      ? "Generating…"
                      : "Generate Transfer Voucher"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating !== null}
                    onClick={() => handleGenerateDocument("INVOICE")}
                  >
                    {generating === "INVOICE" ? "Generating…" : "Generate Invoice"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating !== null}
                    onClick={() => handleGenerateDocument("CONFIRMATION")}
                  >
                    {generating === "CONFIRMATION" ? "Generating…" : "Generate Confirmation"}
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No documents generated yet. Generate a voucher or invoice above.
                  </p>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Download</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                          )
                          .map((doc) => (
                            <TableRow key={doc.id}>
                              <TableCell className="font-medium">
                                {doc.type.replaceAll("_", " ")}
                              </TableCell>
                              <TableCell>v{doc.version}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(doc.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" asChild>
                                  <a href={doc.url} target="_blank" rel="noreferrer">
                                    Download
                                  </a>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="supplier" className="mt-4 rounded-2xl border bg-card p-6">
                <h2 className="flex items-center gap-2 text-xl">
                  <Truck className="size-5 text-primary" /> Supplier
                </h2>
                <div className="mt-4">
                  <SupplierPanel bookingId={detail.id} propertyName={detail.property} />
                </div>
                <div className="mt-6 rounded-2xl border bg-secondary/40 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="size-4" /> Inbound email
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Email → System: paste a supplier reply and it is linked to this booking.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">From</Label>
                      <Input
                        value={inboundFrom}
                        placeholder="bookings@velaaisland.com"
                        onChange={(e) => setInboundFrom(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Subject</Label>
                      <Input
                        value={inboundSubject}
                        placeholder="Re: Booking MV-00000"
                        onChange={(e) => setInboundSubject(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5">
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      rows={3}
                      value={inboundBody}
                      placeholder="We confirm the availability…"
                      onChange={(e) => setInboundBody(e.target.value)}
                    />
                  </div>
                  <Button className="mt-3" size="sm" onClick={ingestEmail} disabled={inboundBusy}>
                    <Mail className="size-4" /> Ingest & link to booking
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4 rounded-2xl border bg-card p-6">
                <h2 className="flex items-center gap-2 text-xl">
                  <History className="size-5 text-primary" /> Timeline
                </h2>
                {detail.events.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No events yet.</p>
                ) : (
                  <ol className="mt-5 space-y-0">
                    {detail.events.map((e, i) => (
                      <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {i < detail.events.length - 1 && (
                          <span className="absolute left-[5px] top-4 h-full w-px bg-border" />
                        )}
                        <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="text-sm font-medium">{e.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(e.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4 rounded-2xl border bg-card p-6">
                <h2 className="flex items-center gap-2 text-xl">
                  <StickyNote className="size-5 text-primary" /> Internal notes
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Only your team can see these.</p>
                <div className="mt-4 space-y-3">
                  {detail.notes.map((n) => (
                    <div key={n.id} className="rounded-xl bg-secondary/50 p-3 text-sm">
                      <p>{n.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add an internal note…"
                  />
                  <Button size="sm" disabled={!note.trim() || noteBusy} onClick={handleAddNote}>
                    Add note
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4 rounded-2xl border bg-card p-6">
                <h2 className="flex items-center gap-2 text-xl">
                  <Paperclip className="size-5 text-primary" /> Attachments
                </h2>
                {detail.attachments.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {detail.attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-xl border p-3 text-sm"
                      >
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {a.filename}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.uploadedAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
                    <UploadCloud className="size-4" /> {uploading ? "Uploading…" : "Upload file"}
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Quotation, invoice, voucher, rooming list…
                  </span>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Status</h2>
              <div className="mt-4 space-y-2">
                <Select value={detail.status} onValueChange={changeStatus} disabled={statusBusy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {nextStatus && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={statusBusy}
                    onClick={() => changeStatus(nextStatus)}
                  >
                    Move to {nextStatus.replaceAll("_", " ").toLowerCase()}{" "}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Assignment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.assignedAgent ? `Assigned to ${detail.assignedAgent.name}` : "Unassigned"}
              </p>
              <div className="mt-4 space-y-2">
                <Select
                  value={detail.assignedAgent?.id ?? ""}
                  onValueChange={handleAssign}
                  disabled={assignBusy || agents.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign an agent…" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.assignedAgent && (
                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    disabled={assignBusy}
                    onClick={handleUnassign}
                  >
                    Unassign
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Truck className="size-4 text-primary" /> Supplier tracking
              </h2>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sup-ref">Supplier reference</Label>
                  <Input
                    id="sup-ref"
                    value={supplierRef}
                    onChange={(e) => setSupplierRef(e.target.value)}
                    placeholder="VELAA-2026-9981"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup-status">Supplier status</Label>
                  <Input
                    id="sup-status"
                    value={supplierStatus}
                    onChange={(e) => setSupplierStatus(e.target.value)}
                    placeholder="Requested / Confirmed…"
                  />
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={supplierBusy}
                  onClick={handleSupplierSave}
                >
                  Save supplier details
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Booking summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Customer" value={detail.customer.name} />
                <Row label="Email" value={detail.customer.email} />
                <Row label="Phone" value={detail.customer.phone} />
                <Row label="Country" value={detail.customer.country} />
                <Separator className="my-2" />
                <Row label="Property" value={detail.property} />
                <Row label="Room" value={detail.room} />
                <Row
                  label="Dates"
                  value={`${detail.checkIn} → ${detail.checkOut} (${detail.nights}n)`}
                />
                <Row
                  label="Guests"
                  value={`${detail.adults} adults, ${detail.children} children`}
                />
                {detail.addons.length > 0 && (
                  <Row label="Add-ons" value={detail.addons.join(", ")} />
                )}
                {detail.specialRequests && <Row label="Requests" value={detail.specialRequests} />}
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Estimated total</span>
                  <span className="text-display text-xl font-semibold">{money(detail.total)}</span>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </main>
    </div>
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
