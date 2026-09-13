// Shared, client-safe types used by both the frontend and the server API.
// These mirror the DB models (via the DTO mappers in src/lib/server) and are
// shaped to match what the UI components already consume.

export type PropertyType = "Resort" | "Hotel" | "Guesthouse" | "Safari Boat";

export type RoomDTO = {
  id: string;
  name: string;
  maxGuests: number;
  baseGuests: number;
  nightlyRate: number;
  extraGuestRate: number;
  boardBasis: string;
  size: string;
  availableUnits: number;
};

export type AddonPricing = "Per Person" | "Per Room" | "Fixed Amount";

export type AddonDTO = {
  id: string;
  name: string;
  description: string;
  pricing: AddonPricing;
  price: number;
  category: string;
};

export type PropertyDTO = {
  id: string;
  slug: string;
  name: string;
  type: PropertyType;
  location: string;
  atoll: string;
  description: string;
  highlights: string[];
  image: string;
  gallery: string[];
  amenities: string[];
  transfer: { method: string; duration: string; pricePerPerson: number };
  featured: boolean;
  rating: number;
  fromPrice: number;
  rooms: RoomDTO[];
  addons: AddonDTO[];
};

export type BookingStatus =
  | "NEW"
  | "ASSIGNED"
  | "PENDING_SUPPLIER"
  | "AWAITING_CUSTOMER"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

export type BookingDTO = {
  id: string;
  reference: string;
  status: BookingStatus;
  trackingToken?: string;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addons: string[];
  total: number;
  customer: { name: string; email: string; phone: string; country: string };
  submittedAt: string;
  specialRequests?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  supplierReference?: string;
  supplierStatus?: string;
};

export type BookingEventDTO = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type BookingNoteDTO = {
  id: string;
  content: string;
  createdAt: string;
};

export type BookingAttachmentDTO = {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
};

export type BookingDetailDTO = BookingDTO & {
  assignedAgent?: { id: string; name: string };
  events: BookingEventDTO[];
  notes: BookingNoteDTO[];
  attachments: BookingAttachmentDTO[];
};

export type AgentDTO = {
  id: string;
  name: string;
};

export type MessageSenderType = "CUSTOMER" | "AGENT" | "SYSTEM";

export type MessageDTO = {
  id: string;
  senderType: MessageSenderType;
  senderName: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
};

export type ConversationDTO = {
  id: string;
  bookingId: string;
  messages: MessageDTO[];
};

export type CreateMessageInput = {
  bookingId: string;
  senderType: MessageSenderType;
  senderName: string;
  message: string;
  isInternal?: boolean;
};

export type NotificationDTO = {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: string;
  createdAt: string;
  bookingId?: string;
};

export type PaymentType = "DEPOSIT" | "BALANCE" | "REFUND";
export type PaymentStatus = "REQUESTED" | "SUBMITTED" | "VERIFIED" | "REJECTED";

export type PaymentProofDTO = {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
};

export type PaymentDTO = {
  id: string;
  bookingId: string;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  proofs: PaymentProofDTO[];
};

export type SupplierType =
  "RESORT" | "HOTEL" | "GUESTHOUSE" | "SAFARI" | "TRANSFER" | "DIVE_CENTER";
export type SupplierStatus = "REQUESTED" | "CONFIRMED" | "DECLINED" | "CANCELLED";

export type SupplierDTO = {
  id: string;
  name: string;
  type: SupplierType;
  email?: string;
  phone?: string;
  contactPerson?: string;
  active: boolean;
};

export type SupplierContactDTO = {
  id: string;
  supplierId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
};

export type ContractRateDTO = {
  id: string;
  supplierId: string;
  roomId?: string;
  validFrom: string;
  validTo: string;
  netRate: number;
};

export type SupplierConfirmationDTO = {
  id: string;
  bookingId: string;
  supplierId: string;
  supplierName: string;
  reference?: string;
  status: SupplierStatus;
  notes?: string;
  confirmedAt?: string;
  createdAt: string;
};

export type BookingCostingDTO = {
  bookingId: string;
  reference: string;
  revenue: number;
  supplierCost: number;
  grossProfit: number;
  marginPercent: number;
};

export type SupplierDashboardDTO = {
  awaitingConfirmation: number;
  confirmed: number;
  pendingResponse: number;
  bySupplier: Array<{ supplierId: string; name: string; count: number }>;
};

// Analytics -----------------------------------------------------------------------------------

export type DateRange = { from: string; to: string };

export type ExecutiveMetricsDTO = {
  revenue: number;
  grossProfit: number;
  bookings: number;
  confirmedBookings: number;
  averageBookingValue: number;
  outstandingPayments: number;
};

export type RevenueAnalyticsDTO = {
  totalRevenue: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  cancelledRevenue: number;
  monthlyTrend: Array<{ month: string; revenue: number; bookings: number }>;
};

export type ProfitAnalyticsDTO = {
  totalRevenue: number;
  totalSupplierCost: number;
  totalProfit: number;
  marginPercent: number;
  monthlyTrend: Array<{ month: string; revenue: number; cost: number; profit: number }>;
};

export type PropertyPerformanceRow = {
  propertyId: string;
  name: string;
  bookings: number;
  revenue: number;
  profit: number;
  averageValue: number;
};

export type SupplierPerformanceRow = {
  supplierId: string;
  name: string;
  bookings: number;
  revenue: number;
  cost: number;
  profit: number;
  confirmed: number;
  declined: number;
  confirmationRate: number;
};

export type AgentPerformanceRow = {
  agentId: string;
  name: string;
  assigned: number;
  confirmed: number;
  cancelled: number;
  revenue: number;
  profit: number;
};

export type SearchFunnelDTO = {
  searches: number;
  searchesWithResults: number;
  bookingRequests: number;
  confirmedBookings: number;
  conversionRate: number;
};

export type PaymentAnalyticsDTO = {
  requested: number;
  submitted: number;
  verified: number;
  verifiedAmount: number;
  outstanding: number;
};

// CRM & Leads -----------------------------------------------------------------------------------

export type LeadSource =
  "WEBSITE" | "WHATSAPP" | "EMAIL" | "PHONE" | "WALK_IN" | "REFERRAL" | "FACEBOOK" | "INSTAGRAM";

export type LeadStatus = "NEW" | "CONTACTED" | "QUOTED" | "FOLLOW_UP" | "WON" | "LOST";

export type LeadDTO = {
  id: string;
  source: LeadSource;
  status: LeadStatus;
  fullName: string;
  email?: string;
  phone?: string;
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  adults: number;
  children: number;
  notes?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  bookingId?: string;
  createdAt: string;
};

export type QuoteDTO = {
  id: string;
  reference?: string;
  token?: string;
  status?: QuoteStatus;
  leadId?: string;
  propertyId?: string;
  roomId?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  customerName?: string;
  customerEmail?: string;
  totalPrice: number;
  validUntil: string;
  notes?: string;
  documentUrl?: string;
  documentFilename?: string;
  bookingLink?: string;
  bookingId?: string;
  createdAt: string;
  leadName?: string;
  propertyName?: string;
};

export type QuoteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "MODIFIED" | "EXPIRED";

export type QuoteEventDTO = {
  id: string;
  quoteId: string;
  type: string;
  message: string;
  createdAt: string;
};

export type QuoteDetailDTO = {
  quote: QuoteDTO;
  propertyName: string;
  roomName: string;
  nights: number;
  breakdown: {
    accommodation: number;
    extraGuests: number;
    transfers: number;
    addons: number;
    total: number;
  };
  addons: string[];
  activity: QuoteEventDTO[];
  expired: boolean;
};

export type AutoQuoteInput = {
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addonIds?: string[];
  leadId?: string;
  customerEmail?: string;
  customerName?: string;
  validUntil: string;
  notes?: string;
};

export type QuoteBreakdownDTO = {
  accommodation: number;
  extraGuests: number;
  transfers: number;
  addons: number;
  markupPercent?: number;
  markup?: number;
  total: number;
};

export type LeadTaskDTO = {
  id: string;
  leadId: string;
  dueAt: string;
  completed: boolean;
  note: string;
  createdAt: string;
};

export type LeadDetailDTO = LeadDTO & {
  quotes: QuoteDTO[];
  tasks: LeadTaskDTO[];
};

export type CreateLeadInput = {
  source: LeadSource;
  fullName: string;
  email?: string;
  phone?: string;
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  notes?: string;
};

export type CrmMetricsDTO = {
  new: number;
  contacted: number;
  quoted: number;
  followUp: number;
  won: number;
  lost: number;
  followUpsDue: number;
};

export type LeadSourceAnalyticsDTO = {
  source: LeadSource;
  leads: number;
  quoted: number;
  bookings: number;
  revenue: number;
};

export type ImportChangeDTO = {
  id: string;
  importJobId: string;
  type: string;
  propertyId: string;
  roomId: string;
  date?: string;
  field: string;
  beforeValue?: string;
  afterValue?: string;
  createdAt: string;
};

export type SupplierUpdateType = "AVAILABILITY" | "RATES";
export type SupplierUpdateStatus = "REQUESTED" | "RECEIVED" | "IMPORTED" | "CANCELLED" | "OVERDUE";

export type SupplierUpdateRequestDTO = {
  id: string;
  supplierId: string;
  supplierName: string;
  type: SupplierUpdateType;
  requestedAt: string;
  dueAt: string;
  status: SupplierUpdateStatus;
  requestedBy?: string;
  notes?: string;
  receivedAt?: string;
  importedAt?: string;
};

export type SupplierUpdateMetricsDTO = {
  pending: number;
  overdue: number;
  receivedToday: number;
  importedToday: number;
};

export type SupplierScorecardRow = {
  supplierId: string;
  name: string;
  total: number;
  avgResponseHours: number;
  overdueCount: number;
  overduePercent: number;
};

export type AutomationLogDTO = {
  id: string;
  type: string;
  targetType: string;
  targetId?: string;
  message: string;
  createdAt: string;
};

export type AutomationRunSummary = {
  depositReminders: number;
  balanceReminders: number;
  supplierReminders: number;
  supplierEscalations: number;
  arrivalSummaries: number;
  vouchersGenerated: number;
  arrivalInstructions: number;
  dailyReportSent: boolean;
  total: number;
};

export type SupplierPortalProperty = {
  id: string;
  name: string;
  slug: string;
  atoll: string;
  island: string;
  rooms: { id: string; name: string; boardBasis?: string | null; maxAdults: number }[];
};

export type SupplierPortalDTO = {
  supplier: { id: string; name: string; type: string; email?: string };
  properties: SupplierPortalProperty[];
  openRequests: number;
  staleProperties: number;
};

export type SupplierPortalAvailabilityRow = {
  roomId: string;
  date: string;
  inventory: number;
  blackedOut: boolean;
};

export type SupplierPortalRateDTO = {
  id: string;
  roomId: string;
  roomName: string;
  propertyId: string;
  propertyName: string;
  validFrom: string;
  validTo: string;
  amount: number;
  currency: string;
  season?: string;
};

export type PromotionDTO = {
  id: string;
  name: string;
  roomId?: string;
  roomName?: string;
  discountType: string;
  value: number;
  validFrom: string;
  validTo: string;
  active: boolean;
};

export type PackageDTO = {
  id: string;
  name: string;
  description?: string;
  price: number;
  validFrom: string;
  validTo: string;
  included: string[];
  active: boolean;
};

export type AllocationDTO = {
  id: string;
  roomId: string;
  roomName: string;
  date: string;
  units: number;
};

export type JobRunDTO = {
  id: string;
  jobKey: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  output?: string;
  error?: string;
};

export type JobDefinitionDTO = {
  key: string;
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  lastRun?: JobRunDTO;
  totalRuns: number;
  successRate: number;
};

export type ReportFilter = { from: string; to: string };

export type PandLRow = {
  reference: string;
  customer: string;
  property: string;
  room: string;
  checkIn: string;
  nights: number;
  status: string;
  revenue: number;
  supplierCost: number;
  grossProfit: number;
  marginPercent: number;
};
export type PandLReport = {
  rows: PandLRow[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginPercent: number;
};

export type OutstandingRow = {
  reference: string;
  customer: string;
  property: string;
  checkIn: string;
  totalPrice: number;
  paid: number;
  outstanding: number;
  status: string;
};
export type OutstandingReport = { rows: OutstandingRow[]; totalOutstanding: number };

export type DepositRow = {
  date: string;
  reference: string;
  customer: string;
  amount: number;
  status: string;
};
export type DepositReport = { rows: DepositRow[]; total: number; count: number };

export type PaymentLedgerRow = {
  date: string;
  reference: string;
  customer: string;
  type: string;
  status: string;
  amount: number;
};
export type PaymentLedgerReport = { rows: PaymentLedgerRow[]; total: number };

export type AgentFinanceRow = {
  agentId: string;
  name: string;
  bookings: number;
  revenue: number;
  profit: number;
  averageValue: number;
  commissionRate: number;
  commission: number;
};
export type AgentFinanceReport = { rows: AgentFinanceRow[] };

export type FinanceDashboardDTO = {
  pandl: PandLReport;
  outstanding: OutstandingReport;
  deposits: DepositReport;
  ledger: PaymentLedgerReport;
  agents: AgentFinanceReport;
};

export type ExportResult = { filename: string; content: string };
export type ExcelExportResult = { filename: string; base64: string };

export type FinanceReportType = "P&L" | "OUTSTANDING" | "DEPOSITS" | "LEDGER" | "AGENTS";
export type AccountingFormat = "QUICKBOOKS" | "XERO";

export type TenantBrandingDTO = {
  tenantId: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  emailFrom?: string;
};

export type InboundEmailInput = {
  to: string;
  from?: string;
  subject?: string;
  body?: string;
};

export type InboundEmailResult =
  | { linked: true; bookingId: string; reference: string; sender: string }
  | { linked: false; reason: string };

export type SupplierInsightRow = {
  supplierId: string;
  name: string;
  score: number;
  tier: "Reliable" | "Needs Attention" | "At Risk";
  confirmationRate: number | null;
  avgResponseHours: number | null;
  cancellationRate: number | null;
  bookingVolume: number;
  revenue: number;
  profit: number;
  openRequests: number;
  contractExpiryDays: number | null;
  contractNetRate: number | null;
};

export type SupplierScorecardsSummary = {
  reliable: number;
  needsAttention: number;
  atRisk: number;
  renewalDue: number;
  total: number;
};

export type RevenueForecastDTO = {
  windowDays: number;
  confirmedRevenue: number;
  pipelineRevenue: number;
  expectedCollections: number;
  expectedProfit: number;
  projectedMarginPercent: number;
  monthly: Array<{ month: string; confirmed: number; expected: number }>;
};

export type BookingForecastDTO = {
  openQuotes: number;
  quoteConversionRate: number;
  expectedConfirmations: number;
  expectedCancellations: number;
  pipelineBookings: number;
};

export type LeadIntelligenceRow = {
  source: string;
  leads: number;
  quoteRate: number;
  conversionRate: number;
  avgBookingValue: number;
  expectedRevenue: number;
};

export type LeadIntelligenceDTO = {
  bySource: LeadIntelligenceRow[];
  bestSource: string | null;
  overallConversionRate: number;
  avgLeadValue: number;
};

export type SupplierRiskRow = {
  supplierId: string;
  name: string;
  avgResponseHours: number | null;
  recentResponseHours: number | null;
  responseTrend: "improving" | "stable" | "slowing";
  contractExpiryDays: number | null;
  atRisk: boolean;
};

export type PredictiveDashboardDTO = {
  revenue: RevenueForecastDTO;
  bookings: BookingForecastDTO;
  leads: LeadIntelligenceDTO;
  supplierRisks: SupplierRiskRow[];
};

export type CommandCenterDTO = {
  month: string;
  monthRevenue: { expected: number; confirmed: number; profit: number };
  attention: {
    newLeads: number;
    openQuotes: number;
    overdueDeposits: number;
    supplierRequests: number;
    atRiskSuppliers: number;
    renewingContracts: number;
  };
  leads: Array<{ id: string; fullName: string; source: string; status: string; createdAt: string }>;
  overdueDeposits: Array<{
    paymentId: string;
    reference: string;
    customer: string;
    amount: number;
    ageDays: number;
  }>;
  arrivals: Array<{
    reference: string;
    customer: string;
    property: string;
    checkIn: string;
    nights: number;
    status: string;
  }>;
  contractsRenewing: Array<{ supplierId: string; name: string; expiryDays: number }>;
  agents: Array<{
    agentId: string;
    name: string;
    bookings: number;
    revenue: number;
    profit: number;
    commission: number;
  }>;
};

export type PropertyRecommendation = {
  propertyId: string;
  name: string;
  type: string;
  atoll: string;
  nightlyRate: number;
  estimatedTotal: number;
  markupPercent: number;
  fitScore: number;
  reasons: string[];
};

export type SalesRecommendation = {
  recommendations: PropertyRecommendation[];
  quoteDraft: string;
  suggestion: string;
};

export type AssistantAdviceItem = {
  type: "supplier-followup" | "contract-renewal" | "deposit-followup";
  title: string;
  detail: string;
  draft: string;
  targetId?: string;
};

export type OperationsAdvice = {
  items: AssistantAdviceItem[];
  summary: string;
};

export type ScoredLead = {
  leadId: string;
  fullName: string;
  source: string;
  status: string;
  conversionProbability: number;
  expectedValue: number;
  reason: string;
};

export type ManagementAnswer = {
  question: string;
  answer: string;
  detail?: string;
};

export type DeployCheckItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type BackupInfo = {
  filename: string;
  sizeBytes: number;
  tables: number;
  rows: number;
  createdAt: string;
};

export type OnboardingChecklist = {
  steps: Array<{ key: string; label: string; done: boolean; detail: string }>;
  progress: number;
};

export type SiteContentData = {
  heroEyebrow?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  heroCtaLabel?: string;
  heroCtaTarget?: string;
  heroCtas?: Array<{ label: string; target: string }>;
  featuredPropertySlugs?: string[];
  testimonials?: Array<{ name: string; quote: string; role?: string }>;
  aboutSummary?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  socialLinks?: Record<string, string>;
  emailSenderName?: string;
  emailSignature?: string;
  quoteFooter?: string;
  voucherFooter?: string;
  invoiceFooter?: string;
  seoTitleTemplate?: string;
  seoDescriptionTemplate?: string;
  ogImageUrl?: string;
  marketingBlocks?: {
    belowHero?: MarketingBlock;
    aboveFooter?: MarketingBlock;
  };
  videoAds?: VideoAd[];
  specialOffers?: SpecialOffer[];
};

export type MarketingBlock = {
  enabled: boolean;
  title: string;
  subtitle?: string;
  image?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  backgroundColor?: string;
  openInNewTab?: boolean;
  startDate?: string;
  endDate?: string;
};

export type VideoAd = {
  title: string;
  videoUrl: string;
  linkUrl?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
};

export type SpecialOffer = {
  title: string;
  subtitle?: string;
  property?: string;
  description?: string;
  offerPeriod?: string;
  discount?: string;
  image?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
};

export type PublicSiteDTO = {
  content: SiteContentData;
  branding: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    emailFrom?: string;
  };
};

export type CmsPageDTO = {
  id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder: number;
  updatedAt: string;
};

// Availability Operations Center ----------------------------------------------------------------

export type AvailabilityHealthRow = {
  propertyId: string;
  name: string;
  status: "FRESH" | "NEEDS_UPDATE" | "EXPIRED" | "NO_DATA";
  lastImportedAt?: string;
  daysSince?: number;
};

export type AvailabilityHealthDTO = {
  totalProperties: number;
  fresh: number;
  needsUpdate: number;
  expired: number;
  noData: number;
  rows: AvailabilityHealthRow[];
};

export type ExpiringRateDTO = {
  rateId: string;
  propertyName: string;
  roomName: string;
  amount: number;
  validTo: string;
  daysRemaining: number;
};

export type RoomCalendarDay = {
  date: string;
  inventory: number | null;
  status: "AVAILABLE" | "LOW" | "SOLD_OUT" | "NO_DATA";
};

export type RoomCalendarDTO = {
  roomId: string;
  roomName: string;
  propertyName: string;
  days: RoomCalendarDay[];
};

export type CreatePaymentInput = {
  bookingId: string;
  type: PaymentType;
  amount: number;
  paymentMethod?: string;
  notes?: string;
};

export type BookingBalanceDTO = {
  bookingId: string;
  reference: string;
  bookingTotal: number;
  paymentsVerified: number;
  outstandingBalance: number;
  payments: PaymentDTO[];
};

export type CreateBookingInput = {
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addonIds: string[];
  customer: { fullName: string; email: string; phone: string; country: string };
  specialRequests?: string;
};
