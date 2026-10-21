"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CloseIcon, MicIcon } from "@/components/Icons";
import { SpeakPractice } from "@/components/SpeakPractice";
import { useStudyTimer } from "@/lib/activity";
import { phrasesById, scenarios, trad, type Phrase } from "@/lib/content";
import { db } from "@/lib/db";
import { loc, useLang, useT } from "@/lib/i18n";

const scoreColor = (score: number) => (score >= 90 ? "var(--green-text)" : score >= 75 ? "var(--orange-text)" : "var(--red-text)");

export default function SpeakingPage() {
  useStudyTimer();
  const lang = useLang();
  const t = useT();
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const bestScores = useLiveQuery(async () => new Map((await db.scores.toArray()).map((r) => [r.id, r.best])), []);
  const [active, setActive] = useState<Phrase | null>(null);

  // Direkt einen Satz öffnen, z. B. aus „Schwächste Sätze“ im Fortschritt: /sprechen?id=…
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    const phrase = id ? phrasesById.get(id) : undefined;
    if (phrase) setActive(phrase);
  }, []);

  if (!lessons || !bestScores) return <main className="screen fullscreen" />;

  const learned = new Set(lessons.flatMap((l) => l.learned));
  const groups = scenarios.map((s) => ({ scenario: s, phrases: s.phrases.filter((p) => learned.has(p.id)) })).filter((g) => g.phrases.length > 0);

  return (
    <main className="screen fullscreen">
      <div className="topbar">
        <Link href="/szenarien" className="icon-btn" aria-label={t("Schließen", "Close")} style={{ justifyContent: "flex-start" }}>
          <span className="close-circle"><CloseIcon /></span>
        </Link>
        <div className="topbar-title">
          <span className="headline">{t("Aussprache", "Pronunciation")}</span>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <p className="sub muted" style={{ margin: "12px 4px 4px", lineHeight: 1.45 }}>
        {t(
          "Sprich gelernte Sätze nach. Du hörst dich im Vergleich zum Original, siehst die Tonkurven und bekommst eine Bewertung.",
          "Say phrases you've learned. You hear yourself next to the original, see the tone curves and get a score.",
        )}
      </p>

      {groups.length === 0 ? (
        <div className="empty" style={{ flexGrow: 1, justifyContent: "center" }}>
          <MicIcon size={44} style={{ color: "var(--blue)" }} />
          <span className="title2" style={{ color: "var(--label)" }}>{t("Noch keine Sätze gelernt", "No phrases learned yet")}</span>
          <Link href="/szenarien" className="btn btn-primary" style={{ width: "auto" }}>{t("Zu den Szenarien", "Go to scenarios")}</Link>
        </div>
      ) : (
        groups.map(({ scenario, phrases }) => (
          <div key={scenario.id}>
            <h2 className="section-header">{loc(lang, scenario.title, scenario.titleEn)}</h2>
            <div className="group">
              {phrases.map((p) => {
                const best = bestScores.get(p.id);
                return (
                  <button key={p.id} className="group-row" style={{ width: "100%", textAlign: "left", paddingTop: 10, paddingBottom: 10 }} onClick={() => setActive(p)}>
                    <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <ChineseText tokens={p.tokens} size={20} secondary={false} />
                      <span className="small muted">{loc(lang, p.de, p.en)}</span>
                    </div>
                    {best !== undefined && <span className="rd" style={{ fontWeight: 700, color: scoreColor(best) }}>{best}</span>}
                    <MicIcon size={20} style={{ color: "var(--blue)" }} />
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {active && (
        <SpeakPractice itemId={active.id} text={trad(active.tokens)} tokens={active.tokens} audio={active.audio} onClose={() => setActive(null)} />
      )}
    </main>
  );
}
