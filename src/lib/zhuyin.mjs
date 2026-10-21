// Pinyin (mit Tonzeichen) → Zhuyin/Bopomofo, eine Silbe pro Aufruf.

const TONE_MARKS = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
};

const INITIALS = {
  zh: "ㄓ", ch: "ㄔ", sh: "ㄕ",
  b: "ㄅ", p: "ㄆ", m: "ㄇ", f: "ㄈ", d: "ㄉ", t: "ㄊ", n: "ㄋ", l: "ㄌ",
  g: "ㄍ", k: "ㄎ", h: "ㄏ", j: "ㄐ", q: "ㄑ", x: "ㄒ", r: "ㄖ", z: "ㄗ", c: "ㄘ", s: "ㄙ",
};

const FINALS = {
  a: "ㄚ", o: "ㄛ", e: "ㄜ", ê: "ㄝ", ai: "ㄞ", ei: "ㄟ", ao: "ㄠ", ou: "ㄡ",
  an: "ㄢ", en: "ㄣ", ang: "ㄤ", eng: "ㄥ", er: "ㄦ", ong: "ㄨㄥ",
  i: "ㄧ", ia: "ㄧㄚ", ie: "ㄧㄝ", iao: "ㄧㄠ", iu: "ㄧㄡ", ian: "ㄧㄢ", in: "ㄧㄣ",
  iang: "ㄧㄤ", ing: "ㄧㄥ", iong: "ㄩㄥ",
  u: "ㄨ", ua: "ㄨㄚ", uo: "ㄨㄛ", uai: "ㄨㄞ", ui: "ㄨㄟ", uan: "ㄨㄢ", un: "ㄨㄣ",
  uang: "ㄨㄤ", ueng: "ㄨㄥ",
  ü: "ㄩ", üe: "ㄩㄝ", üan: "ㄩㄢ", ün: "ㄩㄣ",
};

const STANDALONE = {
  yi: "ㄧ", ya: "ㄧㄚ", ye: "ㄧㄝ", yao: "ㄧㄠ", you: "ㄧㄡ", yan: "ㄧㄢ", yin: "ㄧㄣ",
  yang: "ㄧㄤ", ying: "ㄧㄥ", yong: "ㄩㄥ", yu: "ㄩ", yue: "ㄩㄝ", yuan: "ㄩㄢ", yun: "ㄩㄣ",
  wu: "ㄨ", wa: "ㄨㄚ", wo: "ㄨㄛ", wai: "ㄨㄞ", wei: "ㄨㄟ", wan: "ㄨㄢ", wen: "ㄨㄣ",
  wang: "ㄨㄤ", weng: "ㄨㄥ",
  a: "ㄚ", o: "ㄛ", e: "ㄜ", ai: "ㄞ", ei: "ㄟ", ao: "ㄠ", ou: "ㄡ", an: "ㄢ", en: "ㄣ",
  ang: "ㄤ", eng: "ㄥ", er: "ㄦ",
};

const TONE_SUFFIX = { 1: "", 2: "ˊ", 3: "ˇ", 4: "ˋ" };

/** Zerlegt eine Silbe in Grundform und Ton (0 = neutral). */
export function splitTone(syllable) {
  let tone = 0;
  let base = "";
  for (const ch of syllable.toLowerCase().normalize("NFC")) {
    if (TONE_MARKS[ch]) {
      base += TONE_MARKS[ch][0];
      tone = TONE_MARKS[ch][1];
    } else {
      base += ch === "v" ? "ü" : ch;
    }
  }
  return { base, tone };
}

/** Wandelt eine Pinyin-Silbe um; gibt null zurück, wenn sie nicht erkannt wird. */
export function syllableToZhuyin(syllable) {
  const { base, tone } = splitTone(syllable.replace(/[^\p{L}]/gu, ""));
  if (!base) return null;

  let body = STANDALONE[base];
  if (!body) {
    const initial = ["zh", "ch", "sh"].find((i) => base.startsWith(i)) ?? base[0];
    const initialZy = INITIALS[initial];
    if (!initialZy) return null;
    let rest = base.slice(initial.length);
    if ("jqx".includes(initial) && rest.startsWith("u")) rest = "ü" + rest.slice(1);
    if (["zh", "ch", "sh", "r", "z", "c", "s"].includes(initial) && rest === "i") {
      body = initialZy;
    } else {
      const finalZy = FINALS[rest];
      if (finalZy === undefined) return null;
      body = initialZy + finalZy;
    }
  }
  return tone === 0 ? "˙" + body : body + TONE_SUFFIX[tone];
}
