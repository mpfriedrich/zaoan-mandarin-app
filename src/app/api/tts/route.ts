import { VOICES } from "@/content/voices.mjs";
import { isAuthed } from "@/lib/server/auth";

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** Azure-Stimme für frei erzeugte Sätze (Rollenspiel). Ohne Azure-Schlüssel antwortet die Route mit 503. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim() || "southeastasia";
  if (!key) return Response.json({ error: "no-tts" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { text?: unknown; voice?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const voice = body?.voice === "male" ? VOICES.male : VOICES.female;
  if (!text || text.length > 300) return Response.json({ error: "invalid" }, { status: 400 });

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW"><voice name="${voice}"><prosody rate="-8%">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "zaoan",
    },
    body: ssml,
  });
  if (!res.ok) {
    console.error("[tts] Azure-Fehler", res.status);
    return Response.json({ error: "tts-failed" }, { status: 502 });
  }
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}
