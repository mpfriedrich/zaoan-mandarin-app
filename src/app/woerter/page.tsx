"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/Icons";
import { WordFlow } from "@/components/WordFlow";
import { useStudyTimer } from "@/lib/activity";
import { beginnerWords, type VocabWord } from "@/lib/content";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { loc, useT } from "@/lib/i18n";

/** Wörter pro Runde – kurz genug für zwischendurch. */
const BATCH_SIZE = 5;

export default function WordsPage() {
  const lang = useSettings().language;
  const t = useT();
  useStudyTimer();
  const [open, setOpen] = useState<VocabWord[] | null>(null);
  const [batch, setBatch] = useState<VocabWord[] | null>(null);
  const [done, setDone] = useState(0);

  // Ein Wort gilt als gelernt, sobald es Karten hat – egal ob aus dieser Liste oder aus einem Szenario.
  const load = useCallback(async () => {
    const cards = await db.cards.where("phraseId").startsWith("wort-").toArray();
    const learned = new Set(cards.map((c) => c.phraseId));
    setOpen(beginnerWords.filter((w) => !learned.has(w.id)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (open === null) return <main className="screen fullscreen" />;

  const total = beginnerWords.length;
  const learnedCount = total - open.length;
  const next = open.slice(0, BATCH_SIZE);

  if (batch) {
    return (
      <main className="screen fullscreen">
        <Topbar title={t("Wörter lernen", "Learn words")} onClose={() => setBatch(null)} t={t} />
        <WordFlow
          batch={batch}
          pool={beginnerWords}
          onDone={() => {
            setDone(batch.length);
            setBatch(null);
            void load();
          }}
        />
      </main>
    );
  }

  return (
    <main className="screen fullscreen">
      <Topbar title={t("Wörter lernen", "Learn words")} href="/wortschatz" t={t} />

      {done > 0 && (
        <section className="card" style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: "var(--green)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CheckIcon size={22} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="label">{t(`${done} Wörter gelernt`, `${done} words learned`)}</span>
            <span className="small muted">{t("Sie kommen ab jetzt in deinen Wiederholungen.", "They'll come up in your reviews from now on.")}</span>
          </div>
        </section>
      )}

      {next.length > 0 ? (
        <>
          <section className="card" style={{ marginTop: 14 }}>
            <div className="row" style={{ gap: 10 }}>
              <div className="progress grow">
                <div style={{ width: `${(learnedCount / total) * 100}%` }} />
              </div>
              <span className="small muted">{t(`${learnedCount} von ${total}`, `${learnedCount} of ${total}`)}</span>
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setBatch(next)}>
              {t(`${next.length} Wörter lernen`, `Learn ${next.length} words`)}
            </button>
            <span className="small muted">
              {t("Grundwortschatz und Wörter aus den Szenarien, von leicht nach schwer.", "Basics and scenario words, from easy to hard.")}
            </span>
          </section>

          <span className="eyebrow" style={{ margin: "18px 4px 8px" }}>{t("Als Nächstes", "Coming up")}</span>
          <section className="card" style={{ gap: 0, paddingTop: 4, paddingBottom: 4 }}>
            {next.map((word, i) => (
              <div key={word.id}>
                {i > 0 && <div className="hairline" />}
                <div className="row" style={{ gap: 12, padding: "10px 0" }}>
                  <span className="zh" style={{ fontSize: 26 }}>{word.tokens.map((token) => token.t).join("")}</span>
                  <span className="spacer" />
                  <span className="sub muted" style={{ textAlign: "right" }}>{loc(lang, word.de, word.en)}</span>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
            <CheckIcon size={48} style={{ color: "var(--green)" }} />
            <h1 className="title2" style={{ color: "var(--label)" }}>{t("Alle Wörter gelernt", "All words learned")}</h1>
            <p className="sub" style={{ margin: 0 }}>{t("Üb sie in den Wiederholungen weiter.", "Keep practising them in your reviews.")}</p>
          </div>
          <Link href="/wiederholen" className="btn btn-primary">{t("Wiederholen", "Review")}</Link>
        </>
      )}
    </main>
  );
}

function Topbar({ title, href, onClose, t }: { title: string; href?: string; onClose?: () => void; t: (de: string, en: string) => string }) {
  return (
    <div className="topbar">
      {href ? (
        <Link href={href} className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
          <span className="close-circle"><CloseIcon /></span>
        </Link>
      ) : (
        <button className="icon-btn" aria-label={t("Schließen", "Close")} onClick={onClose} style={{ justifyContent: "flex-start" }}>
          <span className="close-circle"><CloseIcon /></span>
        </button>
      )}
      <div className="topbar-title">
        <span className="headline">{title}</span>
      </div>
      <div style={{ width: 44 }} />
    </div>
  );
}
