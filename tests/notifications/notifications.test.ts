import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  customerDeepLink,
  agentDeepLink,
  sendNotification,
  notifyStatusChanged,
  notifyCustomerMessage,
  notifyAttachmentAdded,
  notifyAgentCustomerMessage,
  listRecentNotifications,
} from "@/lib/notifications/service";
import { emailTemplates } from "@/lib/notifications/templates";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    notification: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    booking: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@/lib/notifications/queue", () => ({
  processEmail: vi.fn().mockResolvedValue(undefined),
}));

const booking = {
  id: "b1",
  reference: "MV-24081",
  trackingToken: "tok123",
  customer: { email: "jane@example.com", emailNotifications: true, fullName: "Jane" },
  assignedAgent: { email: "ahmed@oceanatlas.mv" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.booking.findUnique.mockResolvedValue(booking);
  mockDb.notification.create.mockResolvedValue({ id: "n1", status: "PENDING" });
  mockDb.notification.update.mockResolvedValue({ id: "n1", status: "SENT", sentAt: new Date() });
});

describe("deep links", () => {
  it("builds a customer portal deep link with the tracking token", () => {
    expect(customerDeepLink({ reference: "MV-24081", token: "tok123" })).toBe(
      "/track/MV-24081?token=tok123",
    );
  });

  it("builds an agent deep link to the booking", () => {
    expect(agentDeepLink({ bookingId: "b1" })).toBe("/agent/bookings/b1");
  });
});

describe("sendNotification", () => {
  it("persists a PENDING notification then marks it SENT on successful delivery", async () => {
    const result = await sendNotification({
      bookingId: "b1",
      type: "STATUS_CHANGED",
      recipient: "jane@example.com",
      subject: "Status update",
      body: "<p>hi</p>",
      deepLink: "/track/MV-24081?token=tok123",
    });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "b1",
        type: "STATUS_CHANGED",
        status: "PENDING",
        deepLink: "/track/MV-24081?token=tok123",
      }),
    });
    expect(mockDb.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
    expect(result.status).toBe("SENT");
  });

  it("marks the notification FAILED when delivery throws", async () => {
    mockDb.notification.update.mockResolvedValueOnce({ id: "n1", status: "FAILED", error: "boom" });
    // force the queue to fail by pointing processEmail to throw
    const queue = await import("@/lib/notifications/queue");
    (queue.processEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("smtp down"));
    const result = await sendNotification({
      type: "NEW_MESSAGE",
      recipient: "jane@example.com",
      subject: "x",
      body: "y",
    });
    expect(result.status).toBe("FAILED");
  });
});

describe("notification flows", () => {
  it("sends a status-change notification to the customer", async () => {
    await notifyStatusChanged({ bookingId: "b1", statusLabel: "Awaiting payment" });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "b1",
        type: "STATUS_CHANGED",
        recipient: "jane@example.com",
        subject: "Booking MV-24081 — status update",
        deepLink: "/track/MV-24081?token=tok123",
      }),
    });
  });

  it("sends a new-message notification to the customer", async () => {
    await notifyCustomerMessage({ bookingId: "b1", senderName: "Ahmed Hassan" });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "NEW_MESSAGE",
        recipient: "jane@example.com",
      }),
    });
  });

  it("sends an attachment notification to the customer", async () => {
    await notifyAttachmentAdded({ bookingId: "b1", filename: "voucher.pdf" });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "ATTACHMENT_ADDED" }),
    });
  });

  it("sends an agent notification with a customer deep link to the agent inbox", async () => {
    await notifyAgentCustomerMessage({
      bookingId: "b1",
      customerName: "Jane",
      message: "Can we extend?",
      agentEmail: "ahmed@oceanatlas.mv",
    });
    expect(mockDb.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "AGENT_MESSAGE",
        recipient: "ahmed@oceanatlas.mv",
        deepLink: "/agent/bookings/b1",
      }),
    });
  });

  it("skips customer notifications when emailNotifications is off", async () => {
    mockDb.booking.findUnique.mockResolvedValue({
      ...booking,
      customer: { ...booking.customer, emailNotifications: false },
    });
    await notifyStatusChanged({ bookingId: "b1", statusLabel: "Confirmed" });
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});

describe("listRecentNotifications", () => {
  it("maps notifications to DTOs newest first", async () => {
    mockDb.notification.findMany.mockResolvedValue([
      {
        id: "n2",
        type: "NEW_MESSAGE",
        recipient: "a@b.c",
        subject: "s",
        status: "SENT",
        createdAt: new Date(),
        bookingId: "b1",
      },
    ]);
    const result = await listRecentNotifications();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "n2", type: "NEW_MESSAGE", status: "SENT" });
  });
});

describe("email templates", () => {
  it("renders a deep link button in the status-change template", () => {
    const t = emailTemplates.statusChanged({
      reference: "MV-24081",
      label: "Confirmed",
      link: "/track/MV-24081?token=tok123",
    });
    expect(t.subject).toContain("MV-24081");
    expect(t.html).toContain("Confirmed");
    expect(t.html).toContain("/track/MV-24081?token=tok123");
  });
});
