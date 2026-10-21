"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, ChevronLeftIcon } from "@/components/Icons";
import { SpeakIconButton } from "@/components/Speak";
import { pinyinText, scenariosById, trad } from "@/lib/content";
import { db } from "@/lib/db";
import { loc, useLang, useT } from "@/lib/i18n";

export function ScenarioDetail({ id }: { id: string }) {
  const scenario = scenariosById.get(id)!;
  const lang = useLang();
  const t = useT();
  const lesson = useLiveQuery(() => db.lessons.get(id), [id]);
  const learned = new Set(lesson?.learned ?? []);
  const remaining = scenario.phrases.length - learned.size;
  const newCount = Math.min(4, remaining);

  return (
    <main className="screen">
      <div className="topbar" style={{ marginLeft: -8 }}>
        <Link href="/szenarien" className="row" style={{ gap: 2, minHeight: 44, color: "var(--blue)" }}>
          <ChevronLeftIcon /> {t("Szenarien", "Scenarios")}
        </Link>
      </div>

      <header style={{ padding: "4px 4px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 className="large-title">{loc(lang, scenario.title, scenario.titleEn)}</h1>
        <div className="row">
          <span className="zh" style={{ fontSize: 22 }}>{trad(scenario.zhTokens)}</span>
          <span className="muted sub">{pinyinText(scenario.zhTokens)}</span>
        </div>
        <span className="muted sub">{loc(lang, scenario.subtitle, scenario.subtitleEn)}</span>
      </header>

      <div className="stack">
        {remaining > 0 ? (
          <Link href={`/lernen/${id}`} className="btn btn-primary">
            {t(`${newCount} neue Sätze lernen`, `Learn ${newCount} new phrases`)}
          </Link>
        ) : (
          <div className="card" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <CheckIcon style={{ color: "var(--green)" }} />
            <span className="sub">{t("Alle Sätze gelernt – sie kommen in deinen Wiederholungen.", "All phrases learned – they'll come up in your reviews.")}</span>
          </div>
        )}
        <Link href={`/rollenspiel/${scenario.roleplay.id}`} className="btn btn-tinted" style={{ width: "100%" }}>
          {t("Rollenspiel: ", "Role-play: ")}
          {loc(lang, scenario.roleplay.title, scenario.roleplay.titleEn)}
        </Link>
      </div>

      {scenario.words.length > 0 && (
        <>
          <h2 className="section-header" style={{ marginTop: 28 }}>{t("Wichtige Wörter", "Key words")}</h2>
          <div className="group">
            {scenario.words.map((w) => (
              <div key={trad(w.tokens)} className="group-row">
                <div className="grow" style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  <ChineseText tokens={w.tokens} size={22} secondary={false} />
                  <span className="sub" style={{ paddingBottom: 3 }}>{loc(lang, w.de, w.en)}</span>
                </div>
                {w.tocfl && (
                  <span className="badge" style={{ background: "var(--fill)", color: "var(--label2)" }} title={t("Stufe in der offiziellen TOCFL-Wortliste", "Level in the official TOCFL word list")}>
                    {w.tocfl}
                  </span>
                )}
                <SpeakIconButton text={trad(w.tokens)} audio={w.audio} />
              </div>
            ))}
          </div>
          <p className="section-footer">{t("Stufen aus der offiziellen TOCFL-Wortliste (Taiwan).", "Levels from the official TOCFL word list (Taiwan).")}</p>
        </>
      )}

      <h2 className="section-header" style={{ marginTop: 28 }}>{t("Sätze", "Phrases")}</h2>
      <div className="group">
        {scenario.phrases.map((p) => (
          <div key={p.id} className="group-row" style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}>
            <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="small muted">{p.von === "du" ? t("Das sagst du", "You say") : t("Das hörst du", "You hear")}</span>
              <ChineseText tokens={p.tokens} size={24} secondary={false} />
              <span className="sub">{loc(lang, p.de, p.en)}</span>
            </div>
            <div className="row" style={{ gap: 0 }}>
              {learned.has(p.id) && <CheckIcon size={14} style={{ color: "var(--green)" }} />}
              <SpeakIconButton text={trad(p.tokens)} audio={p.audio} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
