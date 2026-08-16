import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { availabilityImports, properties, rateImports } from "@/lib/mock-data";

export const Route = createFileRoute("/agent/imports")({
  head: () => ({
    meta: [
      { title: "Rate & Availability Imports | Ocean Atlas Agent" },
      { name: "description", content: "Upload daily rate and availability spreadsheets for Maldives properties." },
      { property: "og:title", content: "Rate & Availability Imports | Ocean Atlas" },
      { property: "og:description", content: "Upload Excel or CSV rate and inventory files." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportsPage,
});

function ImportsPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Link to="/agent" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
        <h1 className="mt-4 text-4xl">Imports</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Upload daily rates and inventory as Excel (.xlsx) or CSV. Columns: property, room type, date range, value.
        </p>

        <Tabs defaultValue="rates" className="mt-8">
          <TabsList>
            <TabsTrigger value="rates">Daily rates</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="rates" className="mt-6 space-y-6">
            <UploadPanel
              title="Import daily rates"
              hint="Required columns: property, room_type, date_from, date_to, rate"
            />
            <HistoryTable rows={rateImports} valueLabel="Date range" />
          </TabsContent>

          <TabsContent value="availability" className="mt-6 space-y-6">
            <UploadPanel
              title="Import availability"
              hint="Required columns: property, room_type, date, available_units"
            />
            <HistoryTable rows={availabilityImports} valueLabel="Covered dates" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function UploadPanel({ title, hint }: { title: string; hint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [property, setProperty] = useState("all");

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="text-xl">{title}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_260px]">
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-secondary/40"
        >
          <UploadCloud className="size-8 text-primary" />
          <p className="mt-3 text-sm font-medium">{fileName ?? "Drop a .xlsx or .csv file, or click to browse"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFileName(f.name);
                toast.success("File staged", { description: `${f.name} ready to validate.` });
              }
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Apply to property</Label>
            <Select value={property} onValueChange={setProperty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties (from file)</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!fileName}
            onClick={() => toast.success("Import queued", { description: `${fileName} will be validated and applied.` })}
          >
            <FileSpreadsheet className="size-4" /> Validate & import
          </Button>
          <Button variant="outline" className="w-full" onClick={() => toast("Template downloaded")}>
            Download template
          </Button>
        </div>
      </div>
    </div>
  );
}

type ImportRow = { id: string; file: string; property: string; rows: number; range: string; uploaded: string; status: string };

function HistoryTable({ rows, valueLabel }: { rows: ImportRow[]; valueLabel: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="text-xl">Recent imports</h2>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>{valueLabel}</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.file}</TableCell>
                <TableCell className="text-muted-foreground">{r.property}</TableCell>
                <TableCell className="text-muted-foreground">{r.range}</TableCell>
                <TableCell className="text-right">{r.rows}</TableCell>
                <TableCell className="text-muted-foreground">{r.uploaded}</TableCell>
                <TableCell>
                  {r.status === "Applied" ? (
                    <Badge className="bg-success text-success-foreground hover:bg-success">
                      <CheckCircle2 className="size-3.5" /> Applied
                    </Badge>
                  ) : (
                    <Badge className="bg-warning text-warning-foreground hover:bg-warning">
                      <AlertTriangle className="size-3.5" /> Needs review
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
