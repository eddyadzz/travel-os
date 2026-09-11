import { createServerFn } from "@tanstack/react-start";
import { listRecentNotifications } from "@/lib/notifications/service";
import type { NotificationDTO } from "@/lib/notifications/service";

export { type NotificationDTO } from "@/lib/notifications/service";

export const getRecentNotifications = createServerFn({ method: "GET" }).handler(async () => {
  return listRecentNotifications(20);
});
