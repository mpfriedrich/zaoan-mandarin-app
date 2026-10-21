"use client";

import { useSettings } from "./hooks";

export type Lang = "de" | "en";

/**
 * Übersetzung direkt an der Stelle, an der der Text steht:
 * `const t = useT(); t("Heute", "Today")`.
 */
export function useT() {
  const { language } = useSettings();
  return (de: string, en: string) => (language === "en" ? en : de);
}

export function useLang(): Lang {
  return useSettings().language;
}

/** Wählt die passende Fassung eines Inhalts (Englisch nur, wenn vorhanden). */
export const loc = (lang: Lang, de: string, en?: string) => (lang === "en" && en ? en : de);

/** Übersetzung in passenden Anführungszeichen. */
export const quote = (lang: Lang, text: string) => (lang === "en" ? `“${text}”` : `„${text}“`);

export const dateLocale = (lang: Lang) => (lang === "en" ? "en-US" : "de-DE");
