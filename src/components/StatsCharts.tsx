"use client";

import { useState } from "react";

type T = (de: string, en: string) => string;

const W = 320;
/** Für Screenreader: jede Grafik hat eine Tabelle mit denselben Werten. */
const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

export type DayBar = { key: string; label: string; long: string; minutes: number; reviews: number };

/** Lernminuten der letzten Tage als Säulen mit Ziellinie. Tippen zeigt die Werte eines Tages. */
export function WeekBars({ data, goal, t }: { data: DayBar[]; goal: number; t: T }) {
  const [selected, setSelected] = useState(data.length - 1);
  const H = 132;
  const top = 16;
  const base = 106;
  const plot = base - top;
  const max = Math.max(goal * 1.2, ...data.map((d) => d.minutes), 5);
  const band = W / data.length;
  const barWidth = Math.min(24, band * 0.5);
  const y = (v: number) => base - (v / max) * plot;
  const barPath = (i: number, v: number) => {
    const h = Math.max(2, (v / max) * plot);
    const x = i * band + (band - barWidth) / 2;
    const r = Math.min(4, h);
    return `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barWidth - r} Q${x + barWidth},${base - h} ${x + barWidth},${base - h + r} V${base} Z`;
  };
  const s = data[selected];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
      <div className="row small" style={{ justifyContent: "space-between", alignItems: "baseline" }} aria-live="polite">
        <span className="muted">{s.long}</span>
        <span>
          <strong>{s.minutes}</strong> {t("Min", "min")} · <strong>{s.reviews}</strong> {t("Wiederholungen", "reviews")}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("Lernminuten pro Tag", "Study minutes per day")} style={{ display: "block" }}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--separator)" strokeWidth={1} />
        <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--label3)" strokeWidth={1} />
        {data.map((d, i) => (
          <g key={d.key}>
            {d.minutes > 0 && <path d={barPath(i, d.minutes)} fill="var(--blue)" opacity={i === selected ? 1 : 0.72} />}
            <text x={i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={i === selected ? "var(--label)" : "var(--label2)"} fontWeight={i === selected ? 700 : 400}>
              {d.label}
            </text>
            <rect
              x={i * band}
              y={0}
              width={band}
              height={H}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${d.long}: ${d.minutes} ${t("Minuten", "minutes")}`}
              onPointerEnter={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              style={{ cursor: "pointer", outline: "none" }}
            />
          </g>
        ))}
      </svg>
      <table style={visuallyHidden}>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.long}</th>
              <td>{d.minutes} {t("Minuten", "minutes")}</td>
              <td>{d.reviews} {t("Wiederholungen", "reviews")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ScorePoint = { key: string; label: string; long: string; avg: number | null; count: number };

/** Durchschnittliche Aussprache-Punktzahl pro Tag als Linie; Tage ohne Übung bleiben leer. */
export function ScoreLine({ data, t }: { data: ScorePoint[]; t: T }) {
  const points = data.map((d, i) => ({ ...d, i })).filter((d): d is ScorePoint & { i: number; avg: number } => d.avg !== null);
  const [selected, setSelected] = useState(points.length ? points[points.length - 1].i : -1);
  const H = 146;
  const top = 10;
  const base = 116;
  const left = 26;
  const right = W - 10;
  const x = (i: number) => left + (i / Math.max(1, data.length - 1)) * (right - left);
  const y = (v: number) => base - (v / 100) * (base - top);
  const line = points.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.avg).toFixed(1)}`).join("");
  const s = data[selected];
  const ticks = [0, 50, 90];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
      <div className="row small" style={{ justifyContent: "space-between", alignItems: "baseline" }} aria-live="polite">
        <span className="muted">{s ? s.long : ""}</span>
        {s && s.avg !== null && (
          <span>
            {t("Ø", "Avg")} <strong>{Math.round(s.avg)}</strong> · {s.count} {s.count === 1 ? t("Übung", "attempt") : t("Übungen", "attempts")}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("Aussprache-Punktzahl pro Tag", "Pronunciation score per day")} style={{ display: "block" }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--separator)" : "var(--fill)"} strokeWidth={1} />
            <text x={left - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--label2)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {v}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <g key={p.key}>
            <circle cx={x(p.i)} cy={y(p.avg)} r={p.i === selected ? 5 : 4} fill="var(--blue)" stroke="var(--card)" strokeWidth={2} />
            <circle
              cx={x(p.i)}
              cy={y(p.avg)}
              r={12}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${p.long}: ${Math.round(p.avg)}`}
              onPointerEnter={() => setSelected(p.i)}
              onClick={() => setSelected(p.i)}
              onFocus={() => setSelected(p.i)}
              style={{ cursor: "pointer", outline: "none" }}
            />
          </g>
        ))}
        <text x={left} y={H - 8} fontSize={11} fill="var(--label2)">{data[0]?.label}</text>
        <text x={right} y={H - 8} textAnchor="end" fontSize={11} fill="var(--label2)">{data[data.length - 1]?.label}</text>
      </svg>
      <table style={visuallyHidden}>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th>{p.long}</th>
              <td>{Math.round(p.avg)}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
