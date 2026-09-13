import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getImportJob, listImportJobs, previewImport, runImport } from "@/lib/api/imports";
import type { AvailabilityPreview, ImportJobDTO, RatePreview } from "@/lib/imports/types";
import type { ImportChangeDTO } from "@/lib/types";

export const Route = createFileRoute("/agent/imports")({
  beforeLoad: requireAuth,
  loader: async () => {
    const jobs = await listImportJobs();
    return { jobs };
  },
  head: () => ({
    meta: [
      { title: "Rate & Availability Imports | TravelOS by Boliflow" },
      {
        name: "description",
        content: "Upload daily rate and availability spreadsheets for Maldives properties.",
      },
      { property: "og:title", content: "Rate & Availability Imports | TravelOS by Boliflow" },
      { property: "og:description", content: "Upload Excel or CSV rate and inventory files." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportsPage,
});

type ImportType = "RATES" | "AVAILABILITY";

function ImportsPage() {
  const { jobs: initialJobs } = Route.useLoaderData();
  const [jobs, setJobs] = useState<ImportJobDTO[]>(initialJobs);
  const [activeTab, setActiveTab] = useState<ImportType>("RATES");

  const refreshJobs = async () => {
    setJobs(await listImportJobs());
  };

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
        <h1 className="mt-4 text-4xl">Imports</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Upload daily rates and availability as Excel (.xlsx) or CSV. Files are validated before
          anything is written. Header names are flexible — property/room/from/to/rate and
          property/room/date/inventory.
        </p>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ImportType)}
          className="mt-8"
        >
          <TabsList>
            <TabsTrigger value="RATES">Daily rates</TabsTrigger>
            <TabsTrigger value="AVAILABILITY">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="RATES" className="mt-6 space-y-6">
            <UploadPanel type="RATES" onImported={refreshJobs} />
          </TabsContent>
          <TabsContent value="AVAILABILITY" className="mt-6 space-y-6">
            <UploadPanel type="AVAILABILITY" onImported={refreshJobs} />
          </TabsContent>
        </Tabs>

        <HistoryTable jobs={jobs.filter((j) => j.type === activeTab)} />
      </main>
    </div>
  );
}

function downloadCsvTemplate(type: ImportType) {
  const csv =
    type === "RATES"
      ? "Property,Room,From,To,Rate,Season\nVelaa Lagoon Resort & Spa,Overwater Villa,2026-11-01,2027-03-31,1112,High\n"
      : "Property,Room,Date,Inventory\nVelaa Lagoon Resort & Spa,Overwater Villa,2026-08-20,3\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = type === "RATES" ? "rates-template.csv" : "availability-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function UploadPanel({ type, onImported }: { type: ImportType; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RatePreview | AvailabilityPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);

  const hint =
    type === "RATES"
      ? "Required columns: property, room, from, to, rate"
      : "Required columns: property, room, date, inventory";

  const buildForm = () => {
    if (!file) return null;
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);
    return form;
  };

  const handlePreview = async () => {
    const form = buildForm();
    if (!form) return;
    setBusy("preview");
    try {
      setPreview(await previewImport({ data: form }));
    } catch (error) {
      toast.error(
        "Could not preview file",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    const form = buildForm();
    if (!form) return;
    setBusy("import");
    try {
      const result = await runImport({ data: form });
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`Import complete — ${result.successRows} rows imported`, {
        description:
          result.failedRows > 0
            ? `${result.failedRows} rows failed validation.`
            : "All rows imported.",
      });
      onImported();
    } catch (error) {
      toast.error("Import failed", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl">
          {type === "RATES" ? "Import daily rates" : "Import availability"}
        </h2>
        <Button variant="outline" size="sm" onClick={() => downloadCsvTemplate(type)}>
          <FileSpreadsheet className="size-4" /> Download template
        </Button>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_260px]">
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-secondary/40"
        >
          <UploadCloud className="size-8 text-primary" />
          <p className="mt-3 text-sm font-medium">
            {file ? file.name : "Drop a .xlsx or .csv file, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFile(f ?? null);
              setPreview(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Button className="w-full" disabled={!file || busy !== null} onClick={handlePreview}>
            {busy === "preview" ? "Validating…" : "Validate & preview"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={!preview || preview.validRows.length === 0 || busy !== null}
            onClick={handleImport}
          >
            {busy === "import"
              ? "Importing…"
              : `Import ${preview?.validRows.length ?? 0} valid rows`}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-3">
            <Summary label="Rows found" value={preview.totalRows} tone="muted" />
            <Summary label="Valid" value={preview.validRows.length} tone="success" />
            <Summary
              label="Errors"
              value={preview.errors.length}
              tone={preview.errors.length > 0 ? "destructive" : "muted"}
            />
          </div>

          {preview.errors.length > 0 && (
            <div className="mt-5 max-h-56 overflow-auto rounded-xl border bg-secondary/30 p-4">
              <p className="text-sm font-semibold">Validation errors</p>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead>Problem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.errors.map((e) => (
                    <TableRow key={e.rowNumber}>
                      <TableCell className="font-mono text-xs">{e.rowNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {preview.validRows.length > 0 && (
            <div className="mt-5 max-h-64 overflow-auto rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold">
                Ready to import ({preview.validRows.length} rows) — showing first{" "}
                {Math.min(preview.validRows.length, 10)}
              </p>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Room</TableHead>
                    {type === "RATES" ? (
                      <>
                        <TableHead>Valid from</TableHead>
                        <TableHead>Valid to</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Inventory</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.validRows.slice(0, 10).map((r) =>
                    "validFrom" in r ? (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="font-medium">{r.propertyName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.roomName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.validFrom}</TableCell>
                        <TableCell className="text-muted-foreground">{r.validTo}</TableCell>
                        <TableCell className="text-right">${r.amount.toFixed(0)}</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="font-medium">{r.propertyName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.roomName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.date}</TableCell>
                        <TableCell className="text-right">{r.inventory}</TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "destructive";
}) {
  const cls =
    tone === "success"
      ? "bg-success text-success-foreground"
      : tone === "destructive"
        ? "bg-destructive text-destructive-foreground"
        : "bg-secondary text-muted-foreground";
  return (
    <div className={`rounded-xl px-4 py-2 text-sm ${cls}`}>
      <span className="opacity-80">{label}: </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function HistoryTable({ jobs }: { jobs: ImportJobDTO[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ rowNumber: number; message: string }> | null>(null);
  const [changes, setChanges] = useState<ImportChangeDTO[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setErrors(null);
    setChanges(null);
    setLoading(true);
    try {
      const job = await getImportJob({ data: id });
      setErrors(job?.errors ?? []);
      setChanges(job?.changes ?? []);
    } catch {
      setErrors([]);
      setChanges([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="text-xl">Recent imports</h2>
      {jobs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No imports yet. Upload your first rate or availability sheet above.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Valid</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <FragmentRow
                  key={j.id}
                  job={j}
                  expanded={expanded === j.id}
                  loading={expanded === j.id && loading}
                  errors={expanded === j.id ? errors : null}
                  changes={expanded === j.id ? changes : null}
                  onToggle={() => toggle(j.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  job,
  expanded,
  loading,
  errors,
  changes,
  onToggle,
}: {
  job: ImportJobDTO;
  expanded: boolean;
  loading: boolean;
  errors: Array<{ rowNumber: number; message: string }> | null;
  changes: ImportChangeDTO[] | null;
  onToggle: () => void;
}) {
  const statusBadge =
    job.status === "COMPLETED" ? (
      <Badge className="bg-success text-success-foreground hover:bg-success">
        <CheckCircle2 className="size-3.5" /> Completed
      </Badge>
    ) : job.status === "FAILED" ? (
      <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
        <XCircle className="size-3.5" /> Failed
      </Badge>
    ) : (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning">
        <AlertTriangle className="size-3.5" /> {job.status}
      </Badge>
    );

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{job.filename}</TableCell>
        <TableCell className="text-muted-foreground">
          {new Date(job.createdAt).toLocaleString()}
        </TableCell>
        <TableCell className="text-right">{job.totalRows}</TableCell>
        <TableCell className="text-right">{job.successRows}</TableCell>
        <TableCell className="text-right">{job.failedRows}</TableCell>
        <TableCell>{statusBadge}</TableCell>
        <TableCell>
          {(job.successRows > 0 || job.failedRows > 0) && (
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              <span className="sr-only">Toggle details</span>
            </Button>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-secondary/20">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading details…</p>
            ) : (
              <div className="space-y-4">
                {changes && changes.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold">Changes ({changes.length})</p>
                    <div className="mt-2 max-h-56 overflow-auto rounded-lg border bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Date / range</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Before</TableHead>
                            <TableHead>After</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {changes.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <Badge variant="outline">{c.type}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{c.roomId.slice(-6)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {c.date ?? "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{c.field}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {c.beforeValue ?? "—"}
                              </TableCell>
                              <TableCell className="font-medium">{c.afterValue}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {errors && errors.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold">Errors ({errors.length})</p>
                    <div className="mt-2 max-h-52 overflow-auto rounded-lg border bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Row</TableHead>
                            <TableHead>Problem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errors.map((e) => (
                            <TableRow key={`${job.id}-${e.rowNumber}`}>
                              <TableCell className="font-mono text-xs">{e.rowNumber}</TableCell>
                              <TableCell className="text-muted-foreground">{e.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {(!changes || changes.length === 0) && (!errors || errors.length === 0) && (
                  <p className="text-sm text-muted-foreground">No changes or errors recorded.</p>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
