import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Play, RefreshCw, History, Activity, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJobStats, listJobDefinitions, listJobRuns, runJobNowFn } from "@/lib/api/scheduler";
import type { JobDefinitionDTO, JobRunDTO } from "@/lib/types";

export const Route = createFileRoute("/jobs")({
  loader: async () => {
    const [definitions, runs, stats] = await Promise.all([
      listJobDefinitions(),
      listJobRuns(),
      getJobStats(),
    ]);
    return { definitions, runs, stats };
  },
  head: () => ({
    meta: [{ title: "Background Jobs | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: JobsPage,
});

function JobsPage() {
  const { definitions: initial, runs: initialRuns, stats: initialStats } = Route.useLoaderData();
  const [definitions, setDefinitions] = useState<JobDefinitionDTO[]>(initial);
  const [runs, setRuns] = useState<JobRunDTO[]>(initialRuns);
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const [d, r, s] = await Promise.all([listJobDefinitions(), listJobRuns(), getJobStats()]);
    setDefinitions(d);
    setRuns(r);
    setStats(s);
  };

  const run = async (key: string, name: string) => {
    setBusy(key);
    try {
      const run = await runJobNowFn({ data: key });
      await refresh();
      if (run.status === "SUCCESS") toast.success(`${name} completed`);
      else if (run.status === "FAILED") toast.error(`${name} failed — ${run.error ?? ""}`);
    } catch (error) {
      toast.error(
        "Could not run job",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(null);
    }
  };

  const cards = [
    { label: "Successful runs", value: stats.success, cls: "bg-success/60" },
    { label: "Failed runs", value: stats.failed, cls: "bg-destructive/60" },
    { label: "Running now", value: stats.running, cls: "bg-primary/60" },
    { label: "Runs in last 24h", value: stats.last24h, cls: "bg-warning/60" },
  ];

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
            <h1 className="text-4xl">Background jobs</h1>
            <p className="mt-2 text-muted-foreground">
              Scheduled automation — runs automatically every minute, retries failures, and alerts
              on error
            </p>
          </div>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-2xl border bg-card p-5 ${c.cls}`}>
              <p className="text-sm opacity-80">{c.label}</p>
              <p className="mt-1 text-display text-2xl font-semibold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {definitions.map((j) => (
            <div key={j.key} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <h2 className="font-semibold">{j.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <Clock className="size-3" /> {j.schedule}
                  </Badge>
                  <Button size="sm" disabled={busy !== null} onClick={() => run(j.key, j.name)}>
                    {busy === j.key ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Run now
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{j.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                {j.lastRun ? (
                  <>
                    <Badge variant={j.lastRun.status === "SUCCESS" ? "default" : "destructive"}>
                      {j.lastRun.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(j.lastRun.startedAt).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Never run</span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {j.totalRuns} run{j.totalRuns === 1 ? "" : "s"} · {j.successRate}% success
                </span>
              </div>
              {j.lastRun?.output && (
                <p className="mt-2 truncate rounded-lg bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
                  {j.lastRun.output}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <History className="size-4" />
            <h2 className="text-lg font-semibold">Run history</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Output / Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No jobs have run yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.jobKey}</TableCell>
                      <TableCell>
                        {r.status === "FAILED" ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="size-3" /> {r.status}
                          </Badge>
                        ) : r.status === "RUNNING" ? (
                          <Badge variant="outline">{r.status}</Badge>
                        ) : (
                          <Badge>{r.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                      </TableCell>
                      <TableCell className="max-w-md truncate text-muted-foreground">
                        {r.error ?? r.output ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
