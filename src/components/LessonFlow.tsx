"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, CloseIcon, InfoIcon, MicIcon, SpeakerIcon } from "@/components/Icons";
import { SpeakPractice } from "@/components/SpeakPractice";
import { SpeakButtons } from "@/components/Speak";
import { addActivity, useStudyTimer } from "@/lib/activity";
import { say } from "@/lib/audio";
import { scenariosById, trad, type Phrase } from "@/lib/content";
import { db, notifyChange } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, quote, useT } from "@/lib/i18n";
import { createCards, ensureWordCards } from "@/lib/srs";

const BATCH_SIZE = 4;

type Step =
  | { type: "learn"; phrase: Phrase }
  | { type: "meaning"; phrase: Phrase; options: Phrase[] }
  | { type: "listen"; phrase: Phrase; options: Phrase[] };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function optionsFor(phrase: Phrase, pool: Phrase[]) {
  const distractors = shuffle(pool.filter((p) => p.id !== phrase.id)).slice(0, 3);
  return shuffle([phrase, ...distractors]);
}

function buildSteps(batch: Phrase[], pool: Phrase[]): Step[] {
  const learn: Step[] = batch.map((phrase) => ({ type: "learn", phrase }));
  const quiz: Step[] = batch.map((phrase, i) =>
    i % 2 === 0
      ? { type: "meaning", phrase, options: optionsFor(phrase, pool) }
      : { type: "listen", phrase, options: optionsFor(phrase, pool) },
  );
  return [...learn, ...shuffle(quiz)];
}

export function LessonFlow({ id }: { id: string }) {
  const scenario = scenariosById.get(id)!;
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  useStudyTimer();

  const [batch, setBatch] = useState<Phrase[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const retried = useRef(new Set<string>());
  const saved = useRef(false);

  useEffect(() => {
    db.lessons.get(id).then((lesson) => {
      const learned = new Set(lesson?.learned ?? []);
      const next = scenario.phrases.filter((p) => !learned.has(p.id)).slice(0, BATCH_SIZE);
      setBatch(next);
      setSteps(buildSteps(next, scenario.phrases));
    });
  }, [id, scenario]);

  const step = steps[index];
  const finished = batch !== null && batch.length > 0 && index >= steps.length;

  useEffect(() => {
    if (step?.type === "learn" || step?.type === "listen") {
      say(trad(step.phrase.tokens), { audio: step.phrase.audio, voiceURI: settings.voiceURI, slow: settings.rate === "langsam" });
    }
    // Nur beim Wechsel des Schritts vorlesen, nicht bei geänderten Einstellungen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps]);

  useEffect(() => {
    if (!finished || saved.current || !batch) return;
    saved.current = true;
    (async () => {
      for (const phrase of batch) await createCards(phrase.id);
      const lesson = await db.lessons.get(id);
      const learned = Array.from(new Set([...(lesson?.learned ?? []), ...batch.map((p) => p.id)]));
      await db.lessons.put({ id, learned, updatedAt: Date.now() });
      await ensureWordCards();
      await addActivity(0, 1);
      notifyChange();
    })();
  }, [finished, batch, id]);

  if (batch === null) return <main className="screen fullscreen" />;

  if (batch.length === 0) {
    return (
      <main className="screen fullscreen">
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <CheckIcon size={48} style={{ color: "var(--green)" }} />
          <h1 className="title2" style={{ color: "var(--label)" }}>{t("Alle Sätze gelernt", "All phrases learned")}</h1>
          <p className="sub" style={{ margin: 0 }}>{t("Sie tauchen jetzt in deinen Wiederholungen auf.", "They now show up in your reviews.")}</p>
        </div>
        <div className="stack">
          <Link href={`/rollenspiel/${scenario.roleplay.id}`} className="btn btn-primary">{t("Rollenspiel üben", "Practice in a role-play")}</Link>
          <Link href="/" className="btn btn-tinted">{t("Zur Übersicht", "Back to overview")}</Link>
        </div>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="screen fullscreen">
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={36} />
          </div>
          <h1 className="large-title" style={{ color: "var(--label)" }}>{t("Geschafft!", "Done!")}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {t(
              `${batch.length} neue Sätze gelernt. Ab jetzt kommen sie in deine Wiederholungen.`,
              `${batch.length} new phrases learned. From now on they'll come up in your reviews.`,
            )}
          </p>
        </div>
        <div className="stack">
          <Link href={`/rollenspiel/${scenario.roleplay.id}`} className="btn btn-primary">{t("Im Rollenspiel anwenden", "Use them in a role-play")}</Link>
          <Link href="/" className="btn btn-tinted">{t("Zur Übersicht", "Back to overview")}</Link>
        </div>
      </main>
    );
  }

  const answer = (option: Phrase) => {
    if (picked || !step || step.type === "learn") return;
    setPicked(option.id);
    if (option.id === step.phrase.id) {
      say(trad(step.phrase.tokens), { audio: step.phrase.audio, voiceURI: settings.voiceURI });
    } else if (!retried.current.has(step.phrase.id)) {
      retried.current.add(step.phrase.id);
      setSteps((s) => [...s, { ...step, options: optionsFor(step.phrase, scenario.phrases) }]);
    }
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        <Link href={`/szenarien/${id}`} className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
          <span className="close-circle"><CloseIcon /></span>
        </Link>
        <div className="topbar-title">
          <span className="headline">{loc(lang, scenario.title, scenario.titleEn)}</span>
          <span className="small muted">{t(`Schritt ${index + 1} von ${steps.length}`, `Step ${index + 1} of ${steps.length}`)}</span>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div className="progress" style={{ marginTop: 10, height: 4 }}>
        <div style={{ width: `${(index / steps.length) * 100}%` }} />
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        {step.type === "learn" && <LearnCard phrase={step.phrase} />}

        {step.type === "meaning" && (
          <>
            <section className="card big">
              <span className="eyebrow">{t("Was bedeutet das?", "What does this mean?")}</span>
              <ChineseText tokens={step.phrase.tokens} size={36} secondary={false} />
            </section>
            {step.options.map((o) => (
              <button key={o.id} className={choiceClass(o, step.phrase, picked)} onClick={() => answer(o)}>
                {loc(lang, o.de, o.en)}
              </button>
            ))}
          </>
        )}

        {step.type === "listen" && (
          <>
            <section className="card big" style={{ alignItems: "center" }}>
              <span className="eyebrow">{t("Welchen Satz hörst du?", "Which phrase do you hear?")}</span>
              <button
                aria-label={t("Nochmal anhören", "Listen again")}
                onClick={() => say(trad(step.phrase.tokens), { audio: step.phrase.audio, voiceURI: settings.voiceURI })}
                style={{ width: 64, height: 64, borderRadius: 999, background: "var(--blue)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <SpeakerIcon size={28} />
              </button>
            </section>
            {step.options.map((o) => (
              <button key={o.id} className={choiceClass(o, step.phrase, picked)} onClick={() => answer(o)}>
                <ChineseText tokens={o.tokens} size={22} secondary={false} />
                {picked && <span className="small muted">{loc(lang, o.de, o.en)}</span>}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="spacer" style={{ minHeight: 16 }} />
      <button className="btn btn-primary" onClick={next} disabled={step.type !== "learn" && !picked}>
        {t("Weiter", "Continue")}
      </button>
    </main>
  );
}

function choiceClass(option: Phrase, correct: Phrase, picked: string | null) {
  if (!picked) return "choice";
  if (option.id === correct.id) return "choice correct";
  if (option.id === picked) return "choice wrong";
  return "choice";
}

function LearnCard({ phrase }: { phrase: Phrase }) {
  const [practice, setPractice] = useState(false);
  const lang = useSettings().language;
  const t = useT();
  const hinweis = phrase.hinweis ? loc(lang, phrase.hinweis, phrase.hinweisEn) : null;
  return (
    <>
      <section className="card big">
        <span className="eyebrow">{phrase.von === "du" ? t("Das sagst du", "You say") : t("Das hörst du", "You hear")}</span>
        <ChineseText tokens={phrase.tokens} size={42} />
        <div className="hairline" />
        <span style={{ fontSize: 20, fontWeight: 600 }}>{quote(lang, loc(lang, phrase.de, phrase.en))}</span>
        <SpeakButtons text={trad(phrase.tokens)} audio={phrase.audio} />
        <button className="btn btn-tinted" style={{ width: "100%" }} onClick={() => setPractice(true)}>
          <MicIcon size={20} /> {t("Nachsprechen", "Practice speaking")}
        </button>
      </section>

      {phrase.twcn && (
        <section className="card" style={{ borderRadius: 16, gap: 10 }}>
          <div className="row">
            <span className="badge badge-orange">TW</span>
            <span className="sub" style={{ fontWeight: 600 }}>
              {t("Taiwan vs. Festland: ", "Taiwan vs. mainland: ")}
              {loc(lang, phrase.twcn.de, phrase.twcn.en)}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="zh" style={{ fontSize: 20, fontWeight: 600 }}>{trad(phrase.twcn.tw.tokens)}</span>
              <span className="small muted">{phrase.twcn.tw.tokens.map((tok) => tok.p).join(" ")} · Taiwan</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, opacity: 0.55 }}>
              <span className="zh" style={{ fontSize: 20, fontWeight: 600 }}>{phrase.twcn.cn.zh}</span>
              <span className="small muted">{phrase.twcn.cn.py} · {t("Festland", "Mainland")}</span>
            </div>
          </div>
        </section>
      )}

      {hinweis && (
        <div className="info-box" style={{ background: "var(--card)" }}>
          <InfoIcon style={{ flexShrink: 0, marginTop: 1, color: "#8E8E93" }} />
          <span>{hinweis}</span>
        </div>
      )}

      {practice && (
        <SpeakPractice itemId={phrase.id} text={trad(phrase.tokens)} tokens={phrase.tokens} audio={phrase.audio} onClose={() => setPractice(false)} />
      )}
    </>
  );
}
