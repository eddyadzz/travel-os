import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Pencil, X, BedDouble, Tag, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createAddon,
  createPackage,
  createPromotion,
  createRate,
  createRoom,
  deleteAddon,
  deletePackage,
  deletePromotion,
  deleteRate,
  deleteRoom,
  getPropertyAdmin,
  updateAddon,
  updatePackage,
  updatePromotion,
  updateRoom,
} from "@/lib/api/catalogue";
import { updateProperty } from "@/lib/api/properties";
import { money } from "@/lib/pricing";

type PropertyAdmin = NonNullable<Awaited<ReturnType<typeof getPropertyAdmin>>>;
type RoomAdmin = PropertyAdmin["rooms"][number];
type RateAdmin = RoomAdmin["rates"][number];
type AddonAdmin = PropertyAdmin["addons"][number];
type PackageAdmin = PropertyAdmin["packages"][number];
type PromotionAdmin = PropertyAdmin["promotions"][number];

const PROPERTY_TYPES = ["RESORT", "HOTEL", "GUESTHOUSE", "SAFARI_BOAT"];
const ADDON_CATEGORIES = ["SPA", "DINING", "DIVING", "EXCURSION", "TRANSFER"];
const ADDON_PRICING = ["PER_PERSON", "PER_ROOM", "FIXED"];

export const Route = createFileRoute("/catalogue/$propertyId")({
  beforeLoad: requireAuth,
  loader: async ({ params }) => getPropertyAdmin({ data: params.propertyId }),
  head: () => ({
    meta: [{ title: "Edit property | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: PropertyEditor,
});

function PropertyEditor() {
  const initial = Route.useLoaderData();
  const [property, setProperty] = useState<PropertyAdmin | null>(initial);
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    type: (initial?.type ?? "RESORT") as string,
    atoll: initial?.atoll ?? "",
    island: initial?.island ?? "",
    description: initial?.description ?? "",
    transferMethod: initial?.transferMethod ?? "",
    transferDuration: initial?.transferDuration ?? "",
    transferPricePerPerson: String(initial?.transferPricePerPerson ?? 0),
    featured: initial?.featured ?? false,
    status: (initial?.status ?? "ACTIVE") as string,
  }));

  const [roomForm, setRoomForm] = useState({ name: "", maxAdults: "2", maxChildren: "0", extraGuestRate: "0", boardBasis: "", size: "", pricingMethod: "PER_ROOM" });
  const [editingRoom, setEditingRoom] = useState<RoomAdmin | null>(null);
  const [rateForm, setRateForm] = useState<{ roomId: string; validFrom: string; validTo: string; amount: string; season: string }>({ roomId: "", validFrom: "", validTo: "", amount: "", season: "" });
  const [addonForm, setAddonForm] = useState({ name: "", description: "", pricingType: "PER_PERSON", amount: "0", category: "SPA" });
  const [packageForm, setPackageForm] = useState({ name: "", description: "", price: "", validFrom: "", validTo: "", included: "" });
  const [promotionForm, setPromotionForm] = useState({ name: "", discountType: "PERCENTAGE", value: "", validFrom: "", validTo: "", roomId: "" });

  const reload = async () => {
    if (!property) return;
    setProperty(await getPropertyAdmin({ data: property.id }));
  };

  const saveDetails = async () => {
    if (!property) return;
    await updateProperty({
      data: {
        id: property.id,
        data: {
          name: form.name,
          slug: form.slug,
          type: form.type,
          atoll: form.atoll,
          island: form.island,
          description: form.description,
          transferMethod: form.transferMethod,
          transferDuration: form.transferDuration,
          transferPricePerPerson: Number(form.transferPricePerPerson) || 0,
          featured: form.featured,
          status: form.status,
        },
      },
    });
    toast.success("Property updated");
    await reload();
  };

  const saveRoom = async () => {
    if (!property || !roomForm.name.trim()) return;
    if (editingRoom) {
      await updateRoom({
        data: {
          id: editingRoom.id,
          name: roomForm.name,
          maxAdults: Number(roomForm.maxAdults),
          maxChildren: Number(roomForm.maxChildren),
          extraGuestRate: Number(roomForm.extraGuestRate) || 0,
          boardBasis: roomForm.boardBasis,
          size: roomForm.size,
        },
      });
      toast.success("Room updated");
    } else {
      await createRoom({
        data: {
          propertyId: property.id,
          name: roomForm.name,
          maxAdults: Number(roomForm.maxAdults),
          maxChildren: Number(roomForm.maxChildren),
          extraGuestRate: Number(roomForm.extraGuestRate) || 0,
          boardBasis: roomForm.boardBasis,
          size: roomForm.size,
          pricingMethod: roomForm.pricingMethod,
        },
      });
      toast.success("Room added");
    }
    setEditingRoom(null);
    setRoomForm({ name: "", maxAdults: "2", maxChildren: "0", extraGuestRate: "0", boardBasis: "", size: "", pricingMethod: "PER_ROOM" });
    await reload();
  };

  const startEditRoom = (r: RoomAdmin) => {
    setEditingRoom(r);
    setRoomForm({
      name: r.name,
      maxAdults: String(r.maxAdults),
      maxChildren: String(r.maxChildren),
      extraGuestRate: String(r.extraGuestRate ?? 0),
      boardBasis: r.boardBasis ?? "",
      size: r.size ?? "",
      pricingMethod: r.pricingMethod,
    });
  };

  const closeRoom = async (r: RoomAdmin) => {
    await deleteRoom({ data: r.id });
    toast.success(`${r.name} closed`);
    await reload();
  };

  const addRate = async () => {
    if (!property || !rateForm.roomId || !rateForm.validFrom || !rateForm.validTo) {
      toast.error("Room and dates are required");
      return;
    }
    await createRate({
      data: {
        propertyId: property.id,
        roomId: rateForm.roomId,
        validFrom: rateForm.validFrom,
        validTo: rateForm.validTo,
        amount: Number(rateForm.amount) || 0,
        ...(rateForm.season ? { season: rateForm.season } : {}),
      },
    });
    toast.success("Rate added");
    setRateForm({ ...rateForm, amount: "", season: "" });
    await reload();
  };

  const removeRate = async (r: RateAdmin) => {
    await deleteRate({ data: r.id });
    await reload();
  };

  const saveAddon = async () => {
    if (!property || !addonForm.name.trim()) return;
    await createAddon({
      data: {
        propertyId: property.id,
        name: addonForm.name,
        description: addonForm.description,
        pricingType: addonForm.pricingType,
        amount: Number(addonForm.amount) || 0,
        category: addonForm.category,
      },
    });
    toast.success("Add-on added");
    setAddonForm({ name: "", description: "", pricingType: "PER_PERSON", amount: "0", category: "SPA" });
    await reload();
  };

  const toggleAddon = async (a: AddonAdmin) => {
    await updateAddon({ data: { id: a.id, active: !a.active } });
    await reload();
  };

  const savePackage = async () => {
    if (!property || !packageForm.name.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    await createPackage({
      data: {
        propertyId: property.id,
        name: packageForm.name,
        ...(packageForm.description ? { description: packageForm.description } : {}),
        price: Number(packageForm.price) || 0,
        validFrom: packageForm.validFrom || today,
        validTo: packageForm.validTo || "2030-12-31",
        included: packageForm.included.split(",").map((s) => s.trim()).filter(Boolean),
      },
    });
    toast.success("Package added");
    setPackageForm({ name: "", description: "", price: "", validFrom: "", validTo: "", included: "" });
    await reload();
  };

  const togglePackage = async (p: PackageAdmin) => {
    await updatePackage({ data: { id: p.id, active: !p.active } });
    await reload();
  };

  const removePackage = async (p: PackageAdmin) => {
    await deletePackage({ data: p.id });
    toast.success(`${p.name} removed`);
    await reload();
  };

  const savePromotion = async () => {
    if (!property || !promotionForm.name.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    await createPromotion({
      data: {
        propertyId: property.id,
        ...(promotionForm.roomId ? { roomId: promotionForm.roomId } : {}),
        name: promotionForm.name,
        discountType: promotionForm.discountType,
        value: Number(promotionForm.value) || 0,
        validFrom: promotionForm.validFrom || today,
        validTo: promotionForm.validTo || "2030-12-31",
      },
    });
    toast.success("Promotion added");
    setPromotionForm({ name: "", discountType: "PERCENTAGE", value: "", validFrom: "", validTo: "", roomId: "" });
    await reload();
  };

  const togglePromotion = async (p: PromotionAdmin) => {
    await updatePromotion({ data: { id: p.id, active: !p.active } });
    await reload();
  };

  const removePromotion = async (p: PromotionAdmin) => {
    await deletePromotion({ data: p.id });
    toast.success(`${p.name} removed`);
    await reload();
  };

  if (!property) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
        Property not found. <Link to="/catalogue">Back to catalogue</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
          </Link>
          <Link to="/catalogue" className="text-sm text-muted-foreground hover:text-foreground">
            Back to catalogue
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="flex items-center gap-2 text-4xl">
          <Building2 className="size-8 text-primary" /> {property.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {property.atoll} · {property.island} · {property.type}
        </p>

        <Tabs defaultValue="details" className="mt-8">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="rooms">Rooms & rates</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6 rounded-2xl border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Atoll</Label>
                <Input value={form.atoll} onChange={(e) => setForm({ ...form, atoll: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Island</Label>
                <Input value={form.island} onChange={(e) => setForm({ ...form, island: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">Live</option>
                  <option value="HIDDEN">Hidden</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Transfer method</Label>
                <Input
                  value={form.transferMethod}
                  onChange={(e) => setForm({ ...form, transferMethod: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Transfer duration</Label>
                <Input
                  value={form.transferDuration}
                  onChange={(e) => setForm({ ...form, transferDuration: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Transfer price / person</Label>
                <Input
                  type="number"
                  value={form.transferPricePerPerson}
                  onChange={(e) => setForm({ ...form, transferPricePerPerson: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured on the homepage
            </label>
            <Button className="mt-4" onClick={saveDetails}>
              Save details
            </Button>
          </TabsContent>

          <TabsContent value="rooms" className="mt-6 space-y-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <BedDouble className="size-5" /> {editingRoom ? `Edit ${editingRoom.name}` : "Add a room"}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input value={roomForm.name} placeholder="Beach Villa" onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Max adults</Label>
                  <Input type="number" value={roomForm.maxAdults} onChange={(e) => setRoomForm({ ...roomForm, maxAdults: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Max children</Label>
                  <Input type="number" value={roomForm.maxChildren} onChange={(e) => setRoomForm({ ...roomForm, maxChildren: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Extra guest rate</Label>
                  <Input type="number" value={roomForm.extraGuestRate} onChange={(e) => setRoomForm({ ...roomForm, extraGuestRate: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Board basis</Label>
                  <Input value={roomForm.boardBasis} placeholder="Half Board" onChange={(e) => setRoomForm({ ...roomForm, boardBasis: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Size</Label>
                  <Input value={roomForm.size} placeholder="85 m²" onChange={(e) => setRoomForm({ ...roomForm, size: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={saveRoom}>{editingRoom ? "Save room" : "Add room"}</Button>
                {editingRoom && (
                  <Button variant="outline" onClick={() => { setEditingRoom(null); setRoomForm({ name: "", maxAdults: "2", maxChildren: "0", extraGuestRate: "0", boardBasis: "", size: "", pricingMethod: "PER_ROOM" }); }}>
                    <X className="size-4" /> Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Tag className="size-5" /> Add a rate
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="grid gap-1.5">
                  <Label>Room</Label>
                  <select
                    className="h-9 rounded-md border bg-background px-2"
                    value={rateForm.roomId}
                    onChange={(e) => setRateForm({ ...rateForm, roomId: e.target.value })}
                  >
                    <option value="">Select room…</option>
                    {property.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>From</Label>
                  <Input type="date" value={rateForm.validFrom} onChange={(e) => setRateForm({ ...rateForm, validFrom: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>To</Label>
                  <Input type="date" value={rateForm.validTo} onChange={(e) => setRateForm({ ...rateForm, validTo: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nightly (USD)</Label>
                  <Input type="number" value={rateForm.amount} onChange={(e) => setRateForm({ ...rateForm, amount: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Season (optional)</Label>
                  <Input value={rateForm.season} placeholder="High" onChange={(e) => setRateForm({ ...rateForm, season: e.target.value })} />
                </div>
              </div>
              <Button className="mt-4" onClick={addRate}>
                <Plus className="size-4" /> Add rate
              </Button>
            </div>

            <div className="space-y-4">
              {property.rooms.map((room) => (
                <div key={room.id} className="rounded-2xl border bg-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        {room.name}
                        {room.status === "CLOSED" && <Badge variant="outline">Closed</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {room.maxAdults} adults · {room.maxChildren} children · {room.boardBasis || "—"} ·{" "}
                        {room.rates.length} rate{room.rates.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEditRoom(room)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => closeRoom(room)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {room.rates.map((rate) => (
                      <span key={rate.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1 text-sm">
                        {rate.validFrom} → {rate.validTo} · {money(rate.amount)}
                        {rate.season ? ` · ${rate.season}` : ""}
                        <button className="text-muted-foreground hover:text-destructive" onClick={() => removeRate(rate)}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="addons" className="mt-6 space-y-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-5" /> Add an add-on
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input value={addonForm.name} placeholder="Sunset Spa Ritual" onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Category</Label>
                  <select
                    className="h-9 rounded-md border bg-background px-2"
                    value={addonForm.category}
                    onChange={(e) => setAddonForm({ ...addonForm, category: e.target.value })}
                  >
                    {ADDON_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Pricing</Label>
                  <select
                    className="h-9 rounded-md border bg-background px-2"
                    value={addonForm.pricingType}
                    onChange={(e) => setAddonForm({ ...addonForm, pricingType: e.target.value })}
                  >
                    {ADDON_PRICING.map((p) => (
                      <option key={p} value={p}>
                        {p.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Amount (USD)</Label>
                  <Input type="number" value={addonForm.amount} onChange={(e) => setAddonForm({ ...addonForm, amount: e.target.value })} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                  <Label>Description</Label>
                  <Input value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} />
                </div>
              </div>
              <Button className="mt-4" onClick={saveAddon}>
                <Plus className="size-4" /> Add add-on
              </Button>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              {property.addons.length === 0 ? (
                <p className="text-muted-foreground">No add-ons yet.</p>
              ) : (
                <div className="divide-y">
                  {property.addons.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">
                          {a.name} <span className="text-xs text-muted-foreground">· {a.category.replace("_", " ")}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.description} · {money(a.amount)} ({a.pricingType.replace("_", " ")})
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.active ? (
                          <Badge className="bg-success text-success-foreground">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => toggleAddon(a)}>
                          {a.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteAddon({ data: a.id }).then(reload)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="packages" className="mt-6 space-y-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-5" /> Add a package
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input value={packageForm.name} placeholder="Honeymoon Package" onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Price (USD)</Label>
                  <Input type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Valid from</Label>
                  <Input type="date" value={packageForm.validFrom} onChange={(e) => setPackageForm({ ...packageForm, validFrom: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Valid to</Label>
                  <Input type="date" value={packageForm.validTo} onChange={(e) => setPackageForm({ ...packageForm, validTo: e.target.value })} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                  <Label>Included (comma separated)</Label>
                  <Input value={packageForm.included} placeholder="Breakfast, Seaplane transfer, Sunset cruise" onChange={(e) => setPackageForm({ ...packageForm, included: e.target.value })} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                  <Label>Description</Label>
                  <Textarea rows={2} value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} />
                </div>
              </div>
              <Button className="mt-4" onClick={savePackage}>
                <Plus className="size-4" /> Add package
              </Button>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              {property.packages.length === 0 ? (
                <p className="text-muted-foreground">No packages yet.</p>
              ) : (
                <div className="divide-y">
                  {property.packages.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {money(p.price)} · {p.validFrom} → {p.validTo}
                          {p.included.length > 0 && ` · ${p.included.join(", ")}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.active ? (
                          <Badge className="bg-success text-success-foreground">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => togglePackage(p)}>
                          {p.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removePackage(p)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="promotions" className="mt-6 space-y-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Tag className="size-5" /> Add a promotion
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input value={promotionForm.name} placeholder="Early Bird 15%" onChange={(e) => setPromotionForm({ ...promotionForm, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <select className="h-9 rounded-md border bg-background px-2" value={promotionForm.discountType} onChange={(e) => setPromotionForm({ ...promotionForm, discountType: e.target.value })}>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed amount</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Value</Label>
                  <Input type="number" value={promotionForm.value} onChange={(e) => setPromotionForm({ ...promotionForm, value: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Valid from</Label>
                  <Input type="date" value={promotionForm.validFrom} onChange={(e) => setPromotionForm({ ...promotionForm, validFrom: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Valid to</Label>
                  <Input type="date" value={promotionForm.validTo} onChange={(e) => setPromotionForm({ ...promotionForm, validTo: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Room (optional)</Label>
                  <select className="h-9 rounded-md border bg-background px-2" value={promotionForm.roomId} onChange={(e) => setPromotionForm({ ...promotionForm, roomId: e.target.value })}>
                    <option value="">All rooms</option>
                    {property.rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button className="mt-4" onClick={savePromotion}>
                <Plus className="size-4" /> Add promotion
              </Button>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              {property.promotions.length === 0 ? (
                <p className="text-muted-foreground">No promotions yet.</p>
              ) : (
                <div className="divide-y">
                  {property.promotions.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.discountType === "PERCENTAGE" ? `${p.value}%` : money(p.value)} off · {p.validFrom} → {p.validTo}
                          {p.room?.name ? ` · ${p.room.name}` : " · all rooms"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.active ? (
                          <Badge className="bg-success text-success-foreground">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => togglePromotion(p)}>
                          {p.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removePromotion(p)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
