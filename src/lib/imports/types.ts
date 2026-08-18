// Shared types for the supplier import engine. The pipeline is:
//   Parser (xlsx -> raw rows) -> Mapper (header aliases -> normalized)
//   -> Validator (against DB, resolves ids) -> Importer (persist + ImportJob).

export type MappedRateRow = {
  rowNumber: number;
  propertyName: string;
  roomName: string;
  validFrom: string | null;
  validTo: string | null;
  amount: number | null;
  season?: string;
  currency?: string;
};

export type MappedAvailabilityRow = {
  rowNumber: number;
  propertyName: string;
  roomName: string;
  date: string | null;
  inventory: number | null;
};

export type ImportRowError = { rowNumber: number; message: string };

export type ValidRateRow = {
  rowNumber: number;
  propertyName: string;
  roomName: string;
  validFrom: string;
  validTo: string;
  amount: number;
  season?: string;
  currency: string;
  propertyId: string;
  roomId: string;
};

export type ValidAvailabilityRow = {
  rowNumber: number;
  propertyName: string;
  roomName: string;
  date: string;
  inventory: number;
  propertyId: string;
  roomId: string;
};

export type RatePreview = {
  type: "RATES";
  filename: string;
  totalRows: number;
  validRows: ValidRateRow[];
  errors: ImportRowError[];
};

export type AvailabilityPreview = {
  type: "AVAILABILITY";
  filename: string;
  totalRows: number;
  validRows: ValidAvailabilityRow[];
  errors: ImportRowError[];
};

export type ImportJobDTO = {
  id: string;
  type: "RATES" | "AVAILABILITY";
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  errorCount: number;
};

export class ImportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFormatError";
  }
}
