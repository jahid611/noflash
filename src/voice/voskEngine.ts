import type { KaldiRecognizer, Model } from 'vosk-browser';

/**
 * Wrapper fin autour de vosk-browser. Zéro import React/DOM : le modèle est
 * chargé par URL, l'audio arrive en Float32Array déjà rééchantillonné (voir
 * audio/BrowserAudioInput), les résultats sortent par callbacks.
 *
 * vosk-browser (WASM inliné, ~6 Mo) est importé dynamiquement : il n'est
 * téléchargé qu'à l'activation de la voix, pas au chargement de l'app.
 */
export interface RecognizerCallbacks {
  onResult(text: string): void;
  onPartial?(text: string): void;
}

function extractText(message: unknown, field: 'text' | 'partial'): string {
  const m = message as { result?: Record<string, unknown> } | undefined;
  const value = m?.result?.[field];
  return typeof value === 'string' ? value.trim() : '';
}

export class VoskRecognizerSession {
  constructor(private readonly recognizer: KaldiRecognizer) {}

  acceptChunk(samples: Float32Array, sampleRate: number): void {
    this.recognizer.acceptWaveformFloat(samples, sampleRate);
  }

  /** Force la finalisation du segment en cours (fin de push-to-talk). */
  flush(): void {
    this.recognizer.retrieveFinalResult();
  }

  dispose(): void {
    this.recognizer.remove();
  }
}

export class VoskEngine {
  private constructor(private readonly model: Model) {}

  static async load(modelUrl: string): Promise<VoskEngine> {
    const { createModel } = await import('vosk-browser');
    const model = await createModel(modelUrl);
    return new VoskEngine(model);
  }

  /**
   * Crée un recognizer contraint par la grammaire fermée : le JSON array de
   * mots est passé au KaldiRecognizer, qui ne reconnaîtra rien d'autre.
   */
  createSession(
    grammarWords: string[],
    sampleRate: number,
    callbacks: RecognizerCallbacks,
  ): VoskRecognizerSession {
    const recognizer = new this.model.KaldiRecognizer(
      sampleRate,
      JSON.stringify(grammarWords),
    );
    recognizer.on('result', (message: unknown) => {
      callbacks.onResult(extractText(message, 'text'));
    });
    recognizer.on('partialresult', (message: unknown) => {
      callbacks.onPartial?.(extractText(message, 'partial'));
    });
    return new VoskRecognizerSession(recognizer);
  }

  terminate(): void {
    this.model.terminate();
  }
}
