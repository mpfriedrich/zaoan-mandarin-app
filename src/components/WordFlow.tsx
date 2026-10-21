"use client";

import { useEffect, useRef, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { MicIcon, SpeakerIcon } from "@/components/Icons";
import { SpeakButtons } from "@/components/Speak";
import { SpeakPractice } from "@/components/SpeakPractice";
import { addActivity } from "@/lib/activity";
import { say } from "@/lib/audio";
import { trad, type VocabWord } from "@/lib/content";
import { notifyChange } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, quote, useT } from "@/lib/i18n";
import { optionsFor, shuffle } from "@/lib/quiz";
import { createCards } from "@/lib/srs";

type Step =
  | { type: "learn"; word: VocabWord }
  | { type: "meaning"; word: VocabWord; options: VocabWord[] }
  | { type: "listen"; word: VocabWord; options: VocabWord[] };

/** Erst alle Wörter ansehen, danach gemischte Fragen dazu. */
function buildSteps(batch: VocabWord[], pool: VocabWord[]): Step[] {
  const learn: Step[] = batch.map((word) => ({ type: "learn", word }));
  const quiz: Step[] = batch.map((word, i) =>
    i % 2 === 0 ? { type: "meaning", word, options: optionsFor(word, pool) } : { type: "listen", word, options: optionsFor(word, pool) },
  );
  return [...learn, ...shuffle(quiz)];
}

export function WordFlow({ batch, pool, onDone }: { batch: VocabWord[]; pool: VocabWord[]; onDone: () => void }) {
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  const [steps, setSteps] = useState(() => buildSteps(batch, pool));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const retried = useRef(new Set<string>());
  const saved = useRef(false);

  const step = steps[index] as Step | undefined;

  useEffect(() => {
    if (step?.type === "learn" || step?.type === "listen") {
      say(trad(step.word.tokens), { audio: step.word.audio, voiceURI: settings.voiceURI, slow: settings.rate === "langsam" });
    }
    // Nur beim Wechsel des Schritts vorlesen, nicht bei geänderten Einstellungen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps]);

  useEffect(() => {
    if (step || saved.current) return;
    saved.current = true;
    (async () => {
      for (const word of batch) await createCards(word.id);
      await addActivity(0, 1);
      notifyChange();
      onDone();
    })();
  }, [step, batch, onDone]);

  if (!step) return null;

  const answer = (option: VocabWord) => {
    if (picked || step.type === "learn") return;
    setPicked(option.id);
    if (option.id === step.word.id) {
      say(trad(step.word.tokens), { audio: step.word.audio, voiceURI: settings.voiceURI });
    } else if (!retried.current.has(step.word.id)) {
      // Danebengegriffen: das Wort kommt am Ende der Runde noch einmal.
      retried.current.add(step.word.id);
      setSteps((list) => [...list, { ...step, options: optionsFor(step.word, pool) }]);
    }
  };

  return (
    <>
      <div className="progress" style={{ marginTop: 10, height: 4 }}>
        <div style={{ width: `${(index / steps.length) * 100}%` }} />
      </div>
      <span className="small muted" style={{ margin: "8px 4px 0" }}>
        {t(`Schritt ${index + 1} von ${steps.length}`, `Step ${index + 1} of ${steps.length}`)}
      </span>

      <div className="stack" style={{ marginTop: 12 }}>
        {step.type === "learn" && <LearnCard word={step.word} />}

        {step.type === "meaning" && (
          <>
            <section className="card big">
              <span className="eyebrow">{t("Was bedeutet das?", "What does this mean?")}</span>
              <ChineseText tokens={step.word.tokens} size={40} secondary={false} />
            </section>
            {step.options.map((o) => (
              <button key={o.id} className={choiceClass(o, step.word, picked)} onClick={() => answer(o)}>
                {loc(lang, o.de, o.en)}
              </button>
            ))}
          </>
        )}

        {step.type === "listen" && (
          <>
            <section className="card big" style={{ alignItems: "center" }}>
              <span className="eyebrow">{t("Welches Wort hörst du?", "Which word do you hear?")}</span>
              <button
                aria-label={t("Nochmal anhören", "Listen again")}
                onClick={() => say(trad(step.word.tokens), { audio: step.word.audio, voiceURI: settings.voiceURI })}
                style={{ width: 64, height: 64, borderRadius: 999, background: "var(--blue)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <SpeakerIcon size={28} />
              </button>
            </section>
            {step.options.map((o) => (
              <button key={o.id} className={choiceClass(o, step.word, picked)} onClick={() => answer(o)}>
                <ChineseText tokens={o.tokens} size={24} secondary={false} />
                {picked && <span className="small muted">{loc(lang, o.de, o.en)}</span>}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="spacer" style={{ minHeight: 16 }} />
      <button
        className="btn btn-primary"
        disabled={step.type !== "learn" && !picked}
        onClick={() => {
          setPicked(null);
          setIndex((i) => i + 1);
        }}
      >
        {t("Weiter", "Continue")}
      </button>
    </>
  );
}

function choiceClass(option: VocabWord, correct: VocabWord, picked: string | null) {
  if (!picked) return "choice";
  if (option.id === correct.id) return "choice correct";
  if (option.id === picked) return "choice wrong";
  return "choice";
}

function LearnCard({ word }: { word: VocabWord }) {
  const [practice, setPractice] = useState(false);
  const lang = useSettings().language;
  const t = useT();
  return (
    <>
      <section className="card big">
        <span className="eyebrow">{word.gruppe ? loc(lang, word.gruppe, word.gruppeEn) : t("Neues Wort", "New word")}</span>
        <ChineseText tokens={word.tokens} size={48} />
        <div className="hairline" />
        <span style={{ fontSize: 20, fontWeight: 600 }}>{quote(lang, loc(lang, word.de, word.en))}</span>
        <SpeakButtons text={trad(word.tokens)} audio={word.audio} />
        <button className="btn btn-tinted" style={{ width: "100%" }} onClick={() => setPractice(true)}>
          <MicIcon size={20} /> {t("Nachsprechen", "Practice speaking")}
        </button>
      </section>

      {practice && (
        <SpeakPractice itemId={word.id} text={trad(word.tokens)} tokens={word.tokens} audio={word.audio} onClose={() => setPractice(false)} />
      )}
    </>
  );
}
