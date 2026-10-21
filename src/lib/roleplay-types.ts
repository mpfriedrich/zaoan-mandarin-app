/** Ein Wort (oder eine kurze Wortgruppe) aus einer KI-Antwort. `s` = vereinfacht, vom Server ergänzt. */
export type Word = { zh: string; py: string; s?: string };
export type Sentence = { words: Word[]; de: string };

export type FeedbackStatus = "keine" | "richtig" | "fast" | "falsch" | "deutsch";

export type RoleplayTurnData = {
  feedback: { status: FeedbackStatus; message: string; better: Sentence[] };
  reply: Sentence;
  tip: string;
  suggestions: Sentence[];
  done: boolean;
};

export type ChatTurn =
  | { role: "user"; text: string; at: number }
  | { role: "assistant"; data: RoleplayTurnData; at: number };

export const ROLEPLAY_MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"] as const;
export type RoleplayModel = (typeof ROLEPLAY_MODELS)[number];

export const MODEL_LABELS: Record<RoleplayModel, string> = {
  "claude-opus-5": "Claude Opus 5",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-haiku-4-5": "Claude Haiku 4.5",
};
