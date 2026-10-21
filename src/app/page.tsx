"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect } from "react";
import { ChevronRightIcon, CardsIcon, ChatFilledIcon, FlameIcon, PersonIcon, PinFilledIcon } from "@/components/Icons";
import { MilestoneBanner } from "@/components/MilestoneBadge";
import { Ring } from "@/components/Ring";
import { computeStreak, dayKey } from "@/lib/activity";
import { beginnerWords, scenarios, trad } from "@/lib/content";
import { db } from "@/lib/db";
import { colorTextVar, colorVar, useMeta, useNow, useSettings } from "@/lib/hooks";
import { dateLocale, loc, useT } from "@/lib/i18n";
import { ensureSpeakCards, ensureWordCards } from "@/lib/srs";

export default function TodayPage() {
  const now = useNow();
  const t = useT();
  // Trägt Wortkarten für bereits gelernte Sätze nach (z. B. nach dem Update oder Sync).
  useEffect(() => {
    void ensureWordCards().then(() => ensureSpeakCards());
  }, []);
  const settings = useSettings();
  const account = useMeta<string>("user", "owner");
  const lang = settings.language;
  const days = useLiveQuery(() => db.days.toArray(), []);
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const due = useLiveQuery(() => db.cards.where("due").belowOrEqual(now ?? 0).count(), [now]);
  const wordCardIds = useLiveQuery(() => db.cards.where("phraseId").startsWith("wort-").primaryKeys(), []);

  if (now === null || days === undefined || lessons === undefined || due === undefined || wordCardIds === undefined) {
    return <main className="screen" />;
  }

  const today = days.find((d) => d.id === dayKey(new Date(now)));
  const minutes = Math.floor((today?.seconds ?? 0) / 60);
  const goal = settings.dailyGoalMin;
  const streak = computeStreak(days, dayKey(new Date(now)));
  const learned = new Map(lessons.map((l) => [l.id, l.learned.length]));
  const tonesDone = learned.has("toene");
  const next = scenarios.find((s) => (learned.get(s.id) ?? 0) < s.phrases.length);
  const recent = [...scenarios].reverse().find((s) => (learned.get(s.id) ?? 0) > 0) ?? scenarios[0];
  const dateLabel = new Intl.DateTimeFormat(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" }).format(now);
  const reviewMinutes = Math.max(1, Math.ceil((due * 15) / 60));
  const newCount = next ? Math.min(4, next.phrases.length - (learned.get(next.id) ?? 0)) : 0;
  const knownWords = new Set((wordCardIds as string[]).map((id) => id.split(":")[0])).size;
  const openWords = beginnerWords.length - knownWords;

  return (
    <main className="screen">
      <header className="header">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="eyebrow">
            {dateLabel}
            {account === "demo" && (
              <span className="badge" style={{ marginLeft: 8, background: "var(--orange)", color: "#FFF", verticalAlign: "1px" }}>Demo</span>
            )}
          </span>
          <h1 className="large-title">{t("Heute", "Today")}</h1>
        </div>
        <Link href="/einstellungen" className="icon-btn" aria-label={t("Einstellungen", "Settings")} style={{ justifyContent: "flex-end" }}>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--fill)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E8E93" }}>
            <PersonIcon />
          </span>
        </Link>
      </header>

      <div className="stack">
        <MilestoneBanner />
        <section className="card" style={{ flexDirection: "row", alignItems: "center", gap: 18, borderRadius: 16, padding: 16 }}>
          <Ring progress={minutes / goal}>
            <span className="rd" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{minutes}</span>
            <span style={{ fontSize: 11 }} className="muted">{t(`von ${goal} Min`, `of ${goal} min`)}</span>
          </Ring>
          <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="sub" style={{ fontWeight: 600, color: "var(--orange-text)" }}>{t("Tagesziel", "Daily goal")}</span>
              <span className="sub muted">
                {minutes >= goal ? t("Geschafft – stark!", "Done – great job!") : t(`Noch ${goal - minutes} Minuten`, `${goal - minutes} minutes to go`)}
              </span>
            </div>
            <div className="hairline" />
            <div className="row" style={{ gap: 6 }}>
              <FlameIcon style={{ color: streak > 0 ? "var(--orange)" : "var(--label3)" }} />
              <span className="rd" style={{ fontWeight: 700 }}>{streak}</span>
              <span className="sub">{t(streak === 1 ? "Tag in Folge" : "Tage in Folge", "day streak")}</span>
            </div>
          </div>
        </section>

        {due > 0 ? (
          <Link href="/wiederholen" className="card">
            <div className="card-head">
              <CardsIcon style={{ color: "var(--blue)" }} />
              <span className="label" style={{ color: "var(--blue-text)" }}>{t("Wiederholen", "Review")}</span>
              <span className="spacer" />
              <span className="muted">{t("Jetzt fällig", "Due now")}</span>
              <ChevronRightIcon style={{ color: "var(--label3)" }} />
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
              <span className="value">{due}</span>
              <span className="muted" style={{ fontWeight: 600 }}>
                {t(`${due === 1 ? "Karte" : "Karten"} · ca. ${reviewMinutes} Min`, `${due === 1 ? "card" : "cards"} · about ${reviewMinutes} min`)}
              </span>
            </div>
          </Link>
        ) : (
          <div className="card">
            <div className="card-head">
              <CardsIcon style={{ color: "var(--blue)" }} />
              <span className="label" style={{ color: "var(--blue-text)" }}>{t("Wiederholen", "Review")}</span>
            </div>
            <span className="title2">{t("Alles erledigt", "All done")}</span>
            <span className="sub muted">{t("Neue Karten entstehen, sobald du Sätze lernst.", "New cards appear as soon as you learn phrases.")}</span>
          </div>
        )}

        {!tonesDone && (
          <Link href="/toene" className="card">
            <div className="card-head">
              <span className="badge badge-orange">Start</span>
              <span className="label" style={{ color: "var(--orange-text)" }}>{t("Grundlagen", "Basics")}</span>
              <span className="spacer" />
              <span className="muted">{t("ca. 5 Min", "about 5 min")}</span>
              <ChevronRightIcon style={{ color: "var(--label3)" }} />
            </div>
            <span className="title2">{t("Die vier Töne", "The four tones")}</span>
            <span className="sub muted">{t("Hör dir die Töne an, bevor du loslegst.", "Listen to the tones before you get started.")}</span>
          </Link>
        )}

        {openWords > 0 && (
          <Link href="/woerter" className="card">
            <div className="card-head">
              <CardsIcon style={{ color: "var(--indigo)" }} />
              <span className="label" style={{ color: "var(--indigo-text)" }}>{t("Wörter", "Words")}</span>
              <span className="spacer" />
              <span className="muted">{t("ca. 3 Min", "about 3 min")}</span>
              <ChevronRightIcon style={{ color: "var(--label3)" }} />
            </div>
            <span className="title2">{t("Einzelne Wörter lernen", "Learn single words")}</span>
            <span className="sub muted">
              {t(`${openWords} Wörter offen · von leicht nach schwer`, `${openWords} words to go · from easy to hard`)}
            </span>
          </Link>
        )}

        {next && (
          <Link href={`/lernen/${next.id}`} className="card">
            <div className="card-head">
              <PinFilledIcon style={{ color: colorVar(next.color) }} />
              <span className="label" style={{ color: colorTextVar(next.color) }}>{t("Weiter lernen", "Keep learning")}</span>
              <span className="spacer" />
              <span className="muted">{t(`${newCount} neue Sätze`, `${newCount} new phrases`)}</span>
              <ChevronRightIcon style={{ color: "var(--label3)" }} />
            </div>
            <div className="row" style={{ alignItems: "baseline" }}>
              <span className="title2">{loc(lang, next.title, next.titleEn)}</span>
              <span className="zh muted">{trad(next.zhTokens)}</span>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <div className="progress grow">
                <div style={{ width: `${((learned.get(next.id) ?? 0) / next.phrases.length) * 100}%`, background: colorVar(next.color) }} />
              </div>
              <span className="small muted">{t(`${learned.get(next.id) ?? 0} von ${next.phrases.length}`, `${learned.get(next.id) ?? 0} of ${next.phrases.length}`)}</span>
            </div>
          </Link>
        )}

        <Link href={`/rollenspiel/${recent.roleplay.id}`} className="card">
          <div className="card-head">
            <ChatFilledIcon style={{ color: "var(--indigo)" }} />
            <span className="label" style={{ color: "var(--indigo-text)" }}>{t("Rollenspiel", "Role-play")}</span>
            <span className="spacer" />
            <span className="muted">{t("ca. 5 Min", "about 5 min")}</span>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="title2">{loc(lang, recent.roleplay.title, recent.roleplay.titleEn)}</span>
              <span className="sub muted">{t("Sprich mit: ", "Talk to: ")}{loc(lang, recent.roleplay.partner, recent.roleplay.partnerEn)}</span>
            </div>
            <span className="btn btn-capsule" style={{ background: "color-mix(in srgb, var(--indigo) 12%, transparent)", color: "var(--indigo-text)" }}>
              {t("Starten", "Start")}
            </span>
          </div>
        </Link>
      </div>
    </main>
  );
}
