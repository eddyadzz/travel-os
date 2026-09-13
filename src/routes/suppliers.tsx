import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Truck, Plus, Trash2, RefreshCw, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSupplier,
  deleteSupplier,
  listSuppliersAdmin,
  updateSupplier,
} from "@/lib/api/suppliers";
import type { SupplierDTO, SupplierType } from "@/lib/types";

const TYPES: SupplierType[] = ["RESORT", "HOTEL", "GUESTHOUSE", "SAFARI", "TRANSFER", "DIVE_CENTER"];

export const Route = createFileRoute("/suppliers")({
  beforeLoad: requireAuth,
  loader: async () => listSuppliersAdmin(),
  head: () => ({
    meta: [{ title: "Suppliers | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const initial = Route.useLoaderData();
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "RESORT" as SupplierType,
    email: "",
    phone: "",
    contactPerson: "",
  });

  const refresh = async () => setSuppliers(await listSuppliersAdmin());

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", type: "RESORT", email: "", phone: "", contactPerson: "" });
    setShowForm(true);
  };

  const openEdit = (s: SupplierDTO) => {
    setEditing(s);
    setForm({
      name: s.name,
      type: s.type,
      email: s.email ?? "",
      phone: s.phone ?? "",
      contactPerson: s.contactPerson ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      if (editing) {
        await updateSupplier({ data: { id: editing.id, ...form } });
        toast.success("Supplier updated");
      } else {
        await createSupplier({ data: form });
        toast.success("Supplier added");
      }
      setShowForm(false);
      await refresh();
    } catch (error) {
      toast.error(
        "Could not save supplier",
        error instanceof Error ? { description: error.message } : {},
      );
    }
  };

  const toggleActive = async (s: SupplierDTO) => {
    await updateSupplier({ data: { id: s.id, active: !s.active } });
    await refresh();
  };

  const remove = async (s: SupplierDTO) => {
    await deleteSupplier({ data: s.id });
    toast.success(`${s.name} deactivated`);
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
              <Truck className="size-8 text-primary" /> Suppliers
            </h1>
            <p className="mt-2 text-muted-foreground">
              Resorts, hotels, guesthouses, safari boats, transfer and dive partners.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button onClick={openAdd}>
              <Plus className="size-4" /> Add supplier
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? `Edit ${editing.name}` : "Add a supplier"}</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="grid gap-1.5 lg:col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  placeholder="Velaa Island Resort"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as SupplierType })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  placeholder="reservations@…"
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  placeholder="+960 …"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 lg:col-span-2">
                <Label>Contact person</Label>
                <Input
                  value={form.contactPerson}
                  placeholder="Ahmed"
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={save}>
              {editing ? "Save changes" : "Add supplier"}
            </Button>
          </div>
        )}

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No suppliers yet — add one or import them.
                    </TableCell>
                  </TableRow>
                )}
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[s.contactPerson, s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>
                      {s.active ? (
                        <Badge className="bg-success text-success-foreground">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(s)}>
                          {s.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(s)}>
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
