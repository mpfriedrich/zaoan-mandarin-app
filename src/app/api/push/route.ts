import { currentUser } from "@/lib/server/auth";
import { deletePushSubscription, getDb, savePushSubscription } from "@/lib/server/database";
import { isPushEndpoint, notifyUser, vapidPublicKey } from "@/lib/server/push";

// Erinnerungen gibt es nur für den eigenen Zugang, nicht für die Demo.
async function ownerOnly() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user !== "owner") return Response.json({ error: "forbidden" }, { status: 403 });
  return null;
}

/** Öffentlicher VAPID-Schlüssel für pushManager.subscribe. */
export async function GET() {
  const denied = await ownerOnly();
  if (denied) return denied;
  const key = vapidPublicKey();
  if (!key) return Response.json({ error: "not-configured" }, { status: 503 });
  return Response.json({ key });
}

/** Abo speichern – oder mit { action: "test" } sofort eine Test-Benachrichtigung schicken. */
export async function POST(request: Request) {
  const denied = await ownerOnly();
  if (denied) return denied;
  const db = await getDb();
  if (!db) return Response.json({ error: "no-db" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { action?: string; endpoint?: unknown; subscription?: { endpoint?: unknown; keys?: unknown } } | null;

  if (body?.action === "test") {
    const only = isPushEndpoint(body.endpoint) ? body.endpoint : undefined;
    return Response.json(await notifyUser(db, "owner", only));
  }

  const endpoint = body?.subscription?.endpoint;
  if (!isPushEndpoint(endpoint)) return Response.json({ error: "invalid" }, { status: 400 });
  await savePushSubscription(db, "owner", { endpoint, keys: body?.subscription?.keys ?? null });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const denied = await ownerOnly();
  if (denied) return denied;
  const db = await getDb();
  if (!db) return Response.json({ error: "no-db" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!isPushEndpoint(body?.endpoint)) return Response.json({ error: "invalid" }, { status: 400 });
  await deletePushSubscription(db, body.endpoint);
  return Response.json({ ok: true });
}
