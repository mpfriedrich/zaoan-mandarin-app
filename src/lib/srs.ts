import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";
import { db, notifyChange, type CardKind, type CardRec } from "./db";
import { addActivity } from "./activity";
import { isWordId, phrasesById, scenariosById, trad } from "./content";

/** Sprechen-Karten: freigeschaltet, wenn die Lesen-Karte so oft ohne Vergessen wiederholt wurde. */
const SPEAK_UNLOCK_REVIEWS = 3;
/** Höchstens so viele noch nie geübte Sprechen-Karten gleichzeitig, damit die Wiederholungen nicht überlaufen. */
const SPEAK_MAX_NEW = 5;

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 365 }));

export const GRADES: { grade: Grade; label: string; labelEn: string; className: string }[] = [
  { grade: Rating.Again, label: "Nochmal", labelEn: "Again", className: "again" },
  { grade: Rating.Hard, label: "Schwer", labelEn: "Hard", className: "hard" },
  { grade: Rating.Good, label: "Gut", labelEn: "Good", className: "good" },
  { grade: Rating.Easy, label: "Einfach", labelEn: "Easy", className: "easy" },
];

export const cardId = (phraseId: string, kind: CardKind) => `${phraseId}:${kind}`;

/** Legt für einen Satz oder ein Wort die Karten „Lesen“ und „Hören“ an (falls noch nicht vorhanden). */
export async function createCards(itemId: string) {
  const now = Date.now();
  let created = 0;
  for (const kind of ["lesen", "hoeren"] as const) {
    const id = cardId(itemId, kind);
    if (await db.cards.get(id)) continue;
    const card = createEmptyCard(new Date(now));
    await db.cards.put({ id, phraseId: itemId, kind, card, due: now, updatedAt: now });
    created++;
  }
  return created;
}

/**
 * Wortkarten für gelernte Sätze: ein Wort kommt dazu, sobald es in einem gelernten Satz vorkommt,
 * und alle Wörter eines Szenarios, sobald alle seine Sätze gelernt sind. Mehrfaches Aufrufen schadet nicht.
 */
export async function ensureWordCards() {
  const lessons = await db.lessons.toArray();
  let created = 0;
  for (const lesson of lessons) {
    const scenario = scenariosById.get(lesson.id);
    if (!scenario) continue;
    const learned = new Set(lesson.learned);
    const allLearned = scenario.phrases.every((p) => learned.has(p.id));
    const learnedText = scenario.phrases.filter((p) => learned.has(p.id)).map((p) => trad(p.tokens)).join("|");
    for (const word of scenario.words) {
      if (allLearned || learnedText.includes(trad(word.tokens))) created += await createCards(word.id);
    }
  }
  if (created > 0) notifyChange();
  return created;
}

/**
 * Legt Sprechen-Karten für Sätze an, die du selbst sagst und schon sicher lesen kannst.
 * Mehrfaches Aufrufen schadet nicht.
 */
export async function ensureSpeakCards() {
  const cards = await db.cards.toArray();
  const existing = new Set(cards.map((c) => c.id));
  let waiting = cards.filter((c) => c.kind === "sprechen" && c.card.state === State.New).length;
  const now = Date.now();
  let created = 0;
  for (const rec of cards) {
    if (waiting >= SPEAK_MAX_NEW) break;
    if (rec.kind !== "lesen" || isWordId(rec.phraseId)) continue;
    if (phrasesById.get(rec.phraseId)?.von !== "du") continue;
    if (rec.card.state !== State.Review || rec.card.reps - rec.card.lapses < SPEAK_UNLOCK_REVIEWS) continue;
    const id = cardId(rec.phraseId, "sprechen");
    if (existing.has(id)) continue;
    await db.cards.put({ id, phraseId: rec.phraseId, kind: "sprechen", card: createEmptyCard(new Date(now)), due: now, updatedAt: now });
    waiting++;
    created++;
  }
  if (created > 0) notifyChange();
  return created;
}

/**
 * Karten desselben Begriffs auseinanderziehen: „Lesen“ und „Hören“ werden zusammen fällig und
 * kämen sonst direkt hintereinander – dann wüsste man die zweite Antwort noch auswendig.
 */
export function spreadCards<T extends { phraseId: string }>(cards: T[], gap = 3): T[] {
  const pending = [...cards];
  const out: T[] = [];
  while (pending.length > 0) {
    const recent = out.slice(-gap).map((c) => c.phraseId);
    const found = pending.findIndex((c) => !recent.includes(c.phraseId));
    out.push(...pending.splice(found < 0 ? 0 : found, 1));
  }
  return out;
}

/** Bewertungs-Vorschlag aus der Aussprache-Punktzahl (Einfach schlägt die App nie vor). */
export function suggestGrade(score: number): Grade {
  return score >= 90 ? Rating.Good : score >= 75 ? Rating.Hard : Rating.Again;
}

/** Nächste Termine je Bewertung, z. B. für die Beschriftung der Knöpfe. */
export function previewIntervals(rec: CardRec, now = new Date()): Record<Grade, number> {
  const preview = scheduler.repeat(rec.card, now);
  const result = {} as Record<Grade, number>;
  for (const { grade } of GRADES) result[grade] = new Date(preview[grade].card.due).getTime() - now.getTime();
  return result;
}

export async function reviewCard(rec: CardRec, grade: Grade): Promise<CardRec> {
  const now = new Date();
  const { card } = scheduler.next(rec.card, now, grade);
  const ts = now.getTime();
  const updated: CardRec = { ...rec, card: card as Card, due: new Date(card.due).getTime(), updatedAt: ts };
  await db.transaction("rw", db.cards, db.reviews, async () => {
    await db.cards.put(updated);
    await db.reviews.put({ id: crypto.randomUUID(), cardId: rec.id, rating: grade, reviewedAt: ts, updatedAt: ts });
  });
  await addActivity(0, 1);
  notifyChange();
  return updated;
}

export function formatInterval(ms: number, lang: "de" | "en" = "de") {
  const en = lang === "en";
  const min = Math.round(ms / 60000);
  if (min < 1) return en ? "< 1 min" : "< 1 Min";
  if (min < 60) return en ? `${min} min` : `${min} Min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return en ? `${hours} h` : `${hours} Std`;
  const days = Math.round(hours / 24);
  if (days < 31) return en ? (days === 1 ? "1 day" : `${days} days`) : days === 1 ? "1 Tag" : `${days} Tage`;
  const months = Math.round(days / 30);
  return en ? (months === 1 ? "1 month" : `${months} months`) : months === 1 ? "1 Monat" : `${months} Monate`;
}
