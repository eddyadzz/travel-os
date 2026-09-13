import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { toast } from "sonner";
import {
  Rocket,
  Building2,
  Palette,
  Mail,
  Database,
  Truck,
  Users,
  ShieldCheck,
  Flag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSetupStatus, getImportTemplates, type SetupStatus } from "@/lib/api/productize";
import { saveBranding } from "@/lib/api/cms";
import { readinessCheckFn } from "@/lib/api/readiness";
import { createBackupFn } from "@/lib/api/deploy";
import type { ReadinessResult } from "@/lib/api/readiness";

export const Route = createFileRoute("/onboard")({
  beforeLoad: requireAuth,
  loader: async () => getSetupStatus(),
  head: () => ({
    meta: [{ title: "Client Onboarding | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardWizard,
});

const STEPS = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "brand", label: "Branding", icon: Palette },
  { key: "email", label: "Email", icon: Mail },
  { key: "import", label: "Import", icon: Database },
  { key: "suppliers", label: "Suppliers", icon: Truck },
  { key: "users", label: "Users", icon: Users },
  { key: "readiness", label: "Readiness", icon: ShieldCheck },
  { key: "golive", label: "Go live", icon: Flag },
] as const;

function OnboardWizard() {
  const initial = Route.useLoaderData();
  const [status, setStatus] = useState<SetupStatus>(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState({
    name: status.company.name,
    emailFrom: status.company.emailFrom ?? "",
    customDomain: status.company.customDomain ?? "",
  });
  const [brand, setBrand] = useState({
    logoUrl: "",
    primaryColor: "#0f766e",
    accentColor: "#0ea5e9",
    fontFamily: "",
  });
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof getImportTemplates>>>([]);

  const refresh = async () => setStatus(await getSetupStatus());

  const saveCompany = async () => {
    setBusy(true);
    try {
      await saveBranding({
        data: {
          name: company.name,
          ...(company.emailFrom ? { emailFrom: company.emailFrom } : {}),
          ...(company.customDomain ? { customDomain: company.customDomain } : {}),
        },
      });
      toast.success("Company saved");
      await refresh();
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const saveBrand = async () => {
    setBusy(true);
    try {
      await saveBranding({
        data: {
          ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
          primaryColor: brand.primaryColor,
          ...(brand.accentColor ? { accentColor: brand.accentColor } : {}),
          ...(brand.fontFamily ? { fontFamily: brand.fontFamily } : {}),
        },
      });
      toast.success("Branding saved — the public site updates automatically");
      await refresh();
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const loadTemplates = async () => setTemplates(await getImportTemplates());

  const downloadTemplate = (base64: string, filename: string) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runReadiness = async () => {
    setBusy(true);
    try {
      setReadiness(await readinessCheckFn());
    } finally {
      setBusy(false);
    }
  };

  const goLive = async () => {
    setBusy(true);
    try {
      await createBackupFn();
      toast.success("Deployment marked live — initial backup created");
    } finally {
      setBusy(false);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const current = STEPS[step]!;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
          </Link>
          <Link to="/agent" className="text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="flex items-center gap-2 text-4xl">
          <Rocket className="size-8 text-primary" /> Client onboarding
        </h1>
        <p className="mt-2 text-muted-foreground">
          A guided setup — each step uses the platform's own tools.
        </p>

        {/* Stepper */}
        <ol className="mt-6 flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
                <button
                  onClick={() => setStep(i)}
                  className={`flex size-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    done
                      ? "border-success bg-success/20 text-success"
                      : active
                        ? "gradient-lagoon text-primary-foreground"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                </button>
                <span
                  className={`text-[10px] ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 rounded-2xl border bg-card p-6">
          {current.key === "company" && (
            <div className="space-y-4">
              <h2 className="text-xl">Company information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Company name</Label>
                  <Input
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Email sender</Label>
                  <Input
                    value={company.emailFrom}
                    placeholder="bookings@client.mv"
                    onChange={(e) => setCompany({ ...company, emailFrom: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2 grid gap-1.5">
                  <Label>Custom domain</Label>
                  <Input
                    value={company.customDomain}
                    placeholder="travel.client.mv"
                    onChange={(e) => setCompany({ ...company, customDomain: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {current.key === "brand" && (
            <div className="space-y-4">
              <h2 className="text-xl">Branding</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Logo URL</Label>
                  <Input
                    value={brand.logoUrl}
                    placeholder="https://client.com/logo.png"
                    onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Primary color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brand.primaryColor}
                      onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                      className="h-9 w-12 rounded border"
                    />
                    <Input
                      value={brand.primaryColor}
                      onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Accent color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brand.accentColor}
                      onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                      className="h-9 w-12 rounded border"
                    />
                    <Input
                      value={brand.accentColor}
                      onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Font family</Label>
                  <Input
                    value={brand.fontFamily}
                    placeholder="Inter, ui-sans-serif"
                    onChange={(e) => setBrand({ ...brand, fontFamily: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {current.key === "email" && (
            <div className="space-y-4">
              <h2 className="text-xl">Email configuration</h2>
              <div className="rounded-xl border px-4 py-3">
                <p className="font-medium">Provider</p>
                <p className="text-sm text-muted-foreground">
                  {status.email.configured
                    ? "Resend configured — customer emails send for real."
                    : "No RESEND_API_KEY — emails are logged only (dev mode). Add the key to .env for production."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sender: <span className="font-mono">{status.email.sender ?? "—"}</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Sender address and company name are set on the Company step. Verify the Resend
                sender domain before go-live.
              </p>
            </div>
          )}

          {current.key === "import" && (
            <div className="space-y-4">
              <h2 className="text-xl">Import catalogue</h2>
              <p className="text-sm text-muted-foreground">
                Download templates, fill them with the client's data, then upload via the import
                tool. Currently loaded:{" "}
                <span className="font-semibold text-foreground">
                  {status.counts.properties} propert{status.counts.properties === 1 ? "y" : "ies"}
                </span>
                ,{" "}
                <span className="font-semibold text-foreground">
                  {status.counts.rooms} room{status.counts.rooms === 1 ? "" : "s"}
                </span>
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={loadTemplates}>
                  <Database className="size-4" /> Show templates
                </Button>
                {templates.map((t) => (
                  <Button
                    key={t.format}
                    size="sm"
                    variant="outline"
                    onClick={() => downloadTemplate(t.base64, t.filename)}
                  >
                    <Download className="size-4" /> {t.format}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {current.key === "suppliers" && (
            <div className="space-y-4">
              <h2 className="text-xl">Suppliers</h2>
              <p className="text-sm text-muted-foreground">
                Add the client's suppliers and give each one their portal link so they manage their
                own inventory. Currently:{" "}
                <span className="font-semibold text-foreground">
                  {status.counts.suppliers} supplier{status.counts.suppliers === 1 ? "" : "s"}
                </span>
                .
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/supplier-updates">Open supplier management</Link>
              </Button>
            </div>
          )}

          {current.key === "users" && (
            <div className="space-y-4">
              <h2 className="text-xl">Users</h2>
              <p className="text-sm text-muted-foreground">
                Confirm the client's staff accounts. Currently:{" "}
                <span className="font-semibold text-foreground">
                  {status.counts.users} user{status.counts.users === 1 ? "" : "s"}
                </span>
                . Each agent gets their own dashboard access from the Agent console.
              </p>
            </div>
          )}

          {current.key === "readiness" && (
            <div className="space-y-4">
              <h2 className="text-xl">Verify readiness</h2>
              <Button onClick={runReadiness} disabled={busy}>
                <ShieldCheck className="size-4" /> Run readiness check
              </Button>
              {readiness && (
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      className={
                        readiness.critical
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }
                    >
                      {readiness.critical ? "Ready to go live" : "Not ready"}
                    </Badge>
                    <Badge variant="outline">{readiness.readyPercent}% pass</Badge>
                    {readiness.blockers.length > 0 && (
                      <p className="text-sm text-destructive">
                        Blockers: {readiness.blockers.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {readiness.checks.map((c) => (
                      <div
                        key={c.key}
                        className={`rounded-lg border px-3 py-2 ${c.ok ? "border-success/40" : "border-destructive/40"}`}
                      >
                        <p className="flex items-center gap-2 text-sm font-medium">
                          {c.ok ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : (
                            <ShieldCheck className="size-4 text-destructive" />
                          )}
                          {c.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {current.key === "golive" && (
            <div className="space-y-4">
              <h2 className="text-xl">Go live</h2>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <p>Company</p>
                <p className="font-medium">{status.company.name}</p>
                <p>Catalogue</p>
                <p className="font-medium">{status.counts.properties} properties</p>
                <p>Suppliers</p>
                <p className="font-medium">{status.counts.suppliers}</p>
                <p>Last backup</p>
                <p className="font-medium">{status.lastBackup ?? "—"}</p>
              </div>
              <Button onClick={goLive} disabled={busy} className="w-full">
                <Flag className="size-4" /> Mark deployment live (creates backup)
              </Button>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="outline" onClick={back} disabled={step === 0}>
              <ChevronLeft className="size-4" /> Back
            </Button>
            {step === 0 && (
              <Button onClick={saveCompany} disabled={busy}>
                Save & continue <ChevronRight className="size-4" />
              </Button>
            )}
            {step === 1 && (
              <Button onClick={saveBrand} disabled={busy}>
                Save & continue <ChevronRight className="size-4" />
              </Button>
            )}
            {step > 1 && step < STEPS.length - 1 && (
              <Button onClick={next}>
                Continue <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
