// Azure-Stimmen (Taiwan). Das Gegenüber spricht mit `partnerVoice`,
// deine eigenen Sätze mit der jeweils anderen Stimme – so klingt es wie ein Dialog.
export const VOICES = {
  female: "zh-TW-HsiaoChenNeural",
  male: "zh-TW-YunJheNeural",
};

export function voiceForPhrase(scenario, phrase) {
  const partner = scenario.partnerVoice === "male" ? "male" : "female";
  const self = partner === "male" ? "female" : "male";
  return VOICES[phrase.von === "gegenueber" ? partner : self];
}

export const DEFAULT_VOICE = VOICES.female;

/** Dateiname einer Audiodatei: hängt von Stimme und Text ab, damit Änderungen neu erzeugt werden. */
export function audioKey(voice, text) {
  return `${voice}|${text}`;
}
