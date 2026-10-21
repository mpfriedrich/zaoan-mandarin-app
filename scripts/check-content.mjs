// Prüft die Lerninhalte gegen CC-CEDICT (Pinyin, inkl. „Taiwan pr.“) und ordnet
// Wörter den TOCFL-Stufen zu. Braucht die Dateien in data/ (nicht im Repository).
// Aufruf: npm run check
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { scenarios } from "../src/content/scenarios.mjs";
import { woerter } from "../src/content/woerter.mjs";
import { minimalPairs, tonePairs } from "../src/content/aussprache.mjs";
import { signs } from "../src/content/schilder.mjs";
import { basisWoerter } from "../src/content/basis.mjs";
import { hochfrequenz } from "../src/content/hochfrequenz.mjs";
import { splitTone } from "../src/lib/zhuyin.mjs";

const CEDICT = new URL("../data/cedict_1_0_ts_utf-8_mdbg.txt", import.meta.url);
const TOCFL = new URL("../data/tocfl-202307.csv", import.meta.url);
if (!existsSync(CEDICT) || !existsSync(TOCFL)) {
  console.error("data/cedict_1_0_ts_utf-8_mdbg.txt oder data/tocfl-202307.csv fehlt.");
  process.exit(1);
}

/** "xie4" → { base: "xie", tone: 4 }, "u:" → "ü", Ton 5 = neutral (0). */
function parseNumbered(syllable) {
  const m = syllable.toLowerCase().replace("u:", "ü").match(/^([a-zü]+)([1-5])$/);
  return m ? { base: m[1], tone: Number(m[2]) % 5 } : null;
}

const dict = new Map();
for (const line of readFileSync(CEDICT, "utf8").split(/\r?\n/)) {
  const m = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);
  if (!m) continue;
  const readings = [m[3].split(" ").map(parseNumbered)];
  for (const tw of m[4].matchAll(/Taiwan pr\. \[([^\]]+)\]/g)) readings.push(tw[1].split(" ").map(parseNumbered));
  const english = m[4].split("/").filter((d) => !d.startsWith("Taiwan pr.") && !d.startsWith("CL:")).slice(0, 3).join("; ");
  const entry = dict.get(m[1]) ?? { readings: [], english };
  entry.readings.push(...readings.filter((r) => r.every(Boolean)));
  dict.set(m[1], entry);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") out.push(cur), (cur = "");
    else cur += c;
  }
  out.push(cur);
  return out;
}

const tocfl = new Map();
for (const line of readFileSync(TOCFL, "utf8").split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const [id, traditional] = parseCsvLine(line);
  const level = id.split("-")[0];
  for (const word of traditional.split("/")) {
    const clean = word.replace(/\(.*?\)|（.*?）/g, "").trim();
    if (clean && !tocfl.has(clean)) tocfl.set(clean, level);
  }
}

const isHan = (ch) => /\p{Script=Han}/u.test(ch);

/** Längste Übereinstimmung zuerst (max. 5 Zeichen). */
function segment(chars) {
  const words = [];
  for (let i = 0; i < chars.length; ) {
    let len = Math.min(5, chars.length - i);
    while (len > 1 && !dict.has(chars.slice(i, i + len).join(""))) len--;
    words.push({ start: i, text: chars.slice(i, i + len).join("") });
    i += len;
  }
  return words;
}

function sandhiOk(char, ours, theirs) {
  if (char === "不" && ours.tone === 2 && theirs.tone === 4) return true;
  if (char === "一" && (ours.tone === 2 || ours.tone === 4) && theirs.tone === 1) return true;
  return false;
}

const errors = [];
const warnings = [];
const wordList = new Map();

function checkText(where, zh, py) {
  const chars = [...zh].filter(isHan);
  const syllables = py.trim().split(/\s+/).map((s) => splitTone(s.replace(/[^\p{L}]/gu, "")));
  for (const word of segment(chars)) {
    const ours = syllables.slice(word.start, word.start + word.text.length);
    const entry = dict.get(word.text);
    const level = tocfl.get(word.text) ?? null;
    if (!wordList.has(word.text)) {
      wordList.set(word.text, { zh: word.text, py: ours.map((s) => s.base + (s.tone || "")).join(" "), tocfl: level, english: entry?.english ?? "", in: [] });
    }
    wordList.get(word.text).in.push(where);
    if (!entry) {
      warnings.push(`${where}: „${word.text}“ nicht im Wörterbuch`);
      continue;
    }
    const chrs = [...word.text];
    const matches = (reading, strictTone) =>
      reading.length === ours.length &&
      reading.every((r, i) => r.base === ours[i].base && (!strictTone || r.tone === ours[i].tone || ours[i].tone === 0 || r.tone === 0 || sandhiOk(chrs[i], ours[i], r)));
    if (entry.readings.some((r) => matches(r, true))) continue;
    const readable = entry.readings.map((r) => r.map((s) => s.base + (s.tone || 5)).join(" ")).join(" | ");
    const oursText = ours.map((s) => s.base + (s.tone || 5)).join(" ");
    if (entry.readings.some((r) => matches(r, false))) warnings.push(`${where}: Ton bei „${word.text}“: wir ${oursText}, CEDICT ${readable}`);
    else errors.push(`${where}: Silbe bei „${word.text}“: wir ${oursText}, CEDICT ${readable}`);
  }
}

for (const scenario of scenarios) {
  checkText(`${scenario.id}/Titel`, scenario.zh, scenario.zhPy);
  for (const phrase of scenario.phrases) {
    checkText(phrase.id, phrase.zh, phrase.py);
    if (phrase.twcn) checkText(`${phrase.id}/tw`, phrase.twcn.tw.zh, phrase.twcn.tw.py);
  }
}

// Wortlisten der Szenarien prüfen und TOCFL-Stufen für die App speichern (wird mit der App veröffentlicht).
const vocabLevels = {};
for (const [scenarioId, words] of Object.entries(woerter)) {
  if (!scenarios.some((s) => s.id === scenarioId)) errors.push(`woerter: unbekanntes Szenario ${scenarioId}`);
  for (const word of words) {
    checkText(`${scenarioId}/Wort`, word.zh, word.py);
    vocabLevels[word.zh] = tocfl.get(word.zh) ?? null;
  }
}
writeFileSync(new URL("../src/content/tocfl-levels.json", import.meta.url), JSON.stringify(vocabLevels, null, 2) + "\n");

for (const gruppe of basisWoerter) for (const w of gruppe.woerter) checkText(`basis/${gruppe.gruppe}`, w.zh, w.py);
for (const level of hochfrequenz) for (const w of level.woerter) checkText(`hf/${level.stufe}`, w.zh, w.py);
for (const sign of signs) checkText(`schild/${sign.id}`, sign.zh, sign.py);
for (const pair of tonePairs) checkText("Tonpaar", pair.zh, pair.py);
for (const mp of minimalPairs) for (const w of [mp.a, mp.b]) checkText("Minimalpaar", w.zh, w.py);

writeFileSync(new URL("../data/wordlist.json", import.meta.url), JSON.stringify([...wordList.values()], null, 2) + "\n");
const levels = {};
for (const w of wordList.values()) levels[w.tocfl ?? "ohne"] = (levels[w.tocfl ?? "ohne"] ?? 0) + 1;

console.log(`Wörter: ${wordList.size} · TOCFL-Stufen: ${JSON.stringify(levels)}`);
console.log(`\nSilben-Abweichungen (${errors.length}):\n- ` + (errors.join("\n- ") || "keine"));
console.log(`\nTon-Abweichungen und Hinweise (${warnings.length}):\n- ` + (warnings.join("\n- ") || "keine"));
