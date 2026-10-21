"use client";

import { speak } from "./speech";

let player: HTMLAudioElement | null = null;

function getPlayer() {
  player ??= new Audio();
  return player;
}

/**
 * Spielt die Azure-Aufnahme ab, wenn es eine gibt; sonst (oder wenn sie nicht lädt,
 * z. B. offline ohne Zwischenspeicher) liest die Gerätestimme den Text vor.
 */
export function say(text: string, opts: { audio?: string; slow?: boolean; voiceURI?: string } = {}) {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (!opts.audio) {
    speak(text, { voiceURI: opts.voiceURI, slow: opts.slow });
    return;
  }
  const audio = getPlayer();
  audio.pause();
  audio.src = opts.audio;
  audio.playbackRate = opts.slow ? 0.7 : 1;
  audio.preservesPitch = true;
  audio.play().catch((error: DOMException) => {
    // NotAllowedError: iOS erlaubt Ton erst nach einer Berührung – dann nicht auf die Gerätestimme ausweichen.
    if (error.name !== "NotAllowedError" && error.name !== "AbortError") speak(text, { voiceURI: opts.voiceURI, slow: opts.slow });
  });
}

const remoteAudio = new Map<string, string>();

/** Für frei erzeugte Sätze (Rollenspiel): Azure-Stimme über den Server, sonst Gerätestimme. */
export async function sayRemote(text: string, voice: "female" | "male", opts: { slow?: boolean; voiceURI?: string } = {}) {
  const key = `${voice}|${text}`;
  let url = remoteAudio.get(key);
  if (!url) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error(String(res.status));
      url = URL.createObjectURL(await res.blob());
      remoteAudio.set(key, url);
    } catch {
      speak(text, { voiceURI: opts.voiceURI, slow: opts.slow });
      return;
    }
  }
  say(text, { ...opts, audio: url });
}

export function stopAudio() {
  player?.pause();
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}
