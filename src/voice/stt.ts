/**
 * Interface STT commune : vosk (streaming, grammaire fermée) et Whisper
 * (bufferisé, transcription libre) sont interchangeables derrière elle. Pur —
 * aucun accès DOM ; les impls chargent leur lib en import dynamique.
 */
export interface SttCallbacks {
  onResult(text: string): void;
  onPartial?(text: string): void;
}

export interface SttSessionOptions {
  /** Grammaire fermée (vosk uniquement ; Whisper l'ignore). */
  grammar?: string[];
  /**
   * Noms des champions actifs (les 5 ennemis). Whisper s'en sert pour construire
   * un prompt de contexte LoL qui le biaise à bien reconnaître ces noms ; vosk
   * l'ignore (il a déjà sa grammaire).
   */
  promptChampions?: string[];
  sampleRate: number;
  callbacks: SttCallbacks;
}

export interface SttSession {
  /** Audio 16 kHz mono. vosk : streamé au recognizer ; Whisper : bufferisé. */
  acceptChunk(samples: Float32Array, sampleRate: number): void;
  /** Nouveau segment de parole (Whisper : vide le buffer ; vosk : no-op). */
  reset(): void;
  /** Finalise : vosk force le résultat ; Whisper transcrit le buffer → onResult. */
  flush(): void;
  dispose(): void;
}

export interface SttEngine {
  createSession(opts: SttSessionOptions): SttSession;
  terminate(): void;
}

export type SttEngineKind = 'vosk' | 'whisper';

/** Concatène des chunks Float32 en un seul buffer (pour Whisper). */
export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
