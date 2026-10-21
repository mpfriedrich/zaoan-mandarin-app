import { longestStreak } from "./activity";
import { scenarios } from "./content";
import type { DayRec, LessonRec, RoleplayRec, ScoreRec } from "./db";

export type MilestoneIcon = "tone" | "pin" | "flame" | "cards" | "mic" | "chat";

export type Milestone = {
  id: string;
  icon: MilestoneIcon;
  title: [string, string];
  detail: [string, string];
  current: number;
  goal: number;
  reached: boolean;
};

/** Meilensteine, grob nach Schwierigkeit sortiert. Werden jedes Mal aus den Lerndaten berechnet. */
export function computeMilestones(input: { days: DayRec[]; lessons: LessonRec[]; reviewCount: number; scores: ScoreRec[]; roleplays: RoleplayRec[] }): Milestone[] {
  const learned = new Map(input.lessons.map((l) => [l.id, l.learned.length]));
  const phrases = input.lessons.filter((l) => l.id !== "toene").reduce((n, l) => n + l.learned.length, 0);
  const completeScenarios = scenarios.filter((s) => (learned.get(s.id) ?? 0) >= s.phrases.length).length;
  const streak = longestStreak(input.days);
  const top = input.scores.filter((s) => s.best >= 90).length;
  const finished = input.roleplays.filter((r) => r.finished).length;

  const m = (id: string, icon: MilestoneIcon, title: [string, string], detail: [string, string], current: number, goal: number): Milestone => ({
    id,
    icon,
    title,
    detail,
    current: Math.min(current, goal),
    goal,
    reached: current >= goal,
  });

  return [
    m("toene", "tone", ["Die vier Töne", "The four tones"], ["Tonlektion abgeschlossen", "Finished the tone lesson"], learned.has("toene") ? 1 : 0, 1),
    m("saetze-10", "pin", ["Erste 10 Sätze", "First 10 phrases"], ["10 Sätze gelernt", "Learned 10 phrases"], phrases, 10),
    m("szenario-1", "pin", ["Erstes Szenario", "First scenario"], ["Alle Sätze eines Szenarios gelernt", "Learned every phrase of a scenario"], completeScenarios, 1),
    m("serie-7", "flame", ["Eine Woche dran", "One-week streak"], ["7 Tage in Folge gelernt", "Studied 7 days in a row"], streak, 7),
    m("aussprache-90", "mic", ["Klingt natürlich", "Sounds natural"], ["Erste Aussprache mit 90+", "First pronunciation score of 90+"], top, 1),
    m("rollenspiel-1", "chat", ["Erstes Gespräch", "First conversation"], ["Ein Rollenspiel geschafft", "Completed a role-play"], finished, 1),
    m("wiederholungen-100", "cards", ["100 Wiederholungen", "100 reviews"], ["100 Karten wiederholt", "Reviewed 100 cards"], input.reviewCount, 100),
    m("saetze-50", "pin", ["50 Sätze", "50 phrases"], ["50 Sätze gelernt", "Learned 50 phrases"], phrases, 50),
    m("szenario-5", "pin", ["5 Szenarien", "5 scenarios"], ["5 Szenarien komplett gelernt", "Completed 5 scenarios"], completeScenarios, 5),
    m("serie-30", "flame", ["Ein Monat dran", "One-month streak"], ["30 Tage in Folge gelernt", "Studied 30 days in a row"], streak, 30),
    m("aussprache-20", "mic", ["Aussprache-Profi", "Pronunciation pro"], ["20 Sätze mit 90+", "20 phrases scored 90+"], top, 20),
    m("rollenspiel-5", "chat", ["Gesprächig", "Chatty"], ["5 Rollenspiele geschafft", "Completed 5 role-plays"], finished, 5),
    m("saetze-100", "pin", ["100 Sätze", "100 phrases"], ["100 Sätze gelernt", "Learned 100 phrases"], phrases, 100),
    m("wiederholungen-1000", "cards", ["1.000 Wiederholungen", "1,000 reviews"], ["1.000 Karten wiederholt", "Reviewed 1,000 cards"], input.reviewCount, 1000),
    m(
      "alle-szenarien",
      "pin",
      ["Alltag gemeistert", "Everyday life mastered"],
      [`Alle ${scenarios.length} Szenarien gelernt`, `Completed all ${scenarios.length} scenarios`],
      completeScenarios,
      scenarios.length,
    ),
  ];
}
