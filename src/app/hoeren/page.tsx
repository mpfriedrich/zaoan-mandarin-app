"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, CloseIcon, HeadphonesIcon, SpeakerIcon } from "@/components/Icons";
import { addActivity, useStudyTimer } from "@/lib/activity";
import { say } from "@/lib/audio";
import { phrasesById, scenarios, trad, type Phrase } from "@/lib/content";
import { db, notifyChange } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, quote, useT } from "@/lib/i18n";

const ROUNDS = 10;

type Question = { phrase: Phrase; type: "bedeutung" | "satz"; options: Phrase[] };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestions(learned: Phrase[]): Question[] {
  const all = scenarios.flatMap((s) => s.phrases);
  return shuffle(learned)
    .slice(0, ROUNDS)
    .map((phrase, i) => {
      const pool = learned.length >= 4 ? learned : all;
      const distractors = shuffle(pool.filter((p) => p.id !== phrase.id && p.de !== phrase.de)).slice(0, 3);
      return { phrase, type: i % 2 === 0 ? "bedeutung" : "satz", options: shuffle([phrase, ...distractors]) };
    });
}

export default function ListeningPage() {
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  useStudyTimer();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const start = async () => {
    const lessons = await db.lessons.toArray();
    const learned = lessons
      .filter((l) => l.id !== "toene")
      .flatMap((l) => l.learned)
      .map((id) => phrasesById.get(id))
      .filter((p): p is Phrase => !!p);
    setQuestions(learned.length >= 4 ? buildQuestions(learned) : []);
    setIndex(0);
    setPicked(null);
    setScore(0);
  };

  useEffect(() => {
    void start();
  }, []);

  const current = questions?.[index];
  const play = (slow = false) =>
    current && say(trad(current.phrase.tokens), { audio: current.phrase.audio, voiceURI: settings.voiceURI, slow });

  useEffect(() => {
    if (current) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.phrase.id, index]);

  const answer = (option: Phrase) => {
    if (picked || !current) return;
    setPicked(option.id);
    if (option.id === current.phrase.id) setScore((s) => s + 1);
  };

  const next = async () => {
    setPicked(null);
    setIndex((i) => i + 1);
    if (questions && index + 1 >= questions.length) {
      await addActivity(0, 1);
      notifyChange();
    }
  };

  if (questions === null) return <main className="screen fullscreen" />;

  if (questions.length === 0) {
    return (
      <main className="screen fullscreen">
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <HeadphonesIcon size={48} style={{ color: "var(--blue)" }} />
          <h1 className="title2" style={{ color: "var(--label)" }}>{t("Erst ein paar Sätze lernen", "Learn a few phrases first")}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {t("Das Hörtraining nutzt Sätze, die du schon gelernt hast – mindestens 4.", "Listening practice uses phrases you've already learned – at least 4.")}
          </p>
        </div>
        <Link href="/szenarien" className="btn btn-primary">{t("Zu den Szenarien", "Go to scenarios")}</Link>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="screen fullscreen">
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={36} />
          </div>
          <h1 className="large-title" style={{ color: "var(--label)" }}>{t(`${score} von ${questions.length}`, `${score} of ${questions.length}`)}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {score >= questions.length * 0.8
              ? t("Sehr gut verstanden!", "Very well understood!")
              : t("Hören braucht Übung – nochmal lohnt sich.", "Listening takes practice – another round is worth it.")}
          </p>
        </div>
        <div className="stack">
          <button className="btn btn-tinted" onClick={start}>{t("Nochmal", "Again")}</button>
          <Link href="/" className="btn btn-primary">{t("Fertig", "Done")}</Link>
        </div>
      </main>
    );
  }

  const optionClass = (option: Phrase) => {
    if (!picked) return "choice";
    if (option.id === current.phrase.id) return "choice correct";
    return option.id === picked ? "choice wrong" : "choice";
  };

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        <Link href="/" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
          <span className="close-circle"><CloseIcon /></span>
        </Link>
        <div className="topbar-title">
          <span className="headline">{t("Hörtraining", "Listening")}</span>
          <span className="small muted">{t(`Frage ${index + 1} von ${questions.length}`, `Question ${index + 1} of ${questions.length}`)}</span>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div className="progress" style={{ marginTop: 10, height: 4 }}>
        <div style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <section className="card big" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="eyebrow">
            {current.type === "bedeutung" ? t("Was bedeutet das?", "What does this mean?") : t("Welchen Satz hörst du?", "Which phrase do you hear?")}
          </span>
          <button
            aria-label={t("Anhören", "Listen")}
            onClick={() => play()}
            style={{ width: 64, height: 64, borderRadius: 999, background: "var(--blue)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <SpeakerIcon size={28} />
          </button>
          <button className="sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => play(true)}>{t("Langsam anhören", "Listen slowly")}</button>
          {picked && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <ChineseText tokens={current.phrase.tokens} size={26} secondary={false} />
              <span className="sub muted">{quote(lang, loc(lang, current.phrase.de, current.phrase.en))}</span>
            </div>
          )}
        </section>

        {current.options.map((option) => (
          <button key={option.id} className={optionClass(option)} onClick={() => answer(option)}>
            {current.type === "bedeutung" ? loc(lang, option.de, option.en) : <ChineseText tokens={option.tokens} size={22} secondary={false} />}
          </button>
        ))}
      </div>

      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-primary" onClick={next} disabled={!picked}>{t("Weiter", "Continue")}</button>
    </main>
  );
}
