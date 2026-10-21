"use client";

/** Aufnahme als WAV (16 kHz, mono, 16 Bit) – das Format, das die Azure-Spracherkennung erwartet. */
export type Recording = { blob: Blob; url: string; seconds: number; peak: number; samples: Float32Array; sampleRate: number };

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

const TARGET_RATE = 16000;

/** Startet die Aufnahme (muss durch eine Berührung ausgelöst werden). Stoppt spätestens nach `maxSeconds`. */
export async function startRecording(maxSeconds: number, onAutoStop: () => void) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor ist veraltet, läuft aber zuverlässig in Safari auf iPhone und iPad.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(ctx.destination);
  const timer = setTimeout(onAutoStop, maxSeconds * 1000);
  let stopped = false;

  const release = () => {
    stopped = true;
    clearTimeout(timer);
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    async stop(): Promise<Recording> {
      if (stopped) throw new Error("Aufnahme ist schon beendet");
      release();
      const rate = ctx.sampleRate;
      await ctx.close();
      return encodeWav(chunks, rate);
    },
    cancel() {
      if (stopped) return;
      release();
      void ctx.close();
    },
  };
}

function encodeWav(chunks: Float32Array[], inputRate: number): Recording {
  const input = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }

  // Heruntertasten durch Mitteln – reicht für Sprache völlig aus.
  const ratio = inputRate / TARGET_RATE;
  const pcm = new Int16Array(Math.floor(input.length / ratio));
  const samples = new Float32Array(pcm.length);
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const value = end > start ? sum / (end - start) : input[start] ?? 0;
    peak = Math.max(peak, Math.abs(value));
    samples[i] = value;
    pcm[i] = Math.max(-1, Math.min(1, value)) * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);

  const blob = new Blob([buffer], { type: "audio/wav" });
  return { blob, url: URL.createObjectURL(blob), seconds: pcm.length / TARGET_RATE, peak, samples, sampleRate: TARGET_RATE };
}
