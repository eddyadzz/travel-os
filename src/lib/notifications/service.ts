import { db } from "@/lib/db.server";
import { emailTemplates } from "./templates";
import { processEmail } from "./queue";
import { money } from "@/lib/pricing";
import type { Prisma } from "@/generated/prisma/client";

export type NotificationType =
  | "STATUS_CHANGED"
  | "NEW_MESSAGE"
  | "ATTACHMENT_ADDED"
  | "PAYMENT_REQUEST"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "AGENT_MESSAGE"
  | "SUPPLIER_UPDATE";

/**
 * Deep link to the customer portal. The tracking token is the secret that
 * authorises access, so every email uses it.
 */
export function customerDeepLink(opts: { reference: string; token: string; path?: string }) {
  const base = `/track/${opts.reference}?token=${opts.token}`;
  return opts.path ? `${base}#${opts.path}` : base;
}

export function agentDeepLink(opts: { bookingId: string }) {
  return `/agent/bookings/${opts.bookingId}`;
}

export type CreateNotificationInput = {
  bookingId?: string;
  type: NotificationType;
  recipient: string;
  subject: string;
  body: string;
  deepLink?: string;
};

/**
 * Creates a Notification record and attempts delivery. The record is always
 * persisted (for auditability) regardless of delivery outcome.
 */
export async function sendNotification(
  input: CreateNotificationInput,
): Promise<{ id: string; status: string }> {
  const notification = await db.notification.create({
    data: {
      ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      type: input.type,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      ...(input.deepLink ? { deepLink: input.deepLink } : {}),
      status: "PENDING",
    },
  });

  try {
    await processEmail({ to: input.recipient, subject: input.subject, html: input.body });
    const updated = await db.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { id: updated.id, status: updated.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated = await db.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", error: message },
    });
    return { id: updated.id, status: updated.status };
  }
}

/**
 * Fetches the data needed to build notification emails for a booking.
 * Returns the booking plus its tracking token and customer email.
 */
async function loadBookingContext(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
}

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  recipient: string;
  subject: string;
  status: string;
  createdAt: string;
  bookingId?: string;
};

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  recipient: true,
  subject: true,
  status: true,
  createdAt: true,
  bookingId: true,
} satisfies Prisma.NotificationSelect;

function toDTO(
  n: Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>,
): NotificationDTO {
  return {
    id: n.id,
    type: n.type as NotificationType,
    recipient: n.recipient,
    subject: n.subject,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    ...(n.bookingId ? { bookingId: n.bookingId } : {}),
  };
}

export const listRecentNotifications = async (limit = 20): Promise<NotificationDTO[]> => {
  const notifications = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: NOTIFICATION_SELECT,
  });
  return notifications.map(toDTO);
};

export type { Prisma };

// Convenience builders for the common notification flows ----------------------------------

export async function notifyStatusChanged(opts: { bookingId: string; statusLabel: string }) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking || !booking.customer.emailNotifications) return;
  const template = emailTemplates.statusChanged({
    reference: booking.reference,
    label: opts.statusLabel,
    link: customerDeepLink({ reference: booking.reference, token: booking.trackingToken }),
  });
  return sendNotification({
    bookingId: booking.id,
    type: "STATUS_CHANGED",
    recipient: booking.customer.email,
    subject: template.subject,
    body: template.html,
    deepLink: customerDeepLink({ reference: booking.reference, token: booking.trackingToken }),
  });
}

export async function notifyCustomerMessage(opts: { bookingId: string; senderName: string }) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking || !booking.customer.emailNotifications) return;
  const link = customerDeepLink({ reference: booking.reference, token: booking.trackingToken });
  const template = emailTemplates.customerNewMessage({
    reference: booking.reference,
    senderName: opts.senderName,
    link,
  });
  return sendNotification({
    bookingId: booking.id,
    type: "NEW_MESSAGE",
    recipient: booking.customer.email,
    subject: template.subject,
    body: template.html,
    deepLink: link,
  });
}

export async function notifyAttachmentAdded(opts: { bookingId: string; filename: string }) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking || !booking.customer.emailNotifications) return;
  const link = customerDeepLink({ reference: booking.reference, token: booking.trackingToken });
  const template = emailTemplates.attachmentAdded({
    reference: booking.reference,
    filename: opts.filename,
    link,
  });
  return sendNotification({
    bookingId: booking.id,
    type: "ATTACHMENT_ADDED",
    recipient: booking.customer.email,
    subject: template.subject,
    body: template.html,
    deepLink: link,
  });
}

export async function notifyAgentCustomerMessage(opts: {
  bookingId: string;
  customerName: string;
  message: string;
  agentEmail: string;
}) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking) return;
  const link = agentDeepLink({ bookingId: booking.id });
  const template = emailTemplates.agentCustomerMessage({
    reference: booking.reference,
    customerName: opts.customerName,
    message: opts.message,
    link,
  });
  return sendNotification({
    bookingId: booking.id,
    type: "AGENT_MESSAGE",
    recipient: opts.agentEmail,
    subject: template.subject,
    body: template.html,
    deepLink: link,
  });
}

export async function notifyPaymentRequest(opts: { bookingId: string; amount: number }) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking || !booking.customer.emailNotifications) return;
  const link = customerDeepLink({ reference: booking.reference, token: booking.trackingToken });
  const template = emailTemplates.paymentRequest({ reference: booking.reference, link });
  return sendNotification({
    bookingId: booking.id,
    type: "PAYMENT_REQUEST",
    recipient: booking.customer.email,
    subject: template.subject,
    body: template.html,
    deepLink: link,
  });
}

export async function notifyPaymentVerified(opts: { bookingId: string }) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking || !booking.customer.emailNotifications) return;
  const link = customerDeepLink({ reference: booking.reference, token: booking.trackingToken });
  const template = emailTemplates.paymentVerified({ reference: booking.reference, link });
  return sendNotification({
    bookingId: booking.id,
    type: "PAYMENT_VERIFIED",
    recipient: booking.customer.email,
    subject: template.subject,
    body: template.html,
    deepLink: link,
  });
}

export async function notifyPaymentRejected(opts: { bookingId: string }) {
  const booking = await loadBookingContext(opts.bookingId);
  if (!booking || !booking.customer.emailNotifications) return;
  const link = customerDeepLink({ reference: booking.reference, token: booking.trackingToken });
  const template = emailTemplates.paymentRejected({ reference: booking.reference, link });
  return sendNotification({
    bookingId: booking.id,
    type: "PAYMENT_REJECTED",
    recipient: booking.customer.email,
    subject: template.subject,
    body: template.html,
    deepLink: link,
  });
}

export async function notifyQuoteReady(opts: {
  recipient: string;
  reference: string;
  total: number;
  documentUrl: string;
  bookingLink: string;
}) {
  const template = emailTemplates.quoteReady({
    reference: opts.reference,
    total: money(opts.total),
    documentUrl: opts.documentUrl,
    bookingLink: opts.bookingLink,
  });
  return sendNotification({
    type: "NEW_MESSAGE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
    deepLink: opts.documentUrl,
  });
}

export async function notifySupplierUpdateRequest(opts: {
  recipient: string;
  supplier: string;
  type: string;
  daysOld: number;
}) {
  const template = emailTemplates.supplierUpdateRequest({
    supplier: opts.supplier,
    type: opts.type,
    daysOld: opts.daysOld,
  });
  return sendNotification({
    type: "SUPPLIER_UPDATE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
  });
}

export async function notifySupplierPortalAccess(opts: {
  recipient: string;
  supplier: string;
  link: string;
}) {
  const template = emailTemplates.supplierPortalAccess({
    supplier: opts.supplier,
    link: opts.link,
  });
  return sendNotification({
    type: "SUPPLIER_UPDATE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
    deepLink: opts.link,
  });
}

export async function notifyJobFailed(opts: {
  recipient: string;
  jobName: string;
  jobKey: string;
  error: string;
}) {
  const template = emailTemplates.jobFailed({
    jobName: opts.jobName,
    jobKey: opts.jobKey,
    error: opts.error,
  });
  return sendNotification({
    type: "NEW_MESSAGE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
  });
}

export async function notifyDepositReminder(opts: {
  recipient: string;
  reference: string;
  deposit: string;
  link: string;
}) {
  const template = emailTemplates.depositReminder({
    reference: opts.reference,
    deposit: opts.deposit,
    link: opts.link,
  });
  return sendNotification({
    type: "PAYMENT_REQUEST",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
    deepLink: opts.link,
  });
}

export async function notifyBalanceReminder(opts: {
  recipient: string;
  reference: string;
  outstanding: string;
  daysUntilArrival: number;
  link: string;
}) {
  const template = emailTemplates.balanceReminder({
    reference: opts.reference,
    outstanding: opts.outstanding,
    daysUntilArrival: opts.daysUntilArrival,
    link: opts.link,
  });
  return sendNotification({
    type: "PAYMENT_REQUEST",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
    deepLink: opts.link,
  });
}

export async function notifyArrivalSummary(opts: {
  recipient: string;
  reference: string;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  link: string;
}) {
  const template = emailTemplates.arrivalSummary(opts);
  return sendNotification({
    type: "NEW_MESSAGE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
    deepLink: opts.link,
  });
}

export async function notifyArrivalInstructions(opts: {
  recipient: string;
  reference: string;
  property: string;
  transfer: string;
  link: string;
}) {
  const template = emailTemplates.arrivalInstructions(opts);
  return sendNotification({
    type: "NEW_MESSAGE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
    deepLink: opts.link,
  });
}

export async function notifySupplierEscalation(opts: {
  recipient: string;
  supplier: string;
  type: string;
  daysOld: number;
  level: number;
}) {
  const template = emailTemplates.supplierEscalation(opts);
  return sendNotification({
    type: "SUPPLIER_UPDATE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
  });
}

export async function notifyDailyReport(opts: {
  recipient: string;
  newLeads: number;
  quotes: number;
  confirmed: number;
  revenue: number;
  outstanding: number;
  supplierPending: number;
}) {
  const template = emailTemplates.dailyReport({
    newLeads: opts.newLeads,
    quotes: opts.quotes,
    confirmed: opts.confirmed,
    revenue: money(opts.revenue),
    outstanding: money(opts.outstanding),
    supplierPending: opts.supplierPending,
  });
  return sendNotification({
    type: "NEW_MESSAGE",
    recipient: opts.recipient,
    subject: template.subject,
    body: template.html,
  });
}
