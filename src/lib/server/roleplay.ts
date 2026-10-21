import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import * as OpenCC from "opencc-js";
import type { RoleplayDef, Scenario } from "@/lib/content";
import { trad } from "@/lib/content";
import type { ChatTurn, RoleplayModel, RoleplayTurnData, Sentence } from "@/lib/roleplay-types";

const client = new Anthropic();
const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });

export type FeedbackLanguage = "de" | "en";

const LANGUAGE = {
  de: { name: "German", address: 'addresses the learner with "du"', helpExample: '"So sagst du das:"' },
  en: { name: "English", address: "addresses the learner in a friendly, casual way", helpExample: '"Here\'s how to say it:"' },
} as const;

/** Systemanweisung je App-Sprache (jeweils eigener Zwischenspeicher). */
function systemPrompt(lang: FeedbackLanguage) {
  const L = LANGUAGE[lang];
  return `You are the conversation partner in a Mandarin role-play inside 早安, a learning app for a German native speaker who has just moved to Taiwan and is an absolute beginner. The learner uses the app in ${L.name}.

Language rules:
- Speak Taiwan Mandarin as it is really spoken in Taiwan today: Traditional characters only, Taiwan vocabulary (計程車, 捷運, 塑膠袋, 外帶, 超商, 便當 …) and Taiwan standard pronunciation.
- Every Chinese sentence is given as words: each item is one word or a very short word group ("zh", with any punctuation attached to the end) and its pinyin ("py") with tone marks, written as one lower-case unit without spaces (e.g. 謝謝 → xièxie, 不用 → búyòng). Write the tone changes of 不 and 一 as pronounced (不要 búyào, 一個 yíge); do not mark third-tone sandhi. Use neutral tones the way Taiwanese speakers do.
- Never put pinyin, translations or simplified characters inside "zh".
- The field "de" of every sentence contains its ${L.name} translation. All explanations, praise and tips are in ${L.name}: natural, short, and the text ${L.address}.

For every turn, fill all fields:
1. feedback – about the learner's last message only.
   - "keine": there is no learner message yet (start of the scene). message "", better [].
   - "richtig": understandable and natural. message: short ${L.name} praise (max 8 words). better [].
   - "fast": understandable but wrong or unnatural. message: one short ${L.name} explanation of the most important issue (max 25 words). better: [the corrected sentence].
   - "falsch": not understandable. message: a brief ${L.name} hint. better: [what the learner probably wanted to say].
   - "deutsch": the learner wrote German or English instead of Chinese, or asked for help. message: e.g. ${L.helpExample}. better: [how to say it, as simple as possible].
   Pinyin without tones counts as correct when the intended words are right.
2. reply – stay fully in character. One short, simple sentence with beginner vocabulary, ideally reusing the key phrases of the scene. Speak like a patient local talking to a foreigner. If the learner wrote German or English, react as if they had said the corrected sentence.
3. tip – a short ${L.name} tip about language or Taiwanese everyday culture (max 20 words) only when it genuinely helps right now, otherwise "".
4. suggestions – exactly 3 different things the learner could say next, each one short and simple, fitting the situation right now (one very easy, one polite, one slightly more ambitious).
5. done – true only when the learning goal of the scene is reached. Then the reply ends the conversation politely and tip congratulates briefly in ${L.name}.`;
}

const START_MESSAGE = "(The scene begins. Open the conversation with your first line.)";

const sentenceSchema = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: { zh: { type: "string" }, py: { type: "string" } },
        required: ["zh", "py"],
        additionalProperties: false,
      },
    },
    de: { type: "string" },
  },
  required: ["words", "de"],
  additionalProperties: false,
};

const turnSchema = {
  type: "object",
  properties: {
    feedback: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["keine", "richtig", "fast", "falsch", "deutsch"] },
        message: { type: "string" },
        better: { type: "array", items: sentenceSchema },
      },
      required: ["status", "message", "better"],
      additionalProperties: false,
    },
    reply: sentenceSchema,
    tip: { type: "string" },
    suggestions: { type: "array", items: sentenceSchema },
    done: { type: "boolean" },
  },
  required: ["feedback", "reply", "tip", "suggestions", "done"],
  additionalProperties: false,
};

export class RoleplayError extends Error {
  constructor(
    public code: "refusal" | "incomplete" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

function sceneBlock(scenario: Scenario, roleplay: RoleplayDef, lang: FeedbackLanguage) {
  const phrases = scenario.phrases.map((p) => `- ${trad(p.tokens)} (${lang === "en" ? p.en : p.de})`).join("\n");
  return `Scene: ${roleplay.promptSetting}
Your role: ${lang === "en" ? roleplay.partnerEn : roleplay.partner}
Learning goal: ${roleplay.promptGoal}
Key phrases the learner has studied:
${phrases}`;
}

/** Nur die Felder, die das Modell selbst erzeugt hat – ohne vom Server ergänzte Zeichen. */
function stripForHistory(data: RoleplayTurnData): RoleplayTurnData {
  const clean = (s: Sentence): Sentence => ({ words: s.words.map(({ zh, py }) => ({ zh, py })), de: s.de });
  return {
    feedback: { ...data.feedback, better: data.feedback.better.map(clean) },
    reply: clean(data.reply),
    tip: data.tip,
    suggestions: data.suggestions.map(clean),
    done: data.done,
  };
}

function addSimplified(data: RoleplayTurnData): RoleplayTurnData {
  const withS = (s: Sentence): Sentence => ({
    ...s,
    words: s.words.map((w) => ({ ...w, py: w.py.replace(/[^\p{L}\s'-]/gu, ""), s: toSimplified(w.zh) })),
  });
  return {
    ...data,
    feedback: { ...data.feedback, better: data.feedback.better.map(withS) },
    reply: withS(data.reply),
    suggestions: data.suggestions.map(withS),
  };
}

function isSentence(value: unknown): value is Sentence {
  const s = value as Sentence;
  return !!s && Array.isArray(s.words) && typeof s.de === "string" && s.words.every((w) => typeof w?.zh === "string" && typeof w?.py === "string");
}

export async function generateTurn(opts: {
  scenario: Scenario;
  roleplay: RoleplayDef;
  turns: ChatTurn[];
  model: RoleplayModel;
  language: FeedbackLanguage;
}) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: START_MESSAGE }];
  for (const turn of opts.turns) {
    messages.push(
      turn.role === "user"
        ? { role: "user", content: turn.text }
        : { role: "assistant", content: JSON.stringify(stripForHistory(turn.data)) },
    );
  }

  const isOpus = opts.model === "claude-opus-5";
  const response = await client.beta.messages.create({
    model: opts.model,
    max_tokens: 16000,
    ...(isOpus ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: [
      { type: "text", text: systemPrompt(opts.language), cache_control: { type: "ephemeral" } },
      { type: "text", text: sceneBlock(opts.scenario, opts.roleplay, opts.language) },
    ],
    output_config: {
      format: { type: "json_schema", schema: turnSchema },
      ...(opts.model === "claude-haiku-4-5" ? {} : { effort: "low" as const }),
    },
    messages,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[rollenspiel]", response.model, response.stop_reason, JSON.stringify(response.usage));
  }
  if (response.stop_reason === "refusal") throw new RoleplayError("refusal", "Die KI hat die Antwort abgelehnt.");
  if (response.stop_reason === "max_tokens") throw new RoleplayError("incomplete", "Die Antwort war zu lang.");

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new RoleplayError("invalid", "Keine Antwort erhalten.");

  let data: RoleplayTurnData;
  try {
    data = JSON.parse(text.text);
  } catch {
    throw new RoleplayError("invalid", "Antwort konnte nicht gelesen werden.");
  }
  if (!isSentence(data.reply) || !Array.isArray(data.suggestions) || !data.suggestions.every(isSentence) || !data.feedback) {
    throw new RoleplayError("invalid", "Antwort war unvollständig.");
  }
  return addSimplified({ ...data, suggestions: data.suggestions.slice(0, 3) });
}
