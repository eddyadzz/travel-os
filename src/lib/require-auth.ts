import { redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/api/auth";

/**
 * Route `beforeLoad` guard for staff-only pages. Redirects to /login when there
 * is no active session. Call as `beforeLoad: requireAuth` in a route.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw redirect({ to: "/login" });
  }
  return { user };
}
