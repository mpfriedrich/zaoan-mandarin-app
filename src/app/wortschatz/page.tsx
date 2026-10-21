"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/Icons";
import { frequencyLevels, frequencyWords } from "@/lib/content";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, useT } from "@/lib/i18n";

/** Wörter pro Runde – wie im Grundwortschatz. */
const BATCH_SIZE = 5;

export default function VocabularyPage() {
  const lang = useSettings().language;
  const t = useT();
  const [learned, setLearned] = useState<Set<string> | null>(null);

  // Ein Wort gilt als gelernt, sobald es Karten hat – auch wenn es aus einem Szenario kam.
  const load = useCallback(async () => {
    const cards = await db.cards.where("phraseId").startsWith("wort-").toArray();
    setLearned(new Set(cards.map((c) => c.phraseId)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (learned === null) return <main className="screen" />;

  return (
    <main className="screen">
      <header className="header">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="eyebrow">{t("Häufigste Wörter", "Most common words")}</span>
          <h1 className="large-title">{t("Wortschatz", "Vocabulary")}</h1>
        </div>
      </header>

      <div className="stack">
        {frequencyLevels.map((level) => {
          const words = frequencyWords.filter((w) => w.stufe === level.id);
          const open = words.filter((w) => !learned.has(w.id));
          const next = open.slice(0, BATCH_SIZE);
          const ready = words.length - open.length;
          return (
            <section key={level.id} className="card">
              <div className="card-head">
                <span className="label" style={{ color: "var(--indigo-text)" }}>{loc(lang, level.title, level.titleEn)}</span>
                <span className="spacer" />
                <span className="muted">{t(`${ready} von ${words.length}`, `${ready} of ${words.length}`)}</span>
              </div>
              <div className="progress">
                <div style={{ width: `${(ready / words.length) * 100}%`, background: "var(--indigo)" }} />
              </div>
              {next.length > 0 ? (
                <>
                  <Link href={`/wortschatz/lernen?stufe=${encodeURIComponent(level.id)}`} className="btn btn-primary" style={{ width: "100%" }}>
                    {t(`${next.length} Wörter lernen`, `Learn ${next.length} words`)}
                  </Link>
                  <div className="row" style={{ gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                    {next.map((word) => (
                      <span key={word.id} className="zh" style={{ fontSize: 30 }}>{word.tokens.map((token) => token.t).join("")}</span>
                    ))}
                  </div>
                </>
              ) : (
                <span className="sub muted">{t("Stufe geschafft – alles in der Wiederholung.", "Level complete – it's all in your reviews now.")}</span>
              )}
            </section>
          );
        })}

        <section className="card" style={{ borderRadius: 16, gap: 10 }}>
          <span className="sub muted">
            {t(
              `Die offizielle Taiwan-Wortliste (TOCFL), Stufen Novice 1 und 2: ${frequencyWords.length} Wörter, die im Alltag am häufigsten vorkommen.`,
              `The official Taiwan word list (TOCFL), levels Novice 1 and 2: ${frequencyWords.length} words that come up most often in everyday life.`,
            )}
          </span>
          <div className="hairline" />
          <Link href="/woerter" className="row" style={{ gap: 6 }}>
            <span className="label">{t("Grundwortschatz & Szenario-Wörter", "Basics & scenario words")}</span>
            <span className="spacer" />
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </Link>
        </section>
      </div>
    </main>
  );
}
