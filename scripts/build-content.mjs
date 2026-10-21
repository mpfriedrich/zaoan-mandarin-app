// Erzeugt src/content/generated.json aus src/content/scenarios.mjs:
// ergänzt vereinfachte Zeichen (OpenCC) und Zhuyin und prüft, dass zu jedem
// Zeichen genau eine Pinyin-Silbe gehört.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as OpenCC from "opencc-js";
import { scenarios, toneSets } from "../src/content/scenarios.mjs";
import { SIGN_CATEGORIES, signs } from "../src/content/schilder.mjs";
import { audioKey, DEFAULT_VOICE, voiceForPhrase } from "../src/content/voices.mjs";
import { TOCFL_LABELS, woerter } from "../src/content/woerter.mjs";
import { basisWoerter } from "../src/content/basis.mjs";
import { hochfrequenz } from "../src/content/hochfrequenz.mjs";
import { minimalPairs, tonePairs } from "../src/content/aussprache.mjs";
import { splitTone } from "../src/lib/zhuyin.mjs";
import * as english from "../src/content/english.mjs";

// TOCFL-Stufen erzeugt scripts/check-content.mjs (braucht die Wortliste in data/).
const levelsUrl = new URL("../src/content/tocfl-levels.json", import.meta.url);
const tocflLevels = existsSync(levelsUrl) ? JSON.parse(readFileSync(levelsUrl, "utf8")) : {};
import { syllableToZhuyin } from "../src/lib/zhuyin.mjs";

// Vorhandene Azure-Audiodateien (siehe scripts/build-audio.mjs); ohne sie liest das Gerät selbst vor.
const manifestUrl = new URL("../public/audio/manifest.json", import.meta.url);
const audioManifest = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, "utf8")) : {};
const audioFor = (voice, text) => (audioManifest[audioKey(voice, text)] ? `/audio/${audioManifest[audioKey(voice, text)]}` : undefined);

const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });
const isHan = (ch) => /\p{Script=Han}/u.test(ch);
const trad = (tokens) => tokens.map((t) => t.t).join("");
const errors = [];

function tokenize(zh, py, where) {
  const chars = [...zh];
  const simplified = [...toSimplified(zh)];
  const syllables = py.trim().split(/\s+/).filter(Boolean);
  if (simplified.length !== chars.length) {
    errors.push(`${where}: vereinfachte Fassung hat andere Länge (${zh})`);
    return [];
  }
  let next = 0;
  const tokens = chars.map((t, i) => {
    if (!isHan(t)) return { t, s: simplified[i], p: "", z: "" };
    const p = syllables[next++];
    if (!p) {
      errors.push(`${where}: zu wenige Pinyin-Silben für „${zh}“`);
      return { t, s: simplified[i], p: "", z: "" };
    }
    const z = syllableToZhuyin(p);
    if (!z) errors.push(`${where}: Zhuyin für „${p}“ unbekannt`);
    return { t, s: simplified[i], p, z: z ?? "" };
  });
  if (next !== syllables.length) errors.push(`${where}: zu viele Pinyin-Silben für „${zh}“`);
  return tokens;
}

const VOWEL_MARKS = {
  a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", ü: "ǖǘǚǜ",
};

function addToneMark(base, tone) {
  const vowels = [...base].map((c, i) => ("aeiouü".includes(c) ? i : -1)).filter((i) => i >= 0);
  let target = base.indexOf("a");
  if (target < 0) target = base.indexOf("e");
  if (target < 0 && base.includes("ou")) target = base.indexOf("o");
  if (target < 0) target = vowels[vowels.length - 1];
  const chars = [...base];
  chars[target] = VOWEL_MARKS[chars[target]][tone - 1];
  return chars.join("");
}

const ids = new Set();
const output = {
  scenarios: scenarios.map((sc) => ({
    id: sc.id,
    title: sc.title,
    subtitle: sc.subtitle,
    color: sc.color,
    partnerVoice: sc.partnerVoice,
    zhTokens: tokenize(sc.zh, sc.zhPy, sc.id),
    roleplay: sc.roleplay,
    words: (woerter[sc.id] ?? []).map((w) => {
      const audio = audioFor(DEFAULT_VOICE, w.zh);
      const level = tocflLevels[w.zh];
      return {
        id: `wort-${w.zh}`,
        scenarioId: sc.id,
        tokens: tokenize(w.zh, w.py, `${sc.id}/${w.zh}`),
        de: w.de,
        ...(level ? { tocfl: TOCFL_LABELS[level] ?? level } : {}),
        ...(audio ? { audio } : {}),
      };
    }),
    phrases: sc.phrases.map((ph) => {
      if (ids.has(ph.id)) errors.push(`doppelte ID ${ph.id}`);
      ids.add(ph.id);
      if (!["du", "gegenueber"].includes(ph.von)) errors.push(`${ph.id}: „von“ muss du oder gegenueber sein`);
      const audio = audioFor(voiceForPhrase(sc, ph), ph.zh);
      const twAudio = ph.twcn ? audioFor(DEFAULT_VOICE, ph.twcn.tw.zh) : undefined;
      return {
        id: ph.id,
        scenarioId: sc.id,
        tokens: tokenize(ph.zh, ph.py, ph.id),
        de: ph.de,
        von: ph.von,
        ...(audio ? { audio } : {}),
        ...(ph.hinweis ? { hinweis: ph.hinweis } : {}),
        ...(ph.twcn
          ? {
              twcn: {
                de: ph.twcn.de,
                tw: { tokens: tokenize(ph.twcn.tw.zh, ph.twcn.tw.py, `${ph.id}/tw`), ...(twAudio ? { audio: twAudio } : {}) },
                cn: ph.twcn.cn,
              },
            }
          : {}),
      };
    }),
  })),
  toneSets: toneSets.map((set) => ({
    syllable: set.syllable,
    items: set.chars.map((char, i) => {
      const py = addToneMark(set.syllable, i + 1);
      const audio = audioFor(DEFAULT_VOICE, char);
      return { char, simp: toSimplified(char), tone: i + 1, py, zy: syllableToZhuyin(py), de: set.de[i], ...(audio ? { audio } : {}) };
    }),
  })),
};

const pairWord = (w, where) => {
  const audio = audioFor(DEFAULT_VOICE, w.zh);
  return { tokens: tokenize(w.zh, w.py, where), de: w.de, ...(audio ? { audio } : {}) };
};
output.tonePairs = tonePairs.map((p) => ({
  ...pairWord(p, `tonpaar/${p.zh}`),
  tones: p.py.split(" ").map((s) => splitTone(s).tone),
  ...(p.hinweis ? { hinweis: p.hinweis } : {}),
}));
if (new Set(output.tonePairs.map((p) => p.tones.join("-"))).size !== output.tonePairs.length) errors.push("Tonpaare: Tonfolge doppelt");
if (output.tonePairs.length !== 20) errors.push("Tonpaare: erwartet 20 Wörter (Töne 1–4 × 1–4 und neutral)");
output.minimalPairs = minimalPairs.map((mp) => ({ a: pairWord(mp.a, `minimal/${mp.a.zh}`), b: pairWord(mp.b, `minimal/${mp.b.zh}`) }));

const signIds = new Set();
output.signCategories = SIGN_CATEGORIES;
output.signs = signs.map((sign) => {
  if (signIds.has(sign.id)) errors.push(`doppelte Schild-ID ${sign.id}`);
  signIds.add(sign.id);
  if (!SIGN_CATEGORIES.some((c) => c.id === sign.category)) errors.push(`${sign.id}: unbekannte Kategorie ${sign.category}`);
  const audio = audioFor(DEFAULT_VOICE, sign.zh);
  return {
    id: sign.id,
    category: sign.category,
    tokens: tokenize(sign.zh, sign.py, `schild/${sign.id}`),
    de: sign.de,
    ...(sign.hinweis ? { hinweis: sign.hinweis } : {}),
    ...(audio ? { audio } : {}),
  };
});

// Grundwortschatz: Wörter ohne Szenario, die in „Wörter lernen“ zuerst drankommen.
output.basicWords = basisWoerter.flatMap((gruppe) =>
  gruppe.woerter.map((w) => {
    const audio = audioFor(DEFAULT_VOICE, w.zh);
    const level = tocflLevels[w.zh];
    return {
      id: `wort-${w.zh}`,
      scenarioId: "basis",
      gruppe: gruppe.gruppe,
      gruppeEn: gruppe.gruppeEn,
      tokens: tokenize(w.zh, w.py, `basis/${w.zh}`),
      de: w.de,
      ...(level ? { tocfl: TOCFL_LABELS[level] ?? level } : {}),
      ...(audio ? { audio } : {}),
    };
  }),
);

// Hochfrequenz-Wortschatz (TOCFL Novice 1+2): eigener Bereich, Bedeutungen stehen in der Quelldatei.
output.frequencyLevels = hochfrequenz.map((level) => ({ id: level.stufe, title: level.stufe, titleEn: level.stufeEn }));
output.frequencyWords = hochfrequenz.flatMap((level) =>
  level.woerter.map((w) => {
    const audio = audioFor(DEFAULT_VOICE, w.zh);
    return {
      id: `wort-${w.zh}`,
      scenarioId: "hochfrequenz",
      stufe: level.stufe,
      gruppe: level.stufe,
      gruppeEn: level.stufeEn,
      tokens: tokenize(w.zh, w.py, `hochfrequenz/${w.zh}`),
      de: w.de,
      en: w.en,
      ...(audio ? { audio } : {}),
    };
  }),
);

// Jedes Wort darf nur in einem Szenario stehen – die Karten-ID hängt am Wort.
const wordScenario = new Map();
for (const sc of output.scenarios) {
  for (const w of sc.words) {
    if (wordScenario.has(w.id)) errors.push(`Wort ${trad(w.tokens)} steht in ${wordScenario.get(w.id)} und ${sc.id}`);
    wordScenario.set(w.id, sc.id);
  }
}
for (const w of output.basicWords) {
  if (wordScenario.has(w.id)) errors.push(`Wort ${trad(w.tokens)} steht im Grundwortschatz und in ${wordScenario.get(w.id)}`);
  wordScenario.set(w.id, "basis");
}
for (const w of output.frequencyWords) {
  if (wordScenario.has(w.id)) errors.push(`Wort ${trad(w.tokens)} steht im Hochfrequenz-Wortschatz und in ${wordScenario.get(w.id)}`);
  wordScenario.set(w.id, "hochfrequenz");
  if (!w.de || !w.en) errors.push(`Hochfrequenz ${trad(w.tokens)}: Bedeutung fehlt`);
}

// Englische Fassung ergänzen; fehlende Übersetzungen sind Fehler.
const need = (value, where) => {
  if (!value) errors.push(`Englisch fehlt: ${where}`);
  return value ?? "";
};
for (const sc of output.scenarios) {
  const src = scenarios.find((s) => s.id === sc.id);
  const en = english.scenarios[sc.id];
  sc.titleEn = need(en?.title, `${sc.id}/title`);
  sc.subtitleEn = need(en?.subtitle, `${sc.id}/subtitle`);
  sc.roleplay = {
    ...sc.roleplay,
    titleEn: need(en?.roleplay?.title, `${sc.id}/roleplay.title`),
    partnerEn: need(en?.roleplay?.partner, `${sc.id}/roleplay.partner`),
    settingEn: need(en?.roleplay?.setting, `${sc.id}/roleplay.setting`),
    goalEn: need(en?.roleplay?.goal, `${sc.id}/roleplay.goal`),
  };
  for (const ph of sc.phrases) {
    const e = english.phrases[ph.id];
    ph.en = need(e?.en, ph.id);
    const original = src.phrases.find((p) => p.id === ph.id);
    if (original.hinweis) ph.hinweisEn = need(e?.hinweis, `${ph.id}/hinweis`);
    if (ph.twcn) ph.twcn.en = need(e?.twcn, `${ph.id}/twcn`);
  }
  for (const w of sc.words) w.en = need(english.words[trad(w.tokens)], `Wort ${trad(w.tokens)}`);
}
for (const w of output.basicWords) w.en = need(english.words[trad(w.tokens)], `Grundwort ${trad(w.tokens)}`);
for (const set of output.toneSets) for (const item of set.items) item.en = need(english.toneWords[item.char], `Ton ${item.char}`);
for (const pair of output.tonePairs) {
  pair.en = need(english.toneWords[trad(pair.tokens)], `Tonpaar ${trad(pair.tokens)}`);
  if (pair.hinweis) pair.hinweisEn = need(english.tonePairHints[trad(pair.tokens)], `Tonpaar-Hinweis ${trad(pair.tokens)}`);
}
for (const mp of output.minimalPairs) for (const w of [mp.a, mp.b]) w.en = need(english.toneWords[trad(w.tokens)], `Minimalpaar ${trad(w.tokens)}`);
for (const sign of output.signs) {
  const e = english.signs[sign.id];
  sign.en = need(e?.en, `Schild ${sign.id}`);
  if (sign.hinweis) sign.hinweisEn = need(e?.hinweis, `Schild ${sign.id}/hinweis`);
}

if (errors.length) {
  console.error("Fehler in den Lerninhalten:\n- " + errors.join("\n- "));
  process.exit(1);
}

writeFileSync(new URL("../src/content/generated.json", import.meta.url), JSON.stringify(output, null, 2) + "\n");

// Strichfolge-Daten (Hanzi Writer / Make Me a Hanzi, Arphic Public License) nur für die Zeichen der App kopieren,
// damit das Schreiben-Üben offline funktioniert. Dateiname: Unicode-Codepunkt in Hex.
const STROKE_SOURCE = new URL("../node_modules/hanzi-writer-data/", import.meta.url);
const STROKE_TARGET = new URL("../public/strokes/", import.meta.url);
const strokeFiles = [];
if (existsSync(STROKE_SOURCE)) {
  const chars = new Set();
  const collect = (tokens) => tokens.forEach((t) => [t.t, t.s].forEach((c) => isHan(c) && chars.add(c)));
  for (const sc of output.scenarios) {
    collect(sc.zhTokens);
    sc.words.forEach((w) => collect(w.tokens));
    sc.phrases.forEach((p) => {
      collect(p.tokens);
      if (p.twcn) collect(p.twcn.tw.tokens);
    });
  }
  output.signs.forEach((s) => collect(s.tokens));
  output.basicWords.forEach((w) => collect(w.tokens));
  output.frequencyWords.forEach((w) => collect(w.tokens));
  rmSync(STROKE_TARGET, { recursive: true, force: true });
  mkdirSync(STROKE_TARGET, { recursive: true });
  const missing = [];
  for (const c of chars) {
    const source = new URL(`${c}.json`, STROKE_SOURCE);
    const file = `${c.codePointAt(0).toString(16)}.json`;
    if (!existsSync(source)) {
      missing.push(c);
      continue;
    }
    copyFileSync(source, new URL(file, STROKE_TARGET));
    strokeFiles.push(file);
  }
  copyFileSync(new URL("ARPHICPL.TXT", STROKE_SOURCE), new URL("ARPHICPL.TXT", STROKE_TARGET));
  if (missing.length) console.warn(`Keine Strichfolge-Daten für: ${missing.join("")}`);
} else {
  console.warn("hanzi-writer-data fehlt – Schreiben-Üben ohne Strichdaten.");
}

// Seiten, die der Service Worker für die Offline-Nutzung vorab speichert.
const offlineRoutes = [
  "/", "/szenarien", "/wiederholen", "/rollenspiel", "/fortschritt", "/einstellungen", "/toene", "/hoeren", "/sprechen", "/schreiben", "/schilder", "/woerter", "/wortschatz", "/wortschatz/lernen", "/login",
  ...output.scenarios.flatMap((s) => [`/szenarien/${s.id}`, `/lernen/${s.id}`, `/rollenspiel/${s.roleplay.id}`]),
  ...Object.values(audioManifest).map((file) => `/audio/${file}`),
  ...strokeFiles.map((file) => `/strokes/${file}`),
];
writeFileSync(new URL("../public/offline-routes.json", import.meta.url), JSON.stringify(offlineRoutes) + "\n");
const phraseCount = output.scenarios.reduce((n, s) => n + s.phrases.length, 0);
console.log(
  `Inhalte erzeugt: ${output.scenarios.length} Szenarien, ${phraseCount} Sätze, ${output.basicWords.length} Grundwörter, ${output.frequencyWords.length} Hochfrequenz-Wörter, ${output.toneSets.length} Tonreihen, ${output.signs.length} Schilder, ${strokeFiles.length} Zeichen mit Strichfolge.`,
);
