"use client";

import { clearLearningData, db, getMeta, setMeta, SYNCED_TABLES, type SyncedKind } from "./db";

export type SyncState = "ok" | "offline" | "no-db" | "unauthorized" | "error" | "syncing";
export type SyncStatus = { state: SyncState; at: number };

const PUSH_BATCH = 400;
let running: Promise<SyncState> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const table = (kind: SyncedKind) => db[kind] as unknown as import("dexie").Table<{ id: string; updatedAt: number }, string>;

async function setStatus(state: SyncState) {
  await setMeta("syncStatus", { state, at: Date.now() } satisfies SyncStatus);
}

type IncomingRecord = { kind: SyncedKind; id: string; data: { id: string; updatedAt: number }; updatedAt: number };

async function post(cursor: number, records: unknown[], epoch: string | null) {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cursor, records, epoch }),
  });
  if (res.status === 401) throw new SyncFailure("unauthorized");
  const body = await res.json().catch(() => ({}));
  if (res.status === 503 && body.error === "no-db") throw new SyncFailure("no-db");
  if (!res.ok) throw new SyncFailure("error");
  if (typeof body.reset === "string") throw new DemoReset(body.reset);
  return body as { records: IncomingRecord[]; cursor: number; more: boolean };
}

class SyncFailure extends Error {
  constructor(public state: SyncState) {
    super(state);
  }
}

/** Der Demo-Stand hat auf dem Server neu begonnen (neuer Tag). */
class DemoReset extends Error {
  constructor(public day: string) {
    super("demo-reset");
  }
}

async function runSync(allowReset = true): Promise<SyncState> {
  if (!navigator.onLine) {
    await setStatus("offline");
    return "offline";
  }
  const startedAt = Date.now();
  const lastPush = await getMeta<number>("lastPushAt", 0);
  let cursor = await getMeta<number>("syncCursor", 0);
  const epoch = await getMeta<string | null>("demoEpoch", null);

  try {
    const outgoing: { kind: SyncedKind; id: string; data: unknown; updatedAt: number }[] = [];
    for (const kind of SYNCED_TABLES) {
      const rows = await table(kind).where("updatedAt").above(lastPush).toArray();
      for (const row of rows) outgoing.push({ kind, id: row.id, data: row, updatedAt: row.updatedAt });
    }

    let first = true;
    while (first || outgoing.length) {
      first = false;
      const batch = outgoing.splice(0, PUSH_BATCH);
      let res = await post(cursor, batch, epoch);
      for (;;) {
        await applyIncoming(res.records);
        cursor = res.cursor;
        if (!res.more) break;
        res = await post(cursor, [], epoch);
      }
    }

    await setMeta("lastPushAt", startedAt);
    await setMeta("syncCursor", cursor);
    await setStatus("ok");
    return "ok";
  } catch (error) {
    if (error instanceof DemoReset && allowReset) {
      // Alten Stand verwerfen, damit er nicht wieder hochgeladen wird. Beim Owner bleiben die Einstellungen.
      const demo = (await getMeta<string>("user", "owner")) === "demo";
      await clearLearningData(["loggedIn", "user"], demo ? [] : ["settings"]);
      await setMeta("demoEpoch", error.day);
      return runSync(false);
    }
    const state = error instanceof SyncFailure ? error.state : navigator.onLine ? "error" : "offline";
    await setStatus(state);
    // Sitzung abgelaufen, z. B. nach neuem Zugangscode: zur Anmeldung. Der lokale Lernstand bleibt und wird danach hochgeladen.
    if (state === "unauthorized") await setMeta("loggedIn", false);
    return state;
  }
}

async function applyIncoming(records: IncomingRecord[]) {
  for (const rec of records) {
    if (!SYNCED_TABLES.includes(rec.kind)) continue;
    const t = table(rec.kind);
    const local = await t.get(rec.id);
    if (!local || local.updatedAt < rec.updatedAt) await t.put(rec.data);
  }
}

export function syncNow() {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

export function scheduleSync(delayMs = 4000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
}
