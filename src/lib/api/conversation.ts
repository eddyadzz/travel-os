import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { notifyAgentCustomerMessage, notifyCustomerMessage } from "@/lib/notifications/service";
import type { ConversationDTO, CreateMessageInput, MessageDTO } from "@/lib/types";

function toMessageDTO(message: {
  id: string;
  senderType: string;
  senderName: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
}): MessageDTO {
  return {
    id: message.id,
    senderType: message.senderType as MessageDTO["senderType"],
    senderName: message.senderName,
    message: message.message,
    isInternal: message.isInternal,
    createdAt: message.createdAt.toISOString(),
  };
}

async function getOrCreateConversation(bookingId: string) {
  const existing = await db.bookingConversation.findUnique({ where: { bookingId } });
  if (existing) return existing;
  return db.bookingConversation.create({ data: { bookingId } });
}

export const listConversation = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    const conversation = await getOrCreateConversation(bookingId);
    const messages = await db.bookingMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    const dto: ConversationDTO = {
      id: conversation.id,
      bookingId,
      messages: messages.map(toMessageDTO),
    };
    return dto;
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator((input: CreateMessageInput) => input)
  .handler(async ({ data: input }) => {
    const trimmed = input.message.trim();
    if (!trimmed) throw new Error("Message cannot be empty.");

    const conversation = await getOrCreateConversation(input.bookingId);

    const message = await db.bookingMessage.create({
      data: {
        conversationId: conversation.id,
        senderType: input.senderType,
        senderName: input.senderName,
        message: trimmed,
        isInternal: input.isInternal ?? false,
      },
    });

    await db.bookingEvent.create({
      data: {
        bookingId: input.bookingId,
        type: "MESSAGE_SENT",
        message: `${input.senderName} sent a message`,
      },
    });

    // Notifications
    if (input.senderType === "AGENT") {
      await notifyCustomerMessage({ bookingId: input.bookingId, senderName: input.senderName });
    } else if (input.senderType === "CUSTOMER") {
      const booking = await db.booking.findUnique({
        where: { id: input.bookingId },
        include: { assignedAgent: true },
      });
      const agentEmail = booking?.assignedAgent?.email;
      if (agentEmail) {
        await notifyAgentCustomerMessage({
          bookingId: input.bookingId,
          customerName: input.senderName,
          message: trimmed,
          agentEmail,
        });
      }
    }

    return toMessageDTO(message);
  });

export const getUnreadMessageCounts = createServerFn({ method: "GET" }).handler(async () => {
  // A message counts as "unread" when it's a customer/system message with no
  // agent reply after it in the same conversation. Simplify for the MVP: count
  // customer+system messages that are newer than the last agent message.
  const conversations = await db.bookingConversation.findMany({
    include: {
      booking: { select: { reference: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { senderType: true, createdAt: true },
      },
    },
  });

  const result: Array<{ bookingId: string; reference: string; unread: number }> = [];
  for (const convo of conversations) {
    let lastAgentIndex = -1;
    convo.messages.forEach((m, i) => {
      if (m.senderType === "AGENT") lastAgentIndex = i;
    });
    const unread = convo.messages
      .slice(lastAgentIndex + 1)
      .filter((m) => m.senderType === "CUSTOMER" || m.senderType === "SYSTEM").length;
    if (unread > 0) {
      result.push({ bookingId: convo.bookingId, reference: convo.booking.reference, unread });
    }
  }
  return result;
});
