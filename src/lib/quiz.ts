/** Kleine Helfer für Auswahlfragen – geteilt von Satz- und Wort-Lektionen. */

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Die richtige Antwort plus Ablenker aus demselben Vorrat, in zufälliger Reihenfolge. */
export function optionsFor<T extends { id: string }>(item: T, pool: T[], distractors = 3) {
  const others = shuffle(pool.filter((p) => p.id !== item.id)).slice(0, distractors);
  return shuffle([item, ...others]);
}
