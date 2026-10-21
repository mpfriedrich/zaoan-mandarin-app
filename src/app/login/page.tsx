"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clearLearningData, getMeta, setMeta } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { syncNow } from "@/lib/sync";

const MESSAGES: Record<string, [string, string]> = {
  "wrong-code": ["Der Code stimmt nicht.", "That code isn't right."],
  "not-configured": ["Auf dem Server ist noch kein Zugangscode eingerichtet.", "No access code has been set up on the server yet."],
  offline: ["Für die Anmeldung brauchst du einmal Internet.", "You need internet once to sign in."],
  error: ["Anmeldung fehlgeschlagen. Versuch es nochmal.", "Sign-in failed. Please try again."],
};

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; user?: string };
      if (!res.ok) {
        setError(body.error && MESSAGES[body.error] ? body.error : "error");
        return;
      }
      const user = body.user === "demo" ? "demo" : "owner";
      // Anderer Zugang als zuletzt auf diesem Gerät: lokalen Lernstand leeren, damit sich nichts vermischt.
      if (user !== (await getMeta<string>("user", "owner"))) await clearLearningData();
      await setMeta("user", user);
      await setMeta("loggedIn", true);
      await navigator.storage?.persist?.().catch(() => false);
      void syncNow();
      router.replace("/");
    } catch {
      setError(navigator.onLine ? "error" : "offline");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen fullscreen" style={{ justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 32 }}>
        <span className="zh" style={{ fontSize: 56, fontWeight: 600 }}>早安</span>
        <span className="muted sub">{t("Mandarin für deinen Alltag in Taiwan", "Mandarin for everyday life in Taiwan")}</span>
      </div>
      <form onSubmit={submit} className="stack">
        <div className="group" style={{ paddingLeft: 0 }}>
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t("Zugangscode", "Access code")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", minHeight: 50, border: 0, background: "transparent", padding: "0 16px", fontSize: 17, outline: "none" }}
          />
        </div>
        {error && <p className="sub" style={{ color: "var(--red-text)", margin: "0 4px" }}>{t(...MESSAGES[error])}</p>}
        <button className="btn btn-primary" disabled={busy || !code.trim()}>
          {busy ? t("Anmelden …", "Signing in …") : t("Anmelden", "Sign in")}
        </button>
        <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
          {t(
            "Mit demselben Code hast du auf iPhone, iPad und Mac denselben Lernstand.",
            "Use the same code on iPhone, iPad and Mac to keep your progress in sync.",
          )}
        </p>
      </form>
    </main>
  );
}
