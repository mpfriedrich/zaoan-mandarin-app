"use client";

import type { Token } from "@/lib/content";
import { useSettings } from "@/lib/hooks";
import type { Word } from "@/lib/roleplay-types";

type Unit = { main: string; alt: string; py: string; zy: string; punct: boolean };

/** Chinesischer Text mit Pinyin (und optional Zhuyin) über jedem Zeichen bzw. Wort. */
export function ChineseText({
  tokens,
  words,
  size = 32,
  secondary = true,
  pinyin,
}: {
  tokens?: Token[];
  words?: Word[];
  size?: number;
  secondary?: boolean;
  /** false: Aussprache (Pinyin und Zhuyin) ausblenden, z. B. auf gut sitzenden Lesekarten. Standard: laut Einstellungen. */
  pinyin?: boolean;
}) {
  const settings = useSettings();
  const traditional = settings.mainScript === "trad";
  const en = settings.language === "en";
  const units: Unit[] = tokens
    ? tokens.map((t) => ({ main: traditional ? t.t : t.s, alt: traditional ? t.s : t.t, py: t.p, zy: t.z, punct: !t.p }))
    : (words ?? []).map((w) => {
        const s = w.s ?? w.zh;
        return { main: traditional ? w.zh : s, alt: traditional ? s : w.zh, py: w.py, zy: "", punct: false };
      });
  const showPinyin = pinyin !== false && settings.pinyin;
  const showZhuyin = pinyin !== false && settings.zhuyin && !!tokens;
  const differs = units.some((u) => u.main !== u.alt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="ruby-line" style={{ fontSize: size }} lang="zh-Hant-TW">
        {units.map((u, i) => (
          <span key={i} className={u.punct ? "ruby punct" : "ruby"}>
            {showPinyin && <span className="py">{u.py || " "}</span>}
            {showZhuyin && <span className="zy">{u.zy || " "}</span>}
            <span className="hz">{u.main}</span>
          </span>
        ))}
      </div>
      {secondary && settings.showSecondary && (
        <div className="sub muted">
          {en ? (traditional ? "Simplified " : "Traditional ") : traditional ? "Vereinfacht " : "Traditionell "}
          <span className="zh" style={{ color: "var(--label)" }}>
            {units.map((u, i) => (
              <span key={i} className={u.main !== u.alt ? "diff" : undefined}>
                {u.alt}
              </span>
            ))}
          </span>
          {!differs && <span className="small">{en ? " · same" : " · gleich"}</span>}
        </div>
      )}
    </div>
  );
}
