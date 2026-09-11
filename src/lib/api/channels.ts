import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import {
  connectorRegistry,
  getChannelTenantId,
  MB_PROP_PREFIX,
  MB_ROOM_PREFIX,
} from "@/lib/connectors/mockbeds";
import type { ChannelAvailability, ChannelRate, ConnectorCatalog } from "@/lib/connectors/types";

export type ChannelConfig = Record<string, string | number | boolean>;

export type ChannelDTO = {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  config?: ChannelConfig;
  enabled: boolean;
  syncStatus?: string;
  lastSyncAt?: string;
  lastResult?: string;
  lastError?: string;
  createdAt: string;
};

function toDTO(c: {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  config: unknown;
  enabled: boolean;
  syncStatus: string | null;
  lastSyncAt: Date | null;
  lastResult: string | null;
  lastError: string | null;
  createdAt: Date;
}): ChannelDTO {
  return {
    id: c.id,
    name: c.name,
    provider: c.provider,
    ...(c.baseUrl ? { baseUrl: c.baseUrl } : {}),
    ...(c.config && typeof c.config === "object" ? { config: c.config as ChannelConfig } : {}),
    enabled: c.enabled,
    ...(c.syncStatus ? { syncStatus: c.syncStatus } : {}),
    ...(c.lastSyncAt ? { lastSyncAt: c.lastSyncAt.toISOString() } : {}),
    ...(c.lastResult ? { lastResult: c.lastResult } : {}),
    ...(c.lastError ? { lastError: c.lastError } : {}),
    createdAt: c.createdAt.toISOString(),
  };
}

export const listChannels = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChannelDTO[]> => {
    const rows = await db.supplierChannel.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDTO);
  },
);

export const createChannel = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      config?: ChannelConfig;
    }) => input,
  )
  .handler(async ({ data }) => {
    const provider = data.provider ?? "MOCKBEDS";
    if (!connectorRegistry[provider]) throw new Error(`Unknown provider: ${provider}`);
    const channel = await db.supplierChannel.create({
      data: {
        name: data.name.trim(),
        provider,
        ...(data.baseUrl ? { baseUrl: data.baseUrl } : {}),
        ...(data.apiKey ? { apiKey: data.apiKey } : {}),
        ...(data.config ? { config: data.config as object } : {}),
      },
    });
    return toDTO(channel);
  });

export const setChannelEnabled = createServerFn({ method: "POST" })
  .validator((input: { id: string; enabled: boolean }) => input)
  .handler(async ({ data }) => {
    const channel = await db.supplierChannel.update({
      where: { id: data.id },
      data: { enabled: data.enabled },
    });
    return toDTO(channel);
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.supplierChannel.delete({ where: { id } });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// External → internal property/room mapping
// ---------------------------------------------------------------------------

type MappingTarget = { propertyId: string; roomId: string } | null;

async function buildMappingResolver(channelId: string) {
  const mappings = await db.channelMapping.findMany({ where: { channelId, active: true } });
  const mapByKey = new Map<string, MappingTarget>();
  for (const m of mappings) {
    mapByKey.set(`${m.externalPropertyRef}|${m.externalRoomRef ?? ""}`, {
      propertyId: m.internalPropertyId,
      roomId: m.internalRoomId ?? "",
    });
  }
  const rooms = await db.room.findMany({ select: { id: true, propertyId: true } });
  const roomToProperty = new Map(rooms.map((r) => [r.id, r.propertyId]));

  return (propertyRef: string, roomRef: string): MappingTarget => {
    // 1. Ref is already an internal room id.
    if (roomRef && roomToProperty.has(roomRef)) {
      return { propertyId: roomToProperty.get(roomRef)!, roomId: roomRef };
    }
    // 2. Explicit mapping.
    const mapped = mapByKey.get(`${propertyRef}|${roomRef}`);
    if (mapped && mapped.roomId && roomToProperty.has(mapped.roomId)) return mapped;
    // 3. MockBeds decode fallback: mb-r-<internalId>.
    if (roomRef.startsWith(MB_ROOM_PREFIX)) {
      const id = roomRef.slice(MB_ROOM_PREFIX.length);
      if (roomToProperty.has(id)) return { propertyId: roomToProperty.get(id)!, roomId: id };
    }
    return null;
  };
}

async function resolveMappedRows(
  channelId: string,
  availability: ChannelAvailability[],
  rates: ChannelRate[],
): Promise<{
  availability: ChannelAvailability[];
  rates: ChannelRate[];
  mapped: number;
  unmapped: number;
}> {
  const resolve = await buildMappingResolver(channelId);
  const outAvailability: ChannelAvailability[] = [];
  const outRates: ChannelRate[] = [];
  let mapped = 0;
  let unmapped = 0;

  for (const a of availability) {
    const target = resolve(a.propertyRef, a.roomRef);
    if (!target) {
      unmapped += 1;
      continue;
    }
    outAvailability.push({ ...a, propertyRef: target.propertyId, roomRef: target.roomId });
    mapped += 1;
  }
  for (const r of rates) {
    const target = resolve(r.propertyRef, r.roomRef);
    if (!target) {
      unmapped += 1;
      continue;
    }
    outRates.push({ ...r, propertyRef: target.propertyId, roomRef: target.roomId });
    mapped += 1;
  }
  return { availability: outAvailability, rates: outRates, mapped, unmapped };
}

export type ChannelMappingDTO = {
  id: string;
  channelId: string;
  externalPropertyRef: string;
  externalRoomRef?: string;
  internalPropertyId: string;
  internalRoomId?: string;
  active: boolean;
};

function toMappingDTO(m: {
  id: string;
  channelId: string;
  externalPropertyRef: string;
  externalRoomRef: string | null;
  internalPropertyId: string;
  internalRoomId: string | null;
  active: boolean;
}): ChannelMappingDTO {
  return {
    id: m.id,
    channelId: m.channelId,
    externalPropertyRef: m.externalPropertyRef,
    ...(m.externalRoomRef ? { externalRoomRef: m.externalRoomRef } : {}),
    internalPropertyId: m.internalPropertyId,
    ...(m.internalRoomId ? { internalRoomId: m.internalRoomId } : {}),
    active: m.active,
  };
}

export const getChannelMappingData = createServerFn({ method: "GET" })
  .validator((channelId: string) => channelId)
  .handler(async ({ data: channelId }) => {
    const channel = await db.supplierChannel.findUnique({ where: { id: channelId } });
    if (!channel) return null;
    const connector = connectorRegistry[channel.provider];
    const connectorChannel = {
      ...(channel.baseUrl ? { baseUrl: channel.baseUrl } : {}),
      ...(channel.apiKey ? { apiKey: channel.apiKey } : {}),
      config: (channel.config ?? {}) as Record<string, unknown>,
    };
    const catalog: ConnectorCatalog = connector?.fetchCatalog
      ? await connector.fetchCatalog(connectorChannel)
      : { properties: [] };
    const [internalProperties, mappings] = await Promise.all([
      db.property.findMany({
        select: { id: true, name: true, atoll: true, rooms: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      }),
      db.channelMapping.findMany({ where: { channelId } }),
    ]);
    return {
      provider: channel.provider,
      channelName: channel.name,
      catalog,
      internalProperties,
      mappings: mappings.map(toMappingDTO),
    };
  });

export const saveChannelMapping = createServerFn({ method: "POST" })
  .validator(
    (input: {
      channelId: string;
      externalPropertyRef: string;
      externalRoomRef: string;
      internalPropertyId: string;
      internalRoomId: string;
      active?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const mapping = await db.channelMapping.upsert({
      where: {
        channelId_externalPropertyRef_externalRoomRef: {
          channelId: data.channelId,
          externalPropertyRef: data.externalPropertyRef,
          externalRoomRef: data.externalRoomRef,
        },
      },
      create: {
        channelId: data.channelId,
        externalPropertyRef: data.externalPropertyRef,
        externalRoomRef: data.externalRoomRef,
        internalPropertyId: data.internalPropertyId,
        internalRoomId: data.internalRoomId,
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
      update: {
        internalPropertyId: data.internalPropertyId,
        internalRoomId: data.internalRoomId,
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
    return toMappingDTO(mapping);
  });

export const deleteChannelMapping = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.channelMapping.delete({ where: { id } });
    return { ok: true };
  });

async function upsertAvailability(tenantId: string, rows: ChannelAvailability[]) {
  let created = 0;
  let updated = 0;
  for (const a of rows) {
    const date = new Date(`${a.date}T00:00:00.000Z`);
    const existing = await db.availability.findUnique({
      where: { roomId_date: { roomId: a.roomRef, date } },
    });
    await db.availability.upsert({
      where: { roomId_date: { roomId: a.roomRef, date } },
      create: {
        propertyId: a.propertyRef,
        roomId: a.roomRef,
        date,
        inventory: a.inventory,
        tenantId,
      },
      update: { inventory: a.inventory },
    });
    if (existing) updated += 1;
    else created += 1;
  }
  return { created, updated };
}

async function upsertRates(rows: ChannelRate[]) {
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const validFrom = new Date(`${r.validFrom}T00:00:00.000Z`);
    const validTo = new Date(`${r.validTo}T00:00:00.000Z`);
    const existing = await db.rate.findFirst({
      where: { roomId: r.roomRef, validFrom, validTo },
    });
    if (existing) {
      await db.rate.update({
        where: { id: existing.id },
        data: { amount: r.amount, ...(r.season ? { season: r.season } : {}) },
      });
      updated += 1;
    } else {
      await db.rate.create({
        data: {
          propertyId: r.propertyRef,
          roomId: r.roomRef,
          validFrom,
          validTo,
          amount: r.amount,
          ...(r.currency ? { currency: r.currency } : {}),
          ...(r.season ? { season: r.season } : {}),
        },
      });
      created += 1;
    }
  }
  return { created, updated };
}

/** Pull live inventory from a provider and write it into BoliFlow. */
export async function syncChannel(channelId: string) {
  const channel = await db.supplierChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error("Channel not found.");

  const connector = connectorRegistry[channel.provider];
  if (!connector) throw new Error(`No connector registered for provider ${channel.provider}.`);

  await db.supplierChannel.update({ where: { id: channelId }, data: { syncStatus: "SYNCING" } });

  try {
    const output = await connector.sync({
      ...(channel.baseUrl ? { baseUrl: channel.baseUrl } : {}),
      ...(channel.apiKey ? { apiKey: channel.apiKey } : {}),
      config: (channel.config ?? {}) as Record<string, unknown>,
    });
    const tenantId = await getChannelTenantId(channel.tenantId);

    // Resolve every external ref to an internal room/property via mappings.
    const resolved = await resolveMappedRows(channel.id, output.availability, output.rates);
    const avail = await upsertAvailability(tenantId, resolved.availability);
    const rates = await upsertRates(resolved.rates);

    // Audit trail via the import pipeline.
    const written = avail.created + avail.updated + rates.created + rates.updated;
    await db.importJob.create({
      data: {
        type: "AVAILABILITY",
        filename: `${channel.name} — live sync`,
        status: "COMPLETED",
        totalRows: output.availability.length + output.rates.length,
        successRows: written,
        createdBy: `channel:${channel.name}`,
      },
    });

    const result = `Mapped ${resolved.mapped} · Unmapped ${resolved.unmapped} · Wrote ${written} rows (${avail.created + avail.updated} availability, ${rates.created + rates.updated} rates)`;
    await db.supplierChannel.update({
      where: { id: channelId },
      data: { syncStatus: "SUCCESS", lastSyncAt: new Date(), lastResult: result, lastError: null },
    });
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.supplierChannel.update({
      where: { id: channelId },
      data: { syncStatus: "FAILED", lastError: message },
    });
    throw error;
  }
}

export const syncChannelFn = createServerFn({ method: "POST" })
  .validator((channelId: string) => channelId)
  .handler(async ({ data: channelId }) => syncChannel(channelId));
