import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, RefreshCw, Palette, Globe, Users, CheckCircle2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTenant,
  getTenantUsage,
  listTenants,
  setTenantPlan,
  updateTenant,
} from "@/lib/api/tenants";
import type { PlanType, TenantDTO, TenantUsageDTO } from "@/lib/types";

export const Route = createFileRoute("/admin/tenants")({
  loader: async () => {
    const tenants = await listTenants();
    return { tenants };
  },
  head: () => ({
    meta: [{ title: "Tenants | Ocean Atlas" }, { name: "robots", content: "noindex" }],
  }),
  component: TenantsPage,
});

const PLAN_LABELS: Record<PlanType, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

function TenantsPage() {
  const { tenants: initial } = Route.useLoaderData();
  const [tenants, setTenants] = useState<TenantDTO[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Onboarding form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<PlanType>("STARTER");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [customDomain, setCustomDomain] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const refresh = async () => setTenants(await listTenants());

  const handleCreate = async () => {
    if (!name || !slug || !adminName || !adminEmail) {
      toast.error("Name, slug, admin name and admin email are required");
      return;
    }
    setBusy("create");
    try {
      await createTenant({
        data: {
          name,
          slug,
          plan,
          ...(primaryColor ? { primaryColor } : {}),
          ...(customDomain ? { customDomain } : {}),
          adminName,
          adminEmail,
          ...(adminPassword ? { adminPassword } : {}),
        },
      });
      toast.success("Agency created");
      setShowCreate(false);
      setName("");
      setSlug("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setCustomDomain("");
      await refresh();
    } catch (error) {
      toast.error(
        "Could not create agency",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(null);
    }
  };

  const handlePlan = async (id: string, next: PlanType) => {
    await setTenantPlan({ data: { id, plan: next } });
    await refresh();
  };

  const handleColor = async (id: string, next: string) => {
    await updateTenant({ data: { id, primaryColor: next } });
    await refresh();
  };

  const handleDomain = async (id: string, next: string) => {
    await updateTenant({ data: { id, customDomain: next || "" } });
    await refresh();
  };

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
            <h1 className="text-4xl">Agencies</h1>
            <p className="mt-2 text-muted-foreground">
              Multi-tenant SaaS — each agency gets isolated data, its own branding and domain
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button onClick={() => setShowCreate((s) => !s)}>
              <Plus className="size-4" /> New agency
            </Button>
          </div>
        </div>

        {showCreate && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Onboard a new agency</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Agency name</Label>
                <Input
                  value={name}
                  placeholder="Maldives Explorers"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Slug (subdomain)</Label>
                <Input
                  value={slug}
                  placeholder="maldives-explorers"
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as PlanType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STARTER">Starter</SelectItem>
                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Brand color</Label>
                <Input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Custom domain (optional)</Label>
                <Input
                  value={customDomain}
                  placeholder="travel.explorers.mv"
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Admin full name</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Admin email</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Admin password (optional — random if blank)</Label>
                <Input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              </div>
            </div>
            <Button className="mt-4" onClick={handleCreate} disabled={busy !== null}>
              <CheckCircle2 className="size-4" /> Create agency
            </Button>
          </div>
        )}

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Agencies</h2>
          <div className="mt-4 space-y-3">
            {tenants.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                onPlan={(p) => handlePlan(t.id, p)}
                onColor={(c) => handleColor(t.id, c)}
                onDomain={(d) => handleDomain(t.id, d)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function TenantCard({
  tenant,
  onPlan,
  onColor,
  onDomain,
}: {
  tenant: TenantDTO;
  onPlan: (p: PlanType) => void;
  onColor: (c: string) => void;
  onDomain: (d: string) => void;
}) {
  const [usage, setUsage] = useState<TenantUsageDTO | null>(null);

  const loadUsage = async () => setUsage(await getTenantUsage({ data: tenant.id }));

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <p className="font-semibold">{tenant.name}</p>
          <Badge variant="outline">{tenant.slug}</Badge>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Select value={tenant.plan} onValueChange={(v) => onPlan(v as PlanType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STARTER">Starter</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadUsage}>
            <Users className="size-4" /> Usage
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" /> {tenant.userCount} user{tenant.userCount === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <Palette className="size-3.5" />{" "}
          <input
            type="color"
            value={tenant.primaryColor ?? "#0f766e"}
            onChange={(e) => onColor(e.target.value)}
            className="h-5 w-8 rounded border"
          />
        </span>
        <span className="flex items-center gap-1">
          <Globe className="size-3.5" />
          <Input
            className="h-7 w-56"
            defaultValue={tenant.customDomain ?? ""}
            placeholder="custom domain"
            onBlur={(e) => onDomain(e.target.value)}
          />
        </span>
        <span className="text-xs">{PLAN_LABELS[tenant.plan]}</span>
      </div>
      {usage && (
        <div className="mt-3 grid gap-2 rounded-xl bg-secondary/40 p-3 text-sm sm:grid-cols-4">
          <UsageStat
            label="Bookings (year)"
            value={usage.bookingsYear}
            limit={usage.limits.bookingsPerYear}
          />
          <UsageStat label="Leads" value={usage.leads} limit={usage.limits.leads} />
          <UsageStat label="Users" value={usage.users} limit={usage.limits.users} />
          <div className="rounded-lg bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Within limits</p>
            <p
              className={`mt-0.5 font-semibold ${usage.withinLimits ? "text-success" : "text-destructive"}`}
            >
              {usage.withinLimits ? "Yes" : "Exceeded"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageStat({ label, value, limit }: { label: string; value: number; limit: number }) {
  const over = limit !== Infinity && value >= limit;
  return (
    <div className="rounded-lg bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-semibold ${over ? "text-destructive" : ""}`}>
        {value}
        {limit !== Infinity ? ` / ${limit}` : " / ∞"}
      </p>
    </div>
  );
}
