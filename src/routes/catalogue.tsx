import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Trash2, RefreshCw, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createProperty, deleteProperty, listPropertiesAdmin } from "@/lib/api/properties";
import type { PropertyDTO } from "@/lib/types";
import { money } from "@/lib/pricing";

const TYPES = ["RESORT", "HOTEL", "GUESTHOUSE", "SAFARI_BOAT"];

type AdminProperty = PropertyDTO & { status: string };

export const Route = createFileRoute("/catalogue")({
  beforeLoad: requireAuth,
  loader: async () => listPropertiesAdmin(),
  head: () => ({
    meta: [{ title: "Catalogue | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: CataloguePage,
});

function CataloguePage() {
  const initial = Route.useLoaderData() as AdminProperty[];
  const [properties, setProperties] = useState<AdminProperty[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "RESORT",
    atoll: "",
    island: "",
    description: "",
    transferMethod: "Seaplane",
    transferDuration: "45 min",
    transferPricePerPerson: "0",
    featured: false,
  });

  const refresh = async () => setProperties((await listPropertiesAdmin()) as AdminProperty[]);

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      await createProperty({
        data: {
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          type: form.type,
          atoll: form.atoll.trim(),
          island: form.island.trim(),
          description: form.description.trim(),
          highlights: [],
          amenities: [],
          gallery: [],
          transferMethod: form.transferMethod.trim(),
          transferDuration: form.transferDuration.trim(),
          transferPricePerPerson: Number(form.transferPricePerPerson) || 0,
          featured: form.featured,
        },
      });
      toast.success("Property added — now add its rooms, rates and add-ons");
      setShowForm(false);
      setForm({
        name: "",
        slug: "",
        type: "RESORT",
        atoll: "",
        island: "",
        description: "",
        transferMethod: "Seaplane",
        transferDuration: "45 min",
        transferPricePerPerson: "0",
        featured: false,
      });
      await refresh();
    } catch (error) {
      toast.error(
        "Could not add property",
        error instanceof Error ? { description: error.message } : {},
      );
    }
  };

  const remove = async (p: AdminProperty) => {
    await deleteProperty({ data: p.id });
    toast.success(`${p.name} hidden`);
    await refresh();
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
            <h1 className="flex items-center gap-2 text-4xl">
              <Building2 className="size-8 text-primary" /> Catalogue
            </h1>
            <p className="mt-2 text-muted-foreground">
              Properties, rooms, rates and add-ons — everything the public site and quotes are built
              from.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button onClick={() => setShowForm((s) => !s)}>
              <Plus className="size-4" /> Add property
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Add a property</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  placeholder="Velaa Island Resort"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  placeholder="velaa-island-resort"
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Atoll</Label>
                <Input
                  value={form.atoll}
                  placeholder="Noonu"
                  onChange={(e) => setForm({ ...form, atoll: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Island</Label>
                <Input
                  value={form.island}
                  placeholder="Velaa Island"
                  onChange={(e) => setForm({ ...form, island: e.target.value })}
                />
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
              <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  rows={3}
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
            <Button className="mt-4" onClick={save}>
              <Plus className="size-4" /> Add property
            </Button>
          </div>
        )}

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No properties yet — add one or import your catalogue.
                    </TableCell>
                  </TableRow>
                )}
                {properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.featured && <span className="mr-1 text-primary">★</span>}
                      {p.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.atoll} · {p.location}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.fromPrice > 0 ? money(p.fromPrice) : "—"}
                    </TableCell>
                    <TableCell>
                      {p.status === "ACTIVE" ? (
                        <Badge className="bg-success text-success-foreground">Live</Badge>
                      ) : (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/catalogue/$propertyId" params={{ propertyId: p.id }}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
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
