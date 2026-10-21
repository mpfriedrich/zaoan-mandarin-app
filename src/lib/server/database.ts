import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let sql: Sql | null | undefined;
let schemaReady: Promise<void> | null = null;

/** Datenbank-Verbindung (Neon über Vercel) oder null, wenn keine eingerichtet ist. */
export async function getDb(): Promise<Sql | null> {
  if (sql === undefined) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    sql = url ? neon(url) : null;
  }
  if (!sql) return null;
  const db = sql;
  schemaReady ??= (async () => {
    await db`CREATE TABLE IF NOT EXISTS records (
      user_id text NOT NULL,
      kind text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL,
      updated_at bigint NOT NULL,
      seq bigserial,
      PRIMARY KEY (user_id, kind, id)
    )`;
    await db`CREATE INDEX IF NOT EXISTS records_user_seq ON records (user_id, seq)`;
    await db`CREATE TABLE IF NOT EXISTS usage (
      user_id text NOT NULL,
      day text NOT NULL,
      count integer NOT NULL,
      PRIMARY KEY (user_id, day)
    )`;
    await db`CREATE TABLE IF NOT EXISTS resets (
      user_id text PRIMARY KEY,
      day text NOT NULL
    )`;
    await db`CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint text PRIMARY KEY,
      user_id text NOT NULL,
      subscription jsonb NOT NULL,
      created_at bigint NOT NULL
    )`;
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  await schemaReady;
  return db;
}

export type SyncRecord = { kind: string; id: string; data: Record<string, unknown>; updatedAt: number };

export async function pushRecords(db: Sql, userId: string, records: SyncRecord[]) {
  if (records.length === 0) return;
  await db.transaction((txn) =>
    records.map(
      (r) => txn`INSERT INTO records (user_id, kind, id, data, updated_at)
        VALUES (${userId}, ${r.kind}, ${r.id}, ${JSON.stringify(r.data)}::jsonb, ${r.updatedAt})
        ON CONFLICT (user_id, kind, id) DO UPDATE
          SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at,
              seq = nextval(pg_get_serial_sequence('records', 'seq'))
          WHERE records.updated_at < EXCLUDED.updated_at`,
    ),
  );
}

export async function pullRecords(db: Sql, userId: string, cursor: number, limit: number) {
  const rows = await db`SELECT kind, id, data, updated_at, seq FROM records
    WHERE user_id = ${userId} AND seq > ${cursor} ORDER BY seq LIMIT ${limit}`;
  return rows.map((row) => ({
    kind: String(row.kind),
    id: String(row.id),
    data: row.data as Record<string, unknown>,
    updatedAt: Number(row.updated_at),
    seq: Number(row.seq),
  }));
}

/** Heutiger Tag in Taiwan als JJJJ-MM-TT. */
export function taipeiDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
}

/** Löscht den Lernstand eines Zugangs beim ersten Sync eines neuen Tages (Demo) und gibt den Tag zurück. */
export async function dailyReset(db: Sql, userId: string) {
  const day = taipeiDay();
  const rows = await db`SELECT day FROM resets WHERE user_id = ${userId}`;
  if (rows[0]?.day !== day) {
    await db.transaction((txn) => [
      txn`DELETE FROM records WHERE user_id = ${userId}`,
      txn`INSERT INTO resets (user_id, day) VALUES (${userId}, ${day})
        ON CONFLICT (user_id) DO UPDATE SET day = EXCLUDED.day`,
    ]);
  }
  return day;
}

/** Stand der letzten einmaligen Rücksetzung eines Zugangs (null = nie). Geräte mit älterem Stand leeren sich. */
export async function resetEpoch(db: Sql, userId: string): Promise<string | null> {
  const rows = await db`SELECT day FROM resets WHERE user_id = ${userId}`;
  return rows[0] ? String(rows[0].day) : null;
}

export async function savePushSubscription(db: Sql, userId: string, subscription: { endpoint: string; keys: unknown }) {
  await db`INSERT INTO push_subscriptions (endpoint, user_id, subscription, created_at)
    VALUES (${subscription.endpoint}, ${userId}, ${JSON.stringify(subscription)}::jsonb, ${Date.now()})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, subscription = EXCLUDED.subscription`;
}

export async function deletePushSubscription(db: Sql, endpoint: string) {
  await db`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export async function listPushSubscriptions(db: Sql, userId: string) {
  const rows = await db`SELECT endpoint FROM push_subscriptions WHERE user_id = ${userId}`;
  return rows.map((row) => String(row.endpoint));
}

export type ReminderStatus = { studiedToday: boolean; streak: number; due: number; language: "de" | "en" };

/** Lernstand für die Erinnerung – aus den synchronisierten Daten, Tage nach Taiwan-Zeit. */
export async function reminderStatus(db: Sql, userId: string, now = new Date()): Promise<ReminderStatus> {
  const DAY = 86400000;
  const today = taipeiDay(now);
  const days = await db`SELECT id, data FROM records WHERE user_id = ${userId} AND kind = 'days'`;
  const active = new Set(
    days
      .filter((row) => {
        const d = row.data as { seconds?: number; activities?: number };
        return (d.activities ?? 0) > 0 || (d.seconds ?? 0) >= 60;
      })
      .map((row) => String(row.id)),
  );
  // Die Tages-IDs kommen aus der Gerätezeit; ein Gerät, das Taiwan voraus ist, zählt trotzdem als „heute gelernt“.
  const studiedToday = [...active].some((id) => id >= today);
  let streak = 0;
  for (let t = now.getTime() - DAY; active.has(taipeiDay(new Date(t))); t -= DAY) streak++;
  const due = await db`SELECT count(*)::int AS n FROM records
    WHERE user_id = ${userId} AND kind = 'cards' AND (data->>'due')::bigint <= ${now.getTime()}`;
  const settings = await db`SELECT data FROM records WHERE user_id = ${userId} AND kind = 'settings' AND id = 'app'`;
  const language = (settings[0]?.data as { value?: { language?: string } } | undefined)?.value?.language === "en" ? "en" : "de";
  return { studiedToday, streak, due: Number(due[0]?.n ?? 0), language };
}

const memoryUsage = new Map<string, number>();

/** Zählt eine Rollenspiel-Nachricht für heute (Zeitzone Taiwan) und gibt den neuen Stand zurück. */
export async function countUsage(userId: string) {
  const day = taipeiDay();
  const db = await getDb();
  if (!db) {
    const key = `${userId}:${day}`;
    const count = (memoryUsage.get(key) ?? 0) + 1;
    memoryUsage.set(key, count);
    return count;
  }
  const rows = await db`INSERT INTO usage (user_id, day, count) VALUES (${userId}, ${day}, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET count = usage.count + 1 RETURNING count`;
  return Number(rows[0].count);
}
