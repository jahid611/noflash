import type { KaldiRecognizer, Model } from 'vosk-browser';
import type { SttEngine, SttSession, SttSessionOptions } from './stt';

/**
 * Wrapper vosk-browser implémentant SttEngine. Zéro import React/DOM : le modèle
 * est chargé par URL, l'audio arrive en Float32Array 16 kHz, les résultats
 * sortent par callbacks. vosk-browser (WASM, ~6 Mo) est importé dynamiquement.
 */
function extractText(message: unknown, field: 'text' | 'partial'): string {
  const m = message as { result?: Record<string, unknown> } | undefined;
  const value = m?.result?.[field];
  return typeof value === 'string' ? value.trim() : '';
}

class VoskSession implements SttSession {
  constructor(private readonly recognizer: KaldiRecognizer) {}

  acceptChunk(samples: Float32Array, sampleRate: number): void {
    this.recognizer.acceptWaveformFloat(samples, sampleRate);
  }

  /** vosk streame en continu et se ré-arme seul après un final → no-op. */
  reset(): void {}

  /** Force la finalisation du segment en cours (fin de push-to-talk). */
  flush(): void {
    this.recognizer.retrieveFinalResult();
  }

  dispose(): void {
    this.recognizer.remove();
  }
}

export class VoskEngine implements SttEngine {
  private constructor(private readonly model: Model) {}

  static async load(modelUrl: string): Promise<VoskEngine> {
    const { createModel } = await import('vosk-browser');
    const model = await createModel(modelUrl);
    return new VoskEngine(model);
  }

  /**
   * Recognizer contraint par la grammaire fermée : le JSON array de mots est
   * passé au KaldiRecognizer, qui ne reconnaîtra rien d'autre.
   */
  createSession(opts: SttSessionOptions): SttSession {
    const recognizer = new this.model.KaldiRecognizer(
      opts.sampleRate,
      JSON.stringify(opts.grammar ?? []),
    );
    recognizer.on('result', (message: unknown) => {
      opts.callbacks.onResult(extractText(message, 'text'));
    });
    recognizer.on('partialresult', (message: unknown) => {
      opts.callbacks.onPartial?.(extractText(message, 'partial'));
    });
    return new VoskSession(recognizer);
  }

  terminate(): void {
    this.model.terminate();
  }
}
