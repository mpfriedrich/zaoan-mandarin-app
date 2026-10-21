import Dexie, { type Table } from "dexie";
import type { Card } from "ts-fsrs";
import type { ChatTurn, RoleplayModel } from "./roleplay-types";

export type Settings = {
  language: "de" | "en";
  mainScript: "trad" | "simp";
  showSecondary: boolean;
  pinyin: boolean;
  zhuyin: boolean;
  /** Tonkurven des Originals schon vor dem Aufnehmen zeigen. */
  curvesBefore: boolean;
  /** Pinyin auf gut sitzenden Lesekarten erst beim Aufdecken zeigen. */
  hidePinyinKnown: boolean;
  voiceURI: string;
  rate: "normal" | "langsam";
  model: RoleplayModel;
  dailyGoalMin: number;
};

export const defaultSettings: Settings = {
  language: "de",
  mainScript: "trad",
  showSecondary: true,
  pinyin: true,
  zhuyin: false,
  curvesBefore: true,
  hidePinyinKnown: true,
  voiceURI: "",
  rate: "normal",
  model: "claude-opus-5",
  dailyGoalMin: 10,
};

export type CardKind = "lesen" | "hoeren" | "sprechen";

/** Alle synchronisierten Datensätze haben `id` und `updatedAt` (ms). */
export type CardRec = { id: string; phraseId: string; kind: CardKind; card: Card; due: number; updatedAt: number };
export type ReviewRec = { id: string; cardId: string; rating: number; reviewedAt: number; updatedAt: number };
/** `pronSum`/`pronCount`: Summe und Anzahl der Aussprache-Punktzahlen an diesem Tag (für den Verlauf). */
export type DayRec = { id: string; seconds: number; activities: number; pronSum?: number; pronCount?: number; updatedAt: number };
export type LessonRec = { id: string; learned: string[]; updatedAt: number };
export type SettingsRec = { id: "app"; value: Settings; updatedAt: number };
export type RoleplayRec = { id: string; turns: ChatTurn[]; finished: boolean; updatedAt: number };
/** Aussprache je Satz oder Wort: beste und letzte Punktzahl. */
export type ScoreRec = { id: string; best: number; last: number; attempts: number; lastAt: number; updatedAt: number };
export type MetaRec = { key: string; value: unknown };

class ZaoanDB extends Dexie {
  cards!: Table<CardRec, string>;
  reviews!: Table<ReviewRec, string>;
  days!: Table<DayRec, string>;
  lessons!: Table<LessonRec, string>;
  settings!: Table<SettingsRec, string>;
  roleplays!: Table<RoleplayRec, string>;
  scores!: Table<ScoreRec, string>;
  meta!: Table<MetaRec, string>;

  constructor() {
    super("zaoan");
    this.version(1).stores({
      cards: "id, due, phraseId, updatedAt",
      reviews: "id, cardId, updatedAt",
      days: "id, updatedAt",
      lessons: "id, updatedAt",
      settings: "id, updatedAt",
      roleplays: "id, updatedAt",
      meta: "key",
    });
    // Version 2: Aussprache-Punktzahlen synchronisiert statt nur lokal (bisher meta „aussprache:…“).
    this.version(2)
      .stores({ scores: "id, updatedAt" })
      .upgrade(async (tx) => {
        const old = await tx.table("meta").where("key").startsWith("aussprache:").toArray();
        const now = Date.now();
        await tx.table("scores").bulkPut(
          old.map((rec: MetaRec) => {
            const score = Number(rec.value) || 0;
            return { id: rec.key.slice("aussprache:".length), best: score, last: score, attempts: 1, lastAt: 0, updatedAt: now };
          }),
        );
      });
  }
}

export const db = new ZaoanDB();

export const SYNCED_TABLES = ["cards", "reviews", "days", "lessons", "settings", "roleplays", "scores"] as const;
export type SyncedKind = (typeof SYNCED_TABLES)[number];

type Listener = () => void;
const changeListeners = new Set<Listener>();
/** Wird nach jeder lokalen Änderung aufgerufen (löst die Synchronisierung aus). */
export function onLocalChange(fn: Listener) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
export function notifyChange() {
  changeListeners.forEach((fn) => fn());
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const rec = await db.meta.get(key);
  return rec === undefined ? fallback : (rec.value as T);
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

/** Leert Lernstand und Sync-Stand auf diesem Gerät – beim Wechsel des Zugangs oder beim täglichen Demo-Neustart. */
export async function clearLearningData(keepMeta: string[] = [], keepTables: SyncedKind[] = []) {
  await db.transaction("rw", [...SYNCED_TABLES.map((kind) => db[kind]), db.meta], async () => {
    await Promise.all(SYNCED_TABLES.filter((kind) => !keepTables.includes(kind)).map((kind) => db[kind].clear()));
    const keys = (await db.meta.toCollection().primaryKeys()) as string[];
    await db.meta.bulkDelete(keys.filter((key) => !keepMeta.includes(key)));
  });
}

/** Standardwerte für den aktuellen Zugang – die Testversion startet auf Englisch. */
export async function baseSettings(): Promise<Settings> {
  return (await getMeta<string>("user", "owner")) === "demo" ? { ...defaultSettings, language: "en" } : defaultSettings;
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await db.settings.get("app");
  await db.settings.put({ id: "app", value: { ...(await baseSettings()), ...current?.value, ...patch }, updatedAt: Date.now() });
  notifyChange();
}
