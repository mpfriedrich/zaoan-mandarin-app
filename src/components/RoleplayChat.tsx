"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChineseText } from "@/components/Chinese";
import { CheckIcon, ChevronLeftIcon, InfoIcon, MicIcon, PencilIcon, SendIcon } from "@/components/Icons";
import { SpeakIconButton } from "@/components/Speak";
import { addActivity, useStudyTimer } from "@/lib/activity";
import { sayRemote, stopAudio } from "@/lib/audio";
import { roleplaysById } from "@/lib/content";
import { db, notifyChange, setMeta } from "@/lib/db";
import { useSettingsState } from "@/lib/hooks";
import { loc, useT } from "@/lib/i18n";
import { matchSpeech, recognizeSpeech, type CandidateScore } from "@/lib/pronounce";
import { canRecord, startRecording } from "@/lib/recorder";
import type { ChatTurn, RoleplayTurnData, Sentence } from "@/lib/roleplay-types";
import { canRecognize, listen } from "@/lib/speech";

const ERRORS: Record<string, [string, string]> = {
  offline: ["Für das Rollenspiel brauchst du Internet.", "You need an internet connection for the role-play."],
  limit: ["Tageslimit erreicht. Morgen geht es weiter.", "Daily limit reached. You can continue tomorrow."],
  busy: ["Claude ist gerade ausgelastet. Versuch es gleich nochmal.", "Claude is busy right now. Please try again in a moment."],
  unauthorized: ["Bitte melde dich neu an.", "Please sign in again."],
  config: ["Der API-Key auf dem Server funktioniert nicht.", "The API key on the server isn't working."],
  refusal: ["Diese Antwort konnte nicht erzeugt werden. Formuliere es bitte anders.", "No answer could be generated. Please phrase it differently."],
  "nothing-heard": ["Ich habe nichts verstanden. Sprich deutlich und tippe erst danach auf Stopp.", "I couldn't understand anything. Speak clearly and only then tap stop."],
  stt: ["Die Spracherkennung hat nicht geklappt. Du kannst die Antwort auch tippen.", "Speech recognition didn't work. You can also type your answer."],
  "too-short": ["Die Aufnahme war sehr kurz. Tippe, sprich den ganzen Satz und tippe erst dann auf Stopp.", "The recording was very short. Tap, say the whole sentence and only then tap stop."],
  mic: ["Das Mikrofon ist nicht erlaubt. Du kannst die Antwort auch tippen.", "Microphone access isn't allowed. You can also type your answer."],
  unknown: ["Etwas ist schiefgelaufen. Versuch es nochmal.", "Something went wrong. Please try again."],
};

const sentenceText = (s: Sentence) => s.words.map((w) => w.zh).join("");

export function RoleplayChat({ id }: { id: string }) {
  const { scenario, roleplay } = roleplaysById.get(id)!;
  const { settings, ready: settingsReady } = useSettingsState();
  const lang = settings.language;
  const t = useT();
  useStudyTimer();

  const [turns, setTurns] = useState<ChatTurn[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceNote, setVoiceNote] = useState<{ text: string; sure: boolean } | null>(null);
  const [maybe, setMaybe] = useState<string | null>(null);
  const learnerVoice = scenario.partnerVoice === "male" ? "female" : "male";
  const recorderRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const [micAvailable, setMicAvailable] = useState(false);
  const stopListening = useRef<(() => void) | null>(null);
  const opened = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMicAvailable(canRecord() || canRecognize());
    db.roleplays.get(id).then((rec) => setTurns(rec?.turns ?? []));
    return () => recorderRef.current?.cancel();
  }, [id]);

  const persist = useCallback(
    async (all: ChatTurn[]) => {
      const last = [...all].reverse().find((turn) => turn.role === "assistant");
      await db.roleplays.put({ id, turns: all, finished: last?.role === "assistant" && last.data.done, updatedAt: Date.now() });
      notifyChange();
    },
    [id],
  );

  const request = useCallback(
    async (history: ChatTurn[]) => {
      if (!navigator.onLine) {
        setError("offline");
        return;
      }
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/roleplay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleplayId: id, turns: history, model: settings.model, language: settings.language }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) await setMeta("loggedIn", false);
          setError(ERRORS[body.error] ? body.error : "unknown");
          return;
        }
        const data = body.data as RoleplayTurnData;
        const all: ChatTurn[] = [...history, { role: "assistant", data, at: Date.now() }];
        setTurns(all);
        await persist(all);
        void sayRemote(sentenceText(data.reply), scenario.partnerVoice, { voiceURI: settings.voiceURI, slow: settings.rate === "langsam" });
      } catch {
        setError(navigator.onLine ? "unknown" : "offline");
      } finally {
        setPending(false);
      }
    },
    [id, scenario.partnerVoice, settings.model, settings.language, settings.voiceURI, settings.rate, persist],
  );

  useEffect(() => {
    // Erst starten, wenn die Einstellungen geladen sind – sonst käme die Übersetzung in der Standardsprache.
    if (settingsReady && turns && turns.length === 0 && !opened.current) {
      opened.current = true;
      void request([]);
    }
  }, [settingsReady, turns, request]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns?.length, pending, error]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || pending || !turns) return;
    stopListening.current?.();
    const next: ChatTurn[] = [...turns, { role: "user", text: clean, at: Date.now() }];
    setTurns(next);
    setDraft("");
    setVoiceNote(null);
    setMaybe(null);
    await persist(next);
    void addActivity(0, 1);
    void request(next);
  };

  const restart = async () => {
    if (!window.confirm(t("Rollenspiel neu starten?", "Restart the role-play?"))) return;
    opened.current = false;
    setError(null);
    setTurns([]);
    await persist([]);
  };

  // Aufnahme → Azure-Spracherkennung (zh-TW). Funktioniert auch in der installierten iPhone-App.
  const finishRecording = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    setListening(false);
    setTranscribing(true);
    try {
      const recording = await rec.stop();
      URL.revokeObjectURL(recording.url);
      if (recording.seconds < 0.6 || recording.peak < 0.02) {
        setError(recording.peak < 0.02 ? "nothing-heard" : "too-short");
        return;
      }
      // Wurde gerade ein Vorschlag nachgesprochen? Dann gezielt mit den Vorschlägen abgleichen.
      const suggestions = lastAssistant && !lastIsUser ? lastAssistant.data.suggestions.map(sentenceText) : [];
      const result = suggestions.length ? await matchSpeech(recording.blob, suggestions) : await recognizeSpeech(recording.blob);
      const [top, second] = (result as { candidates?: CandidateScore[] }).candidates ?? [];
      setMaybe(null);
      if (top && top.score >= 60 && top.completeness >= 60 && (!second || top.score - second.score >= 8)) {
        setDraft(top.text);
        setVoiceNote({ text: t(`Erkannt als Vorschlag · Aussprache ${top.score} Punkte`, `Recognized as suggestion · pronunciation ${top.score} points`), sure: true });
      } else if (top && top.score >= 35 && top.completeness >= 40) {
        setMaybe(top.text);
        if (result.text) setDraft(result.text);
        setVoiceNote(null);
      } else if (result.text) {
        setDraft((d) => d + result.text);
        setVoiceNote(
          suggestions.length
            ? { text: t("Unsicher erkannt – prüfe den Text vor dem Senden.", "Not sure I got that – check the text before sending."), sure: false }
            : null,
        );
      } else {
        setError("nothing-heard");
      }
    } catch {
      setError(navigator.onLine ? "stt" : "offline");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleMic = async () => {
    if (listening) {
      if (recorderRef.current) await finishRecording();
      else stopListening.current?.();
      return;
    }
    setError(null);
    if (canRecord()) {
      stopAudio();
      try {
        recorderRef.current = await startRecording(20, () => void finishRecording());
        setListening(true);
      } catch {
        setError("mic");
      }
      return;
    }
    // Ohne Aufnahme-Unterstützung: Spracherkennung des Browsers.
    setListening(true);
    stopListening.current = listen({
      onText: (text) => setDraft(text),
      onEnd: () => setListening(false),
      onError: (code) => {
        setListening(false);
        if (code === "not-allowed" || code === "service-not-allowed") setError("mic");
      },
    });
  };

  const lastAssistant = turns ? [...turns].reverse().find((turn): turn is Extract<ChatTurn, { role: "assistant" }> => turn.role === "assistant") : undefined;
  const lastIsUser = turns?.length ? turns[turns.length - 1].role === "user" : true;
  const done = lastAssistant?.data.done ?? false;

  return (
    <main style={{ minHeight: "100dvh", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", minHeight: 44,
          padding: "calc(var(--safe-top) + 6px) 8px 6px", background: "var(--bar)", borderBottom: "0.5px solid var(--separator)",
          WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)",
        }}
      >
        <Link href="/rollenspiel" className="row" style={{ gap: 2, minHeight: 44, minWidth: 90, color: "var(--blue)" }}>
          <ChevronLeftIcon /> {t("Zurück", "Back")}
        </Link>
        <div className="topbar-title">
          <span className="headline">{loc(lang, roleplay.title, roleplay.titleEn)}</span>
          <span className="small muted">{t("Mit: ", "With: ")}{loc(lang, roleplay.partner, roleplay.partnerEn)}</span>
        </div>
        <button onClick={restart} style={{ minWidth: 90, minHeight: 44, color: "var(--blue)", textAlign: "right", paddingRight: 8 }}>
          {t("Neu", "New")}
        </button>
      </header>

      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px" }}>
        <div style={{ alignSelf: "center", background: "var(--card)", borderRadius: 12, padding: "8px 12px", textAlign: "center", maxWidth: 420 }}>
          <div className="small muted">{loc(lang, roleplay.setting, roleplay.settingEn)}</div>
          <div className="small" style={{ marginTop: 2 }}>
            <span className="muted">{t("Ziel:", "Goal:")}</span> {loc(lang, roleplay.goal, roleplay.goalEn)}
          </div>
        </div>

        {turns?.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="bubble out">
              <span className="zh" style={{ fontSize: 19 }}>{turn.text}</span>
            </div>
          ) : (
            <AssistantTurn key={i} data={turn.data} partnerVoice={scenario.partnerVoice} />
          ),
        )}

        {pending && (
          <div className="bubble in" aria-label={t("Claude schreibt", "Claude is typing")}>
            <span className="muted" style={{ letterSpacing: 3 }}>•••</span>
          </div>
        )}

        {error && (
          <div className="info-box" style={{ background: "color-mix(in srgb, var(--red) 10%, var(--card))", color: "var(--label)" }}>
            <InfoIcon style={{ flexShrink: 0, marginTop: 1, color: "var(--red)" }} />
            <div className="grow">{t(...(ERRORS[error] ?? ERRORS.unknown))}</div>
            {error !== "mic" && error !== "limit" && lastIsUser && (
              <button style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => turns && request(turns)}>
                {t("Nochmal", "Retry")}
              </button>
            )}
          </div>
        )}

        {done && (
          <div className="card" style={{ alignItems: "center", textAlign: "center", marginTop: 8 }}>
            <CheckIcon size={32} style={{ color: "var(--green)" }} />
            <span className="title2">{t("Szene geschafft!", "Scene complete!")}</span>
            <div className="row" style={{ gap: 10, marginTop: 4 }}>
              <button className="btn btn-tinted btn-capsule" onClick={restart}>{t("Nochmal", "Again")}</button>
              <Link href={`/szenarien/${scenario.id}`} className="btn btn-tinted btn-capsule">{t("Zum Szenario", "To the scenario")}</Link>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {!done && (
        <div className="composer" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          {lastAssistant && !pending && lastAssistant.data.suggestions.length > 0 && !lastIsUser && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="small muted">{t("Vorschläge", "Suggestions")}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {lastAssistant.data.suggestions.map((s, i) => (
                  <div key={i} className="chip" style={{ flexDirection: "row", alignItems: "center", gap: 2, padding: "4px 2px 4px 12px" }}>
                    <button style={{ display: "flex", flexDirection: "column", textAlign: "left" }} onClick={() => send(sentenceText(s))}>
                      <span className="zh" style={{ fontSize: 16, fontWeight: 600, color: "var(--blue-text)" }}>{sentenceText(s)}</span>
                      {settings.pinyin && <span className="small" style={{ color: "var(--blue-text)", opacity: 0.8 }}>{s.words.map((w) => w.py).join(" ")}</span>}
                      <span className="small muted">{s.de}</span>
                    </button>
                    <SpeakIconButton text={sentenceText(s)} voice={learnerVoice} size={16} />
                  </div>
                ))}
              </div>
              <span className="small muted">
                {t("Tippen zum Senden · Lautsprecher zum Anhören · oder per Mikrofon nachsprechen", "Tap to send · speaker to listen · or say it with the microphone")}
              </span>
            </div>
          )}
          {voiceNote && (
            <span className="small" style={{ color: voiceNote.sure ? "var(--green-text)" : "var(--orange-text)", fontWeight: 600 }}>
              {voiceNote.text}
            </span>
          )}
          {maybe && (
            <div className="row small" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="muted">{t("Meintest du:", "Did you mean:")}</span>
              <button
                className="chip"
                style={{ minHeight: 36, padding: "4px 12px" }}
                onClick={() => {
                  setDraft(maybe);
                  setMaybe(null);
                  setVoiceNote({ text: t("Vorschlag übernommen", "Suggestion applied"), sure: true });
                }}
              >
                <span className="zh" style={{ fontSize: 16, fontWeight: 600, color: "var(--blue-text)" }}>{maybe}</span>
              </button>
              <button style={{ color: "var(--label2)", minHeight: 36 }} onClick={() => setMaybe(null)}>{t("Nein", "No")}</button>
            </div>
          )}
          <form
            className="row"
            style={{ alignItems: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <textarea
              rows={1}
              value={draft}
              placeholder={
                listening
                  ? t("Ich höre zu – tippe zum Beenden", "Listening – tap to stop")
                  : transcribing
                    ? t("Erkenne …", "Recognizing …")
                    : t("Auf Chinesisch oder Deutsch antworten", "Reply in Chinese or English")
              }
              onChange={(e) => {
                setDraft(e.target.value);
                setVoiceNote(null);
                setMaybe(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              lang="zh-Hant-TW"
            />
            {draft.trim() ? (
              <button type="submit" className="round-btn" aria-label={t("Senden", "Send")} disabled={pending}>
                <SendIcon />
              </button>
            ) : (
              micAvailable && (
                <button type="button" className={listening ? "round-btn recording" : "round-btn"} aria-label={t("Sprechen", "Speak")} onClick={toggleMic} disabled={transcribing}>
                  <MicIcon />
                </button>
              )
            )}
          </form>
        </div>
      )}
    </main>
  );
}

function AssistantTurn({ data, partnerVoice }: { data: RoleplayTurnData; partnerVoice: "female" | "male" }) {
  const t = useT();
  const fb = data.feedback;
  const learnerVoice = partnerVoice === "male" ? "female" : "male";
  const positive = fb.status === "richtig";
  const titles: Record<string, string> = {
    richtig: t("Richtig", "Correct"),
    fast: t("Fast richtig", "Almost"),
    falsch: t("Nicht ganz", "Not quite"),
    deutsch: t("So sagst du das", "Here's how to say it"),
  };
  return (
    <>
      {fb.status !== "keine" && (
        <div className={positive ? "feedback gut" : "feedback fast"}>
          <div className="row" style={{ gap: 6 }}>
            {positive ? <CheckIcon size={14} style={{ color: "var(--green)" }} /> : <PencilIcon style={{ color: "var(--orange)" }} />}
            <span className="small" style={{ fontWeight: 600, color: positive ? "var(--green-text)" : "var(--orange-text)" }}>
              {titles[fb.status]}
            </span>
          </div>
          {fb.message && <span>{fb.message}</span>}
          {fb.better.map((s, i) => (
            <div key={i} className="row" style={{ alignItems: "flex-start" }}>
              <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <ChineseText words={s.words} size={18} secondary={false} />
                <span className="small muted">{s.de}</span>
              </div>
              <SpeakIconButton text={sentenceText(s)} voice={learnerVoice} size={16} />
            </div>
          ))}
        </div>
      )}
      <div className="bubble in">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <ChineseText words={data.reply.words} size={21} />
          </div>
          <SpeakIconButton text={sentenceText(data.reply)} voice={partnerVoice} />
        </div>
        <span className="sub muted">{data.reply.de}</span>
      </div>
      {data.tip && (
        <div className="info-box" style={{ alignSelf: "flex-start", maxWidth: "85%", background: "var(--card)" }}>
          <InfoIcon style={{ flexShrink: 0, marginTop: 1, color: "#8E8E93" }} />
          <span>{data.tip}</span>
        </div>
      )}
    </>
  );
}
