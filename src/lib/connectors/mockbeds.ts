import { db } from "@/lib/db.server";
import { getDefaultTenantId } from "@/lib/tenant-context";
import type {
  ChannelAvailability,
  ChannelRate,
  ConnectorCatalog,
  ConnectorChannel,
  ConnectorSyncOutput,
  SupplierConnector,
} from "@/lib/connectors/types";

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function isoOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** External refs are prefixed so a real mapping is required/overridable, with a decode fallback for MockBeds. */
export const MB_PROP_PREFIX = "mb-p-";
export const MB_ROOM_PREFIX = "mb-r-";

type CatalogProperty = {
  propertyId: string;
  propertyName: string;
  type: string;
  atoll: string;
  supplierId: string | null;
  transferPricePerPerson: number;
  rating: number;
  highlights: string[];
  amenities: string[];
  rooms: Array<{ id: string; name: string; maxAdults: number; extraGuestRate: number | null }>;
};

async function loadTenantCatalog(channel: ConnectorChannel): Promise<CatalogProperty[]> {
  const tenantId = channel.config["tenantId"] as string | undefined;
  const properties = await db.property.findMany({
    where: { ...(tenantId ? { tenantId } : {}) },
    include: {
      rooms: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, maxAdults: true, extraGuestRate: true },
      },
    },
  });
  if (properties.length === 0) throw new Error("No properties available to sync.");
  return properties.map((p) => ({
    propertyId: p.id,
    propertyName: p.name,
    type: p.type,
    atoll: p.atoll,
    supplierId: p.supplierId,
    transferPricePerPerson: Number(p.transferPricePerPerson),
    rating: Number(p.rating),
    highlights: p.highlights,
    amenities: p.amenities,
    rooms: p.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      maxAdults: r.maxAdults,
      extraGuestRate: r.extraGuestRate ? Number(r.extraGuestRate) : null,
    })),
  }));
}

/**
 * A deterministic simulated hotel-beds provider used to prove the connector
 * framework end-to-end (auth → fetch → normalize → map → upsert) without live
 * vendor credentials. It generates 90 days of availability and a rate window
 * for every room of the tenant's properties, keyed by external refs.
 */
export const mockBedsConnector: SupplierConnector = {
  provider: "MOCKBEDS",
  label: "MockBeds (simulated)",
  async fetchCatalog(channel: ConnectorChannel): Promise<ConnectorCatalog> {
    const properties = await loadTenantCatalog(channel);
    return {
      properties: properties.map((p) => ({
        propertyRef: `${MB_PROP_PREFIX}${p.propertyId}`,
        name: p.propertyName,
        rooms: p.rooms.map((r) => ({ roomRef: `${MB_ROOM_PREFIX}${r.id}`, name: r.name })),
      })),
    };
  },
  async sync(channel: ConnectorChannel): Promise<ConnectorSyncOutput> {
    const properties = await loadTenantCatalog(channel);
    const basePrice =
      typeof channel.config["basePrice"] === "number" ? channel.config["basePrice"] : 300;

    const availability: ChannelAvailability[] = [];
    const rates: ChannelRate[] = [];

    for (const property of properties) {
      for (const room of property.rooms) {
        const nightly = basePrice + (hash(room.id) % 600);
        rates.push({
          propertyRef: `${MB_PROP_PREFIX}${property.propertyId}`,
          roomRef: `${MB_ROOM_PREFIX}${room.id}`,
          validFrom: isoOffset(1),
          validTo: isoOffset(120),
          amount: nightly,
          currency: "USD",
          season: "Channel",
        });
        for (let d = 1; d <= 90; d++) {
          const seed = hash(`${room.id}:${isoOffset(d)}`);
          const inventory = seed % 9 === 0 ? 0 : 3 + (seed % 7);
          availability.push({
            propertyRef: `${MB_PROP_PREFIX}${property.propertyId}`,
            roomRef: `${MB_ROOM_PREFIX}${room.id}`,
            date: isoOffset(d),
            inventory,
          });
        }
      }
    }

    return { availability, rates };
  },
};

export const connectorRegistry: Record<string, SupplierConnector> = {
  MOCKBEDS: mockBedsConnector,
};

export async function getChannelTenantId(channelTenantId: string | null): Promise<string> {
  return channelTenantId ?? (await getDefaultTenantId());
}
