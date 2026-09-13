import {
  clearSession,
  getSession,
  updateSession,
  type SessionConfig,
} from "@tanstack/react-start/server";

const SESSION_SECRET =
  process.env["SESSION_SECRET"] ??
  "travelos-dev-session-secret-change-me-in-production-0123456789";

const sessionConfig: SessionConfig = {
  password: SESSION_SECRET,
  name: "travelos_session",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env["NODE_ENV"] === "production",
  },
};

export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession(sessionConfig);
  const userId = session.data["userId"];
  return typeof userId === "string" ? userId : null;
}

export async function setSessionUserId(userId: string): Promise<void> {
  await updateSession(sessionConfig, { userId });
}

export async function clearSessionUser(): Promise<void> {
  await clearSession(sessionConfig);
}
