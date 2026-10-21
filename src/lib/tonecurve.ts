"use client";

import type { Token } from "./content";
import { compareTones } from "./pitch-core.mjs";
import type { Recording } from "./recorder";
import { splitTone } from "./zhuyin.mjs";

export type CurveSyllable = {
  char: string;
  py: string;
  tone: number;
  original: (number | null)[];
  user: (number | null)[];
  hint: string | null;
  measured: boolean;
};

const decoded = new Map<string, Promise<{ samples: Float32Array; sampleRate: number }>>();

/** Lädt und dekodiert eine Aufnahme der Originalstimme (einmal pro Datei). */
function decodeAudio(url: string) {
  let pending = decoded.get(url);
  if (!pending) {
    pending = (async () => {
      const data = await (await fetch(url)).arrayBuffer();
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      try {
        const buffer = await ctx.decodeAudioData(data);
        return { samples: buffer.getChannelData(0).slice(), sampleRate: buffer.sampleRate };
      } finally {
        void ctx.close();
      }
    })();
    pending.catch(() => decoded.delete(url));
    decoded.set(url, pending);
  }
  return pending;
}

/**
 * Tonkurven Silbe für Silbe. Ohne eigene Aufnahme wird nur das Original analysiert.
 * Gibt null zurück, wenn es keine Originalaufnahme gibt oder sie nicht geladen werden kann.
 */
export async function analyseTones(tokens: Token[], audio: string | undefined, recording?: Recording): Promise<CurveSyllable[] | null> {
  if (!audio) return null;
  const syllables = tokens.filter((t) => t.p);
  if (syllables.length === 0) return null;
  let original;
  try {
    original = await decodeAudio(audio);
  } catch {
    return null;
  }
  // Rechnen erst nach dem nächsten Bild, damit die Oberfläche nicht hängt.
  await new Promise((resolve) => setTimeout(resolve, 30));
  const tones = syllables.map((t) => splitTone(t.p).tone as number);
  const user = recording ? { samples: recording.samples, sampleRate: recording.sampleRate } : original;
  const result = compareTones({ user, original, tones }) as Omit<CurveSyllable, "char" | "py">[];
  return result.map((r, i) => ({
    ...r,
    char: syllables[i].t,
    py: syllables[i].p,
    hint: recording ? r.hint : null,
  }));
}
