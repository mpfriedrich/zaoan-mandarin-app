// Service Worker für 早安: macht die App offline nutzbar.
// Seiten: erst Netzwerk, sonst Zwischenspeicher. Statische Dateien: Zwischenspeicher zuerst.
const CACHE = "zaoan-v5";

async function precache() {
  const cache = await caches.open(CACHE);
  let routes = [];
  try {
    routes = await (await fetch("/offline-routes.json", { cache: "no-store" })).json();
  } catch {
    return;
  }
  const assets = new Set(["/manifest.webmanifest", "/pwa-icon/180", "/pwa-icon/192", "/pwa-icon/512"]);
  await Promise.all(
    routes.map(async (route) => {
      try {
        const res = await fetch(route, { cache: "no-store" });
        if (!res.ok) return;
        const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
        const html = isHtml ? await res.clone().text() : "";
        await cache.put(route, res);
        for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(match[0]);
      } catch {
        // Einzelne Seiten dürfen fehlen; sie werden beim ersten Besuch gespeichert.
      }
    }),
  );
  await Promise.all([...assets].map((url) => cache.add(url).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true })) ?? (fallbackUrl && (await cache.match(fallbackUrl)));
    return cached ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

// Erinnerungen: Der Push kommt ohne Inhalt, den Text liefert die App (kennt Lernstand und Sprache).
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let message = { title: "早安", body: "Zeit für ein paar Minuten Mandarin.", url: "/" };
      try {
        if (event.data) message = { ...message, ...event.data.json() };
        else {
          const res = await fetch("/api/push/message", { cache: "no-store", credentials: "same-origin" });
          if (res.ok) message = { ...message, ...(await res.json()) };
        }
      } catch {
        // Ohne Netz oder Anmeldung bleibt der allgemeine Text.
      }
      await self.registration.showNotification(message.title, {
        body: message.body,
        icon: "/pwa-icon/192",
        badge: "/pwa-icon/192",
        tag: "zaoan-reminder",
        // Neu melden statt still ersetzen; auf Mac/iPad bleibt sie stehen, bis man sie wegklickt.
        renotify: true,
        requireInteraction: true,
        data: { url: message.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      if (open) return open.navigate(url).then((client) => (client ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/audio/") || url.pathname.startsWith("/strokes/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
  } else {
    event.respondWith(networkFirst(request));
  }
});
