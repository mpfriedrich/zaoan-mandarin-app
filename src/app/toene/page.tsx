"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon, CloseIcon, InfoIcon, SpeakerIcon, ToneContour } from "@/components/Icons";
import { ToneCurve } from "@/components/ToneCurve";
import { addActivity, useStudyTimer } from "@/lib/activity";
import { say } from "@/lib/audio";
import { minimalPairs, pinyinText, tonePairs, toneSets, trad, type TonePair } from "@/lib/content";
import { db, notifyChange } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, quote, useT } from "@/lib/i18n";
import { analyseTones, type CurveSyllable } from "@/lib/tonecurve";

const QUIZ_LENGTH = 10;
const TONE_NAMES: [string, string][] = [
  ["Neutraler Ton", "Neutral tone"],
  ["1. Ton · gleichbleibend hoch", "1st tone · high and level"],
  ["2. Ton · steigend", "2nd tone · rising"],
  ["3. Ton · tief, fällt und steigt", "3rd tone · low, dips and rises"],
  ["4. Ton · fallend", "4th tone · falling"],
];
const toneShort = (tone: number) => (tone === 0 ? "neutral" : String(tone));

type QuizKind = "einzeln" | "paare" | "minimal";
type Option = { key: string; tones?: number[]; py?: string; zh?: string; de?: string; en?: string };
type Question = { text: string; audio?: string; options: Option[]; answer: string; reveal: { zh: string; py: string; de: string; en: string } };

const QUIZ_TITLES: Record<QuizKind, [string, string]> = {
  einzeln: ["Welchen Ton hörst du?", "Which tone do you hear?"],
  paare: ["Welche Tonfolge hörst du?", "Which tone pattern do you hear?"],
  minimal: ["Welches Wort hörst du?", "Which word do you hear?"],
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeQuestion(kind: QuizKind): Question {
  if (kind === "einzeln") {
    const set = pick(toneSets);
    const item = pick(set.items);
    return {
      text: item.char,
      audio: item.audio,
      options: set.items.map((o) => ({ key: String(o.tone), tones: [o.tone], py: o.py })),
      answer: String(item.tone),
      reveal: { zh: item.char, py: item.py, de: item.de, en: item.en },
    };
  }
  if (kind === "paare") {
    const pair = pick(tonePairs);
    const others = shuffle(tonePairs.filter((p) => p.tones.join("-") !== pair.tones.join("-"))).slice(0, 3);
    return {
      text: trad(pair.tokens),
      audio: pair.audio,
      options: shuffle([pair, ...others]).map((p) => ({ key: p.tones.join("-"), tones: p.tones })),
      answer: pair.tones.join("-"),
      reveal: { zh: trad(pair.tokens), py: pinyinText(pair.tokens), de: pair.de, en: pair.en },
    };
  }
  const mp = pick(minimalPairs);
  const target = Math.random() < 0.5 ? mp.a : mp.b;
  return {
    text: trad(target.tokens),
    audio: target.audio,
    options: [mp.a, mp.b].map((w) => ({ key: trad(w.tokens), zh: trad(w.tokens), py: pinyinText(w.tokens), de: w.de, en: w.en })),
    answer: trad(target.tokens),
    reveal: { zh: trad(target.tokens), py: pinyinText(target.tokens), de: target.de, en: target.en },
  };
}

export default function TonesPage() {
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  useStudyTimer();
  const [mode, setMode] = useState<"learn" | "quiz" | "done">("learn");
  const [kind, setKind] = useState<QuizKind>("einzeln");
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const play = (text: string, audio?: string) => say(text, { audio, voiceURI: settings.voiceURI, slow: !audio });
  const [curve, setCurve] = useState<{ pair: TonePair; syllables: CurveSyllable[] | null } | null>(null);

  const showPair = async (pair: TonePair) => {
    play(trad(pair.tokens), pair.audio);
    setCurve({ pair, syllables: null });
    const syllables = await analyseTones(pair.tokens, pair.audio);
    setCurve((c) => (c?.pair === pair ? { pair, syllables } : c));
  };

  const current = quiz[index];
  useEffect(() => {
    if (mode === "quiz" && current) play(current.text, current.audio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, index, quiz]);

  const start = (next: QuizKind) => {
    setKind(next);
    setQuiz(Array.from({ length: QUIZ_LENGTH }, () => makeQuestion(next)));
    setIndex(0);
    setScore(0);
    setPicked(null);
    setMode("quiz");
    window.scrollTo(0, 0);
  };

  const answer = (key: string) => {
    if (picked !== null) return;
    setPicked(key);
    if (key === current.answer) setScore((s) => s + 1);
  };

  const next = async () => {
    if (index + 1 < quiz.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    setMode("done");
    if (!(await db.lessons.get("toene"))) await db.lessons.put({ id: "toene", learned: ["done"], updatedAt: Date.now() });
    await addActivity(0, 1);
    notifyChange();
  };

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        {mode === "learn" ? (
          <Link href="/szenarien" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
            <span className="close-circle"><CloseIcon /></span>
          </Link>
        ) : (
          <button className="icon-btn" aria-label={t("Zur Übersicht", "Back to overview")} style={{ justifyContent: "flex-start" }} onClick={() => setMode("learn")}>
            <span className="close-circle"><CloseIcon /></span>
          </button>
        )}
        <div className="topbar-title">
          <span className="headline">{t("Töne", "Tones")}</span>
          {mode === "quiz" && <span className="small muted">{t(`Frage ${index + 1} von ${quiz.length}`, `Question ${index + 1} of ${quiz.length}`)}</span>}
        </div>
        <div style={{ width: 44 }} />
      </div>

      {mode === "learn" && (
        <div className="stack" style={{ marginTop: 16 }}>
          <p className="sub" style={{ margin: "0 4px", lineHeight: 1.45 }}>
            {t(
              "Mandarin hat vier Töne und einen neutralen Ton. Dieselbe Silbe bedeutet mit einem anderen Ton etwas völlig anderes. Tippe auf eine Zeile, um sie zu hören.",
              "Mandarin has four tones and a neutral tone. The same syllable means something completely different with another tone. Tap a row to hear it.",
            )}
          </p>
          <div className="group">
            {toneSets[0].items.map((item) => (
              <button key={item.char} className="group-row" style={{ width: "100%", textAlign: "left", minHeight: 60 }} onClick={() => play(item.char, item.audio)}>
                <ToneContour tone={item.tone} style={{ color: "var(--blue)" }} />
                <div className="grow" style={{ display: "flex", flexDirection: "column" }}>
                  <span className="headline">{item.py} <span className="zh" style={{ fontWeight: 400 }}>{item.char}</span></span>
                  <span className="small muted">{t(...TONE_NAMES[item.tone])} · {quote(lang, loc(lang, item.de, item.en))}</span>
                </div>
                <SpeakerIcon size={18} style={{ color: "var(--blue)" }} />
              </button>
            ))}
            <button className="group-row" style={{ width: "100%", textAlign: "left", minHeight: 60 }} onClick={() => play("好嗎")}>
              <ToneContour tone={0} style={{ color: "var(--blue)" }} />
              <div className="grow" style={{ display: "flex", flexDirection: "column" }}>
                <span className="headline">ma <span className="zh" style={{ fontWeight: 400 }}>嗎</span></span>
                <span className="small muted">
                  {t("Neutraler Ton · kurz und leicht, z. B. als Fragewort", "Neutral tone · short and light, e.g. as a question word")}
                </span>
              </div>
              <SpeakerIcon size={18} style={{ color: "var(--blue)" }} />
            </button>
          </div>
          <button className="btn btn-tinted" onClick={() => start("einzeln")}>{t("Hörtest: einzelne Töne", "Listening test: single tones")}</button>

          <h2 className="section-header" style={{ marginBottom: 0 }}>{t("Tonpaare", "Tone pairs")}</h2>
          <p className="sub muted" style={{ margin: "0 4px", lineHeight: 1.45 }}>
            {t(
              "Im Alltag kommen Töne fast immer zu zweit. Zeile = erster Ton, Spalte = zweiter Ton.",
              "In everyday speech tones almost always come in pairs. Row = first tone, column = second tone.",
            )}
          </p>
          <div className="card" style={{ padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "20px repeat(5, minmax(0, 1fr))", gap: 4, alignItems: "center" }}>
              <span />
              {[1, 2, 3, 4, 0].map((tone) => (
                <span key={tone} style={{ display: "flex", justifyContent: "center", color: "var(--label2)" }}>
                  <ToneContour tone={tone} size={20} />
                </span>
              ))}
              {[1, 2, 3, 4].map((first, row) => (
                <div key={first} style={{ display: "contents" }}>
                  <span className="small muted" style={{ textAlign: "center", fontWeight: 600 }}>{first}</span>
                  {tonePairs.slice(row * 5, row * 5 + 5).map((pair) => (
                    <button
                      key={trad(pair.tokens)}
                      onClick={() => void showPair(pair)}
                      style={{ minHeight: 56, borderRadius: 10, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: "4px 2px" }}
                    >
                      <span className="zh" style={{ fontSize: 17 }}>{trad(pair.tokens)}</span>
                      <span style={{ fontSize: 11, color: "var(--blue-text)", whiteSpace: "nowrap" }}>{pinyinText(pair.tokens).replace(" ", "")}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {curve && (
            <section className="card" style={{ gap: 8 }}>
              <div className="row">
                <span className="headline grow">
                  {t("Tonkurve: ", "Tone curve: ")}
                  <span className="zh">{trad(curve.pair.tokens)}</span> {pinyinText(curve.pair.tokens)} · {loc(lang, curve.pair.de, curve.pair.en)}
                </span>
                <button className="sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => play(trad(curve.pair.tokens), curve.pair.audio)}>
                  {t("Nochmal", "Again")}
                </button>
              </div>
              {curve.syllables ? (
                <ToneCurve syllables={curve.syllables} showUser={false} />
              ) : (
                <span className="small muted">{t("Wird berechnet …", "Calculating …")}</span>
              )}
            </section>
          )}
          {tonePairs.filter((p) => p.hinweis).map((p) => (
            <div key={trad(p.tokens)} className="info-box" style={{ background: "var(--card)" }}>
              <InfoIcon style={{ flexShrink: 0, marginTop: 1, color: "#8E8E93" }} />
              <span><span className="zh">{trad(p.tokens)}</span>: {loc(lang, p.hinweis!, p.hinweisEn)}</span>
            </div>
          ))}
          <button className="btn btn-tinted" onClick={() => start("paare")}>{t("Hörtest: Tonpaare", "Listening test: tone pairs")}</button>

          <h2 className="section-header" style={{ marginBottom: 0 }}>{t("Minimalpaare", "Minimal pairs")}</h2>
          <p className="sub muted" style={{ margin: "0 4px", lineHeight: 1.45 }}>
            {t("Gleiche Laute, anderer Ton – ganz andere Bedeutung.", "Same sounds, different tone – completely different meaning.")}
          </p>
          <div className="group" style={{ paddingLeft: 0 }}>
            {minimalPairs.map((mp) => (
              <div key={trad(mp.a.tokens)} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderBottom: "0.5px solid var(--separator)" }}>
                {[mp.a, mp.b].map((w, i) => (
                  <button
                    key={trad(w.tokens)}
                    onClick={() => play(trad(w.tokens), w.audio)}
                    style={{ minHeight: 64, padding: "8px 12px", textAlign: "left", borderLeft: i === 1 ? "0.5px solid var(--separator)" : undefined, display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <span><span className="zh" style={{ fontSize: 20 }}>{trad(w.tokens)}</span> <span className="sub" style={{ color: "var(--blue-text)" }}>{pinyinText(w.tokens)}</span></span>
                    <span className="small muted">{loc(lang, w.de, w.en)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button className="btn btn-tinted" onClick={() => start("minimal")}>{t("Hörtest: Minimalpaare", "Listening test: minimal pairs")}</button>
        </div>
      )}

      {mode === "quiz" && current && (
        <>
          <div className="stack" style={{ marginTop: 16 }}>
            <section className="card big" style={{ alignItems: "center", textAlign: "center" }}>
              <span className="eyebrow">{t(...QUIZ_TITLES[kind])}</span>
              <button
                aria-label={t("Nochmal anhören", "Listen again")}
                onClick={() => play(current.text, current.audio)}
                style={{ width: 64, height: 64, borderRadius: 999, background: "var(--blue)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <SpeakerIcon size={28} />
              </button>
              {picked !== null && (
                <span className="sub">
                  <span className="zh" style={{ fontSize: 22 }}>{current.reveal.zh}</span> {current.reveal.py} · {quote(lang, loc(lang, current.reveal.de, current.reveal.en))}
                </span>
              )}
            </section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {current.options.map((option) => {
                const state = picked === null ? "" : option.key === current.answer ? " correct" : option.key === picked ? " wrong" : "";
                return (
                  <button key={option.key} className={"choice" + state} onClick={() => answer(option.key)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    {option.tones && (
                      <span className="row" style={{ gap: 2, color: "var(--blue)" }}>
                        {option.tones.map((tone, i) => (
                          <ToneContour key={i} tone={tone} size={24} />
                        ))}
                      </span>
                    )}
                    {kind === "einzeln" && <span style={{ fontSize: 22, fontWeight: 600 }}>{option.py}</span>}
                    {kind === "paare" && <span className="sub">{option.tones?.map(toneShort).join(" + ")}</span>}
                    {kind === "minimal" && (
                      <>
                        <span><span className="zh" style={{ fontSize: 22 }}>{option.zh}</span> <span className="sub" style={{ color: "var(--blue-text)" }}>{option.py}</span></span>
                        <span className="small muted">{loc(lang, option.de ?? "", option.en)}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="spacer" style={{ minHeight: 16 }} />
          <button className="btn btn-primary" onClick={next} disabled={picked === null}>{t("Weiter", "Continue")}</button>
        </>
      )}

      {mode === "done" && (
        <>
          <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckIcon size={36} />
            </div>
            <h1 className="large-title" style={{ color: "var(--label)" }}>{t(`${score} von ${quiz.length}`, `${score} of ${quiz.length}`)}</h1>
            <p className="sub" style={{ margin: 0 }}>
              {score >= 8
                ? t("Sehr gut – deine Ohren gewöhnen sich an die Töne.", "Very good – your ears are getting used to the tones.")
                : t("Töne brauchen Übung. Wiederhole den Test ruhig ein paar Mal.", "Tones take practice. Feel free to repeat the test a few times.")}
            </p>
          </div>
          <div className="stack">
            <button className="btn btn-tinted" onClick={() => start(kind)}>{t("Nochmal", "Again")}</button>
            <button className="btn btn-primary" onClick={() => setMode("learn")}>{t("Zur Übersicht", "Back to overview")}</button>
          </div>
        </>
      )}
    </main>
  );
}
