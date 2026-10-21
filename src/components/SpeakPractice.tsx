"use client";

import { useEffect, useRef, useState } from "react";
import { recordPronunciation } from "@/lib/activity";
import { say, stopAudio } from "@/lib/audio";
import type { Token } from "@/lib/content";
import { saveSettings } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { assessPronunciation, SpeechError, type Assessment } from "@/lib/pronounce";
import { startRecording, type Recording } from "@/lib/recorder";
import { analyseTones, type CurveSyllable } from "@/lib/tonecurve";
import { ChineseText } from "./Chinese";
import { CloseIcon, MicIcon, SpeakerIcon } from "./Icons";
import { Ring } from "./Ring";
import { ToneCurve } from "./ToneCurve";

const ERRORS: Record<string, [string, string]> = {
  offline: [
    "Ohne Internet kannst du dich aufnehmen und die Tonkurven vergleichen – die Punktzahl braucht Internet.",
    "Offline you can still record yourself and compare tone curves – the score needs internet.",
  ],
  "no-speech": ["Die Aussprachebewertung ist auf dem Server noch nicht eingerichtet.", "Pronunciation scoring isn't set up on the server yet."],
  unauthorized: ["Bitte melde dich neu an, um die Bewertung zu nutzen.", "Please sign in again to use scoring."],
  quiet: ["Die Aufnahme ist sehr leise. Halte das Mikrofon näher und versuch es nochmal.", "The recording is very quiet. Hold the microphone closer and try again."],
  NoMatch: ["Ich konnte keine chinesischen Wörter erkennen. Versuch es nochmal.", "I couldn't recognize any Chinese words. Please try again."],
  InitialSilenceTimeout: ["Ich habe nichts gehört. Sprich direkt nach dem Tippen los.", "I didn't hear anything. Start speaking right after tapping."],
  mic: [
    "Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen deines Geräts für diese App.",
    "No microphone access. Allow it for this app in your device settings.",
  ],
  unknown: ["Die Bewertung hat gerade nicht geklappt. Versuch es nochmal.", "Scoring didn't work just now. Please try again."],
};

const scoreColor = (score: number) => (score >= 90 ? "var(--green)" : score >= 75 ? "var(--orange)" : "var(--red)");

function verdict(score: number): [string, string] {
  if (score >= 90) return ["Sehr gut – das klingt schon richtig natürlich!", "Very good – that already sounds really natural!"];
  if (score >= 75) return ["Gut! Achte auf die markierten Wörter und die Tonkurven.", "Good! Watch the highlighted words and the tone curves."];
  return ["Hör dir das Original langsam an und versuch es nochmal.", "Listen to the original slowly and try again."];
}

const DIGITS = "零一二三四五六七八九";

/** Ganze Zahl als chinesische Ziffern (Azure schreibt Zahlen oft als 100 statt 一百). */
function numberToHan(n: number): string {
  if (n === 0) return DIGITS[0];
  if (n >= 10000) {
    const rest = n % 10000;
    return numberToHan(Math.floor(n / 10000)) + "萬" + (rest ? (rest < 1000 ? DIGITS[0] : "") + numberToHan(rest) : "");
  }
  let out = "";
  let gap = false;
  [1000, 100, 10, 1].forEach((unit, i) => {
    const d = Math.floor(n / unit) % 10;
    if (d === 0) {
      gap = out !== "";
      return;
    }
    if (gap) out += DIGITS[0];
    gap = false;
    out += (d === 1 && unit === 10 && out === "" ? "" : DIGITS[d]) + ["千", "百", "十", ""][i];
  });
  return out;
}

const hanOnly = (s: string) => [...s.replace(/\d+/g, (m) => numberToHan(Number(m)))].filter((c) => /\p{Script=Han}/u.test(c));
/** 二 und 兩 gelten beim Vergleich als gleich. */
const sameChar = (a: string | undefined, b: string | undefined) => a === b || (!!a && !!b && "二兩".includes(a) && "二兩".includes(b));

/** Nachsprechen: aufnehmen, Tonkurven vergleichen und von Azure bewerten lassen. */
export function SpeakPractice({ itemId, text, tokens, audio, onClose, inline = false, showText = true, onAssessed }: {
  itemId: string;
  text: string;
  tokens: Token[];
  audio?: string;
  onClose?: () => void;
  /** Direkt in der Seite statt als Sheet (z. B. auf Sprechen-Karten). */
  inline?: boolean;
  /** false: Zeichen und Vorab-Kurven ausblenden, weil der Satz erst selbst gesagt werden soll. */
  showText?: boolean;
  /** Nach jeder ausgewerteten Aufnahme: Punktzahl oder null (offline oder Fehler). */
  onAssessed?: (score: number | null) => void;
}) {
  const settings = useSettings();
  const t = useT();
  const [preview, setPreview] = useState<CurveSyllable[] | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "checking">("idle");
  const [result, setResult] = useState<Assessment | null>(null);
  const [curves, setCurves] = useState<CurveSyllable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const lastUrl = useRef<string | null>(null);
  const assessed = useRef(onAssessed);
  assessed.current = onAssessed;

  useEffect(
    () => () => {
      recorder.current?.cancel();
      player.current?.pause();
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    },
    [],
  );

  // Tonkurven des Originals als Vorlage, bevor man selbst spricht.
  useEffect(() => {
    if (!settings.curvesBefore || !showText || preview) return;
    let cancelled = false;
    analyseTones(tokens, audio).then((c) => !cancelled && setPreview(c)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.curvesBefore, showText, preview, tokens, audio]);

  useEffect(() => {
    if (phase !== "recording") return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds((Date.now() - started) / 1000), 200);
    return () => clearInterval(timer);
  }, [phase]);

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    const take = await rec.stop();
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    lastUrl.current = take.url;
    setRecording(take);
    if (take.peak < 0.02) {
      setError("quiet");
      setPhase("idle");
      return;
    }
    setPhase("checking");
    // Tonkurven laufen auf dem Gerät und funktionieren auch offline.
    const curvesPromise = analyseTones(tokens, audio, take).then(setCurves).catch(() => setCurves(null));
    let score: number | null = null;
    if (!navigator.onLine) {
      setError("offline");
    } else {
      try {
        const assessment = await assessPronunciation(take.blob, text);
        if (assessment.status !== "Success") {
          setError(ERRORS[assessment.status] ? assessment.status : "unknown");
        } else {
          setResult(assessment);
          score = assessment.scores.pron;
          await recordPronunciation(itemId, score);
        }
      } catch (e) {
        setError(e instanceof SpeechError && ERRORS[e.code] ? e.code : navigator.onLine ? "unknown" : "offline");
      }
    }
    await curvesPromise;
    setPhase("idle");
    assessed.current?.(score);
  };

  const start = async () => {
    stopAudio();
    player.current?.pause();
    setError(null);
    setResult(null);
    setCurves(null);
    try {
      recorder.current = await startRecording(12, () => void stop());
      setSeconds(0);
      setPhase("recording");
    } catch {
      setError("mic");
    }
  };

  const playOwn = () => {
    if (!recording) return;
    stopAudio();
    player.current ??= new Audio();
    player.current.src = recording.url;
    void player.current.play();
  };

  const expected = hanOnly(text);
  const heard = result ? hanOnly(result.text) : [];
  const heardDiffers = heard.length > 0 && (heard.length !== expected.length || heard.some((c, i) => !sameChar(c, expected[i])));

  const content = (
    <>
      {showText && (
        <section className="card big" style={{ alignItems: "center", textAlign: "center" }}>
          <ChineseText tokens={tokens} size={32} secondary={false} />
          <div className="row" style={{ gap: 16 }}>
            <button className="row sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => say(text, { audio, voiceURI: settings.voiceURI })}>
              <SpeakerIcon size={18} /> Original
            </button>
            <button className="row sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => say(text, { audio, voiceURI: settings.voiceURI, slow: true })}>
              {t("Langsam", "Slow")}
            </button>
            {recording && (
              <button className="row sub" style={{ color: "var(--indigo-text)", minHeight: 44 }} onClick={playOwn}>
                <SpeakerIcon size={18} /> {t("Du", "You")}
              </button>
            )}
          </div>
          {settings.curvesBefore && preview && !(curves && recording) && (
            <div style={{ width: "100%", textAlign: "left" }}>
              <ToneCurve syllables={preview} showUser={false} />
            </div>
          )}
          <div className="row sub" style={{ width: "100%", gap: 8, textAlign: "left" }}>
            <span className="grow muted">{t("Tonkurven vor dem Sprechen", "Tone curves before speaking")}</span>
            <button
              role="switch"
              aria-checked={settings.curvesBefore}
              aria-label={t("Tonkurven vor dem Sprechen", "Tone curves before speaking")}
              className={settings.curvesBefore ? "toggle on" : "toggle"}
              onClick={() => void saveSettings({ curvesBefore: !settings.curvesBefore })}
            />
          </div>
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <button
          className={phase === "recording" ? "record-btn recording" : "record-btn"}
          aria-label={phase === "recording" ? t("Aufnahme beenden", "Stop recording") : t("Aufnehmen", "Record")}
          disabled={phase === "checking"}
          onClick={() => (phase === "recording" ? void stop() : void start())}
        >
          {phase === "recording" ? <span style={{ width: 24, height: 24, borderRadius: 5, background: "#FFF" }} /> : <MicIcon size={32} />}
        </button>
        <span className="sub muted">
          {phase === "recording"
            ? t(`Aufnahme läuft … ${seconds.toFixed(0)} s – tippen zum Beenden`, `Recording … ${seconds.toFixed(0)} s – tap to stop`)
            : phase === "checking"
              ? t("Wird ausgewertet …", "Analyzing …")
              : recording
                ? t("Nochmal aufnehmen", "Record again")
                : showText
                  ? t("Tippen und den Satz sprechen", "Tap and say the phrase")
                  : t("Tippen und auf Chinesisch sagen", "Tap and say it in Chinese")}
        </span>
        {!showText && recording && phase === "idle" && (
          <button className="row sub" style={{ color: "var(--indigo-text)", minHeight: 44 }} onClick={playOwn}>
            <SpeakerIcon size={18} /> {t("Mich anhören", "Play my recording")}
          </button>
        )}
      </div>

      {error && (
        <div className="info-box" style={{ background: "var(--card)", color: "var(--label)" }}>
          {t(...ERRORS[error])}
        </div>
      )}

      {result && (
        <section className="card" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 16 }}>
            <Ring progress={result.scores.pron / 100} size={76} stroke={9} color={scoreColor(result.scores.pron)}>
              <span className="rd" style={{ fontSize: 22, fontWeight: 700 }}>{result.scores.pron}</span>
            </Ring>
            <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span className="headline">{t(...verdict(result.scores.pron))}</span>
              <span className="small muted">
                {t(
                  `Genauigkeit ${result.scores.accuracy} · Flüssigkeit ${result.scores.fluency} · Vollständigkeit ${result.scores.completeness}`,
                  `Accuracy ${result.scores.accuracy} · Fluency ${result.scores.fluency} · Completeness ${result.scores.completeness}`,
                )}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.words
              .filter((w) => w.error !== "Insertion")
              .map((w, i) => {
                const missing = w.error === "Omission";
                return (
                  <span
                    key={i}
                    className="zh"
                    title={missing ? t("nicht gehört", "not heard") : t(`${w.accuracy} Punkte`, `${w.accuracy} points`)}
                    style={{
                      fontSize: 20,
                      borderRadius: 10,
                      padding: "3px 8px",
                      background: missing ? "var(--fill)" : `color-mix(in srgb, ${scoreColor(w.accuracy)} 18%, transparent)`,
                      color: missing ? "var(--label2)" : "var(--label)",
                      textDecoration: missing ? "line-through" : undefined,
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
          </div>

          {heardDiffers && (
            <div className="row sub" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="muted">{t("Gehört wurde:", "Heard as:")}</span>
              <span className="zh" style={{ fontSize: 20 }}>
                {heard.map((c, i) => (
                  <span key={i} style={!sameChar(c, expected[i]) ? { textDecoration: "underline", textDecorationColor: "var(--red)", textDecorationThickness: 2 } : undefined}>
                    {c}
                  </span>
                ))}
              </span>
            </div>
          )}

          <span className="small muted">
            {t(
              "Grün ab 90, Orange ab 75, sonst Rot · durchgestrichen = nicht gehört.",
              "Green from 90, orange from 75, otherwise red · struck through = not heard.",
            )}
          </span>
        </section>
      )}

      {curves && recording && (
        <section className="card" style={{ gap: 10 }}>
          <span className="headline">{t("Tonkurven", "Tone curves")}</span>
          <ToneCurve syllables={curves} showUser />
        </section>
      )}
    </>
  );

  if (inline) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{content}</div>;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={t("Nachsprechen", "Speaking practice")} onClick={(e) => e.stopPropagation()}>
        <div className="topbar">
          <div style={{ width: 44 }} />
          <div className="topbar-title">
            <span className="headline">{t("Nachsprechen", "Speaking practice")}</span>
          </div>
          <button className="icon-btn" aria-label={t("Schließen", "Close")} onClick={onClose} style={{ justifyContent: "flex-end" }}>
            <span className="close-circle"><CloseIcon /></span>
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
