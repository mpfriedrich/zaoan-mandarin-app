"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { ChineseText } from "@/components/Chinese";
import { CardsIcon, ChartIcon, ChevronRightIcon, FlameIcon, MicIcon, PinFilledIcon } from "@/components/Icons";
import { MilestoneBadge } from "@/components/MilestoneBadge";
import { ScoreLine, WeekBars, type DayBar, type ScorePoint } from "@/components/StatsCharts";
import { computeStreak, dayKey, longestStreak, shiftDay } from "@/lib/activity";
import { phrasesById, scenarios } from "@/lib/content";
import { db } from "@/lib/db";
import { useNow, useSettings } from "@/lib/hooks";
import { dateLocale, loc, useT } from "@/lib/i18n";
import { computeMilestones } from "@/lib/milestones";

const toDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Veränderung zur Vorwoche als kurzer, neutraler Text. */
function delta(current: number, previous: number, unit: string) {
  const diff = Math.round(current - previous);
  if (diff === 0) return `± 0${unit}`;
  return `${diff > 0 ? "↑" : "↓"} ${Math.abs(diff)}${unit}`;
}

export default function ProgressPage() {
  const now = useNow();
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  const days = useLiveQuery(() => db.days.toArray(), []);
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const scores = useLiveQuery(() => db.scores.toArray(), []);
  const roleplays = useLiveQuery(() => db.roleplays.toArray(), []);
  const learnedWords = useLiveQuery(async () => (await db.cards.where("phraseId").startsWith("wort-").uniqueKeys()).length, []);

  if (now === null || !days || !lessons || !reviews || !scores || !roleplays) return <main className="screen" />;

  const today = dayKey(new Date(now));
  const byId = new Map(days.map((d) => [d.id, d]));
  const streak = computeStreak(days, today);
  const bestStreak = longestStreak(days);
  const learnedPhrases = lessons.filter((l) => l.id !== "toene").reduce((n, l) => n + l.learned.length, 0);
  const totalPhrases = scenarios.reduce((n, s) => n + s.phrases.length, 0);
  const totalMinutes = Math.round(days.reduce((n, d) => n + d.seconds, 0) / 60);

  // Woche: Minuten, Wiederholungen und zum ersten Mal wiederholte Karten je Tag.
  const reviewsByDay = new Map<string, number>();
  const firstReview = new Map<string, number>();
  for (const r of reviews) {
    const key = dayKey(new Date(r.reviewedAt));
    reviewsByDay.set(key, (reviewsByDay.get(key) ?? 0) + 1);
    firstReview.set(r.cardId, Math.min(firstReview.get(r.cardId) ?? Infinity, r.reviewedAt));
  }
  const newByDay = new Map<string, number>();
  for (const at of firstReview.values()) {
    const key = dayKey(new Date(at));
    newByDay.set(key, (newByDay.get(key) ?? 0) + 1);
  }
  const weekday = new Intl.DateTimeFormat(dateLocale(lang), { weekday: "short" });
  const longDate = new Intl.DateTimeFormat(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" });
  const shortDate = new Intl.DateTimeFormat(dateLocale(lang), { day: "numeric", month: "short" });
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const previousWeek = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 13));
  const minutesOf = (key: string) => Math.round((byId.get(key)?.seconds ?? 0) / 60);
  const sum = (keys: string[], fn: (key: string) => number) => keys.reduce((n, k) => n + fn(k), 0);
  const bars: DayBar[] = week.map((key) => ({
    key,
    label: weekday.format(toDate(key)).replace(".", ""),
    long: key === today ? t("Heute", "Today") : longDate.format(toDate(key)),
    minutes: minutesOf(key),
    reviews: reviewsByDay.get(key) ?? 0,
  }));
  const weekStats = [
    { label: t("Minuten", "Minutes"), value: sum(week, minutesOf), previous: sum(previousWeek, minutesOf), unit: "" },
    { label: t("Wiederholungen", "Reviews"), value: sum(week, (k) => reviewsByDay.get(k) ?? 0), previous: sum(previousWeek, (k) => reviewsByDay.get(k) ?? 0), unit: "" },
    { label: t("Neue Karten", "New cards"), value: sum(week, (k) => newByDay.get(k) ?? 0), previous: sum(previousWeek, (k) => newByDay.get(k) ?? 0), unit: "" },
  ];
  const activeDays = week.filter((k) => {
    const d = byId.get(k);
    return !!d && (d.activities > 0 || d.seconds >= 60);
  }).length;

  // Aussprache: Tagesdurchschnitt der letzten 30 Tage, schwächste Sätze nach letzter Punktzahl.
  const month = Array.from({ length: 30 }, (_, i) => shiftDay(today, i - 29));
  const points: ScorePoint[] = month.map((key) => {
    const d = byId.get(key);
    const count = d?.pronCount ?? 0;
    return { key, label: shortDate.format(toDate(key)), long: key === today ? t("Heute", "Today") : longDate.format(toDate(key)), avg: count ? (d!.pronSum ?? 0) / count : null, count };
  });
  const average = (keys: string[]) => {
    const [total, count] = keys.reduce(([s, c], k) => [s + (byId.get(k)?.pronSum ?? 0), c + (byId.get(k)?.pronCount ?? 0)], [0, 0]);
    return count ? Math.round(total / count) : null;
  };
  const avgWeek = average(week);
  const avgPrevious = average(previousWeek);
  const phraseScores = scores.filter((s) => phrasesById.has(s.id));
  const topScores = phraseScores.filter((s) => s.best >= 90).length;
  const weakest = [...phraseScores].filter((s) => s.last < 90).sort((a, b) => a.last - b.last).slice(0, 5);
  const measuredDays = points.filter((p) => p.avg !== null).length;

  const milestones = computeMilestones({ days, lessons, reviewCount: reviews.length, scores, roleplays });
  const reached = milestones.filter((m) => m.reached).length;

  return (
    <main className="screen">
      <header className="header">
        <h1 className="large-title">{t("Fortschritt", "Progress")}</h1>
      </header>
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <FlameIcon style={{ color: "var(--orange)" }} />
            <span className="label" style={{ color: "var(--orange-text)" }}>{t("Serie", "Streak")}</span>
          </div>
          <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
            <span className="value">{streak}</span>
            <span className="muted" style={{ fontWeight: 600 }}>{t(streak === 1 ? "Tag in Folge" : "Tage in Folge", streak === 1 ? "day in a row" : "days in a row")}</span>
          </div>
          <span className="sub muted">{t(`Längste Serie: ${bestStreak} ${bestStreak === 1 ? "Tag" : "Tage"}`, `Longest streak: ${bestStreak} ${bestStreak === 1 ? "day" : "days"}`)}</span>
        </section>

        <section className="card">
          <div className="card-head">
            <ChartIcon style={{ color: "var(--blue)" }} />
            <span className="label" style={{ color: "var(--blue-text)" }}>{t("Diese Woche", "This week")}</span>
            <span className="spacer" />
            <span className="muted">{t(`aktiv an ${activeDays} von 7 Tagen`, `active ${activeDays} of 7 days`)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {weekStats.map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
                <span className="title2" style={{ fontWeight: 700 }}>{s.value}</span>
                <span className="small muted">{s.label}</span>
                <span className="small muted">{delta(s.value, s.previous, s.unit)}</span>
              </div>
            ))}
          </div>
          <WeekBars data={bars} goal={settings.dailyGoalMin} t={t} />
          <span className="small muted">
            {t(
              `Linie = Tagesziel (${settings.dailyGoalMin} Min) · Pfeile = Veränderung zur Vorwoche · tippe auf einen Tag für Details`,
              `Line = daily goal (${settings.dailyGoalMin} min) · arrows = change vs. last week · tap a day for details`,
            )}
          </span>
        </section>

        <section className="card">
          <div className="card-head">
            <MicIcon size={16} style={{ color: "var(--red)" }} />
            <span className="label" style={{ color: "var(--red-text)" }}>{t("Aussprache", "Pronunciation")}</span>
          </div>
          {phraseScores.length === 0 && measuredDays === 0 ? (
            <>
              <span className="sub muted">{t("Noch keine Bewertungen. Sprich Sätze nach, dann siehst du hier deinen Verlauf.", "No scores yet. Practice speaking phrases and your progress shows up here.")}</span>
              <Link href="/sprechen" className="btn btn-tinted">{t("Nachsprechen", "Speaking practice")}</Link>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="title2" style={{ fontWeight: 700 }}>{avgWeek ?? "–"}</span>
                  <span className="small muted">{t("Ø diese Woche", "Avg this week")}</span>
                  {avgWeek !== null && avgPrevious !== null && <span className="small muted">{delta(avgWeek, avgPrevious, "")}</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="title2" style={{ fontWeight: 700 }}>{phraseScores.length}</span>
                  <span className="small muted">{t("Sätze geübt", "Phrases practiced")}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="title2" style={{ fontWeight: 700 }}>{topScores}</span>
                  <span className="small muted">{t("mit 90+", "scored 90+")}</span>
                </div>
              </div>
              {measuredDays >= 2 ? (
                <ScoreLine data={points} t={t} />
              ) : (
                <span className="small muted">{t("Der Verlauf erscheint, sobald du an zwei Tagen geübt hast.", "The chart appears once you've practiced on two days.")}</span>
              )}
              {weakest.length > 0 && (
                <>
                  <span className="headline" style={{ marginTop: 4 }}>{t("Noch üben", "Keep practicing")}</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {weakest.map((s) => {
                      const phrase = phrasesById.get(s.id)!;
                      return (
                        <Link key={s.id} href={`/sprechen?id=${s.id}`} className="row" style={{ gap: 10, minHeight: 52, borderTop: "0.5px solid var(--separator)", color: "var(--label)" }}>
                          <div className="grow" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <ChineseText tokens={phrase.tokens} size={18} secondary={false} pinyin={false} />
                            <span className="small muted">{loc(lang, phrase.de, phrase.en)}</span>
                          </div>
                          <span className="rd" style={{ fontWeight: 700 }}>{s.last}</span>
                          <ChevronRightIcon style={{ color: "var(--label3)" }} />
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <PinFilledIcon style={{ color: "var(--green)" }} />
            <span className="label" style={{ color: "var(--green-text)" }}>{t("Gelernte Sätze", "Phrases learned")}</span>
          </div>
          <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
            <span className="value">{learnedPhrases}</span>
            <span className="muted" style={{ fontWeight: 600 }}>{t(`von ${totalPhrases}`, `of ${totalPhrases}`)}</span>
          </div>
          <div className="progress">
            <div style={{ width: `${(learnedPhrases / totalPhrases) * 100}%`, background: "var(--green)" }} />
          </div>
          <span className="sub muted">{t(`Dazu ${learnedWords ?? 0} Wörter als Karteikarten`, `Plus ${learnedWords ?? 0} words as flashcards`)}</span>
        </section>

        <section className="card">
          <div className="card-head">
            <FlameIcon style={{ color: "var(--orange)" }} />
            <span className="label" style={{ color: "var(--orange-text)" }}>{t("Meilensteine", "Milestones")}</span>
            <span className="spacer" />
            <span className="muted">{t(`${reached} von ${milestones.length}`, `${reached} of ${milestones.length}`)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px 8px" }}>
            {milestones.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }} title={t(...m.detail)}>
                <MilestoneBadge milestone={m} />
                <span className="small" style={{ fontWeight: 600, color: m.reached ? "var(--label)" : "var(--label2)" }}>{t(...m.title)}</span>
                <span className="small muted">{m.reached ? t("Erreicht", "Reached") : `${m.current} / ${m.goal}`}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <CardsIcon style={{ color: "var(--blue)" }} />
            <span className="label" style={{ color: "var(--blue-text)" }}>{t("Insgesamt", "Overall")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="value">{reviews.length}</span>
              <span className="sub muted">{t("Wiederholungen", "Reviews")}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="value">{totalMinutes}</span>
              <span className="sub muted">{t("Minuten gelernt", "Minutes studied")}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
