"use client";

export type Assessment = {
  status: string;
  text: string;
  scores: { pron: number; accuracy: number; fluency: number; completeness: number };
  words: { word: string; accuracy: number; error: string }[];
};

export class SpeechError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function send<T>(query: string, wav: Blob): Promise<T> {
  const res = await fetch(`/api/speech?${query}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new SpeechError(body.error ?? "unknown");
  return body as T;
}

/** Bewertet die Aufnahme gegen den Satz, der gesprochen werden sollte. */
export function assessPronunciation(wav: Blob, reference: string) {
  return send<Assessment>(`mode=assess&ref=${encodeURIComponent(reference)}`, wav);
}

export type CandidateScore = { text: string; score: number; completeness: number };

/** Erkennung plus Abgleich mit bis zu 3 Vorschlägen (nach Punktzahl sortiert). */
export function matchSpeech(wav: Blob, candidates: string[]) {
  const query = ["mode=match", ...candidates.slice(0, 3).map((c) => `cand=${encodeURIComponent(c)}`)].join("&");
  return send<{ status: string; text: string; candidates: CandidateScore[] }>(query, wav);
}

/** Wandelt eine Aufnahme in Text um (Taiwan-Mandarin). */
export function recognizeSpeech(wav: Blob) {
  return send<{ status: string; text: string }>("mode=recognize", wav);
}
