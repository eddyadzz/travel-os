import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Percent, Wallet, Plus, Trash2, RefreshCw, BadgePercent } from "lucide-react";
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
  createMarkupRule,
  deleteMarkupRule,
  listMarkupRules,
  updateMarkupRule,
  type MarkupRuleDTO,
} from "@/lib/api/markup";
import { listAgentsWithRates, setAgentCommissionRate } from "@/lib/api/finance";
import { DEFAULT_MARKUP } from "@/lib/markup";

export const Route = createFileRoute("/revenue")({
  beforeLoad: requireAuth,
  loader: async () => {
    const [rules, agents] = await Promise.all([listMarkupRules(), listAgentsWithRates()]);
    return { rules, agents };
  },
  head: () => ({
    meta: [
      { title: "Revenue & Commissions | TravelOS by Boliflow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const { rules: initial, agents: initialAgents } = Route.useLoaderData();
  const [rules, setRules] = useState<MarkupRuleDTO[]>(initial);
  const [agents, setAgents] = useState(initialAgents);
  const [tab, setTab] = useState<"markup" | "commissions">("markup");

  // Markup form
  const [scope, setScope] = useState("TYPE");
  const [propertyType, setPropertyType] = useState("RESORT");
  const [markup, setMarkup] = useState("20");
  const [priority, setPriority] = useState("0");
  const [season, setSeason] = useState("");

  const refresh = async () => {
    const [r, a] = await Promise.all([listMarkupRules(), listAgentsWithRates()]);
    setRules(r);
    setAgents(a);
  };

  const addRule = async () => {
    const percent = Number(markup);
    if (Number.isNaN(percent) || percent < 0) {
      toast.error("Enter a valid markup percentage");
      return;
    }
    try {
      await createMarkupRule({
        data: {
          ...(scope === "TYPE" ? { propertyType: propertyType as never } : {}),
          ...(season ? { season } : {}),
          markupPercent: percent,
          priority: Number(priority) || 0,
        },
      });
      toast.success("Markup rule added");
      setMarkup("");
      await refresh();
    } catch (error) {
      toast.error(
        "Could not add rule",
        error instanceof Error ? { description: error.message } : {},
      );
    }
  };

  const toggleActive = async (rule: MarkupRuleDTO) => {
    await updateMarkupRule({ data: { id: rule.id, active: !rule.active } });
    await refresh();
  };

  const remove = async (id: string) => {
    await deleteMarkupRule({ data: id });
    await refresh();
  };

  const saveRate = async (agentId: string, rate: number) => {
    await setAgentCommissionRate({ data: { agentId, rate } });
    toast.success("Commission rate saved");
    await refresh();
  };

  const typeLabels: Record<string, string> = {
    RESORT: "Resort (default 22%)",
    HOTEL: "Hotel (default 22%)",
    GUESTHOUSE: "Guesthouse (default 18%)",
    SAFARI_BOAT: "Safari cruise (default 25%)",
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
            <h1 className="text-4xl">Revenue optimization</h1>
            <p className="mt-2 text-muted-foreground">
              Dynamic markup by property type, supplier or property — plus agent commission rates
            </p>
          </div>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        <div className="mt-6 flex gap-2">
          <Button
            variant={tab === "markup" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("markup")}
          >
            <Percent className="size-4" /> Markup rules
          </Button>
          <Button
            variant={tab === "commissions" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("commissions")}
          >
            <Wallet className="size-4" /> Commission rates
          </Button>
        </div>

        {tab === "markup" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Add markup rule</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                More specific rules override defaults: property &gt; supplier &gt; type.
              </p>
              <div className="mt-4 space-y-3">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={propertyType} onValueChange={(v) => setPropertyType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Markup %</Label>
                  <Input
                    type="number"
                    min={0}
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Priority</Label>
                    <Input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Season (optional)</Label>
                    <Input
                      value={season}
                      placeholder="e.g. High"
                      onChange={(e) => setSeason(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={addRule}>
                  <Plus className="size-4" /> Add rule
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Rules</h2>
              <div className="mt-4 space-y-2">
                {rules.length === 0 && (
                  <p className="text-muted-foreground">
                    No custom rules — defaults apply:{" "}
                    {Object.entries(DEFAULT_MARKUP)
                      .map(([k, v]) => `${k} ${v}%`)
                      .join(" · ")}
                  </p>
                )}
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        <BadgePercent className="mr-1 inline size-3.5" />
                        {r.propertyType ?? "All types"} · {r.markupPercent}%
                        {r.season ? ` · ${r.season}` : ""}
                        <Badge variant={r.active ? "default" : "outline"} className="ml-2">
                          {r.active ? "active" : "paused"}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        priority {r.priority}
                        {r.supplierName ? ` · ${r.supplierName}` : ""}
                        {r.propertyName ? ` · ${r.propertyName}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>
                        {r.active ? "Pause" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "commissions" && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Agent commission rates</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Commission is calculated as a % of the agent's gross profit on their confirmed
              bookings.
            </p>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Commission %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a) => (
                    <CommissionRow key={a.agentId} agent={a} onSave={saveRate} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CommissionRow({
  agent,
  onSave,
}: {
  agent: { agentId: string; name: string; commissionRate: number; role: string };
  onSave: (agentId: string, rate: number) => void;
}) {
  const [rate, setRate] = useState(String(agent.commissionRate));
  return (
    <TableRow>
      <TableCell className="font-medium">{agent.name}</TableCell>
      <TableCell className="text-muted-foreground">{agent.role}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          max={100}
          className="w-24"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={() => onSave(agent.agentId, Number(rate) || 0)}>
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}
