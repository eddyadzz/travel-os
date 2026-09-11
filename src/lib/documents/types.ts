export type DocumentType =
  "RESORT_VOUCHER" | "TRANSFER_VOUCHER" | "INVOICE" | "CONFIRMATION" | "ROOMING_LIST" | "QUOTE";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RESORT_VOUCHER: "Resort Voucher",
  TRANSFER_VOUCHER: "Transfer Voucher",
  INVOICE: "Invoice",
  CONFIRMATION: "Guest Confirmation",
  ROOMING_LIST: "Rooming List",
  QUOTE: "Travel Quote",
};

export type DocumentBookingData = {
  reference: string;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addons: string[];
  total: number;
  paid: number;
  outstanding: number;
  customerName: string;
  customerEmail: string;
  transfer: { method: string; duration: string };
  boardBasis?: string;
  specialRequests?: string;
  supplierReference?: string;
  portalUrl: string;
};

export type DocumentRow = {
  label: string;
  value: string;
};

export type GeneratedDocument = {
  buffer: Buffer;
  filename: string;
};

export type QuoteDocumentData = {
  reference: string;
  customerName: string;
  customerEmail?: string;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addons: string[];
  breakdown: {
    accommodation: number;
    extraGuests: number;
    transfers: number;
    addons: number;
    total: number;
  };
  validUntil: string;
  bookingLink: string;
  notes?: string;
};
