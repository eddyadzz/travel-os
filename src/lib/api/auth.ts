import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { verifyPassword } from "@/lib/crypto.server";
import { clearSessionUser, getSessionUserId, setSessionUserId } from "@/lib/auth.server";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

export const login = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => input)
  .handler(async ({ data }): Promise<AuthUser> => {
    const email = data.email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE" || !verifyPassword(data.password, user.passwordHash)) {
      throw new Error("Invalid email or password.");
    }
    await setSessionUserId(user.id);
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await clearSessionUser();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthUser | null> => {
    const userId = await getSessionUserId();
    if (!userId) return null;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") return null;
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  },
);
