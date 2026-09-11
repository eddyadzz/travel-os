import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Rocket,
  ShieldCheck,
  XCircle,
  DatabaseBackup,
  Palette,
  RefreshCw,
  Download,
  CheckCircle2,
  ClipboardCheck,
  LifeBuoy,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readinessCheckFn, type ReadinessResult } from "@/lib/api/readiness";
import {
  getImportTemplates,
  getSupportBundle,
  getSystemInfo,
  type SystemInfo,
} from "@/lib/api/productize";
import { loadDemoDataFn } from "@/lib/api/demo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBackupFn,
  importBranding,
  listBackupsFn,
  onboardingChecklistFn,
  restoreBackupFn,
  validateEnvironmentFn,
  verifyBackupFn,
} from "@/lib/api/deploy";
import type { BackupInfo, DeployCheckItem, OnboardingChecklist } from "@/lib/types";

export const Route = createFileRoute("/deploy")({
  loader: async () => {
    const [checks, backups, checklist] = await Promise.all([
      validateEnvironmentFn(),
      listBackupsFn(),
      onboardingChecklistFn(),
    ]);
    return { checks, backups, checklist };
  },
  head: () => ({
    meta: [{ title: "Deployment | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: DeployPage,
});

function DeployPage() {
  const {
    checks: initialChecks,
    backups: initialBackups,
    checklist: initialChecklist,
  } = Route.useLoaderData();
  const [checks, setChecks] = useState<DeployCheckItem[]>(initialChecks);
  const [backups, setBackups] = useState<BackupInfo[]>(initialBackups);
  const [checklist, setChecklist] = useState<OnboardingChecklist>(initialChecklist);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof getImportTemplates>>>([]);
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [emailFrom, setEmailFrom] = useState("");

  const runReadiness = async () => {
    setBusy(true);
    try {
      setReadiness(await readinessCheckFn());
    } finally {
      setBusy(false);
    }
  };

  const loadSystemInfo = async () => {
    setSysInfo(await getSystemInfo());
  };

  const downloadBundle = async () => {
    setBusy(true);
    try {
      const bundle = await getSupportBundle();
      const blob = new Blob([bundle.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = bundle.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

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

  const loadTemplates = async () => setTemplates(await getImportTemplates());

  const loadDemo = async () => {
    setBusy(true);
    try {
      const r = await loadDemoDataFn();
      toast.success(
        `Demo loaded — ${r.branded ? "branded as Paradise Holidays Maldives · " : ""}${r.content} content · ${r.pagesCreated} pages · ${r.addonsAdded} excursions · ${r.leadsAdded} leads · ${r.quotesAdded} quotes`,
      );
      await refresh();
    } catch (error) {
      toast.error("Demo load failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const [c, b, cl] = await Promise.all([
        validateEnvironmentFn(),
        listBackupsFn(),
        onboardingChecklistFn(),
      ]);
      setChecks(c);
      setBackups(b);
      setChecklist(cl);
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    setBusy(true);
    try {
      const info = await createBackupFn();
      toast.success(`Backup created — ${info.filename}`);
      await refresh();
    } catch (error) {
      toast.error("Backup failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  const restore = async (filename: string) => {
    setBusy(true);
    try {
      const r = await restoreBackupFn({ data: filename });
      toast.success(`Restored — ${r.restored} rows`);
      await refresh();
    } catch (error) {
      toast.error("Restore failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  const verify = async (filename: string) => {
    setBusy(true);
    try {
      const v = await verifyBackupFn({ data: filename });
      if (v.valid) toast.success(`Backup valid — ${v.tables} tables, ${v.rows} rows`);
      else toast.error("Backup invalid", { description: v.error });
    } finally {
      setBusy(false);
    }
  };

  const downloadBackup = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/data/backups/${filename}`;
    a.download = filename;
    a.click();
  };

  const applyBranding = async () => {
    setBusy(true);
    try {
      await importBranding({
        data: {
          ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
          primaryColor,
          ...(emailFrom.trim() ? { emailFrom: emailFrom.trim() } : {}),
        },
      });
      toast.success("Branding applied to this deployment");
      await refresh();
    } catch (error) {
      toast.error(
        "Could not apply branding",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
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
            <h1 className="flex items-center gap-2 text-4xl">
              <Rocket className="size-8 text-primary" /> Deployment toolkit
            </h1>
            <p className="mt-2 text-muted-foreground">
              Provision a client installation — validate, brand, back up, go live
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        {/* Onboarding checklist */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Onboarding checklist</h2>
            <Badge className="bg-success text-success-foreground">
              {checklist.progress}% complete
            </Badge>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${checklist.progress}%` }}
            />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.steps.map((s) => (
              <div
                key={s.key}
                className={`rounded-xl border px-4 py-3 ${s.done ? "border-success/40" : ""}`}
              >
                <p className="flex items-center gap-2 font-medium">
                  {s.done ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <XCircle className="size-4 text-muted-foreground" />
                  )}
                  {s.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Client readiness */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <ClipboardCheck className="size-5 text-primary" /> First client — readiness check
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The go-live gate: backup, email, PWA, audit trail, branding and data.
              </p>
            </div>
            <Button onClick={runReadiness} disabled={busy}>
              <ClipboardCheck className="size-4" /> Run check
            </Button>
          </div>
          {readiness && (
            <div className="mt-4">
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {readiness.checks.map((c) => (
                  <div
                    key={c.key}
                    className={`rounded-xl border px-4 py-3 ${c.ok ? "border-success/40" : "border-destructive/40"}`}
                  >
                    <p className="flex items-center gap-2 font-medium">
                      {c.ok ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <XCircle className="size-4 text-destructive" />
                      )}
                      {c.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Support toolkit */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <LifeBuoy className="size-5 text-primary" /> Support toolkit
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                System info and a one-click diagnostics bundle for remote support.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadSystemInfo} disabled={busy}>
                <RefreshCw className="size-4" /> System info
              </Button>
              <Button onClick={downloadBundle} disabled={busy}>
                <Download className="size-4" /> Download diagnostics
              </Button>
            </div>
          </div>
          {sysInfo && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Environment" value={`${sysInfo.nodeEnv} · port ${sysInfo.port}`} />
              <Info
                label="Database"
                value={`${sysInfo.database.connected ? "connected" : "down"} · ${sysInfo.database.urlHost}`}
              />
              <Info
                label="Email"
                value={
                  sysInfo.email.sender
                    ? `${sysInfo.email.sender} · ${sysInfo.email.providerConfigured ? "live" : "dev"}`
                    : "not set"
                }
              />
              <Info
                label="Data"
                value={`${sysInfo.counts.properties} props · ${sysInfo.counts.bookings} bookings · ${sysInfo.counts.leads} leads`}
              />
              <Info
                label="Last backup"
                value={
                  sysInfo.lastBackup
                    ? `${sysInfo.lastBackup.filename} · ${sysInfo.lastBackup.valid ? "valid" : "INVALID"}`
                    : "none"
                }
              />
              <Info
                label="Last job"
                value={
                  sysInfo.lastJob ? `${sysInfo.lastJob.key} · ${sysInfo.lastJob.status}` : "none"
                }
              />
              <Info label="Readiness" value={`${sysInfo.readiness.readyPercent}%`} />
              <Info label="Base domain" value={sysInfo.baseDomain} />
            </div>
          )}
        </section>

        {/* Import templates */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Package className="size-5 text-primary" /> Import templates
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fill these and upload via the import tool — reduces onboarding time dramatically.
              </p>
            </div>
            <Button variant="outline" onClick={loadTemplates} disabled={busy}>
              <Download className="size-4" /> Show templates
            </Button>
          </div>
          {templates.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
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
          )}
        </section>

        {/* Demo environment */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Rocket className="size-5 text-primary" /> Demo environment
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Loads a full demo dataset + brand ("Paradise Holidays Maldives") for sales and
                training. For demo deployments only — it brands the deployment if still default.
              </p>
            </div>
            <Button onClick={loadDemo} disabled={busy}>
              <Rocket className="size-4" /> Load demo data
            </Button>
          </div>
        </section>

        {/* Environment validation */}
        <section className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" /> Environment validation
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c) => (
              <div
                key={c.key}
                className={`rounded-xl border px-4 py-3 ${c.ok ? "border-success/40" : "border-destructive/40"}`}
              >
                <p className="flex items-center gap-2 font-medium">
                  {c.ok ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <XCircle className="size-4 text-destructive" />
                  )}
                  {c.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Branding import */}
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Palette className="size-5 text-primary" /> Apply client branding
            </h2>
            <div className="mt-4 space-y-3">
              <div className="grid gap-1.5">
                <Label>Logo URL</Label>
                <Input
                  value={logoUrl}
                  placeholder="https://client.com/logo.png"
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
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
                <Label>Email sender</Label>
                <Input
                  value={emailFrom}
                  placeholder="bookings@client.mv"
                  onChange={(e) => setEmailFrom(e.target.value)}
                />
              </div>
              <Button onClick={applyBranding} disabled={busy}>
                <Palette className="size-4" /> Apply to deployment
              </Button>
            </div>
          </section>

          {/* Backups */}
          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <DatabaseBackup className="size-5 text-primary" /> Backups
              </h2>
              <Button onClick={backup} disabled={busy}>
                <DatabaseBackup className="size-4" /> Create backup
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No backups yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {backups.map((b) => (
                    <TableRow key={b.filename}>
                      <TableCell className="font-mono text-xs">{b.filename}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(b.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(b.sizeBytes / 1024).toFixed(1)} KB
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verify(b.filename)}
                            title="Verify backup integrity"
                          >
                            <ShieldCheck className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadBackup(b.filename)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => restore(b.filename)}>
                            Restore
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
