"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, CloseIcon, EyeIcon, HeadphonesIcon, InfoIcon, MicIcon, SpeakerIcon } from "@/components/Icons";
import { SpeakPractice } from "@/components/SpeakPractice";
import { useStudyTimer } from "@/lib/activity";
import { say } from "@/lib/audio";
import { isWordId, itemsById, scenariosById, trad } from "@/lib/content";
import { db, type CardRec } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, quote, useT } from "@/lib/i18n";
import { ensureSpeakCards, formatInterval, GRADES, previewIntervals, reviewCard, spreadCards, suggestGrade } from "@/lib/srs";
import type { Grade } from "ts-fsrs";

const SAME_SESSION_MS = 10 * 60 * 1000;

export default function ReviewPage() {
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  useStudyTimer();
  const [queue, setQueue] = useState<CardRec[] | null>(null);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suggested, setSuggested] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [practice, setPractice] = useState(false);

  useEffect(() => {
    ensureSpeakCards()
      .catch(() => 0)
      .then(() => db.cards.where("due").belowOrEqual(Date.now()).sortBy("due"))
      .then((cards) => {
        const due = spreadCards(cards).slice(0, 100);
        setQueue(due);
        setTotal(due.length);
      });
  }, []);

  const current = queue?.[index];
  const speaking = current?.kind === "sprechen";
  const phrase = current ? itemsById.get(current.phraseId) : undefined;
  const text = phrase ? trad(phrase.tokens) : "";
  const playCard = useCallback(
    (slow = false) => text && say(text, { audio: phrase?.audio, voiceURI: settings.voiceURI, slow: slow || settings.rate === "langsam" }),
    [text, phrase?.audio, settings.voiceURI, settings.rate],
  );

  useEffect(() => {
    if (current?.kind === "hoeren") playCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index]);

  const reveal = useCallback(() => {
    setRevealed(true);
    if (current?.kind === "lesen" || current?.kind === "sprechen") playCard();
  }, [current, playCard]);

  /** Sprechen-Karte: nach der Aufnahme aufdecken und eine Bewertung vorschlagen. */
  const onAssessed = useCallback((score: number | null) => {
    setSuggested(score === null ? null : suggestGrade(score));
    setRevealed(true);
  }, []);

  const rate = useCallback(
    async (grade: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      const updated = await reviewCard(current, grade);
      if (updated.due - Date.now() < SAME_SESSION_MS) setQueue((q) => (q ? [...q, updated] : q));
      setRevealed(false);
      setSuggested(null);
      setIndex((i) => i + 1);
      setBusy(false);
    },
    [current, busy],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || practice) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(Number(e.key) as Grade);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, reveal, rate, practice]);

  if (queue === null) return <main className="screen fullscreen" />;

  if (!current || !phrase) {
    return (
      <main className="screen fullscreen">
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={36} />
          </div>
          <h1 className="large-title" style={{ color: "var(--label)" }}>
            {total > 0 ? t("Alles wiederholt", "All reviewed") : t("Nichts fällig", "Nothing due")}
          </h1>
          <p className="sub" style={{ margin: 0 }}>
            {total > 0
              ? t("Stark! Die nächsten Karten kommen, wenn du sie fast vergessen hättest.", "Great! The next cards come back just before you'd forget them.")
              : t("Lerne neue Sätze, dann gibt es hier etwas zu tun.", "Learn some new phrases and there'll be something to do here.")}
          </p>
        </div>
        <Link href="/" className="btn btn-primary">{t("Fertig", "Done")}</Link>
      </main>
    );
  }

  const scenario = scenariosById.get(phrase.scenarioId);
  const intervals = revealed ? previewIntervals(current) : null;
  const progress = Math.min(index, total) / Math.max(total, 1);
  const hinweis = phrase.hinweis ? loc(lang, phrase.hinweis, phrase.hinweisEn) : null;
  const meaning = quote(lang, loc(lang, phrase.de, phrase.en));
  const kindLabel =
    current.kind === "hoeren" ? t("Hören", "Listening") : current.kind === "sprechen" ? t("Sprechen", "Speaking") : t("Lesen", "Reading");
  const suggestedLabel = GRADES.find((g) => g.grade === suggested);
  // Gut sitzende Lesekarten: Pinyin erst beim Aufdecken, damit die Zeichen selbst gelesen werden.
  const hidePinyin = current.kind === "lesen" && !revealed && settings.hidePinyinKnown && current.card.scheduled_days >= 7;

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        <Link href="/" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
          <span className="close-circle"><CloseIcon /></span>
        </Link>
        <div className="topbar-title">
          <span className="headline">{t("Wiederholen", "Review")}</span>
          <span className="small muted">
            {index < total ? t(`${index + 1} von ${total}`, `${index + 1} of ${total}`) : t("Letzte Runde", "Final round")}
          </span>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div className="progress" style={{ marginTop: 10, height: 4 }}>
        <div style={{ width: `${progress * 100}%` }} />
      </div>

      <section className="card big" style={{ marginTop: 18 }}>
        <div className="row">
          <span className="row btn-tinted" style={{ gap: 5, minHeight: 26, padding: "0 10px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
            {current.kind === "hoeren" ? <HeadphonesIcon /> : current.kind === "sprechen" ? <MicIcon size={14} /> : <EyeIcon />}
            {kindLabel}
          </span>
          <span className="spacer" />
          {scenario && (
            <span className="small muted">
              {isWordId(phrase.id) ? t("Wort", "Word") : t("Satz", "Phrase")} · {loc(lang, scenario.title, scenario.titleEn)}
            </span>
          )}
        </div>

        {speaking && <span style={{ fontSize: 24, fontWeight: 600, textAlign: "center" }}>{meaning}</span>}

        {current.kind === "hoeren" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <button
              aria-label={t("Anhören", "Listen")}
              onClick={() => playCard()}
              style={{ width: 64, height: 64, borderRadius: 999, background: "var(--blue)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <SpeakerIcon size={28} />
            </button>
            <button className="sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => playCard(true)}>
              {t("Langsam anhören", "Listen slowly")}
            </button>
          </div>
        )}

        {(current.kind === "lesen" || revealed) && (
          <>
            {current.kind !== "lesen" && <div className="hairline" />}
            <ChineseText tokens={phrase.tokens} size={speaking ? 32 : 38} secondary={revealed} pinyin={!hidePinyin} />
          </>
        )}

        {revealed ? (
          <>
            {!speaking && (
              <>
                <div className="hairline" />
                <span style={{ fontSize: 20, fontWeight: 600 }}>{meaning}</span>
              </>
            )}
            <div className="row" style={{ gap: 18 }}>
              {current.kind !== "hoeren" && (
                <button className="row sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => playCard()}>
                  <SpeakerIcon size={18} /> {t("Anhören", "Listen")}
                </button>
              )}
              {!speaking && (
                <button className="row sub" style={{ color: "var(--blue)", minHeight: 44 }} onClick={() => setPractice(true)}>
                  <MicIcon size={18} /> {t("Nachsprechen", "Practice speaking")}
                </button>
              )}
            </div>
            {hinweis && (
              <div className="info-box">
                <InfoIcon style={{ flexShrink: 0, marginTop: 1, color: "#8E8E93" }} />
                <span>{hinweis}</span>
              </div>
            )}
          </>
        ) : (
          <span className="sub muted" style={{ textAlign: "center" }}>
            {current.kind === "hoeren"
              ? t("Was hörst du – und was bedeutet es?", "What do you hear – and what does it mean?")
              : speaking
                ? t("Wie sagst du das auf Chinesisch? Sprich es ein.", "How do you say this in Chinese? Say it out loud.")
                : hidePinyin
                  ? t("Was bedeutet das? Pinyin ist verdeckt – die Karte sitzt schon.", "What does this mean? Pinyin is hidden – you know this card well.")
                  : t("Was bedeutet das?", "What does this mean?")}
          </span>
        )}
      </section>

      {speaking && (
        <div style={{ marginTop: 12 }}>
          <SpeakPractice key={current.id + index} inline showText={false} itemId={phrase.id} text={text} tokens={phrase.tokens} audio={phrase.audio} onAssessed={onAssessed} />
        </div>
      )}

      <div className="spacer" style={{ minHeight: 16 }} />

      {revealed && intervals ? (
        <>
          <span className="small muted" style={{ textAlign: "center", marginBottom: 10 }}>
            {suggestedLabel
              ? t(`Vorschlag nach deiner Aussprache: ${suggestedLabel.label}`, `Suggested from your pronunciation: ${suggestedLabel.labelEn}`)
              : speaking
                ? t("Wie gut konntest du es sagen?", "How well could you say it?")
                : t("Wie gut wusstest du es?", "How well did you know it?")}
          </span>
          <div className="rating-grid">
            {GRADES.map(({ grade, label, labelEn, className }) => (
              <button key={grade} className={`rating ${className}${grade === suggested ? " suggested" : ""}`} disabled={busy} onClick={() => rate(grade)}>
                <span className="r-label">{t(label, labelEn)}</span>
                <span className="r-int">{formatInterval(intervals[grade], lang)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button className={speaking ? "btn btn-tinted" : "btn btn-primary"} onClick={reveal}>
          {speaking ? t("Ohne Aufnahme aufdecken", "Reveal without recording") : t("Antwort zeigen", "Show answer")}
        </button>
      )}

      {practice && !speaking && (
        <SpeakPractice itemId={phrase.id} text={text} tokens={phrase.tokens} audio={phrase.audio} onClose={() => setPractice(false)} />
      )}
    </main>
  );
}
