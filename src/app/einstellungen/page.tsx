"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearLearningData, db, getMeta, saveSettings, setMeta, SYNCED_TABLES, type Settings } from "@/lib/db";
import { useMeta, useSettings } from "@/lib/hooks";
import { useT, type Lang } from "@/lib/i18n";
import { MODEL_LABELS, ROLEPLAY_MODELS, type RoleplayModel } from "@/lib/roleplay-types";
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from "@/lib/push";
import { speak, useZhVoices } from "@/lib/speech";
import { syncNow, type SyncStatus } from "@/lib/sync";

const SYNC_LABELS: Record<string, { de: string; en: string; color: string }> = {
  ok: { de: "Synchronisiert", en: "Synced", color: "var(--green)" },
  syncing: { de: "Synchronisiert …", en: "Syncing …", color: "var(--orange)" },
  offline: { de: "Offline", en: "Offline", color: "var(--label3)" },
  "no-db": { de: "Keine Datenbank verbunden", en: "No database connected", color: "var(--orange)" },
  unauthorized: { de: "Nicht angemeldet", en: "Not signed in", color: "var(--red)" },
  error: { de: "Fehler beim Synchronisieren", en: "Sync error", color: "var(--red)" },
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={on ? "toggle on" : "toggle"} onClick={() => onChange(!on)} />;
}

function timeAgo(ts: number, lang: Lang) {
  const en = lang === "en";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return en ? "just now" : "gerade eben";
  if (min < 60) return en ? `${min} min ago` : `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return en ? `${h} h ago` : `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return en ? `${d} d ago` : `vor ${d} T.`;
}

export default function SettingsPage() {
  const router = useRouter();
  const settings = useSettings();
  const lang = settings.language;
  const t = useT();
  const demo = useMeta<string>("user", "owner") === "demo";
  const voices = useZhVoices();
  const syncStatus = useLiveQuery(() => getMeta<SyncStatus | null>("syncStatus", null), []);
  const [syncing, setSyncing] = useState(false);
  const set = (patch: Partial<Settings>) => void saveSettings(patch);
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setPushState).catch(() => setPushState("unsupported"));
  }, []);

  const togglePush = async (on: boolean) => {
    setPushBusy(true);
    setPushNote(null);
    if (on) {
      const result = await enablePush();
      if (result === "error") {
        setPushNote(t("Das Einrichten hat nicht geklappt. Versuch es nochmal.", "Setting it up didn't work. Please try again."));
        setPushState(await getPushState());
      } else setPushState(result);
    } else {
      await disablePush();
      setPushState("off");
    }
    setPushBusy(false);
  };

  const testPush = async () => {
    setPushBusy(true);
    const ok = await sendTestPush();
    setPushNote(ok ? t("Gesendet – die Benachrichtigung sollte gleich erscheinen.", "Sent – the notification should appear in a moment.") : t("Senden hat nicht geklappt.", "Sending didn't work."));
    setPushBusy(false);
  };

  const pushFooter =
    pushState === "not-installed"
      ? t(
          "Auf dem iPhone geht das nur, wenn 早安 auf dem Home-Bildschirm liegt: In Safari auf Teilen → „Zum Home-Bildschirm“ tippen und die App von dort öffnen.",
          "On iPhone this only works when 早安 is on your Home Screen: in Safari tap Share → “Add to Home Screen” and open the app from there.",
        )
      : pushState === "denied"
        ? t(
            "Benachrichtigungen sind blockiert. Erlaube sie in den iPhone-Einstellungen unter Mitteilungen → 早安.",
            "Notifications are blocked. Allow them in iPhone Settings → Notifications → 早安.",
          )
        : pushState === "unsupported"
          ? t("Auf diesem Gerät oder in diesem Browser gibt es keine Push-Benachrichtigungen.", "This device or browser doesn't support push notifications.")
          : t(
              "Um 12:00 Uhr Taiwan-Zeit, wenn du an dem Tag noch nicht gelernt hast, und um 20:00 Uhr, wenn sonst deine Serie reißen würde. Damit sie nicht untergehen: iPhone-Einstellungen → Mitteilungen → 早安 → Banner-Stil „Dauerhaft“, und unter Fokus 早安 als erlaubte App hinzufügen.",
              "At 12:00 Taiwan time if you haven't studied that day, and at 20:00 if your streak would otherwise break. So they don't get missed: iPhone Settings → Notifications → 早安 → Banner Style “Persistent”, and add 早安 as an allowed app in Focus.",
            );

  const runSync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
  };

  const exportBackup = async () => {
    const data: Record<string, unknown> = { exportedAt: new Date().toISOString() };
    for (const kind of SYNCED_TABLES) data[kind] = await db[kind].toArray();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaoan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const logout = async () => {
    if (!window.confirm(t("Auf diesem Gerät abmelden? Dein Lernstand bleibt gespeichert.", "Sign out on this device? Your progress stays saved."))) return;
    await fetch("/api/login", { method: "DELETE" }).catch(() => {});
    await setMeta("loggedIn", false);
    router.replace("/login");
  };

  const [resetNote, setResetNote] = useState<string | null>(null);
  const resetProgress = async () => {
    if (!window.confirm(t(
      "Gesamten Lernstand löschen? Karten, Serie, Lektionen, Rollenspiele und Aussprache-Werte werden auf allen Geräten gelöscht. Einstellungen bleiben.",
      "Delete all progress? Cards, streak, lessons, role-plays and pronunciation scores are deleted on all devices. Settings stay.",
    ))) return;
    if (!window.confirm(t("Wirklich? Das lässt sich nicht rückgängig machen.", "Are you sure? This can't be undone."))) return;
    setResetNote(null);
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "reset" }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { epoch?: string } | undefined;
    if (!res?.ok || !body?.epoch) {
      setResetNote(t("Zurücksetzen hat nicht geklappt. Du brauchst Internet – versuch es nochmal.", "Reset didn't work. You need internet – please try again."));
      return;
    }
    await clearLearningData(["loggedIn", "user"], ["settings"]);
    await setMeta("demoEpoch", body.epoch);
    await syncNow();
    router.replace("/");
  };

  const syncLabel = syncing ? SYNC_LABELS.syncing : SYNC_LABELS[syncStatus?.state ?? ""];
  const status = syncLabel
    ? { text: t(syncLabel.de, syncLabel.en), color: syncLabel.color }
    : { text: t("Noch nicht synchronisiert", "Not synced yet"), color: "var(--label3)" };

  return (
    <main className="screen fullscreen">
      <div className="topbar" style={{ justifyContent: "flex-end" }}>
        <button className="headline" style={{ color: "var(--blue)", minHeight: 44, padding: "0 4px" }} onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>
          {t("Fertig", "Done")}
        </button>
      </div>
      <h1 className="large-title" style={{ padding: "0 4px" }}>{t("Einstellungen", "Settings")}</h1>

      <h2 className="section-header">{t("Sprache", "Language")}</h2>
      <div className="group">
        <div className="group-row">
          <div className="segmented" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }} role="radiogroup" aria-label="Sprache / Language">
            <button role="radio" aria-checked={lang === "de"} className={lang === "de" ? "selected" : ""} onClick={() => set({ language: "de" })}>
              Deutsch
            </button>
            <button role="radio" aria-checked={lang === "en"} className={lang === "en" ? "selected" : ""} onClick={() => set({ language: "en" })}>
              English
            </button>
          </div>
        </div>
      </div>
      <p className="section-footer">
        {t("Menüs, Übersetzungen, Hinweise und Claudes Korrekturen im Rollenspiel.", "Menus, translations, tips and Claude's corrections in role-plays.")}
      </p>

      <h2 className="section-header">{t("Schrift", "Characters")}</h2>
      <div className="group">
        <div className="group-row">
          <div className="segmented" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <button className={settings.mainScript === "trad" ? "selected" : ""} onClick={() => set({ mainScript: "trad" })}>
              {t("Traditionell", "Traditional")} <span className="zh">繁</span>
            </button>
            <button className={settings.mainScript === "simp" ? "selected" : ""} onClick={() => set({ mainScript: "simp" })}>
              {t("Vereinfacht", "Simplified")} <span className="zh">简</span>
            </button>
          </div>
        </div>
        <div className="group-row">
          <span className="grow">
            {settings.mainScript === "trad" ? t("Vereinfachte Zeichen dazu", "Also show simplified") : t("Traditionelle Zeichen dazu", "Also show traditional")}
          </span>
          <Toggle label={t("Zweite Schrift anzeigen", "Show second script")} on={settings.showSecondary} onChange={(on) => set({ showSecondary: on })} />
        </div>
      </div>
      <p className="section-footer">{t("In Taiwan werden traditionelle Zeichen verwendet.", "Taiwan uses traditional characters.")}</p>

      <h2 className="section-header">{t("Aussprache", "Pronunciation")}</h2>
      <div className="group">
        <div className="group-row">
          <span className="grow">Pinyin</span>
          <Toggle label="Pinyin" on={settings.pinyin} onChange={(on) => set({ pinyin: on })} />
        </div>
        <div className="group-row">
          <span className="grow">Zhuyin <span className="zh muted">ㄅㄆㄇ</span></span>
          <Toggle label="Zhuyin" on={settings.zhuyin} onChange={(on) => set({ zhuyin: on })} />
        </div>
        <div className="group-row">
          <span className="grow">{t("Tonkurven vor dem Sprechen", "Tone curves before speaking")}</span>
          <Toggle label={t("Tonkurven vor dem Sprechen", "Tone curves before speaking")} on={settings.curvesBefore} onChange={(on) => set({ curvesBefore: on })} />
        </div>
        <div className="group-row">
          <span className="grow">{t("Stimme", "Voice")}</span>
          {voices.length > 0 ? (
            <select
              value={settings.voiceURI}
              onChange={(e) => {
                set({ voiceURI: e.target.value });
                speak("你好，歡迎來到台灣。", { voiceURI: e.target.value });
              }}
            >
              <option value="">{t("Automatisch (Taiwan)", "Automatic (Taiwan)")}</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          ) : (
            <span className="value-text">{t("Keine gefunden", "None found")}</span>
          )}
        </div>
        <div className="group-row">
          <span className="grow">{t("Tempo", "Speed")}</span>
          <select value={settings.rate} onChange={(e) => set({ rate: e.target.value as Settings["rate"] })}>
            <option value="normal">Normal</option>
            <option value="langsam">{t("Langsam", "Slow")}</option>
          </select>
        </div>
      </div>
      <p className="section-footer">
        {t(
          "Die Sätze sprechen natürliche Azure-Stimmen. Für neue Texte ohne Aufnahme gilt die Gerätestimme – eine bessere gibt es auf dem iPhone unter Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Chinesisch (Taiwan).",
          "Phrases are spoken by natural Azure voices. For new text without a recording the device voice is used – get a better one on iPhone under Settings → Accessibility → Spoken Content → Voices → Chinese (Taiwan).",
        )}
      </p>

      <h2 className="section-header">{t("Lernen", "Learning")}</h2>
      <div className="group">
        <div className="group-row">
          <span className="grow">{t("Tagesziel", "Daily goal")}</span>
          <select value={settings.dailyGoalMin} onChange={(e) => set({ dailyGoalMin: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>{t(`${m} Minuten`, `${m} minutes`)}</option>
            ))}
          </select>
        </div>
        <div className="group-row">
          <span className="grow">{t("Pinyin bei sicheren Karten verdecken", "Hide pinyin on well-known cards")}</span>
          <Toggle
            label={t("Pinyin bei sicheren Karten verdecken", "Hide pinyin on well-known cards")}
            on={settings.hidePinyinKnown}
            onChange={(on) => set({ hidePinyinKnown: on })}
          />
        </div>
      </div>
      <p className="section-footer">
        {t(
          "Lesekarten, die du schon etwa eine Woche sicher kannst, zeigen das Pinyin erst beim Aufdecken – so lernst du die Zeichen selbst lesen.",
          "Reading cards you've known well for about a week only show pinyin when you reveal the answer – so you learn to read the characters themselves.",
        )}
      </p>

      <h2 className="section-header">{t("KI-Rollenspiel", "AI role-play")}</h2>
      <div className="group">
        <div className="group-row">
          <span className="grow">{t("Modell", "Model")}</span>
          {demo ? (
            <span className="value-text">{MODEL_LABELS["claude-sonnet-5"]}</span>
          ) : (
            <select value={settings.model} onChange={(e) => set({ model: e.target.value as RoleplayModel })}>
              {ROLEPLAY_MODELS.map((m) => (
                <option key={m} value={m}>{MODEL_LABELS[m]}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <p className="section-footer">
        {demo
          ? t(
              "Im Demo-Zugang fest eingestellt: 20 Rollenspiel-Runden pro Tag für alle Demo-Nutzer zusammen.",
              "Fixed for demo access: 20 role-play turns per day, shared by all demo users.",
            )
          : t(
              "Opus 5: beste Korrekturen (ca. 25–30 Cent pro Rollenspiel). Sonnet 5: ca. 10 Cent. Haiku 4.5: ca. 5 Cent, ungenauer.",
              "Opus 5: best corrections (about 25–30 cents per role-play). Sonnet 5: about 10 cents. Haiku 4.5: about 5 cents, less accurate.",
            )}
      </p>

      {!demo && (
        <>
          <h2 className="section-header">{t("Erinnerung", "Reminder")}</h2>
          <div className="group">
            <div className="group-row">
              <span className="grow">{t("Tägliche Erinnerung", "Daily reminder")}</span>
              {pushState === "on" || pushState === "off" ? (
                <Toggle label={t("Tägliche Erinnerung", "Daily reminder")} on={pushState === "on"} onChange={(on) => !pushBusy && void togglePush(on)} />
              ) : (
                <span className="value-text">
                  {pushState === null
                    ? "…"
                    : pushState === "not-installed"
                      ? t("Nur als Home-App", "Home Screen app only")
                      : pushState === "denied"
                        ? t("Blockiert", "Blocked")
                        : t("Nicht verfügbar", "Not available")}
                </span>
              )}
            </div>
            {pushState === "on" && (
              <button className="group-row" style={{ width: "100%", color: "var(--blue)" }} onClick={testPush} disabled={pushBusy}>
                {t("Test-Benachrichtigung senden", "Send test notification")}
              </button>
            )}
          </div>
          <p className="section-footer">{pushNote ?? pushFooter}</p>
        </>
      )}

      <h2 className="section-header">{t("Synchronisierung", "Sync")}</h2>
      <div className="group">
        <div className="group-row">
          <span style={{ width: 8, height: 8, borderRadius: 999, background: status.color, flexShrink: 0 }} />
          <span className="grow">{status.text}</span>
          {syncStatus && !syncing && <span className="value-text">{timeAgo(syncStatus.at, lang)}</span>}
        </div>
        {syncStatus?.state === "unauthorized" ? (
          <button
            className="group-row"
            style={{ width: "100%", color: "var(--blue)" }}
            onClick={async () => {
              await setMeta("loggedIn", false);
              router.replace("/login");
            }}
          >
            {t("Neu anmelden", "Sign in again")}
          </button>
        ) : (
          <button className="group-row" style={{ width: "100%", color: "var(--blue)" }} onClick={runSync} disabled={syncing}>
            {t("Jetzt synchronisieren", "Sync now")}
          </button>
        )}
        <button className="group-row" style={{ width: "100%", color: "var(--blue)" }} onClick={exportBackup}>
          {t("Backup exportieren", "Export backup")}
        </button>
      </div>
      <p className="section-footer">
        {demo
          ? t(
              "Demo-Zugang: Alle Demo-Nutzer teilen einen Lernstand. Er wird jeden Tag um Mitternacht (Taiwan-Zeit) zurückgesetzt.",
              "Demo access: all demo users share one progress. It resets every day at midnight (Taiwan time).",
            )
          : t("Gleicher Stand auf iPhone, iPad und Mac – mit deinem Zugangscode.", "Same progress on iPhone, iPad and Mac – with your access code.")}
      </p>

      {!demo && (
        <>
          <div className="group" style={{ marginTop: 28 }}>
            <button className="group-row" style={{ width: "100%", color: "var(--red-text)" }} onClick={resetProgress}>
              {t("Lernstand zurücksetzen", "Reset progress")}
            </button>
          </div>
          <p className="section-footer">
            {resetNote ?? t("Neu anfangen: löscht deinen Fortschritt auf allen Geräten. Einstellungen und Erinnerungen bleiben.", "Start over: deletes your progress on all devices. Settings and reminders stay.")}
          </p>
        </>
      )}

      <div className="group" style={{ marginTop: 28 }}>
        <button className="group-row" style={{ width: "100%", color: "var(--red-text)" }} onClick={logout}>
          {t("Abmelden", "Sign out")}
        </button>
      </div>
    </main>
  );
}
