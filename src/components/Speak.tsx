"use client";

import { say, sayRemote } from "@/lib/audio";
import { useSettings } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { SpeakerIcon } from "./Icons";

export function SpeakButtons({ text, audio }: { text: string; audio?: string }) {
  const settings = useSettings();
  const t = useT();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      <button className="btn btn-tinted" onClick={() => say(text, { audio, voiceURI: settings.voiceURI, slow: settings.rate === "langsam" })}>
        <SpeakerIcon /> {t("Anhören", "Listen")}
      </button>
      <button className="btn btn-tinted" onClick={() => say(text, { audio, voiceURI: settings.voiceURI, slow: true })}>
        <span style={{ fontSize: 13, fontWeight: 700, border: "1.5px solid currentColor", borderRadius: 5, padding: "0 4px" }}>{t("0,5×", "0.5×")}</span>
        {t("Langsam", "Slow")}
      </button>
    </div>
  );
}

/** Kleiner Lautsprecher-Knopf. `audio` = feste Aufnahme, `voice` = frei erzeugter Satz über den Server. */
export function SpeakIconButton({ text, audio, voice, size = 18 }: { text: string; audio?: string; voice?: "female" | "male"; size?: number }) {
  const settings = useSettings();
  const t = useT();
  const slow = settings.rate === "langsam";
  return (
    <button
      className="icon-btn"
      aria-label={t("Anhören", "Listen")}
      style={{ color: "var(--blue)", width: 36, height: 36, flexShrink: 0 }}
      onClick={() => (voice ? void sayRemote(text, voice, { voiceURI: settings.voiceURI, slow }) : say(text, { audio, voiceURI: settings.voiceURI, slow }))}
    >
      <SpeakerIcon size={size} />
    </button>
  );
}
