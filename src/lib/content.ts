import data from "@/content/generated.json";

/** Ein Zeichen: traditionell, vereinfacht, Pinyin, Zhuyin (leer bei Satzzeichen). */
export type Token = { t: string; s: string; p: string; z: string };

export type Phrase = {
  id: string;
  scenarioId: string;
  tokens: Token[];
  de: string;
  en: string;
  von: "du" | "gegenueber";
  /** Pfad zur Azure-Audiodatei, falls schon erzeugt. */
  audio?: string;
  hinweis?: string;
  hinweisEn?: string;
  twcn?: { de: string; en: string; tw: { tokens: Token[]; audio?: string }; cn: { zh: string; py: string } };
};

export type RoleplayDef = {
  id: string;
  title: string;
  titleEn: string;
  partner: string;
  partnerEn: string;
  setting: string;
  settingEn: string;
  goal: string;
  goalEn: string;
  promptSetting: string;
  promptGoal: string;
};

/** Wichtiges Wort eines Szenarios; `id` beginnt mit „wort-“. */
export type VocabWord = { id: string; scenarioId: string; tokens: Token[]; de: string; en: string; tocfl?: string; gruppe?: string; gruppeEn?: string; stufe?: string; audio?: string };

/** Alles, was als Karteikarte wiederholt werden kann: Sätze und Wörter. */
export type StudyItem = Pick<Phrase, "id" | "scenarioId" | "tokens" | "de" | "en" | "audio" | "hinweis" | "hinweisEn">;

export type Scenario = {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  color: "orange" | "green" | "indigo" | "blue" | "red";
  partnerVoice: "female" | "male";
  zhTokens: Token[];
  roleplay: RoleplayDef;
  words: VocabWord[];
  phrases: Phrase[];
};

export type ToneItem = { char: string; simp: string; tone: number; py: string; zy: string; de: string; en: string; audio?: string };
export type ToneSet = { syllable: string; items: ToneItem[] };

export type PairWord = { tokens: Token[]; de: string; en: string; audio?: string };
export type TonePair = PairWord & { tones: number[]; hinweis?: string; hinweisEn?: string };
export type MinimalPair = { a: PairWord; b: PairWord };

/** Schild, Speisekarte oder Aushang für das Lese-Quiz. */
export type Sign = { id: string; category: string; tokens: Token[]; de: string; en: string; hinweis?: string; hinweisEn?: string; audio?: string };
export type SignCategory = { id: string; title: string; titleEn: string };

export const scenarios = data.scenarios as unknown as Scenario[];
export const signs = data.signs as unknown as Sign[];
/** Grundwortschatz ohne Szenario – steht in „Wörter lernen“ am Anfang. */
export const basicWords = data.basicWords as unknown as VocabWord[];
/** Hochfrequenz-Wortschatz: TOCFL Novice 1 und 2, eigener Bereich mit Stufen. */
export const frequencyWords = data.frequencyWords as unknown as VocabWord[];
export const frequencyLevels = data.frequencyLevels as unknown as { id: string; title: string; titleEn: string }[];
export const signCategories = data.signCategories as unknown as SignCategory[];
export const toneSets = data.toneSets as unknown as ToneSet[];
export const tonePairs = data.tonePairs as unknown as TonePair[];
export const minimalPairs = data.minimalPairs as unknown as MinimalPair[];

export const phrasesById = new Map<string, Phrase>(scenarios.flatMap((s) => s.phrases.map((p) => [p.id, p] as const)));
export const scenariosById = new Map<string, Scenario>(scenarios.map((s) => [s.id, s]));
export const wordsById = new Map<string, VocabWord>([
  ...basicWords.map((w) => [w.id, w] as const),
  ...frequencyWords.map((w) => [w.id, w] as const),
  ...scenarios.flatMap((s) => s.words.map((w) => [w.id, w] as const)),
]);
export const itemsById = new Map<string, StudyItem>([...phrasesById, ...wordsById]);
export const isWordId = (id: string) => id.startsWith("wort-");
export const roleplaysById = new Map<string, { scenario: Scenario; roleplay: RoleplayDef }>(
  scenarios.map((s) => [s.roleplay.id, { scenario: s, roleplay: s.roleplay }]),
);

export const trad = (tokens: Token[]) => tokens.map((t) => t.t).join("");
export const simp = (tokens: Token[]) => tokens.map((t) => t.s).join("");
export const pinyinText = (tokens: Token[]) => tokens.map((t) => t.p).filter(Boolean).join(" ");

/** Rang der TOCFL-Stufen von leicht nach schwer. */
const TOCFL_RANK: Record<string, number> = { "Novice 1": 1, "Novice 2": 2, A1: 3, A2: 4, B1: 5, B2: 6, C1: 7, C2: 8 };

/** Wie schwer ein Wort für den Anfang ist. Ohne TOCFL-Stufe entscheidet die Wortlänge. */
export const wordDifficulty = (word: VocabWord) =>
  word.tocfl ? (TOCFL_RANK[word.tocfl] ?? 4) : trad(word.tokens).length <= 2 ? 2.5 : 3.5;

/** Reihenfolge für „Wörter lernen“: erst der Grundwortschatz, dann die Szenario-Wörter von leicht nach schwer. */
export const beginnerWords: VocabWord[] = [
  ...basicWords,
  ...scenarios
    .flatMap((s) => s.words)
    .sort((a, b) => wordDifficulty(a) - wordDifficulty(b) || trad(a.tokens).length - trad(b.tokens).length),
];
