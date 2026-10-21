// Erzeugt mit Azure Speech MP3-Dateien für alle festen Sätze (public/audio/).
// Aufruf: npm run audio   (liest AZURE_SPEECH_KEY und AZURE_SPEECH_REGION aus .env.local)
// Bereits vorhandene Dateien werden übersprungen; das Skript kann jederzeit neu gestartet werden.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { scenarios, toneSets } from "../src/content/scenarios.mjs";
import { audioKey, DEFAULT_VOICE, voiceForPhrase } from "../src/content/voices.mjs";
import { woerter } from "../src/content/woerter.mjs";
import { minimalPairs, tonePairs } from "../src/content/aussprache.mjs";
import { signs } from "../src/content/schilder.mjs";
import { basisWoerter } from "../src/content/basis.mjs";
import { hochfrequenz } from "../src/content/hochfrequenz.mjs";

const KEY = process.env.AZURE_SPEECH_KEY?.trim();
const REGION = process.env.AZURE_SPEECH_REGION?.trim() || "southeastasia";
if (!KEY) {
  console.error("AZURE_SPEECH_KEY fehlt in .env.local");
  process.exit(1);
}

const AUDIO_DIR = new URL("../public/audio/", import.meta.url);
const MANIFEST = new URL("manifest.json", AUDIO_DIR);
mkdirSync(AUDIO_DIR, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

// Free-Tarif: höchstens 20 Anfragen pro Minute.
const PAUSE_MS = 3200;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

const items = new Map();
const add = (voice, text) => items.set(audioKey(voice, text), { voice, text });
for (const scenario of scenarios) {
  for (const phrase of scenario.phrases) {
    add(voiceForPhrase(scenario, phrase), phrase.zh);
    if (phrase.twcn) add(DEFAULT_VOICE, phrase.twcn.tw.zh);
  }
}
for (const set of toneSets) for (const char of set.chars) add(DEFAULT_VOICE, char);
for (const words of Object.values(woerter)) for (const word of words) add(DEFAULT_VOICE, word.zh);
for (const gruppe of basisWoerter) for (const word of gruppe.woerter) add(DEFAULT_VOICE, word.zh);
for (const level of hochfrequenz) for (const word of level.woerter) add(DEFAULT_VOICE, word.zh);
for (const pair of tonePairs) add(DEFAULT_VOICE, pair.zh);
for (const mp of minimalPairs) for (const w of [mp.a, mp.b]) add(DEFAULT_VOICE, w.zh);
for (const sign of signs) add(DEFAULT_VOICE, sign.zh);

async function synthesize({ voice, text }) {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW"><voice name="${voice}"><prosody rate="-8%">${escapeXml(text)}</prosody></voice></speak>`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "zaoan-build-audio",
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 401 || res.status === 403) throw new Error(`Azure lehnt den Schlüssel ab (HTTP ${res.status}). Stimmen Schlüssel und Region?`);
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || attempt * 15000;
      console.log(`  Azure ausgelastet (HTTP ${res.status}), warte ${Math.round(wait / 1000)} s …`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Azure-Fehler HTTP ${res.status}: ${await res.text()}`);
  }
  throw new Error("Azure antwortet nach mehreren Versuchen nicht.");
}

const todo = [...items.entries()].filter(([key]) => !manifest[key] || !existsSync(new URL(manifest[key], AUDIO_DIR)));
console.log(`${items.size} Audiodateien insgesamt, ${todo.length} neu zu erzeugen (ca. ${Math.ceil((todo.length * PAUSE_MS) / 60000)} Min).`);

let done = 0;
for (const [key, item] of todo) {
  const file = createHash("sha1").update(key).digest("hex").slice(0, 16) + ".mp3";
  writeFileSync(new URL(file, AUDIO_DIR), await synthesize(item));
  manifest[key] = file;
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  done++;
  if (done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} fertig`);
  if (done < todo.length) await sleep(PAUSE_MS);
}

// Dateien entfernen, die zu keinem aktuellen Text mehr gehören, aus dem Verzeichnis.
for (const key of Object.keys(manifest)) if (!items.has(key)) delete manifest[key];
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log("Audio fertig.");
