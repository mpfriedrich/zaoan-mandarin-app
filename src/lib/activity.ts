"use client";

import { useEffect } from "react";
import { db, notifyChange, type DayRec } from "./db";

/** Lokales Datum als YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDay(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export async function addActivity(seconds: number, activities: number) {
  const id = dayKey();
  await db.transaction("rw", db.days, async () => {
    const day = await db.days.get(id);
    await db.days.put({
      ...day,
      id,
      seconds: (day?.seconds ?? 0) + seconds,
      activities: (day?.activities ?? 0) + activities,
      updatedAt: Date.now(),
    });
  });
  if (activities > 0) notifyChange();
}

/** Speichert eine Aussprache-Bewertung: Tagesverlauf plus beste und letzte Punktzahl des Satzes. */
export async function recordPronunciation(itemId: string, score: number) {
  const id = dayKey();
  const now = Date.now();
  await db.transaction("rw", db.days, db.scores, async () => {
    const day = await db.days.get(id);
    await db.days.put({
      ...day,
      id,
      seconds: day?.seconds ?? 0,
      activities: (day?.activities ?? 0) + 1,
      pronSum: (day?.pronSum ?? 0) + score,
      pronCount: (day?.pronCount ?? 0) + 1,
      updatedAt: now,
    });
    const prev = await db.scores.get(itemId);
    await db.scores.put({ id: itemId, best: Math.max(prev?.best ?? 0, score), last: score, attempts: (prev?.attempts ?? 0) + 1, lastAt: now, updatedAt: now });
  });
  notifyChange();
}

export const isActive = (day: DayRec | undefined) => !!day && (day.activities > 0 || day.seconds >= 60);

/** Tage in Folge mit Lernaktivität; heute zählt mit, sobald gelernt wurde. */
export function computeStreak(days: DayRec[], today = dayKey()) {
  const byId = new Map(days.map((d) => [d.id, d]));
  let key = isActive(byId.get(today)) ? today : shiftDay(today, -1);
  let streak = 0;
  while (isActive(byId.get(key))) {
    streak++;
    key = shiftDay(key, -1);
  }
  return streak;
}

/** Längste Serie aller Zeiten. */
export function longestStreak(days: DayRec[]) {
  const active = new Set(days.filter(isActive).map((d) => d.id));
  let best = 0;
  for (const key of active) {
    if (active.has(shiftDay(key, -1))) continue;
    let length = 0;
    for (let k = key; active.has(k); k = shiftDay(k, 1)) length++;
    best = Math.max(best, length);
  }
  return best;
}

/** Zählt Lernzeit, solange die Seite sichtbar ist. */
export function useStudyTimer() {
  useEffect(() => {
    const STEP = 10;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void addActivity(STEP, 0);
    }, STEP * 1000);
    return () => clearInterval(timer);
  }, []);
}
