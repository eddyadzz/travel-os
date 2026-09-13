import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useState } from "react";
import { toast } from "sonner";
import { PlugZap, Plus, RefreshCw, Trash2, Radio, Power, Wifi, GitBranch } from "lucide-react";
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
  createChannel,
  deleteChannel,
  getChannelMappingData,
  listChannels,
  saveChannelMapping,
  setChannelEnabled,
  syncChannelFn,
  type ChannelDTO,
  type ChannelMappingDTO,
} from "@/lib/api/channels";
import type { ConnectorCatalog } from "@/lib/connectors/types";

export const Route = createFileRoute("/connectors")({
  beforeLoad: requireAuth,
  loader: async () => listChannels(),
  head: () => ({
    meta: [{ title: "Supplier Channels | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: ChannelsPage,
});

function statusBadge(status?: string) {
  if (status === "SUCCESS")
    return (
      <Badge className="bg-success text-success-foreground">
        <Wifi className="size-3" /> Live
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="destructive">
        <Radio className="size-3" /> Failed
      </Badge>
    );
  if (status === "SYNCING") return <Badge variant="outline">Syncing…</Badge>;
  return <Badge variant="outline">Never synced</Badge>;
}

function ChannelsPage() {
  const initial = Route.useLoaderData();
  const [channels, setChannels] = useState<ChannelDTO[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [basePrice, setBasePrice] = useState("300");
  const [mappingChannel, setMappingChannel] = useState<ChannelDTO | null>(null);
  const [mappingData, setMappingData] = useState<{
    catalog: ConnectorCatalog;
    internalProperties: Array<{
      id: string;
      name: string;
      atoll: string;
      rooms: Array<{ id: string; name: string }>;
    }>;
    mappings: ChannelMappingDTO[];
  } | null>(null);

  const refresh = async () => setChannels(await listChannels());

  const openMap = async (channel: ChannelDTO) => {
    setBusy(channel.id);
    try {
      const data = await getChannelMappingData({ data: channel.id });
      if (data) {
        setMappingData(data);
        setMappingChannel(channel);
      } else {
        toast.error("Channel not found");
      }
    } finally {
      setBusy(null);
    }
  };

  const mappingFor = (propertyRef: string, roomRef: string) =>
    mappingData?.mappings.find(
      (m) => m.externalPropertyRef === propertyRef && m.externalRoomRef === roomRef,
    );

  const saveMap = async (propertyRef: string, roomRef: string, internalRoomId: string) => {
    if (!mappingData || !mappingChannel) return;
    const prop = mappingData.internalProperties.find((p) =>
      p.rooms.some((r) => r.id === internalRoomId),
    );
    if (!prop) return;
    await saveChannelMapping({
      data: {
        channelId: mappingChannel.id,
        externalPropertyRef: propertyRef,
        externalRoomRef: roomRef,
        internalPropertyId: prop.id,
        internalRoomId,
      },
    });
    await openMap(mappingChannel);
    toast.success("Mapping saved");
  };

  const add = async () => {
    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }
    try {
      await createChannel({
        data: {
          name: name.trim(),
          provider: "MOCKBEDS",
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
          config: { basePrice: Number(basePrice) || 300 },
        },
      });
      toast.success("Channel created");
      setShowAdd(false);
      setName("");
      setBaseUrl("");
      await refresh();
    } catch (error) {
      toast.error(
        "Could not create channel",
        error instanceof Error ? { description: error.message } : {},
      );
    }
  };

  const sync = async (id: string, channelName: string) => {
    setBusy(id);
    try {
      const r = await syncChannelFn({ data: id });
      await refresh();
      toast.success(`${channelName} synced — ${r.result}`);
    } catch (error) {
      await refresh();
      toast.error(
        `${channelName} sync failed`,
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    await setChannelEnabled({ data: { id, enabled } });
    await refresh();
  };

  const remove = async (id: string) => {
    await deleteChannel({ data: id });
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
              <PlugZap className="size-8 text-primary" /> Supplier channels
            </h1>
            <p className="mt-2 text-muted-foreground">
              Live inventory via supplier APIs — each connector normalizes availability & rates into
              BoliFlow
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button onClick={() => setShowAdd((s) => !s)}>
              <Plus className="size-4" /> Add channel
            </Button>
          </div>
        </div>

        {showAdd && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Add a MockBeds channel (simulated provider)</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Channel name</Label>
                <Input
                  value={name}
                  placeholder="Velaa Direct API"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Base URL (optional)</Label>
                <Input
                  value={baseUrl}
                  placeholder="https://api.mockbeds.test/v2"
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Base price (USD)</Label>
                <Input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={add}>
              <Plus className="size-4" /> Create channel
            </Button>
          </div>
        )}

        {mappingChannel && mappingData && (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Map rooms · {mappingChannel.name}</h2>
              <Button size="sm" variant="outline" onClick={() => setMappingChannel(null)}>
                Close
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Map the provider's external rooms to your internal catalogue. Unmapped rows are
              skipped during sync.
            </p>
            <div className="mt-4 space-y-4">
              {mappingData.catalog.properties.map((property) => (
                <div key={property.propertyRef} className="rounded-xl border p-4">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="font-mono text-xs text-muted-foreground">
                      {property.propertyRef}
                    </span>
                    {property.name}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {property.rooms.map((room) => {
                      const existing = mappingFor(property.propertyRef, room.roomRef);
                      return (
                        <div
                          key={room.roomRef}
                          className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {room.roomRef}
                          </span>
                          <span className="w-40">{room.name}</span>
                          <select
                            className="h-8 flex-1 rounded-md border bg-background px-2"
                            value={existing?.internalRoomId ?? ""}
                            onChange={(e) =>
                              saveMap(property.propertyRef, room.roomRef, e.target.value)
                            }
                          >
                            <option value="">— unmapped —</option>
                            {mappingData.internalProperties.flatMap((p) =>
                              p.rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {p.name} · {r.name}
                                </option>
                              )),
                            )}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No channels yet — add a MockBeds channel to see live sync in action.
                    </TableCell>
                  </TableRow>
                )}
                {channels.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.provider}</TableCell>
                    <TableCell>{statusBadge(c.syncStatus)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {c.lastResult ?? c.lastError ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          onClick={() => sync(c.id, c.name)}
                          disabled={busy !== null}
                        >
                          {busy === c.id ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <Radio className="size-4" />
                          )}
                          Sync
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openMap(c)}>
                          <GitBranch className="size-4" /> Map
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggle(c.id, !c.enabled)}
                        >
                          <Power className="size-4" /> {c.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
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
