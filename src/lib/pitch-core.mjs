// Tonhöhen-Analyse für das Tontraining – reine Rechenfunktionen ohne Browser-APIs,
// damit sie im Browser und in Testskripten gleich laufen.

const FRAME_SECONDS = 0.04;
const HOP_SECONDS = 0.01;
const MIN_HZ = 70;
const MAX_HZ = 450;

/** Grundfrequenz (Hz, 0 = stimmlos) und Lautstärke je 10 ms, per YIN-Verfahren. */
export function pitchTrack(samples, sampleRate) {
  const frame = Math.round(FRAME_SECONDS * sampleRate);
  const hop = Math.round(HOP_SECONDS * sampleRate);
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.ceil(sampleRate / MIN_HZ);
  const hz = [];
  const rms = [];
  const diff = new Float32Array(maxLag + 2);
  const cmnd = new Float32Array(maxLag + 2);

  for (let start = 0; start + frame + maxLag + 1 < samples.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < frame; i++) energy += samples[start + i] * samples[start + i];
    rms.push(Math.sqrt(energy / frame));

    for (let lag = 1; lag <= maxLag + 1; lag++) {
      let sum = 0;
      for (let i = 0; i < frame; i++) {
        const d = samples[start + i] - samples[start + i + lag];
        sum += d * d;
      }
      diff[lag] = sum;
    }
    let running = 0;
    cmnd[0] = 1;
    for (let lag = 1; lag <= maxLag + 1; lag++) {
      running += diff[lag];
      cmnd[lag] = running > 0 ? (diff[lag] * lag) / running : 1;
    }
    let best = -1;
    let minValue = Infinity;
    let minLagFound = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (cmnd[lag] < minValue) {
        minValue = cmnd[lag];
        minLagFound = lag;
      }
      if (best < 0 && cmnd[lag] < 0.22) {
        while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
        best = lag;
      }
    }
    // Tiefe oder hauchige Stimmen erreichen die Schwelle oft nicht – dann das deutlichste Minimum nehmen.
    if (best < 0 && minValue < 0.45) best = minLagFound;
    if (best > 0) {
      const a = cmnd[best - 1];
      const b = cmnd[best];
      const c = cmnd[best + 1];
      const denom = a - 2 * b + c;
      const shift = denom !== 0 ? (a - c) / (2 * denom) : 0;
      hz.push(sampleRate / (best + (Math.abs(shift) < 1 ? shift : 0)));
    } else {
      hz.push(0);
    }
  }

  // Leise Stellen gelten als stimmlos; Ausreißer (Oktavsprünge) glätten.
  const loudest = rms.reduce((m, v) => Math.max(m, v), 1e-9);
  for (let i = 0; i < hz.length; i++) if (rms[i] < loudest * 0.02) hz[i] = 0;
  const smooth = hz.map((h, i) => {
    if (!h) return 0;
    const around = hz.slice(Math.max(0, i - 2), i + 3).filter(Boolean).sort((x, y) => x - y);
    const median = around[Math.floor(around.length / 2)];
    return h / median > 1.6 || median / h > 1.6 ? median : h;
  });
  return { hz: smooth, rms, frameSeconds: HOP_SECONDS };
}

/** Halbtöne relativ zum Median der eigenen Stimme – so sind Männer- und Frauenstimmen vergleichbar. */
export function toSemitones(hz) {
  const voiced = hz.filter(Boolean).sort((a, b) => a - b);
  if (voiced.length === 0) return hz.map(() => null);
  const median = voiced[Math.floor(voiced.length / 2)];
  return hz.map((h) => (h ? 12 * Math.log2(h / median) : null));
}

/** Teilt einen stimmhaften Abschnitt in `parts` Stücke, Grenzen bevorzugt an leisen Stellen. */
function splitRun([a, b], parts, rms, loudest) {
  const bounds = [a];
  const span = b - a;
  for (let k = 1; k < parts; k++) {
    const target = a + Math.round((span * k) / parts);
    const radius = Math.max(2, Math.round((span / parts) * 0.3));
    let bestIndex = target;
    let bestScore = Infinity;
    for (let i = Math.max(bounds[k - 1] + 3, target - radius); i <= Math.min(b - 3, target + radius); i++) {
      const score = rms[i] / loudest + Math.abs(i - target) / (radius * 4);
      if (score < bestScore) { bestScore = score; bestIndex = i; }
    }
    bounds.push(bestIndex);
  }
  bounds.push(b);
  return bounds.slice(0, -1).map((start, k) => [start, bounds[k + 1]]);
}

const VALLEY = 0.3;
const VALLEY_WINDOW = 12;

/** Wie tief die Lautstärke zwischen zwei Stellen einbricht, relativ zum leiseren Nachbar-Gipfel (0 = Stille, 1 = kein Einbruch). */
function valleyRatio(energy, from, to) {
  let low = Infinity;
  for (let i = from; i < to; i++) low = Math.min(low, energy[i]);
  if (!Number.isFinite(low)) low = Math.min(energy[from - 1] ?? 0, energy[to] ?? 0);
  const left = Math.max(...energy.slice(Math.max(0, from - VALLEY_WINDOW), Math.max(from, 1)));
  const right = Math.max(0, ...energy.slice(to, Math.min(energy.length, to + VALLEY_WINDOW)));
  return low / Math.max(1e-9, Math.min(left, right));
}

/**
 * Silbengrenzen: Jede Silbe beginnt mit einem Vokal, also mit Stimme. Stimmhafte Abschnitte werden
 * deshalb zuerst als Silben genommen – auch bei kurzer Stimmlücke getrennt, wenn die Lautstärke dort
 * deutlich einbricht. Zu viele werden an der schwächsten Grenze zusammengelegt, zu wenige an leisen Stellen geteilt.
 */
export function segmentSyllables(hz, rms, count) {
  if (count < 1) return null;
  const loudest = rms.reduce((m, v) => Math.max(m, v), 1e-9);
  const energy = rms.map((v, i) => ((rms[i - 1] ?? v) + v + (rms[i + 1] ?? v)) / 3);
  let runs = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i < hz.length; i++) {
    if (hz[i] > 0) {
      // Knarrende oder gleitende Stellen verlieren kurz die Tonhöhe – nur ein Lautstärke-Tal ist eine echte Grenze.
      if (start >= 0 && gap > 0 && valleyRatio(energy, i - gap, i) < VALLEY) {
        runs.push([start, i - gap]);
        start = -1;
      }
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0 && ++gap > 3) {
      runs.push([start, i - gap + 1]);
      start = -1;
      gap = 0;
    }
  }
  if (start >= 0) runs.push([start, hz.length - gap]);
  runs = runs.filter(([a, b]) => b - a >= 4);
  if (runs.length === 0) return null;

  while (runs.length > count) {
    let merge = 0;
    let weakest = -1;
    for (let k = 0; k < runs.length - 1; k++) {
      const ratio = valleyRatio(energy, runs[k][1], runs[k + 1][0]);
      if (ratio > weakest) {
        weakest = ratio;
        merge = k;
      }
    }
    runs.splice(merge, 2, [runs[merge][0], runs[merge + 1][1]]);
  }

  if (runs.length < count) {
    const lengths = runs.map(([a, b]) => b - a);
    const total = lengths.reduce((s, l) => s + l, 0);
    const parts = lengths.map((l) => Math.max(1, Math.round((l / total) * count)));
    const sum = () => parts.reduce((s, p) => s + p, 0);
    while (sum() > count) {
      let k = -1;
      parts.forEach((p, j) => { if (p > 1 && (k < 0 || lengths[j] / p < lengths[k] / parts[k])) k = j; });
      parts[k]--;
    }
    while (sum() < count) {
      let k = 0;
      parts.forEach((p, j) => { if (lengths[j] / p > lengths[k] / parts[k]) k = j; });
      parts[k]++;
    }
    runs = runs.flatMap((run, j) => splitRun(run, parts[j], rms, loudest));
  }
  return runs.every(([a, b]) => b - a >= 3) ? runs : null;
}

/**
 * Kennwerte des Tonverlaufs einer Silbe (Halbtöne): Anfang, Ende, Minimum, Mittelwert.
 * Bei der letzten Silbe wird mehr vom Ende ignoriert, weil die Stimme am Satzende ohnehin ausklingt.
 */
export function contourFeatures(semitones, [start, end], isLast = false) {
  const values = semitones.slice(start, end).filter((v) => v !== null);
  if (values.length < 4) return null;
  const trimStart = Math.floor(values.length * 0.15);
  const trimEnd = Math.floor(values.length * (isLast ? 0.35 : 0.15));
  const core = values.slice(trimStart, values.length - trimEnd);
  if (core.length < 3) return null;
  const avg = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const edge = Math.max(2, Math.floor(core.length / 4));
  return { start: avg(core.slice(0, edge)), end: avg(core.slice(-edge)), min: Math.min(...core), mean: avg(core) };
}

/**
 * Hinweis, wenn der eigene Verlauf nicht zum erwarteten Ton passt UND deutlich vom Original abweicht
 * (sonst null). `next` ist der Ton der folgenden Silbe (für die 3.-Ton-Regel).
 */
export function toneHint(expected, user, original, next) {
  if (!user || expected === 0) return null;
  const slope = user.end - user.start;
  const ref = original ? original.end - original.start : null;
  // Ohne messbares Original entscheidet nur die Tonregel.
  const apart = (difference) => ref === null || difference > 2;
  switch (expected) {
    case 1:
      if (slope > 3.5 && apart(slope - ref)) return "t1-rises";
      if (slope < -3.5 && apart(ref - slope)) return "t1-falls";
      return null;
    case 2:
      return slope < -1 && apart(ref - slope) ? "t2-falls" : null;
    case 3:
      if (next === 3) return slope < 0 && apart(ref - slope) ? "t3-sandhi" : null;
      return original && user.mean - original.mean > 3.5 ? "t3-high" : null;
    case 4:
      return slope > 0 && apart(slope - ref) ? "t4-flat" : null;
    default:
      return null;
  }
}

/** Vergleicht eigene Aufnahme und Original Silbe für Silbe. */
export function compareTones({ user, original, tones }) {
  const analyse = ({ samples, sampleRate }) => {
    const track = pitchTrack(samples, sampleRate);
    const st = toSemitones(track.hz);
    const segments = segmentSyllables(track.hz, track.rms, tones.length);
    return { st, segments };
  };
  const u = analyse(user);
  const o = analyse(original);
  return tones.map((tone, i) => {
    const uSeg = u.segments?.[i];
    const oSeg = o.segments?.[i];
    const isLast = i === tones.length - 1;
    const uFeat = uSeg ? contourFeatures(u.st, uSeg, isLast) : null;
    const oFeat = oSeg ? contourFeatures(o.st, oSeg, isLast) : null;
    return {
      tone,
      user: uSeg ? u.st.slice(uSeg[0], uSeg[1]) : [],
      original: oSeg ? o.st.slice(oSeg[0], oSeg[1]) : [],
      hint: toneHint(tone, uFeat, oFeat, tones[i + 1]),
      measured: !!uFeat,
    };
  });
}
