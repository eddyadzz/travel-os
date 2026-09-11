import { describe, expect, it, vi, beforeEach } from "vitest";
import { listConversation, sendMessage, getUnreadMessageCounts } from "@/lib/api/conversation";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    bookingConversation: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    bookingMessage: { findMany: vi.fn(), create: vi.fn() },
    bookingEvent: { create: vi.fn() },
    booking: { findUnique: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-start", () => {
  const handler = (h: (ctx: { data: unknown }) => unknown) => async (opts?: { data: unknown }) =>
    h({ data: opts?.data });
  return {
    createServerFn: () => ({
      validator: () => ({ handler }),
      handler,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findUnique.mockResolvedValue({
    id: "b1",
    reference: "MV-24081",
    trackingToken: "tok123",
    customer: { email: "jane@example.com", emailNotifications: true, fullName: "Jane" },
    assignedAgent: { email: "ahmed@oceanatlas.mv" },
  });
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT" });
});

describe("listConversation", () => {
  it("creates a conversation when none exists, then returns its messages", async () => {
    mockDb.bookingConversation.findUnique.mockResolvedValue(null);
    mockDb.bookingConversation.create.mockResolvedValue({ id: "conv1", bookingId: "b1" });
    mockDb.bookingMessage.findMany.mockResolvedValue([
      {
        id: "m1",
        senderType: "CUSTOMER",
        senderName: "Jane",
        message: "hi",
        isInternal: false,
        createdAt: new Date(),
      },
    ]);

    const result = await listConversation({ data: "b1" });
    expect(mockDb.bookingConversation.create).toHaveBeenCalledWith({ data: { bookingId: "b1" } });
    expect(result).toMatchObject({
      id: "conv1",
      bookingId: "b1",
      messages: [{ id: "m1", senderType: "CUSTOMER" }],
    });
  });

  it("reuses an existing conversation", async () => {
    mockDb.bookingConversation.findUnique.mockResolvedValue({ id: "conv1", bookingId: "b1" });
    mockDb.bookingMessage.findMany.mockResolvedValue([]);
    await listConversation({ data: "b1" });
    expect(mockDb.bookingConversation.create).not.toHaveBeenCalled();
  });
});

describe("sendMessage", () => {
  it("sends an agent message and records a MESSAGE_SENT event", async () => {
    mockDb.bookingConversation.findUnique.mockResolvedValue({ id: "conv1", bookingId: "b1" });
    mockDb.bookingMessage.create.mockResolvedValue({
      id: "m2",
      senderType: "AGENT",
      senderName: "Ahmed",
      message: "Confirmed availability",
      isInternal: false,
      createdAt: new Date(),
    });

    const result = await sendMessage({
      data: {
        bookingId: "b1",
        senderType: "AGENT",
        senderName: "Ahmed",
        message: "Confirmed availability",
      },
    });
    expect(mockDb.bookingMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv1",
        senderType: "AGENT",
        message: "Confirmed availability",
        isInternal: false,
      }),
    });
    expect(mockDb.bookingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", type: "MESSAGE_SENT" }),
    });
    expect(result.message).toBe("Confirmed availability");
  });

  it("stores an internal message with isInternal true", async () => {
    mockDb.bookingConversation.findUnique.mockResolvedValue({ id: "conv1", bookingId: "b1" });
    mockDb.bookingMessage.create.mockResolvedValue({
      id: "m3",
      senderType: "AGENT",
      senderName: "Ahmed",
      message: "Supplier offered discount",
      isInternal: true,
      createdAt: new Date(),
    });
    await sendMessage({
      data: {
        bookingId: "b1",
        senderType: "AGENT",
        senderName: "Ahmed",
        message: "Supplier offered discount",
        isInternal: true,
      },
    });
    expect(mockDb.bookingMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isInternal: true }),
    });
  });

  it("rejects an empty message", async () => {
    await expect(
      sendMessage({
        data: { bookingId: "b1", senderType: "AGENT", senderName: "Ahmed", message: "   " },
      }),
    ).rejects.toThrow(/cannot be empty/i);
  });
});

describe("getUnreadMessageCounts", () => {
  it("counts customer/system messages newer than the last agent reply", async () => {
    mockDb.bookingConversation.findMany.mockResolvedValue([
      {
        id: "conv1",
        bookingId: "b1",
        booking: { reference: "MV-24081" },
        messages: [
          { senderType: "CUSTOMER", createdAt: new Date() },
          { senderType: "AGENT", createdAt: new Date() },
          { senderType: "CUSTOMER", createdAt: new Date() },
        ],
      },
      {
        id: "conv2",
        bookingId: "b2",
        booking: { reference: "MV-24080" },
        messages: [
          { senderType: "CUSTOMER", createdAt: new Date() },
          { senderType: "SYSTEM", createdAt: new Date() },
        ],
      },
    ]);

    const result = await getUnreadMessageCounts();
    expect(result).toContainEqual({ bookingId: "b1", reference: "MV-24081", unread: 1 });
    expect(result).toContainEqual({ bookingId: "b2", reference: "MV-24080", unread: 2 });
  });

  it("returns empty when all conversations have an agent reply last", async () => {
    mockDb.bookingConversation.findMany.mockResolvedValue([
      {
        id: "conv1",
        bookingId: "b1",
        booking: { reference: "MV-24081" },
        messages: [
          { senderType: "CUSTOMER", createdAt: new Date() },
          { senderType: "AGENT", createdAt: new Date() },
        ],
      },
    ]);
    const result = await getUnreadMessageCounts();
    expect(result).toEqual([]);
  });
});
