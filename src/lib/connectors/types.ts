/** Normalized inventory output that every supplier connector must produce. */

export type ChannelAvailability = {
  propertyRef: string;
  roomRef: string;
  date: string; // YYYY-MM-DD
  inventory: number;
};

export type ChannelRate = {
  propertyRef: string;
  roomRef: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  amount: number;
  currency?: string;
  season?: string;
};

export type ConnectorSyncOutput = {
  availability: ChannelAvailability[];
  rates: ChannelRate[];
};

export type ConnectorCatalogProperty = {
  propertyRef: string;
  name: string;
  rooms: Array<{ roomRef: string; name: string }>;
};

export type ConnectorCatalog = {
  properties: ConnectorCatalogProperty[];
};

export type ConnectorChannel = {
  baseUrl?: string;
  apiKey?: string;
  config: Record<string, unknown>;
};

/**
 * The contract every supplier connector implements. Real providers (Hotelbeds,
 * WebBeds, RateHawk, DOTW, EPS) plug in here — the rest of BoliFlow only ever
 * sees normalized availability + rates.
 */
export interface SupplierConnector {
  readonly provider: string;
  readonly label: string;
  sync(channel: ConnectorChannel): Promise<ConnectorSyncOutput>;
  /** The provider's property/room catalogue, used to build external→internal mappings. */
  fetchCatalog?(channel: ConnectorChannel): Promise<ConnectorCatalog>;
}
