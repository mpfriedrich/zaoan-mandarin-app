import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import { deletePushSubscription, listPushSubscriptions, type ReminderStatus, type Sql } from "./database";

// Web Push ohne Inhalt: Der Server sendet nur den Anstoß (VAPID-signiert), der Service Worker holt
// den Text danach von /api/push/message. So braucht es keine Verschlüsselung der Nachricht.

// Kontaktangabe im VAPID-Token: eigene Adresse via PUSH_SUBJECT, sonst die Vercel-Adresse dieses Deploys.
const SUBJECT = process.env.PUSH_SUBJECT?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "mailto:zaoan@example.com");
const PUSH_HOSTS = [".push.apple.com", "fcm.googleapis.com", ".push.services.mozilla.com", ".notify.windows.com"];

/** Nur echte Push-Dienste als Ziel zulassen. */
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => (host.startsWith(".") ? url.hostname.endsWith(host) : url.hostname === host));
  } catch {
    return false;
  }
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function vapidAuthorization(endpoint: string) {
  const publicKey = vapidPublicKey();
  const d = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !d) throw new Error("VAPID-Schlüssel fehlen");
  const raw = Buffer.from(publicKey, "base64url");
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d, x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33, 65).toString("base64url") },
    format: "jwk",
  });
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `vapid t=${unsigned}.${signature}, k=${publicKey}`;
}

export async function sendPush(endpoint: string): Promise<"sent" | "gone" | "failed"> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: vapidAuthorization(endpoint), TTL: String(3 * 3600), Urgency: "high" },
    body: new Uint8Array(0),
  });
  if (res.ok) return "sent";
  if (res.status === 404 || res.status === 410) return "gone";
  console.error("[push] Versand fehlgeschlagen", res.status, (await res.text().catch(() => "")).slice(0, 200));
  return "failed";
}

/** An alle Geräte eines Zugangs senden; abgelaufene Abos werden entfernt. */
export async function notifyUser(db: Sql, userId: string, only?: string) {
  const endpoints = (await listPushSubscriptions(db, userId)).filter((e) => !only || e === only);
  const result = { devices: endpoints.length, sent: 0, removed: 0, failed: 0 };
  for (const endpoint of endpoints) {
    const outcome = await sendPush(endpoint).catch((error) => {
      console.error("[push] Fehler", error);
      return "failed" as const;
    });
    if (outcome === "sent") result.sent++;
    else if (outcome === "gone") {
      result.removed++;
      await deletePushSubscription(db, endpoint);
    } else result.failed++;
  }
  return result;
}

export type ReminderSlot = "noon" | "evening";

export function reminderMessage(status: Pick<ReminderStatus, "streak" | "due" | "language">, slot: ReminderSlot) {
  const en = status.language === "en";
  if (slot === "evening" && status.streak > 0) {
    return {
      title: en ? `Keep your ${status.streak}-day streak 🔥` : `Deine Serie: ${status.streak} ${status.streak === 1 ? "Tag" : "Tage"} 🔥`,
      body: en
        ? "You haven't studied today yet – a few cards before bed keep your streak alive."
        : "Heute noch nicht gelernt – ein paar Karten vor dem Schlafen retten deine Serie.",
      url: "/wiederholen",
    };
  }
  const title = en ? "早安 – time for Mandarin" : "早安 – Zeit für Mandarin";
  if (status.due > 0) {
    return {
      title,
      body: en
        ? `${status.due} ${status.due === 1 ? "card is" : "cards are"} waiting for you – five minutes are enough.`
        : `${status.due} ${status.due === 1 ? "Karte wartet" : "Karten warten"} auf dich – fünf Minuten reichen.`,
      url: "/wiederholen",
    };
  }
  return {
    title,
    body: en ? "Learn a few new phrases today – five minutes are enough." : "Lern heute ein paar neue Sätze – fünf Minuten reichen.",
    url: "/szenarien",
  };
}
