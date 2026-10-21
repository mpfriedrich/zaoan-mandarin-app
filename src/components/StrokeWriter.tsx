"use client";

import type HanziWriterType from "hanzi-writer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

type Mode = "loading" | "animating" | "quiz" | "done" | "error";

/** Strichdaten liegen offline in public/strokes/ (Dateiname = Unicode-Codepunkt in Hex). */
const strokeUrl = (char: string) => `/strokes/${char.codePointAt(0)!.toString(16)}.json`;

/** Hanzi Writer braucht feste Farben statt CSS-Variablen. */
function palette() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark
    ? { stroke: "#FFFFFF", outline: "#48484A", highlight: "#0A84FF", drawing: "#FF9F0A" }
    : { stroke: "#1C1C1E", outline: "#D1D1D6", highlight: "#007AFF", drawing: "#FF9500" };
}

/** Ein Zeichen: Strichfolge vorspielen und mit dem Finger nachschreiben. */
export function StrokeWriter({ char, size, onDone }: { char: string; size: number; onDone?: (mistakes: number) => void }) {
  const t = useT();
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriterType | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [outline, setOutline] = useState(true);
  const [mistakes, setMistakes] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  const startQuiz = useCallback(() => {
    const w = writer.current;
    if (!w) return;
    setMistakes(0);
    setMode("quiz");
    void w.quiz({
      leniency: 1.2,
      showHintAfterMisses: 2,
      markStrokeCorrectAfterMisses: 5,
      onMistake: (s) => setMistakes(s.totalMistakes),
      onCorrectStroke: (s) => setMistakes(s.totalMistakes),
      onComplete: ({ totalMistakes }) => {
        setMistakes(totalMistakes);
        setMode("done");
        done.current?.(totalMistakes);
      },
    });
  }, []);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let cancelled = false;
    setMode("loading");
    setOutline(true);
    import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (cancelled) return;
      const colors = palette();
      el.innerHTML = "";
      const w = HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.06),
        showOutline: true,
        showCharacter: false,
        strokeColor: colors.stroke,
        outlineColor: colors.outline,
        highlightColor: colors.highlight,
        drawingColor: colors.drawing,
        drawingWidth: Math.max(14, Math.round(size / 16)),
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 250,
        charDataLoader: (ch, onLoad, onError) => {
          fetch(strokeUrl(ch))
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then(onLoad)
            .catch(onError);
        },
        onLoadCharDataError: () => !cancelled && setMode("error"),
        onLoadCharDataSuccess: () => {
          if (cancelled) return;
          writer.current = w;
          startQuiz();
        },
      });
    });
    return () => {
      cancelled = true;
      writer.current?.cancelQuiz();
      writer.current = null;
      el.innerHTML = "";
    };
  }, [char, size, startQuiz]);

  const animate = async () => {
    const w = writer.current;
    if (!w || mode === "animating") return;
    w.cancelQuiz();
    setMode("animating");
    await w.hideCharacter();
    await w.animateCharacter();
    startQuiz();
  };

  const toggleOutline = () => {
    const w = writer.current;
    if (!w) return;
    if (outline) void w.hideOutline();
    else void w.showOutline();
    setOutline(!outline);
  };

  const grid = "var(--separator)";
  const status =
    mode === "loading"
      ? t("Lädt …", "Loading …")
      : mode === "error"
        ? t("Für dieses Zeichen gibt es keine Strichdaten.", "No stroke data for this character.")
        : mode === "animating"
          ? t("Schau dir die Reihenfolge an …", "Watch the stroke order …")
          : mode === "done"
            ? mistakes === 0
              ? t("Perfekt – ohne Fehler!", "Perfect – no mistakes!")
              : t(`Geschafft, mit ${mistakes} ${mistakes === 1 ? "Fehler" : "Fehlern"}.`, `Done, with ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}.`)
            : t("Schreib Strich für Strich. Nach 2 Fehlern blinkt ein Tipp.", "Write stroke by stroke. After 2 mistakes a hint flashes.");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", width: size, height: size, borderRadius: 20, background: "var(--card)", overflow: "hidden" }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0 }} aria-hidden>
          <rect x="1" y="1" width={size - 2} height={size - 2} rx="19" fill="none" stroke={grid} />
          <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke={grid} strokeDasharray="6 6" />
          <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke={grid} strokeDasharray="6 6" />
          <line x1="0" y1="0" x2={size} y2={size} stroke={grid} strokeDasharray="4 8" opacity="0.5" />
          <line x1={size} y1="0" x2="0" y2={size} stroke={grid} strokeDasharray="4 8" opacity="0.5" />
        </svg>
        <div ref={target} style={{ position: "relative", width: size, height: size, touchAction: "none" }} />
      </div>
      <span className="sub muted" style={{ textAlign: "center", minHeight: 20 }} aria-live="polite">{status}</span>
      <div className="row" style={{ gap: 18, justifyContent: "center" }}>
        <button className="sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={animate} disabled={mode === "loading" || mode === "error"}>
          {t("Vorspielen", "Show me")}
        </button>
        <button className="sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={toggleOutline} disabled={mode === "loading" || mode === "error"}>
          {outline ? t("Umriss aus", "Hide outline") : t("Umriss an", "Show outline")}
        </button>
        <button className="sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={startQuiz} disabled={mode === "loading" || mode === "error"}>
          {t("Nochmal", "Again")}
        </button>
      </div>
    </div>
  );
}
