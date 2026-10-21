import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "zaoan_session";

/** "owner" = eigener Lernstand, "demo" = gemeinsamer Demo-Zugang, der jeden Tag neu beginnt. */
export type UserId = "owner" | "demo";
const USERS: UserId[] = ["owner", "demo"];

function accessCode(user: UserId) {
  const value = user === "owner" ? process.env.APP_ACCESS_CODE : process.env.DEMO_ACCESS_CODE;
  return value?.trim() || null;
}

export function isConfigured() {
  return accessCode("owner") !== null;
}

function digest(value: string, purpose: string) {
  return createHmac("sha256", purpose).update(value).digest();
}

/** Zu welchem Zugang der eingegebene Code gehört – oder null. */
export function userForCode(input: string): UserId | null {
  const entered = digest(input.trim(), "compare");
  for (const user of USERS) {
    const code = accessCode(user);
    if (code && timingSafeEqual(entered, digest(code, "compare"))) return user;
  }
  return null;
}

/** Das Sitzungs-Cookie leitet sich vom Zugangscode ab: Code ändern = alle Geräte dieses Zugangs abmelden. */
export function sessionToken(user: UserId) {
  const code = accessCode(user);
  if (!code) throw new Error(`Zugangscode für ${user} fehlt`);
  // Der Owner-Wert bleibt wie bisher, damit bestehende Geräte angemeldet bleiben.
  return createHmac("sha256", code).update(user === "owner" ? "zaoan-session-v1" : "zaoan-session-demo-v1").digest("hex");
}

export async function currentUser(): Promise<UserId | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const actual = Buffer.from(value);
  for (const user of USERS) {
    if (!accessCode(user)) continue;
    const expected = Buffer.from(sessionToken(user));
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return user;
  }
  return null;
}

export async function isAuthed() {
  return (await currentUser()) !== null;
}
