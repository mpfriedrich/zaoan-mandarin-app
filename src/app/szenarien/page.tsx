"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { CardsIcon, ChevronRightIcon, EyeIcon, HeadphonesIcon, MicIcon, PencilIcon, PinFilledIcon, ToneContour } from "@/components/Icons";
import { pinyinText, scenarios, trad } from "@/lib/content";
import { db } from "@/lib/db";
import { colorTextVar, colorVar } from "@/lib/hooks";
import { loc, useLang, useT } from "@/lib/i18n";

export default function ScenariosPage() {
  const lang = useLang();
  const t = useT();
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const learned = new Map((lessons ?? []).map((l) => [l.id, l.learned.length]));

  return (
    <main className="screen">
      <header className="header">
        <h1 className="large-title">{t("Szenarien", "Scenarios")}</h1>
      </header>
      <div className="stack">
        <Link href="/toene" className="card">
          <div className="card-head">
            <ToneContour tone={3} size={18} style={{ color: "var(--orange)" }} />
            <span className="label" style={{ color: "var(--orange-text)" }}>{t("Grundlagen", "Basics")}</span>
            <span className="spacer" />
            {learned.has("toene") && <span className="muted">{t("Erledigt", "Done")}</span>}
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </div>
          <span className="title2">{t("Die vier Töne", "The four tones")}</span>
          <span className="sub muted">{t("Hören, unterscheiden, üben", "Listen, distinguish, practice")}</span>
        </Link>

        <Link href="/hoeren" className="card">
          <div className="card-head">
            <HeadphonesIcon style={{ color: "var(--blue)" }} />
            <span className="label" style={{ color: "var(--blue-text)" }}>{t("Hörtraining", "Listening")}</span>
            <span className="spacer" />
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </div>
          <span className="title2">{t("Verstehst du es?", "Can you understand it?")}</span>
          <span className="sub muted">{t("10 Fragen zu Sätzen, die du schon gelernt hast", "10 questions on phrases you've already learned")}</span>
        </Link>

        <Link href="/sprechen" className="card">
          <div className="card-head">
            <MicIcon size={16} style={{ color: "var(--red)" }} />
            <span className="label" style={{ color: "var(--red-text)" }}>{t("Aussprache", "Pronunciation")}</span>
            <span className="spacer" />
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </div>
          <span className="title2">{t("Nachsprechen", "Speaking practice")}</span>
          <span className="sub muted">{t("Aufnehmen, vergleichen und bewerten lassen", "Record, compare and get a score")}</span>
        </Link>

        <Link href="/woerter" className="card">
          <div className="card-head">
            <CardsIcon style={{ color: "var(--indigo)" }} />
            <span className="label" style={{ color: "var(--indigo-text)" }}>{t("Wörter", "Words")}</span>
            <span className="spacer" />
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </div>
          <span className="title2">{t("Einzelne Wörter lernen", "Learn single words")}</span>
          <span className="sub muted">{t("Kurze Runden mit Grundwortschatz, von leicht nach schwer", "Short rounds of basic vocabulary, from easy to hard")}</span>
        </Link>

        <Link href="/schreiben" className="card">
          <div className="card-head">
            <PencilIcon size={16} style={{ color: "var(--green)" }} />
            <span className="label" style={{ color: "var(--green-text)" }}>{t("Schreiben", "Writing")}</span>
            <span className="spacer" />
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </div>
          <span className="title2">{t("Zeichen schreiben", "Writing characters")}</span>
          <span className="sub muted">{t("Strichfolge ansehen und mit dem Finger nachschreiben", "Watch the stroke order and write with your finger")}</span>
        </Link>

        <Link href="/schilder" className="card">
          <div className="card-head">
            <EyeIcon style={{ color: "var(--indigo)" }} />
            <span className="label" style={{ color: "var(--indigo-text)" }}>{t("Lesen", "Reading")}</span>
            <span className="spacer" />
            <ChevronRightIcon style={{ color: "var(--label3)" }} />
          </div>
          <span className="title2">{t("Schilder & Speisekarten", "Signs & menus")}</span>
          <span className="sub muted">{t("Echte Aufschriften aus Taiwan ohne Pinyin erkennen", "Recognize real signs from Taiwan without pinyin")}</span>
        </Link>

        {scenarios.map((s, i) => {
          const count = learned.get(s.id) ?? 0;
          return (
            <Link key={s.id} href={`/szenarien/${s.id}`} className="card">
              <div className="card-head">
                <PinFilledIcon style={{ color: colorVar(s.color) }} />
                <span className="label" style={{ color: colorTextVar(s.color) }}>{t(`Szenario ${i + 1}`, `Scenario ${i + 1}`)}</span>
                <span className="spacer" />
                <span className="muted">
                  {count === s.phrases.length ? t("Gelernt", "Learned") : t(`${count} von ${s.phrases.length}`, `${count} of ${s.phrases.length}`)}
                </span>
                <ChevronRightIcon style={{ color: "var(--label3)" }} />
              </div>
              <span className="title2">{loc(lang, s.title, s.titleEn)}</span>
              <span className="sub muted">
                <span className="zh" style={{ color: "var(--label)" }}>{trad(s.zhTokens)}</span> {pinyinText(s.zhTokens)} · {loc(lang, s.subtitle, s.subtitleEn)}
              </span>
              <div className="progress">
                <div style={{ width: `${(count / s.phrases.length) * 100}%`, background: colorVar(s.color) }} />
              </div>
            </Link>
          );
        })}
        <p className="section-footer" style={{ textAlign: "center" }}>{t("Weitere Szenarien folgen.", "More scenarios are on the way.")}</p>
      </div>
    </main>
  );
}
