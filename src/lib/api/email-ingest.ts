import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import type { InboundEmailInput } from "@/lib/types";

const INBOUND_DOMAIN = process.env["INBOUND_EMAIL_DOMAIN"] ?? "mail.oceanatlas.mv";

/**
 * Parse an inbound address for a booking reference/token.
 * Supported shapes: bookings+<reference>@domain, bookings+<trackingToken>@domain.
 */
export function parseInboundRecipient(
  recipient: string,
): { reference?: string; token?: string } | null {
  const local = recipient.split("@")[0] ?? "";
  const plus = local.split("+");
  if (plus.length < 2) return null;
  const key = plus.slice(1).join("+");
  if (!key) return null;
  if (/^MV-\d{4,}$/i.test(key)) return { reference: key.toUpperCase() };
  return { token: key };
}

/**
 * Email → System: link an inbound email to its booking and append it to the
 * booking conversation. Supplier replies also mark open update requests received.
 */
export async function ingestInboundEmail(input: InboundEmailInput) {
  const parsed = parseInboundRecipient(input.to);
  if (!parsed) {
    return { linked: false, reason: "Recipient address does not reference a booking" };
  }

  const booking = parsed.reference
    ? await db.booking.findUnique({
        where: { reference: parsed.reference },
        include: { property: { select: { supplierId: true } } },
      })
    : parsed.token
      ? await db.booking.findFirst({
          where: { trackingToken: parsed.token },
          include: { property: { select: { supplierId: true } } },
        })
      : null;
  if (!booking) {
    return { linked: false, reason: "No booking matches the recipient address" };
  }

  const isSupplier = input.from ? await isSupplierSender(booking, input.from) : false;

  const conversation = await db.bookingConversation.findUnique({
    where: { bookingId: booking.id },
  });
  const conversationId =
    conversation?.id ??
    (await db.bookingConversation.create({ data: { bookingId: booking.id } })).id;

  await db.bookingMessage.create({
    data: {
      conversationId,
      senderType: isSupplier ? "SUPPLIER" : "CUSTOMER",
      senderName: input.from ?? "Inbound",
      message: `[Email] ${input.subject ?? "No subject"}\n\n${input.body ?? ""}`.trim(),
      isInternal: false,
    },
  });

  if (isSupplier) {
    await db.supplierUpdateRequest.updateMany({
      where: { supplierId: booking.property.supplierId ?? "none", status: "REQUESTED" },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
  }

  await db.bookingEvent.create({
    data: {
      bookingId: booking.id,
      type: "MESSAGE_SENT",
      message: `${isSupplier ? "Supplier" : "Customer"} email ingested: ${input.subject ?? ""}`,
    },
  });

  return {
    linked: true,
    bookingId: booking.id,
    reference: booking.reference,
    sender: isSupplier ? "SUPPLIER" : "CUSTOMER",
  };
}

async function isSupplierSender(
  booking: { property: { supplierId: string | null } },
  from: string,
): Promise<boolean> {
  if (!booking.property.supplierId || !from) return false;
  const supplier = await db.supplier.findUnique({ where: { id: booking.property.supplierId } });
  if (!supplier?.email) return false;
  return from
    .toLowerCase()
    .includes(supplier.email.split("@")[1]?.toLowerCase() ?? "__no_domain__");
}

export const ingestInboundEmailFn = createServerFn({ method: "POST" })
  .validator((input: InboundEmailInput) => input)
  .handler(async ({ data }) => ingestInboundEmail(data));

export const getInboundAddressForBooking = createServerFn({ method: "GET" })
  .validator((reference: string) => reference)
  .handler(async ({ data: reference }) => ({
    address: `bookings+${reference}@${INBOUND_DOMAIN}`,
  }));
