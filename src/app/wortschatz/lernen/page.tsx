"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/Icons";
import { WordFlow } from "@/components/WordFlow";
import { useStudyTimer } from "@/lib/activity";
import { frequencyLevels, frequencyWords, type VocabWord } from "@/lib/content";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, useT } from "@/lib/i18n";

const BATCH_SIZE = 5;

/** Eigene Vollbild-Seite, damit der „Weiter“-Knopf nicht unter der Tab-Leiste liegt. */
export default function VocabularyLessonPage() {
  return (
    <Suspense fallback={<main className="screen fullscreen" />}>
      <Lesson />
    </Suspense>
  );
}

function Lesson() {
  const lang = useSettings().language;
  const t = useT();
  useStudyTimer();
  const level = useSearchParams().get("stufe") ?? frequencyLevels[0]?.id;
  const [batch, setBatch] = useState<VocabWord[] | null>(null);
  const [learnedCount, setLearnedCount] = useState(0);
  const [done, setDone] = useState(false);

  const nextBatch = useCallback(async () => {
    const cards = await db.cards.where("phraseId").startsWith("wort-").toArray();
    const learned = new Set(cards.map((c) => c.phraseId));
    const open = frequencyWords.filter((w) => w.stufe === level && !learned.has(w.id));
    setBatch(open.slice(0, BATCH_SIZE));
    setDone(false);
  }, [level]);

  useEffect(() => {
    void nextBatch();
  }, [nextBatch]);

  const title = frequencyLevels.find((l) => l.id === level);
  const header = (
    <div className="topbar">
      <Link href="/wortschatz" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
        <span className="close-circle"><CloseIcon /></span>
      </Link>
      <div className="topbar-title">
        <span className="headline">{title ? loc(lang, title.title, title.titleEn) : t("Wortschatz", "Vocabulary")}</span>
      </div>
      <div style={{ width: 44 }} />
    </div>
  );

  if (batch === null) return <main className="screen fullscreen">{header}</main>;

  if (done || batch.length === 0) {
    return (
      <main className="screen fullscreen">
        {header}
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={36} />
          </div>
          <h1 className="large-title" style={{ color: "var(--label)" }}>
            {batch.length === 0 ? t("Stufe geschafft", "Level complete") : t("Geschafft!", "Done!")}
          </h1>
          <p className="sub" style={{ margin: 0 }}>
            {batch.length === 0
              ? t("Alle Wörter dieser Stufe sind in deiner Wiederholung.", "Every word of this level is in your reviews.")
              : t(`${learnedCount} Wörter gelernt. Sie kommen ab jetzt in deinen Wiederholungen.`, `${learnedCount} words learned. They'll come up in your reviews from now on.`)}
          </p>
        </div>
        <div className="stack">
          {batch.length > 0 && (
            <button className="btn btn-primary" onClick={() => void nextBatch()}>
              {t("Noch 5 Wörter", "5 more words")}
            </button>
          )}
          <Link href="/wortschatz" className="btn btn-tinted">{t("Zur Übersicht", "Back to overview")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="screen fullscreen">
      {header}
      <WordFlow
        batch={batch}
        pool={frequencyWords}
        onDone={() => {
          setLearnedCount(batch.length);
          setDone(true);
        }}
      />
    </main>
  );
}
