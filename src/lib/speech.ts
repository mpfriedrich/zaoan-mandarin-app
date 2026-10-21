"use client";

import { useEffect, useState } from "react";

const isZh = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase().startsWith("zh");
const isTw = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase() === "zh-tw";

export function useZhVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const update = () => setVoices(speechSynthesis.getVoices().filter(isZh));
    update();
    speechSynthesis.addEventListener("voiceschanged", update);
    return () => speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

function pickVoice(voiceURI: string) {
  const voices = speechSynthesis.getVoices().filter(isZh);
  return voices.find((v) => v.voiceURI === voiceURI) ?? voices.find(isTw) ?? voices[0];
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Liest chinesischen Text vor (taiwanische Stimme, wenn vorhanden). */
export function speak(text: string, opts: { voiceURI?: string; slow?: boolean } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(opts.voiceURI ?? "");
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "zh-TW";
  utterance.rate = opts.slow ? 0.55 : 0.9;
  speechSynthesis.speak(utterance);
}

type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognize() {
  return recognitionCtor() !== null;
}

/** Startet die Spracherkennung auf Chinesisch (Taiwan). Gibt eine Stopp-Funktion zurück. */
export function listen(handlers: { onText: (text: string, final: boolean) => void; onEnd: () => void; onError: (error: string) => void }) {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError("not-supported");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "zh-TW";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = e.results[i].isFinal;
    }
    handlers.onText(text, final);
  };
  rec.onerror = (e) => handlers.onError(e.error);
  rec.onend = handlers.onEnd;
  rec.start();
  return () => rec.stop();
}
