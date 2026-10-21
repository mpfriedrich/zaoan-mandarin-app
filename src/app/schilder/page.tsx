"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, ChevronRightIcon, CloseIcon, EyeIcon, InfoIcon } from "@/components/Icons";
import { SpeakIconButton } from "@/components/Speak";
import { addActivity, useStudyTimer } from "@/lib/activity";
import { say } from "@/lib/audio";
import { signCategories, signs, trad, type Sign } from "@/lib/content";
import { notifyChange } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, useT } from "@/lib/i18n";

const ROUNDS = 10;

type Question = { sign: Sign; options: Sign[] };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestions(category: string | null): Question[] {
  const pool = category ? signs.filter((s) => s.category === category) : signs;
  return shuffle(pool)
    .slice(0, ROUNDS)
    .map((sign) => {
      // Ablenker bevorzugt aus derselben Kategorie, damit es nicht zu leicht wird.
      const same = signs.filter((s) => s.category === sign.category && s.id !== sign.id);
      return { sign, options: shuffle([sign, ...shuffle(same).slice(0, 3)]) };
    });
}

/** Schild-Optik: Speisekarten hell wie Papier, Läden rot wie ein Aushang. */
function SignBoard({ sign, script }: { sign: Sign; script: "trad" | "simp" }) {
  const menu = sign.category === "essen";
  const text = sign.tokens.map((tok) => (script === "trad" ? tok.t : tok.s)).join("");
  return (
    <div
      className="zh"
      lang="zh-Hant-TW"
      style={{
        alignSelf: "stretch",
        padding: "28px 16px",
        borderRadius: 16,
        textAlign: "center",
        fontSize: text.length > 4 ? 40 : 52,
        fontWeight: 600,
        letterSpacing: "0.06em",
        background: menu ? "#FFF6E5" : "#C62828",
        color: menu ? "#5D2E0C" : "#FFFFFF",
        border: menu ? "2px solid #E7C9A0" : "2px solid #8E1B1B",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      {text}
    </div>
  );
}

export default function SignsPage() {
  useStudyTimer();
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [category, setCategory] = useState<string | null>(null);

  const start = (cat: string | null) => {
    setCategory(cat);
    setQuestions(buildQuestions(cat));
    setIndex(0);
    setPicked(null);
    setScore(0);
  };

  const current = questions?.[index];

  useEffect(() => {
    if (picked && current) say(trad(current.sign.tokens), { audio: current.sign.audio, voiceURI: settings.voiceURI });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const answer = (option: Sign) => {
    if (picked || !current) return;
    setPicked(option.id);
    if (option.id === current.sign.id) setScore((s) => s + 1);
  };

  const next = async () => {
    setPicked(null);
    setIndex((i) => i + 1);
    if (questions && index + 1 >= questions.length) {
      await addActivity(0, 1);
      notifyChange();
    }
  };

  if (!questions) {
    return (
      <main className="screen fullscreen">
        <div className="topbar">
          <Link href="/szenarien" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
            <span className="close-circle"><CloseIcon /></span>
          </Link>
          <div className="topbar-title">
            <span className="headline">{t("Schilder lesen", "Reading signs")}</span>
          </div>
          <div style={{ width: 44 }} />
        </div>
        <p className="sub muted" style={{ margin: "12px 4px 4px", lineHeight: 1.45 }}>
          {t(
            "Echte Aufschriften aus Taiwan – ohne Pinyin. Erkennst du, was da steht? Danach hörst du die Aussprache.",
            "Real signs from Taiwan – without pinyin. Can you tell what they say? Afterwards you'll hear how they're pronounced.",
          )}
        </p>
        <div className="group" style={{ marginTop: 16 }}>
          {[...signCategories.map((c) => ({ id: c.id as string | null, label: loc(lang, c.title, c.titleEn), count: signs.filter((s) => s.category === c.id).length })), { id: null, label: t("Alles gemischt", "Everything mixed"), count: signs.length }].map((c) => (
            <button key={c.id ?? "alle"} className="group-row" style={{ width: "100%", textAlign: "left" }} onClick={() => start(c.id)}>
              <EyeIcon style={{ color: "var(--indigo)" }} />
              <span className="grow">{c.label}</span>
              <span className="value-text">{t(`${Math.min(ROUNDS, c.count)} Fragen`, `${Math.min(ROUNDS, c.count)} questions`)}</span>
              <ChevronRightIcon style={{ color: "var(--label3)" }} />
            </button>
          ))}
        </div>
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
              ? t("Du kommst in Taiwan schon gut zurecht!", "You're already getting around Taiwan well!")
              : t("Schilder lesen braucht Übung – nochmal lohnt sich.", "Reading signs takes practice – another round is worth it.")}
          </p>
        </div>
        <div className="stack">
          <button className="btn btn-tinted" onClick={() => start(category)}>{t("Nochmal", "Again")}</button>
          <button className="btn btn-primary" onClick={() => setQuestions(null)}>{t("Fertig", "Done")}</button>
        </div>
      </main>
    );
  }

  const optionClass = (option: Sign) => {
    if (!picked) return "choice";
    if (option.id === current.sign.id) return "choice correct";
    return option.id === picked ? "choice wrong" : "choice";
  };
  const hinweis = current.sign.hinweis ? loc(lang, current.sign.hinweis, current.sign.hinweisEn) : null;

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        <button className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }} onClick={() => setQuestions(null)}>
          <span className="close-circle"><CloseIcon /></span>
        </button>
        <div className="topbar-title">
          <span className="headline">{t("Schilder lesen", "Reading signs")}</span>
          <span className="small muted">{t(`Frage ${index + 1} von ${questions.length}`, `Question ${index + 1} of ${questions.length}`)}</span>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div className="progress" style={{ marginTop: 10, height: 4 }}>
        <div style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <section className="card big" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="eyebrow">{t("Was steht da?", "What does it say?")}</span>
          <SignBoard sign={current.sign} script={settings.mainScript} />
          {picked && (
            <div className="row" style={{ gap: 8, justifyContent: "center" }}>
              <ChineseText tokens={current.sign.tokens} size={24} secondary={false} pinyin />
              <SpeakIconButton text={trad(current.sign.tokens)} audio={current.sign.audio} />
            </div>
          )}
        </section>

        {current.options.map((option) => (
          <button key={option.id} className={optionClass(option)} onClick={() => answer(option)}>
            {loc(lang, option.de, option.en)}
          </button>
        ))}

        {picked && hinweis && (
          <div className="info-box">
            <InfoIcon style={{ flexShrink: 0, marginTop: 1, color: "#8E8E93" }} />
            <span>{hinweis}</span>
          </div>
        )}
      </div>

      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-primary" onClick={next} disabled={!picked}>{t("Weiter", "Continue")}</button>
    </main>
  );
}
