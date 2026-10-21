"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { baseSettings, db, defaultSettings, getMeta, type Settings } from "./db";

/** Einstellungen plus `ready`, sobald sie aus der Datenbank geladen sind (vorher gelten die Standardwerte). */
export function useSettingsState(): { settings: Settings; ready: boolean } {
  const loaded = useLiveQuery(async () => {
    const [rec, base] = await Promise.all([db.settings.get("app"), baseSettings()]);
    return { ...base, ...rec?.value };
  }, []);
  return { settings: loaded ?? defaultSettings, ready: loaded !== undefined };
}

export function useSettings(): Settings {
  return useSettingsState().settings;
}

/** `undefined`, solange der Wert noch geladen wird. */
export function useMeta<T>(key: string, fallback: T): T | undefined {
  return useLiveQuery(() => getMeta(key, fallback), [key]);
}

/** Aktuelle Zeit, erst nach dem ersten Rendern im Browser (sonst null). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export const colorVar = (color: string) => `var(--${color})`;
export const colorTextVar = (color: string) => `var(--${color}-text)`;
