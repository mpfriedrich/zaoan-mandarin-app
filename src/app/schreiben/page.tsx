"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, ChevronRightIcon, CloseIcon, PencilIcon } from "@/components/Icons";
import { SpeakIconButton } from "@/components/Speak";
import { StrokeWriter } from "@/components/StrokeWriter";
import { addActivity, useStudyTimer } from "@/lib/activity";
import { scenarios, scenariosById, trad } from "@/lib/content";
import { notifyChange } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, useT } from "@/lib/i18n";

export default function WritingPage() {
  useStudyTimer();
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [written, setWritten] = useState(false);
  const [finished, setFinished] = useState(false);
  const [size, setSize] = useState(280);

  useEffect(() => {
    const update = () => setSize(Math.max(220, Math.min(320, window.innerWidth - 56)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const open = (id: string) => {
    setScenarioId(id);
    setWordIndex(0);
    setCharIndex(0);
    setWritten(false);
    setFinished(false);
  };

  if (!scenarioId) {
    return (
      <main className="screen fullscreen">
        <div className="topbar">
          <Link href="/szenarien" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
            <span className="close-circle"><CloseIcon /></span>
          </Link>
          <div className="topbar-title">
            <span className="headline">{t("Zeichen schreiben", "Writing characters")}</span>
          </div>
          <div style={{ width: 44 }} />
        </div>
        <p className="sub muted" style={{ margin: "12px 4px 4px", lineHeight: 1.45 }}>
          {t(
            "Wähle ein Szenario und schreib seine wichtigen Wörter Zeichen für Zeichen mit dem Finger nach. Die App zeigt dir die Strichfolge und hilft bei Fehlern.",
            "Pick a scenario and write its key words character by character with your finger. The app shows the stroke order and helps when you make mistakes.",
          )}
        </p>
        <h2 className="section-header">{t("Szenarien", "Scenarios")}</h2>
        <div className="group">
          {scenarios
            .filter((s) => s.words.length > 0)
            .map((s) => (
              <button key={s.id} className="group-row" style={{ width: "100%", textAlign: "left" }} onClick={() => open(s.id)}>
                <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>{loc(lang, s.title, s.titleEn)}</span>
                  <span className="small muted">
                    {s.words.map((w) => (settings.mainScript === "trad" ? trad(w.tokens) : w.tokens.map((x) => x.s).join(""))).join(" · ")}
                  </span>
                </div>
                <ChevronRightIcon style={{ color: "var(--label3)" }} />
              </button>
            ))}
        </div>
        <p className="section-footer">
          {t(
            "Die Strichfolge folgt den Daten von Make Me a Hanzi (Arphic Public License). Bei einigen Zeichen lehren taiwanische Schulen eine leicht andere Reihenfolge.",
            "Stroke order comes from Make Me a Hanzi data (Arphic Public License). For a few characters, Taiwanese schools teach a slightly different order.",
          )}
        </p>
      </main>
    );
  }

  const scenario = scenariosById.get(scenarioId)!;
  const words = scenario.words;
  const word = words[wordIndex];
  const chars = word ? word.tokens.filter((tok) => tok.p) : [];
  const current = chars[charIndex];
  const char = current ? (settings.mainScript === "trad" ? current.t : current.s) : "";
  const lastChar = charIndex >= chars.length - 1;
  const lastWord = wordIndex >= words.length - 1;

  const next = async () => {
    setWritten(false);
    if (!lastChar) return setCharIndex((i) => i + 1);
    if (!lastWord) {
      setWordIndex((i) => i + 1);
      setCharIndex(0);
      return;
    }
    setFinished(true);
    await addActivity(0, 1);
    notifyChange();
  };

  if (finished) {
    return (
      <main className="screen fullscreen">
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={36} />
          </div>
          <h1 className="title2" style={{ color: "var(--label)" }}>{t("Alle Wörter geschrieben", "All words written")}</h1>
          <p className="sub" style={{ margin: 0 }}>{loc(lang, scenario.title, scenario.titleEn)}</p>
        </div>
        <div className="stack">
          <button className="btn btn-tinted" onClick={() => open(scenario.id)}>{t("Nochmal", "Again")}</button>
          <button className="btn btn-primary" onClick={() => setScenarioId(null)}>{t("Anderes Szenario", "Another scenario")}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        <button className="icon-btn" aria-label={t("Zurück zur Auswahl", "Back to the list")} style={{ justifyContent: "flex-start" }} onClick={() => setScenarioId(null)}>
          <span className="close-circle"><CloseIcon /></span>
        </button>
        <div className="topbar-title">
          <span className="headline">{loc(lang, scenario.title, scenario.titleEn)}</span>
          <span className="small muted">{t(`Wort ${wordIndex + 1} von ${words.length}`, `Word ${wordIndex + 1} of ${words.length}`)}</span>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div className="progress" style={{ marginTop: 10, height: 4 }}>
        <div style={{ width: `${(wordIndex / words.length) * 100}%` }} />
      </div>

      <section className="card" style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="row" style={{ gap: 6 }}>
            {chars.map((tok, i) => (
              <span
                key={i}
                className="zh"
                style={{
                  fontSize: 26,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: i === charIndex ? "color-mix(in srgb, var(--blue) 16%, transparent)" : "transparent",
                  color: i < charIndex ? "var(--label2)" : "var(--label)",
                }}
              >
                {settings.mainScript === "trad" ? tok.t : tok.s}
              </span>
            ))}
          </div>
          <span className="sub muted">
            {chars.map((tok) => tok.p).join(" ")} · {loc(lang, word.de, word.en)}
          </span>
        </div>
        <SpeakIconButton text={trad(word.tokens)} audio={word.audio} />
      </section>

      <div style={{ marginTop: 18 }}>
        <StrokeWriter key={`${word.id}-${charIndex}`} char={char} size={size} onDone={() => setWritten(true)} />
      </div>

      <div className="spacer" style={{ minHeight: 16 }} />
      <button className={written ? "btn btn-primary" : "btn btn-tinted"} onClick={next}>
        {!written
          ? t("Überspringen", "Skip")
          : !lastChar
            ? t("Nächstes Zeichen", "Next character")
            : !lastWord
              ? t("Nächstes Wort", "Next word")
              : t("Fertig", "Done")}
      </button>
      <span className="small muted" style={{ textAlign: "center", marginTop: 8, display: "flex", gap: 6, justifyContent: "center" }}>
        <PencilIcon size={14} /> {t("Tipp: Schreib groß und in einem Zug pro Strich.", "Tip: write big, one smooth motion per stroke.")}
      </span>
    </main>
  );
}
