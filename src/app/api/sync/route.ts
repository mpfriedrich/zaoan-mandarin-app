import { currentUser } from "@/lib/server/auth";
import { dailyReset, getDb, pullRecords, pushRecords, resetEpoch, type SyncRecord } from "@/lib/server/database";

const KINDS = new Set(["cards", "reviews", "days", "lessons", "settings", "roleplays", "scores"]);
const PULL_LIMIT = 1000;

function validRecord(r: unknown): r is SyncRecord {
  const rec = r as SyncRecord;
  return (
    !!rec &&
    KINDS.has(rec.kind) &&
    typeof rec.id === "string" &&
    rec.id.length > 0 &&
    rec.id.length <= 200 &&
    Number.isFinite(rec.updatedAt) &&
    typeof rec.data === "object" &&
    rec.data !== null
  );
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let db;
  try {
    db = await getDb();
  } catch (error) {
    console.error("[sync] Datenbank nicht erreichbar", error);
    return Response.json({ error: "db-error" }, { status: 503 });
  }
  if (!db) return Response.json({ error: "no-db" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { cursor?: unknown; records?: unknown; epoch?: unknown } | null;
  const cursor = Number.isFinite(body?.cursor) ? Number(body!.cursor) : 0;
  const records = Array.isArray(body?.records) ? body.records : [];
  if (records.length > 500 || !records.every(validRecord)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  // Demo: gemeinsamer Stand, der jeden Tag (Taiwan) neu beginnt. Geräte mit dem Stand von gestern leeren sich zuerst.
  if (user === "demo") {
    const day = await dailyReset(db, user);
    if (body?.epoch !== day) return Response.json({ reset: day });
  } else {
    // Owner: nur nach einer bewussten Rücksetzung, dann einmal pro Gerät.
    const epoch = await resetEpoch(db, user);
    if (epoch && body?.epoch !== epoch) return Response.json({ reset: epoch });
  }

  await pushRecords(db, user, records);
  const pulled = await pullRecords(db, user, cursor, PULL_LIMIT);
  const nextCursor = pulled.length ? pulled[pulled.length - 1].seq : cursor;
  return Response.json({
    records: pulled.map(({ kind, id, data, updatedAt }) => ({ kind, id, data, updatedAt })),
    cursor: nextCursor,
    more: pulled.length === PULL_LIMIT,
  });
}
