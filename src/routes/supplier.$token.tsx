import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Home,
  Percent,
  Boxes,
  Ban,
  Wallet,
  RefreshCw,
  ExternalLink,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  deletePackage,
  deletePortalRate,
  deletePromotion,
  getAllocations,
  getPackages,
  getPortalAvailability,
  getPortalRates,
  getPromotions,
  getSupplierPortal,
  saveAllocation,
  savePackage,
  savePortalAvailability,
  savePortalRate,
  savePromotion,
  setBlackout,
  clearBlackout,
} from "@/lib/api/supplier-portal";
import type {
  AllocationDTO,
  PackageDTO,
  PromotionDTO,
  SupplierPortalAvailabilityRow,
  SupplierPortalDTO,
  SupplierPortalRateDTO,
} from "@/lib/types";

export const Route = createFileRoute("/supplier/$token")({
  loader: async ({ params }) => {
    const portal = await getSupplierPortal({ data: params.token });
    return { portal };
  },
  head: () => ({
    meta: [{ title: "Supplier Portal | TravelOS by Boliflow" }],
  }),
  component: SupplierPortalPage,
});

type Tab =
  "dashboard" | "availability" | "rates" | "blackouts" | "promotions" | "packages" | "allocations";

function todayIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function SupplierPortalPage() {
  const { portal } = Route.useLoaderData();
  const { token } = Route.useParams();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!portal) {
    return (
      <div className="min-h-screen bg-secondary/30 px-4 py-16 text-center">
        <h1 className="text-3xl">Invalid portal link</h1>
        <p className="mt-2 text-muted-foreground">
          This access link is not valid. Contact the agency for a fresh link.
        </p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "availability", label: "Availability", icon: CalendarDays },
    { key: "rates", label: "Rates", icon: Wallet },
    { key: "blackouts", label: "Blackout dates", icon: Ban },
    { key: "promotions", label: "Promotions", icon: Percent },
    { key: "packages", label: "Packages", icon: Boxes },
    { key: "allocations", label: "Allocations", icon: Boxes },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
            <Badge variant="outline">Supplier portal</Badge>
          </div>
          <span className="text-sm text-muted-foreground">{portal.supplier.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              <t.icon className="size-4" /> {t.label}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "dashboard" && <DashboardTab portal={portal} onNavigate={setTab} />}
          {tab === "availability" && <AvailabilityTab token={token} portal={portal} />}
          {tab === "rates" && <RatesTab token={token} portal={portal} />}
          {tab === "blackouts" && <BlackoutsTab token={token} portal={portal} />}
          {tab === "promotions" && <PromotionsTab token={token} portal={portal} />}
          {tab === "packages" && <PackagesTab token={token} portal={portal} />}
          {tab === "allocations" && <AllocationsTab token={token} portal={portal} />}
        </div>
      </main>
    </div>
  );
}

function DashboardTab({
  portal,
  onNavigate,
}: {
  portal: SupplierPortalDTO;
  onNavigate: (t: Tab) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-6 lg:col-span-2">
        <h2 className="text-2xl">{portal.supplier.name}</h2>
        <p className="mt-1 text-muted-foreground">
          {portal.supplier.type.toLowerCase()} partner · manage your inventory in real time
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Stat label="Open update requests" value={portal.openRequests} />
          <Stat label="Properties needing attention" value={portal.staleProperties} />
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Your properties</h3>
        <div className="mt-4 space-y-3">
          {portal.properties.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.atoll} · {p.rooms.length} room{p.rooms.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onNavigate("availability")}>
                <CalendarDays className="size-4" /> Update
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

// Availability ----------------------------------------------------------------------------------

function AvailabilityTab({ token, portal }: { token: string; portal: SupplierPortalDTO }) {
  const [propertyId, setPropertyId] = useState(portal.properties[0]?.id ?? "");
  const [roomId, setRoomId] = useState(portal.properties[0]?.rooms[0]?.id ?? "");
  const [rows, setRows] = useState<SupplierPortalAvailabilityRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState(1);

  const property = portal.properties.find((p) => p.id === propertyId);
  const rooms = property?.rooms ?? [];

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    getPortalAvailability({ data: { token, roomId, days: 30 } })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token, roomId]);

  const setInventory = (date: string, inventory: number) => {
    setRows((prev) => prev?.map((r) => (r.date === date ? { ...r, inventory } : r)) ?? prev);
  };

  const toggleBlackout = async (row: SupplierPortalAvailabilityRow) => {
    if (row.blackedOut) {
      await clearBlackout({ data: { token, roomId, date: row.date } });
    } else {
      await setBlackout({ data: { token, roomId, date: row.date } });
    }
    toast.success(row.blackedOut ? "Blackout cleared" : "Day blocked");
    const fresh = await getPortalAvailability({ data: { token, roomId, days: 30 } });
    setRows(fresh);
  };

  const applyBulk = () => {
    setRows((prev) => prev?.map((r) => ({ ...r, inventory: bulk })) ?? prev);
  };

  const save = async () => {
    if (!rows) return;
    const entries = rows.map((r) => ({ roomId, date: r.date, inventory: r.inventory }));
    const res = await savePortalAvailability({ data: { token, entries } });
    toast.success(`Saved — ${res.updated} day(s) updated`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-4">
        <div className="grid gap-1.5">
          <Label>Property</Label>
          <Select value={propertyId} onValueChange={(v) => setPropertyId(v)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portal.properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Room</Label>
          <Select value={roomId} onValueChange={(v) => setRoomId(v)}>
            <SelectTrigger className="w-56">
              <SelectValue />
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
        <div className="grid gap-1.5">
          <Label>Fill all days</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              max={30}
              className="w-20"
              value={bulk}
              onChange={(e) => setBulk(Number(e.target.value))}
            />
            <Button variant="outline" onClick={applyBulk}>
              Apply
            </Button>
          </div>
        </div>
        <Button onClick={save} className="ml-auto">
          <Save className="size-4" /> Save all
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {rows && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Next 30 days — set rooms available for sale. Days marked blocked show as sold out on the
            website.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {rows.map((r) => (
              <div
                key={r.date}
                className={`rounded-xl border p-2 text-center ${r.blackedOut ? "border-destructive/40 bg-destructive/10" : ""}`}
              >
                <p className="text-[11px] text-muted-foreground">{r.date.slice(5)}</p>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  className="mt-1 h-8 text-center"
                  value={r.inventory}
                  disabled={r.blackedOut}
                  onChange={(e) => setInventory(r.date, Number(e.target.value))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 w-full text-[11px]"
                  onClick={() => toggleBlackout(r)}
                >
                  {r.blackedOut ? "Unblock" : "Block"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Rates -----------------------------------------------------------------------------------------

function RatesTab({ token, portal }: { token: string; portal: SupplierPortalDTO }) {
  const [rates, setRates] = useState<SupplierPortalRateDTO[]>([]);
  const [propertyId, setPropertyId] = useState(portal.properties[0]?.id ?? "");
  const [roomId, setRoomId] = useState(portal.properties[0]?.rooms[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [validFrom, setValidFrom] = useState(todayIso());
  const [validTo, setValidTo] = useState(todayIso(90));
  const [season, setSeason] = useState("");
  const [editing, setEditing] = useState<SupplierPortalRateDTO | null>(null);

  const load = () => getPortalRates({ data: token }).then(setRates);
  useEffect(() => {
    load();
  }, [token]);

  const filtered = rates.filter((r) => r.propertyId === propertyId);

  const submit = async () => {
    const payload = {
      token,
      ...(editing ? { id: editing.id } : {}),
      roomId,
      validFrom,
      validTo,
      amount: Number(amount),
      ...(season ? { season } : {}),
    };
    await savePortalRate({ data: payload });
    toast.success(editing ? "Rate updated" : "Rate added");
    setEditing(null);
    setAmount("");
    await load();
  };

  const remove = async (id: string) => {
    await deletePortalRate({ data: { token, id } });
    toast.success("Rate deleted");
    await load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">{editing ? "Edit rate" : "Add rate"}</h3>
        <div className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={(v) => setPropertyId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portal.properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Room</Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(portal.properties.find((p) => p.id === propertyId)?.rooms ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Valid from</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Valid to</Label>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Season (optional)</Label>
            <Input
              value={season}
              placeholder="e.g. High season"
              onChange={(e) => setSeason(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={submit}>
            {editing ? "Save changes" : "Add rate"}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setEditing(null);
                setAmount("");
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">
          Rates — {portal.properties.find((p) => p.id === propertyId)?.name}
        </h3>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Season</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No rates yet — add your first rate.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.roomName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.validFrom} → {r.validTo}
                  </TableCell>
                  <TableCell>${r.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{r.season ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(r);
                          setRoomId(r.roomId);
                          setAmount(String(r.amount));
                          setValidFrom(r.validFrom);
                          setValidTo(r.validTo);
                          setSeason(r.season ?? "");
                        }}
                      >
                        <ExternalLink className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// Blackouts -------------------------------------------------------------------------------------

function BlackoutsTab({ token, portal }: { token: string; portal: SupplierPortalDTO }) {
  const [roomId, setRoomId] = useState(portal.properties[0]?.rooms[0]?.id ?? "");
  const [rows, setRows] = useState<SupplierPortalAvailabilityRow[]>([]);
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!roomId) return;
    getPortalAvailability({ data: { token, roomId, days: 120 } }).then((r) => setRows(r ?? []));
  }, [token, roomId]);

  const blacked = rows.filter((r) => r.blackedOut);

  const add = async () => {
    await setBlackout({ data: { token, roomId, date, ...(reason ? { reason } : {}) } });
    toast.success("Blackout added");
    setReason("");
    setRows((await getPortalAvailability({ data: { token, roomId, days: 120 } })) ?? []);
  };

  const clear = async (d: string) => {
    await clearBlackout({ data: { token, roomId, date: d } });
    toast.success("Blackout cleared");
    setRows((await getPortalAvailability({ data: { token, roomId, days: 120 } })) ?? []);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Add blackout</h3>
        <div className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label>Room</Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portal.properties
                  .flatMap((p) => p.rooms.map((r) => ({ ...r, propertyName: p.name })))
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.propertyName} — {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              placeholder="e.g. Maintenance"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={add}>
            <Ban className="size-4" /> Block date
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Blacked-out dates</h3>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blacked.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No blackout dates.
                  </TableCell>
                </TableRow>
              )}
              {blacked.map((r) => (
                <TableRow key={r.date}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">Blocked</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => clear(r.date)}>
                      Clear
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// Promotions ------------------------------------------------------------------------------------

function PromotionsTab({ token, portal }: { token: string; portal: SupplierPortalDTO }) {
  const [items, setItems] = useState<PromotionDTO[]>([]);
  const [propertyId, setPropertyId] = useState(portal.properties[0]?.id ?? "");
  const [roomId, setRoomId] = useState<string>("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [value, setValue] = useState("");
  const [validFrom, setValidFrom] = useState(todayIso());
  const [validTo, setValidTo] = useState(todayIso(60));
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<PromotionDTO | null>(null);

  const load = () => getPromotions({ data: token }).then(setItems);
  useEffect(() => {
    load();
  }, [token]);

  const submit = async () => {
    await savePromotion({
      data: {
        token,
        ...(editing ? { id: editing.id } : {}),
        propertyId,
        ...(roomId ? { roomId } : {}),
        name,
        discountType,
        value: Number(value),
        validFrom,
        validTo,
        active,
      },
    });
    toast.success(editing ? "Promotion updated" : "Promotion added");
    setEditing(null);
    setName("");
    setValue("");
    await load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">{editing ? "Edit promotion" : "Add promotion"}</h3>
        <div className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={(v) => setPropertyId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portal.properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{discountType === "PERCENTAGE" ? "% off" : "USD off"}</Label>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" onClick={submit}>
            {editing ? "Save changes" : "Add promotion"}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setEditing(null);
                setName("");
                setValue("");
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Promotions</h3>
        <div className="mt-4 space-y-2">
          {items.length === 0 && <p className="text-muted-foreground">No promotions yet.</p>}
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {p.name} <Badge variant="outline">{p.active ? "active" : "paused"}</Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.discountType === "PERCENTAGE"
                    ? `${p.value}% off`
                    : `$${p.value.toLocaleString()} off`}
                  {" · "}
                  {p.validFrom} → {p.validTo}
                  {p.roomName ? ` · ${p.roomName}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(p);
                  setName(p.name);
                  setValue(String(p.value));
                  setDiscountType(p.discountType);
                  setValidFrom(p.validFrom);
                  setValidTo(p.validTo);
                  setActive(p.active);
                }}
              >
                Edit
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Packages --------------------------------------------------------------------------------------

function PackagesTab({ token, portal }: { token: string; portal: SupplierPortalDTO }) {
  const [items, setItems] = useState<PackageDTO[]>([]);
  const [propertyId, setPropertyId] = useState(portal.properties[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [validFrom, setValidFrom] = useState(todayIso());
  const [validTo, setValidTo] = useState(todayIso(180));
  const [included, setIncluded] = useState("");
  const [editing, setEditing] = useState<PackageDTO | null>(null);

  const load = () => getPackages({ data: token }).then(setItems);
  useEffect(() => {
    load();
  }, [token]);

  const submit = async () => {
    await savePackage({
      data: {
        token,
        ...(editing ? { id: editing.id } : {}),
        propertyId,
        name,
        ...(description ? { description } : {}),
        price: Number(price),
        validFrom,
        validTo,
        included: included
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        active: true,
      },
    });
    toast.success(editing ? "Package updated" : "Package added");
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setIncluded("");
    await load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">{editing ? "Edit package" : "Add package"}</h3>
        <div className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={(v) => setPropertyId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portal.properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Price (USD)</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Included (comma separated)</Label>
            <Input
              value={included}
              placeholder="Transfer, Breakfast, 1 excursion"
              onChange={(e) => setIncluded(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={submit}>
            {editing ? "Save changes" : "Add package"}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setEditing(null);
                setName("");
                setDescription("");
                setPrice("");
                setIncluded("");
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Packages</h3>
        <div className="mt-4 space-y-2">
          {items.length === 0 && <p className="text-muted-foreground">No packages yet.</p>}
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {p.name} <Badge variant="outline">${p.price.toLocaleString()}</Badge>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(p);
                    setName(p.name);
                    setDescription(p.description ?? "");
                    setPrice(String(p.price));
                    setValidFrom(p.validFrom);
                    setValidTo(p.validTo);
                    setIncluded(p.included.join(", "));
                  }}
                >
                  Edit
                </Button>
              </div>
              {p.description && (
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {p.validFrom} → {p.validTo} · {p.included.join(", ") || "—"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Allocations -----------------------------------------------------------------------------------

function AllocationsTab({ token, portal }: { token: string; portal: SupplierPortalDTO }) {
  const [items, setItems] = useState<AllocationDTO[]>([]);
  const [roomId, setRoomId] = useState(portal.properties[0]?.rooms[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [units, setUnits] = useState("2");

  const load = () => getAllocations({ data: token }).then(setItems);
  useEffect(() => {
    load();
  }, [token]);

  const roomRows = items.filter((a) => a.roomId === roomId);

  const add = async () => {
    await saveAllocation({ data: { token, roomId, date, units: Number(units) } });
    toast.success("Allocation saved");
    setDate(todayIso());
    await load();
  };

  const zero = async (date: string) => {
    await saveAllocation({ data: { token, roomId, date, units: 0 } });
    await load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Add allocation</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Rooms reserved for this agency on a given date.
        </p>
        <div className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label>Room</Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portal.properties
                  .flatMap((p) => p.rooms.map((r) => ({ ...r, propertyName: p.name })))
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.propertyName} — {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Units</Label>
              <Input
                type="number"
                min={0}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
          </div>
          <Button className="w-full" onClick={add}>
            Save allocation
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Allocations</h3>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Units</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No allocations for this room.
                  </TableCell>
                </TableRow>
              )}
              {roomRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {a.units} unit{a.units === 1 ? "" : "s"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => zero(a.date)}>
                      Set to 0
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
