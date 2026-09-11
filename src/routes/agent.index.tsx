import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Inbox,
  Clock3,
  Banknote,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Upload,
  MessageSquare,
  Bell,
  Truck,
  BarChart3,
  Users,
  FileText,
  CalendarCheck2,
  AlertTriangle,
  Mail,
  Zap,
  Clock,
  Wallet,
  Building2,
  Percent,
  ShieldCheck,
  TrendingUp,
  LayoutDashboard,
  PlugZap,
  Sparkles,
  Rocket,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { assignBooking, listAgents, listBookings } from "@/lib/api/bookings";
import { getUnreadMessageCounts } from "@/lib/api/conversation";
import { getRecentNotifications } from "@/lib/api/notifications";
import { getFinanceMetrics } from "@/lib/api/payments";
import { getSupplierDashboard } from "@/lib/api/suppliers";
import { getAvailabilityHealth, getExpiringRates } from "@/lib/api/availability";
import { getSupplierUpdateMetrics } from "@/lib/api/supplier-updates";
import type { BookingDTO, NotificationDTO } from "@/lib/types";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/agent/")({
  loader: async () => {
    const bookings = await listBookings();
    const agents = await listAgents();
    const unread = await getUnreadMessageCounts();
    const notifications = await getRecentNotifications();
    const finance = await getFinanceMetrics();
    const availabilityHealth = await getAvailabilityHealth();
    const expiringRates = await getExpiringRates({ data: 30 });
    const supplierUpdates = await getSupplierUpdateMetrics();
    const suppliers = await getSupplierDashboard();
    return {
      bookings,
      agents,
      unread,
      notifications,
      finance,
      suppliers,
      availabilityHealth,
      expiringRates,
      supplierUpdates,
    };
  },
  head: () => ({
    meta: [
      { title: "Agent Dashboard — Booking Requests | TravelOS by Boliflow" },
      {
        name: "description",
        content: "Manage, assign and track Maldives booking requests in one queue.",
      },
      { property: "og:title", content: "Agent Dashboard | TravelOS by Boliflow" },
      { property: "og:description", content: "Manage incoming Maldives booking requests." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentDashboard,
});

type DashboardTab = "mine" | "unassigned" | "all";

function AgentDashboard() {
  const {
    bookings: initial,
    agents,
    unread,
    notifications,
    finance,
    suppliers,
    availabilityHealth,
    expiringRates,
    supplierUpdates,
  } = Route.useLoaderData();
  const [bookings, setBookings] = useState<BookingDTO[]>(initial);
  const [tab, setTab] = useState<DashboardTab>("all");
  const currentAgent = agents[0];

  const reload = async () => setBookings(await listBookings());

  const count = (status: string) => bookings.filter((b) => b.status === status).length;

  const metrics = [
    { icon: Inbox, label: "New", value: count("NEW"), cls: "bg-warning text-warning-foreground" },
    {
      icon: Clock3,
      label: "Pending supplier",
      value: count("PENDING_SUPPLIER"),
      cls: "bg-warning text-warning-foreground",
    },
    {
      icon: Banknote,
      label: "Awaiting payment",
      value: count("AWAITING_PAYMENT"),
      cls: "bg-warning text-warning-foreground",
    },
    {
      icon: CheckCircle2,
      label: "Confirmed",
      value: count("CONFIRMED"),
      cls: "bg-success text-success-foreground",
    },
    {
      icon: XCircle,
      label: "Cancelled",
      value: count("CANCELLED"),
      cls: "bg-destructive text-destructive-foreground",
    },
  ];

  const visible = bookings.filter((b) => {
    if (tab === "mine") return b.assignedAgentId === currentAgent?.id;
    if (tab === "unassigned") return !b.assignedAgentId;
    return true;
  });

  const handleAssign = async (bookingId: string, agentId: string) => {
    try {
      await assignBooking({ data: { id: bookingId, agentId } });
      await reload();
      toast.success("Booking assigned", { description: "The agent has been notified." });
    } catch (error) {
      toast.error("Could not assign", error instanceof Error ? { description: error.message } : {});
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Agent dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              {currentAgent ? `Signed in as ${currentAgent.name}` : "Booking operations"} — every
              action is tracked on the booking timeline.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/onboard">
                <Rocket className="size-4" /> Onboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/cms">
                <LayoutTemplate className="size-4" /> Website
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/assistant">
                <Sparkles className="size-4" /> Assistant
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/deploy">
                <Rocket className="size-4" /> Deploy
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/connectors">
                <PlugZap className="size-4" /> Channels
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/command">
                <LayoutDashboard className="size-4" /> Command
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/intelligence">
                <TrendingUp className="size-4" /> Insights
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/scorecards">
                <ShieldCheck className="size-4" /> Suppliers
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/revenue">
                <Percent className="size-4" /> Revenue
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/tenants">
                <Building2 className="size-4" /> Agencies
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/finance">
                <Wallet className="size-4" /> Finance
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/jobs">
                <Clock className="size-4" /> Jobs
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/automation">
                <Zap className="size-4" /> Automation
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/quotes">
                <FileText className="size-4" /> Quotes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/leads">
                <Users className="size-4" /> Leads
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/analytics" search={{ range: "30d" }}>
                <BarChart3 className="size-4" /> Analytics
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/agent/imports">
                <Upload className="size-4" /> Rate & availability imports
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border bg-card p-5">
              <m.icon className={`size-5 ${m.cls.split(" ")[1]}`} />
              <p className="mt-3 text-display text-2xl font-semibold">{m.value}</p>
              <p className="text-sm text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Banknote className="size-4 text-primary" /> Finance
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceStat label="Pending payments" value={String(finance.pendingPayments)} />
            <FinanceStat label="Submitted proofs" value={String(finance.submittedPayments)} />
            <FinanceStat label="Verified" value={String(finance.verifiedCount)} />
            <FinanceStat label="Outstanding revenue" value={money(finance.outstandingRevenue)} />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Truck className="size-4 text-primary" /> Supplier confirmations
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceStat
              label="Awaiting confirmation"
              value={String(suppliers.awaitingConfirmation)}
            />
            <FinanceStat label="Confirmed" value={String(suppliers.confirmed)} />
            <FinanceStat label="Pending response" value={String(suppliers.pendingResponse)} />
            <FinanceStat label="Suppliers" value={String(suppliers.bySupplier.length)} />
          </div>
          {suppliers.bySupplier.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suppliers.bySupplier.map((s) => (
                <Badge key={s.supplierId} variant="outline">
                  {s.name} · {s.count}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Availability health */}
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <CalendarCheck2 className="size-4 text-primary" /> Availability health
            </p>
            <Link
              to="/availability"
              search={{ roomId: "" }}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Open calendar
            </Link>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <HealthStat
              label="Fresh (< 3 days)"
              value={availabilityHealth.fresh}
              tone="bg-success/60"
            />
            <HealthStat
              label="Needs update"
              value={availabilityHealth.needsUpdate}
              tone="bg-warning/60"
            />
            <HealthStat
              label="Expired"
              value={availabilityHealth.expired}
              tone="bg-destructive/60"
            />
            <HealthStat label="No data" value={availabilityHealth.noData} tone="bg-muted" />
          </div>
        </div>

        {/* Expiring rates */}
        {expiringRates.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Rates expiring soon
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {expiringRates.map((r) => (
                <Badge key={r.rateId} variant="outline" className="text-muted-foreground">
                  {r.propertyName} · {r.daysRemaining} {r.daysRemaining === 1 ? "day" : "days"} left
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Supplier updates */}
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <Mail className="size-4 text-primary" /> Supplier updates
            </p>
            <Link
              to="/supplier-updates"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Open center
            </Link>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <HealthStat
              label="Pending requests"
              value={supplierUpdates.pending}
              tone="bg-warning/60"
            />
            <HealthStat label="Overdue" value={supplierUpdates.overdue} tone="bg-destructive/60" />
            <HealthStat
              label="Received today"
              value={supplierUpdates.receivedToday}
              tone="bg-primary/60"
            />
            <HealthStat
              label="Imported today"
              value={supplierUpdates.importedToday}
              tone="bg-success/60"
            />
          </div>
        </div>

        {unread.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <MessageSquare className="size-4 text-primary" /> Unread messages
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {unread.map((u) => (
                <Button key={u.bookingId} asChild variant="outline" size="sm">
                  <Link to="/agent/bookings/$bookingId" params={{ bookingId: u.bookingId }}>
                    {u.reference} ({u.unread})
                  </Link>
                </Button>
              ))}
              {unread.length > 0 && (
                <span className="ml-1 self-center text-xs text-muted-foreground">
                  waiting on your reply
                </span>
              )}
            </div>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Bell className="size-4 text-primary" /> Recent notifications
            </p>
            <ul className="mt-3 space-y-2">
              {notifications.slice(0, 10).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{n.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      n.status === "FAILED"
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                        : n.status === "SENT"
                          ? "bg-success text-success-foreground hover:bg-success"
                          : "bg-warning text-warning-foreground hover:bg-warning"
                    }
                  >
                    {n.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as DashboardTab)} className="mt-10">
          <TabsList>
            <TabsTrigger value="mine">My bookings</TabsTrigger>
            <TabsTrigger value="unassigned">
              Unassigned (
              {count("NEW") +
                bookings.filter((b) => !b.assignedAgentId && b.status !== "NEW").length}
              )
            </TabsTrigger>
            <TabsTrigger value="all">All ({bookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6 space-y-4">
            {visible.length === 0 && (
              <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
                Nothing in this queue.
              </div>
            )}
            {visible.map((b) => (
              <article
                key={b.id}
                className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{b.customer.name}</p>
                      <Badge variant="secondary">{b.reference}</Badge>
                      <BookingStatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {b.customer.email} · {b.customer.phone} · {b.customer.country}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-display text-2xl font-semibold">{money(b.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      submitted {new Date(b.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
                  <Field label="Property" value={b.property} />
                  <Field label="Room" value={b.room} />
                  <Field label="Dates" value={`${b.checkIn} → ${b.checkOut} (${b.nights}n)`} />
                  <Field label="Guests" value={`${b.adults} adults, ${b.children} children`} />
                </dl>

                {b.addons.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {b.addons.map((a) => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}

                {b.specialRequests && (
                  <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                    “{b.specialRequests}”
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {b.assignedAgentName ? (
                      <span className="text-sm text-muted-foreground">
                        Assigned to{" "}
                        <span className="font-medium text-foreground">{b.assignedAgentName}</span>
                      </span>
                    ) : (
                      <Select onValueChange={(agentId) => handleAssign(b.id, agentId)}>
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Assign to…" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/agent/bookings/$bookingId" params={{ bookingId: b.id }}>
                      Open booking <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function FinanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function HealthStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 text-display text-lg font-semibold">{value}</p>
    </div>
  );
}
