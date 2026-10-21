"use client";

import { useT } from "@/lib/i18n";
import type { CurveSyllable } from "@/lib/tonecurve";
import { InfoIcon } from "./Icons";

const COLUMN = 64;
const HEIGHT = 110;
const PAD_X = 8;
const PAD_Y = 10;
/** Mindestbereich in Halbtönen; wird erweitert, wenn eine Stimme weiter ausschlägt. */
const MIN_ST = -8;
const MAX_ST = 8;

/** Texte zu den Hinweis-Codes aus pitch-core. */
const HINTS: Record<string, [string, string]> = {
  "t1-rises": ["sollte gleichbleibend hoch sein – steigt", "should stay high and level – rises"],
  "t1-falls": ["sollte gleichbleibend hoch sein – fällt", "should stay high and level – falls"],
  "t2-falls": ["sollte steigen – fällt eher", "should rise – tends to fall"],
  "t3-sandhi": ["vor einem 3. Ton wie einen 2. Ton steigen lassen", "before another 3rd tone, let it rise like a 2nd tone"],
  "t3-high": ["sollte tiefer gehen", "should go lower"],
  "t4-flat": ["sollte fallen – steigt oder bleibt gleich", "should fall – rises or stays level"],
};

type Scale = (st: number) => number;

/** y-Achse passend zu allen gezeigten Werten, damit nichts abgeschnitten wird. */
function makeScale(syllables: CurveSyllable[], showUser: boolean): Scale {
  const values = syllables.flatMap((s) => (showUser ? [...s.original, ...s.user] : s.original)).filter((v): v is number => v !== null);
  const lo = Math.min(MIN_ST, ...values.map((v) => Math.floor(v - 1)));
  const hi = Math.max(MAX_ST, ...values.map((v) => Math.ceil(v + 1)));
  return (st) => PAD_Y + ((hi - Math.max(lo, Math.min(hi, st))) / (hi - lo)) * (HEIGHT - 2 * PAD_Y);
}

/** Pfad durch die Messpunkte einer Silbe; stimmlose Stellen unterbrechen die Linie. */
function linePath(values: (number | null)[], column: number, y: Scale) {
  if (values.length < 2) return "";
  const x0 = column * COLUMN + PAD_X;
  const width = COLUMN - 2 * PAD_X;
  let d = "";
  let drawing = false;
  values.forEach((v, i) => {
    if (v === null) {
      drawing = false;
      return;
    }
    const x = x0 + (i / (values.length - 1)) * width;
    d += `${drawing ? "L" : "M"}${x.toFixed(1)},${y(v).toFixed(1)}`;
    drawing = true;
  });
  return d;
}

/** Tonverlauf je Silbe: Original (orange) und – falls vorhanden – eigene Aufnahme (blau). */
export function ToneCurve({ syllables, showUser }: { syllables: CurveSyllable[]; showUser: boolean }) {
  const t = useT();
  const hintText = (code: string) => (HINTS[code] ? t(...HINTS[code]) : code);
  const y = makeScale(syllables, showUser);
  const width = syllables.length * COLUMN;
  const hints = syllables.filter((s) => s.hint);
  const summary = syllables.map((s) => `${s.py}: ${s.hint ? hintText(s.hint) : t("kein Hinweis", "no hint")}`).join(", ");

  return (
    <div className="tone-curve" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row small muted" style={{ gap: 14 }}>
        <span className="row" style={{ gap: 5 }}>
          <svg width="16" height="4" aria-hidden><line x1="1" y1="2" x2="15" y2="2" stroke="var(--viz-original)" strokeWidth="2" strokeLinecap="round" /></svg>
          Original
        </span>
        {showUser && (
          <span className="row" style={{ gap: 5 }}>
            <svg width="16" height="4" aria-hidden><line x1="1" y1="2" x2="15" y2="2" stroke="var(--viz-user)" strokeWidth="2" strokeLinecap="round" /></svg>
            {t("Du", "You")}
          </span>
        )}
        <span className="spacer" />
        <span>{t("hoch ↑ · tief ↓", "high ↑ · low ↓")}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={HEIGHT + 40} viewBox={`0 0 ${width} ${HEIGHT + 40}`} role="img" aria-label={`${t("Tonkurven", "Tone curves")}: ${summary}`} style={{ display: "block", margin: "0 auto" }}>
          {syllables.map((s, i) => (
            <g key={i}>
              <rect x={i * COLUMN + 1} y={0} width={COLUMN - 2} height={HEIGHT} rx={8} fill="var(--viz-cell)" />
              <line x1={i * COLUMN + PAD_X} x2={(i + 1) * COLUMN - PAD_X} y1={y(0)} y2={y(0)} stroke="var(--viz-grid)" strokeWidth="1" />
              <path d={linePath(s.original, i, y)} fill="none" stroke="var(--viz-original)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {showUser && (
                <path d={linePath(s.user, i, y)} fill="none" stroke="var(--viz-user)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {showUser && !s.measured && (
                <text x={i * COLUMN + COLUMN / 2} y={HEIGHT / 2 + 4} textAnchor="middle" fontSize="11" fill="var(--label2)">{t("nicht messbar", "no reading")}</text>
              )}
              <text x={i * COLUMN + COLUMN / 2} y={HEIGHT + 19} textAnchor="middle" fontSize="17" fill="var(--label)" style={{ fontFamily: "var(--font-zh)" }}>
                {s.char}
              </text>
              <text x={i * COLUMN + COLUMN / 2} y={HEIGHT + 35} textAnchor="middle" fontSize="11" fill="var(--label2)">
                {s.py}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {showUser && (
        hints.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {hints.map((s, i) => (
              <div key={i} className="row small" style={{ gap: 6, alignItems: "flex-start" }}>
                <InfoIcon size={14} style={{ color: "var(--orange)", flexShrink: 0, marginTop: 1 }} />
                <span><strong>{s.py}</strong>: {hintText(s.hint!)} <span className="muted">({t("geschätzt", "estimated")})</span></span>
              </div>
            ))}
          </div>
        ) : (
          <span className="small muted">
            {t(
              "Keine auffälligen Tonabweichungen gefunden (geschätzt). Vergleiche die Kurven trotzdem selbst.",
              "No obvious tone mistakes found (estimated). Still compare the curves yourself.",
            )}
          </span>
        )
      )}
    </div>
  );
}
