import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/database";

/** Löscht den gesamten Lernstand des Owners (Einstellungen bleiben). Alle Geräte leeren sich beim nächsten Sync. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user !== "owner") return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== "reset") return Response.json({ error: "invalid" }, { status: 400 });

  const db = await getDb().catch(() => null);
  if (!db) return Response.json({ error: "no-db" }, { status: 503 });

  const epoch = `reset-${Date.now()}`;
  await db.transaction((txn) => [
    txn`DELETE FROM records WHERE user_id = ${user} AND kind <> 'settings'`,
    txn`INSERT INTO resets (user_id, day) VALUES (${user}, ${epoch})
      ON CONFLICT (user_id) DO UPDATE SET day = EXCLUDED.day`,
  ]);
  return Response.json({ epoch });
}
