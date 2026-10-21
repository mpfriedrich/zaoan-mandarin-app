"use client";

/** on/off = eingerichtet bzw. nicht; sonst der Grund, warum es auf diesem Gerät nicht geht. */
export type PushState = "on" | "off" | "unsupported" | "not-installed" | "denied";

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Der Service Worker läuft nur in der veröffentlichten App (siehe AppShell). */
async function registration() {
  if (process.env.NODE_ENV !== "production") return null;
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !standalone() ? "not-installed" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  if (!reg) return "unsupported";
  return (await reg.pushManager.getSubscription()) ? "on" : "off";
}

function keyBytes(base64url: string) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

export async function enablePush(): Promise<PushState | "error"> {
  const state = await getPushState();
  if (state !== "off" && state !== "on") return state;
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  try {
    const reg = await registration();
    if (!reg) return "unsupported";
    const res = await fetch("/api/push");
    if (!res.ok) return "error";
    const { key } = (await res.json()) as { key: string };
    const subscription =
      (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const saved = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return saved.ok ? "on" : "error";
  } catch {
    return "error";
  }
}

export async function disablePush() {
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}

/** Schickt sofort eine Benachrichtigung an dieses Gerät. */
export async function sendTestPush() {
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return false;
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test", endpoint: subscription.endpoint }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const result = (await res.json()) as { sent?: number };
  return (result.sent ?? 0) > 0;
}
