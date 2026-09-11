import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Bot,
  Gauge,
  Copy,
  Check,
  TrendingUp,
  ShieldAlert,
  Banknote,
  FileText,
} from "lucide-react";
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
  assistantAnswer,
  assistantOperationsAdvice,
  assistantRecommendProperties,
  assistantScoredLeads,
} from "@/lib/api/assistant";
import type {
  ManagementAnswer,
  OperationsAdvice,
  SalesRecommendation,
  ScoredLead,
} from "@/lib/types";

export const Route = createFileRoute("/assistant")({
  loader: async () => {
    const [advice, leads] = await Promise.all([
      assistantOperationsAdvice(),
      assistantScoredLeads(),
    ]);
    return { advice, leads };
  },
  head: () => ({
    meta: [{ title: "AI Assistant | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: AssistantPage,
});

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function AssistantPage() {
  const { advice: initialAdvice, leads: initialLeads } = Route.useLoaderData();
  const [tab, setTab] = useState<"sales" | "operations" | "management">("operations");
  const [advice, setAdvice] = useState<OperationsAdvice>(initialAdvice);
  const [leads, setLeads] = useState<ScoredLead[]>(initialLeads);
  const [sales, setSales] = useState<SalesRecommendation | null>(null);
  const [answer, setAnswer] = useState<ManagementAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Sales form
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [budget, setBudget] = useState("");
  const [prefs, setPrefs] = useState("");
  // Management
  const [question, setQuestion] = useState("");

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const recommend = async () => {
    if (!checkIn || !checkOut) {
      toast.error("Choose dates first");
      return;
    }
    setBusy(true);
    try {
      setSales(
        await assistantRecommendProperties({
          data: {
            checkIn,
            checkOut,
            adults: Number(adults) || 2,
            children: Number(children) || 0,
            ...(budget ? { budget: Number(budget) } : {}),
            ...(prefs.trim()
              ? {
                  preferences: prefs
                    .split(",")
                    .map((p) => p.trim())
                    .filter(Boolean),
                }
              : {}),
          },
        }),
      );
    } catch (error) {
      toast.error(
        "Could not generate",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const refreshOps = async () => {
    setBusy(true);
    try {
      const [a, l] = await Promise.all([assistantOperationsAdvice(), assistantScoredLeads()]);
      setAdvice(a);
      setLeads(l);
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      setAnswer(await assistantAnswer({ data: question.trim() }));
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
        <h1 className="flex items-center gap-2 text-4xl">
          <Sparkles className="size-8 text-primary" /> AI operations assistant
        </h1>
        <p className="mt-2 text-muted-foreground">
          Recommendations, drafted messages and answers generated from your live platform data
        </p>

        <div className="mt-6 flex gap-2">
          <Button
            variant={tab === "operations" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("operations")}
          >
            <Bot className="size-4" /> Operations
          </Button>
          <Button
            variant={tab === "sales" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("sales")}
          >
            <TrendingUp className="size-4" /> Sales
          </Button>
          <Button
            variant={tab === "management" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("management")}
          >
            <Gauge className="size-4" /> Management
          </Button>
        </div>

        {tab === "operations" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Suggested actions</h2>
                <Button size="sm" variant="outline" onClick={refreshOps} disabled={busy}>
                  <Sparkles className="size-4" /> Regenerate
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{advice.summary}</p>
              <div className="mt-4 space-y-3">
                {advice.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing urgent right now.</p>
                )}
                {advice.items.map((item, i) => (
                  <div key={i} className="rounded-xl border p-4">
                    <div className="flex items-center gap-2">
                      {item.type === "supplier-followup" && (
                        <ShieldAlert className="size-4 text-destructive" />
                      )}
                      {item.type === "contract-renewal" && (
                        <FileText className="size-4 text-primary" />
                      )}
                      {item.type === "deposit-followup" && (
                        <Banknote className="size-4 text-warning" />
                      )}
                      <p className="font-medium">{item.title}</p>
                      <Badge variant="outline">{item.type.replace("-", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 text-xs">
                      {item.draft}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => copy(`ops-${i}`, item.draft)}
                    >
                      {copied === `ops-${i}` ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copied === `ops-${i}` ? "Copied" : "Copy draft"}
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Leads most likely to convert</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ranked by conversion probability from source, intent and recency.
              </p>
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Expected value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No open leads.
                        </TableCell>
                      </TableRow>
                    )}
                    {leads.map((l) => (
                      <TableRow key={l.leadId}>
                        <TableCell className="font-medium">{l.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{l.source}</TableCell>
                        <TableCell>
                          <Probability p={l.conversionProbability} />
                        </TableCell>
                        <TableCell>{money(l.expectedValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        )}

        {tab === "sales" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Recommend properties</h2>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Check-in</Label>
                    <Input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Check-out</Label>
                    <Input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Adults</Label>
                    <Input
                      type="number"
                      min={1}
                      value={adults}
                      onChange={(e) => setAdults(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Children</Label>
                    <Input
                      type="number"
                      min={0}
                      value={children}
                      onChange={(e) => setChildren(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Budget (total)</Label>
                  <Input
                    type="number"
                    value={budget}
                    placeholder="e.g. 5000"
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Preferences (comma separated)</Label>
                  <Input
                    value={prefs}
                    placeholder="honeymoon, spa, diving"
                    onChange={(e) => setPrefs(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={recommend} disabled={busy}>
                  <Sparkles className="size-4" /> Recommend & draft
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {!sales && (
                <p className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
                  Set dates and the assistant will rank properties, apply markup and draft a quote
                  message.
                </p>
              )}
              {sales && (
                <>
                  {sales.recommendations.map((r) => (
                    <div key={r.propertyId} className="rounded-2xl border bg-card p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold">{r.name}</p>
                        <Badge variant="outline">
                          {r.type} · {r.atoll}
                        </Badge>
                        <Badge className="bg-success text-success-foreground">
                          fit {r.fitScore}
                        </Badge>
                        <span className="ml-auto font-semibold">{money(r.estimatedTotal)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {money(r.nightlyRate)}/night · {r.markupPercent}% markup ·{" "}
                        {r.reasons.join(" · ")}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-2xl border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Draft quote message</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy("quote", sales.quoteDraft)}
                      >
                        {copied === "quote" ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                        {copied === "quote" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary/40 p-4 text-sm">
                      {sales.quoteDraft}
                    </pre>
                    <p className="mt-3 text-sm text-muted-foreground">{sales.suggestion}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "management" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Ask about the business</h2>
              <div className="mt-4 flex gap-2">
                <Input
                  value={question}
                  placeholder='Try "expected revenue this month"'
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ask()}
                />
                <Button onClick={ask} disabled={busy}>
                  <Gauge className="size-4" /> Ask
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "expected revenue this month",
                  "which deposits are overdue",
                  "which suppliers are at risk",
                  "which leads are likely to convert",
                  "arrivals next 14 days",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setQuestion(q);
                      void (async () => {
                        setAnswer(await assistantAnswer({ data: q }));
                      })();
                    }}
                    className="rounded-full border bg-secondary/40 px-3 py-1 text-xs hover:bg-secondary/60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              {!answer && <p className="text-sm text-muted-foreground">Answers appear here.</p>}
              {answer && (
                <>
                  <p className="text-xs text-muted-foreground">{answer.question}</p>
                  <p className="mt-2 text-lg font-medium">{answer.answer}</p>
                  {answer.detail && (
                    <p className="mt-2 text-sm text-muted-foreground">{answer.detail}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Probability({ p }: { p: number }) {
  const color = p >= 60 ? "bg-success" : p >= 35 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-14 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="font-semibold">{p}%</span>
    </div>
  );
}
