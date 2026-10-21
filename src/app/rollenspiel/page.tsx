"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { ChatFilledIcon, ChevronRightIcon } from "@/components/Icons";
import { scenarios } from "@/lib/content";
import { db } from "@/lib/db";
import { loc, useLang, useT } from "@/lib/i18n";

export default function RoleplaysPage() {
  const lang = useLang();
  const t = useT();
  const sessions = useLiveQuery(() => db.roleplays.toArray(), []);
  const byId = new Map((sessions ?? []).map((s) => [s.id, s]));

  return (
    <main className="screen">
      <header className="header">
        <h1 className="large-title">{t("Rollenspiel", "Role-play")}</h1>
      </header>
      <p className="sub muted" style={{ margin: "0 4px 16px", lineHeight: 1.45 }}>
        {t(
          "Übe echte Gespräche mit Claude. Du bekommst Korrekturen und Antwort-Vorschläge. Dafür brauchst du Internet.",
          "Practice real conversations with Claude. You get corrections and suggested replies. This needs internet.",
        )}
      </p>
      <div className="stack">
        {scenarios.map((s) => {
          const session = byId.get(s.roleplay.id);
          const status = session?.finished ? t("Geschafft", "Completed") : session?.turns.length ? t("Fortsetzen", "Continue") : t("Neu", "New");
          return (
            <Link key={s.roleplay.id} href={`/rollenspiel/${s.roleplay.id}`} className="card">
              <div className="card-head">
                <ChatFilledIcon style={{ color: "var(--indigo)" }} />
                <span className="label" style={{ color: "var(--indigo-text)" }}>{loc(lang, s.title, s.titleEn)}</span>
                <span className="spacer" />
                <span className="muted">{status}</span>
                <ChevronRightIcon style={{ color: "var(--label3)" }} />
              </div>
              <span className="title2">{loc(lang, s.roleplay.title, s.roleplay.titleEn)}</span>
              <span className="sub muted">{loc(lang, s.roleplay.setting, s.roleplay.settingEn)}</span>
              <span className="sub"><span className="muted">{t("Ziel:", "Goal:")}</span> {loc(lang, s.roleplay.goal, s.roleplay.goalEn)}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
