import { isAuthed } from "@/lib/server/auth";

export const maxDuration = 30;

const MAX_BYTES = 2_000_000;

type AzureScores = { AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number; PronScore?: number; ErrorType?: string };
type AzureWord = AzureScores & { Word: string; PronunciationAssessment?: AzureScores };
type AzureResult = {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: (AzureScores & { Display?: string; Words?: AzureWord[]; PronunciationAssessment?: AzureScores })[];
};

async function callAzure(audio: ArrayBuffer, key: string, region: string, reference?: string): Promise<AzureResult> {
  const headers: Record<string, string> = {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
    Accept: "application/json",
  };
  if (reference) {
    const config = { ReferenceText: reference, GradingSystem: "HundredMark", Granularity: "Word", Dimension: "Comprehensive", EnableMiscue: "True" };
    headers["Pronunciation-Assessment"] = Buffer.from(JSON.stringify(config)).toString("base64");
  }
  const res = await fetch(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=zh-TW&format=detailed`,
    { method: "POST", headers, body: audio },
  );
  if (!res.ok) throw new Error(`Azure HTTP ${res.status}`);
  return (await res.json()) as AzureResult;
}

function summarize(data: AzureResult) {
  const best = data.NBest?.[0];
  if (data.RecognitionStatus !== "Success" || !best) return null;
  const scores = best.PronunciationAssessment ?? best;
  return {
    text: best.Display ?? data.DisplayText ?? "",
    scores: {
      pron: Math.round(scores.PronScore ?? 0),
      accuracy: Math.round(scores.AccuracyScore ?? 0),
      fluency: Math.round(scores.FluencyScore ?? 0),
      completeness: Math.round(scores.CompletenessScore ?? 0),
    },
    words: (best.Words ?? []).map((w) => {
      const s = w.PronunciationAssessment ?? w;
      return { word: w.Word, accuracy: Math.round(s.AccuracyScore ?? 0), error: s.ErrorType ?? "None" };
    }),
  };
}

/**
 * Azure-Sprachdienste, Sprache zh-TW. Körper der Anfrage: WAV (16 kHz, mono, 16 Bit).
 * - mode=recognize: freie Spracherkennung
 * - mode=assess&ref=…: Aussprachebewertung gegen einen Satz
 * - mode=match&cand=…(bis zu 3×): Erkennung plus Abgleich mit Antwort-Vorschlägen (Rollenspiel)
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim() || "southeastasia";
  if (!key) return Response.json({ error: "no-speech" }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const mode = params.get("mode");
  const reference = (params.get("ref") ?? "").trim();
  const candidates = params.getAll("cand").map((c) => c.trim()).filter((c) => c && c.length <= 100).slice(0, 3);
  if (mode === "assess" && (!reference || reference.length > 100)) return Response.json({ error: "invalid" }, { status: 400 });

  const audio = await request.arrayBuffer();
  if (audio.byteLength < 1000 || audio.byteLength > MAX_BYTES) return Response.json({ error: "invalid" }, { status: 400 });

  try {
    if (mode === "assess") {
      const data = await callAzure(audio, key, region, reference);
      const result = summarize(data);
      return Response.json(result ? { status: "Success", ...result } : { status: data.RecognitionStatus ?? "Error", text: "" });
    }

    if (mode === "match" && candidates.length > 0) {
      const [free, ...assessed] = await Promise.all([
        callAzure(audio, key, region),
        ...candidates.map((c) => callAzure(audio, key, region, c)),
      ]);
      const recognized = summarize(free)?.text ?? "";
      // Alle Vorschläge mit Punktzahl; die App entscheidet, ob sicher, „Meintest du …?“ oder freie Erkennung.
      const ranked = assessed
        .map((data, i) => {
          const result = summarize(data);
          return { text: candidates[i], score: result?.scores.pron ?? 0, completeness: result?.scores.completeness ?? 0 };
        })
        .sort((a, b) => b.score - a.score);
      return Response.json({
        status: recognized || ranked[0]?.score ? "Success" : free.RecognitionStatus ?? "NoMatch",
        text: recognized,
        candidates: ranked,
      });
    }

    const data = await callAzure(audio, key, region);
    return Response.json({ status: data.RecognitionStatus ?? "Error", text: summarize(data)?.text ?? "" });
  } catch (error) {
    console.error("[speech]", error);
    return Response.json({ error: "speech-failed" }, { status: 502 });
  }
}
