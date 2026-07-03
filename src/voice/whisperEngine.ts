import { concatFloat32, type SttEngine, type SttSession, type SttSessionOptions } from './stt';

/**
 * Moteur STT Whisper (OpenAI) via transformers.js, EN LOCAL (WASM). Bien plus
 * robuste au bruit/accent et surtout aux noms propres fantasy que vosk small —
 * et sans grammaire fermée (transcription libre) : c'est le parser phonétique
 * (`phoneticKey`) qui relie ensuite le texte au bon champion.
 *
 * ⚠️ transformers.js est chargé depuis un CDN au runtime (import dynamique
 * d'URL) : pas de dépendance npm à installer, donc pas de galère
 * `onnxruntime-node`. Contrepartie : réseau requis au 1er chargement (le modèle
 * ~40-150 Mo est ensuite mis en cache par le navigateur). Le chemin vosk reste
 * 100 % offline.
 */

/** CDN ESM par défaut de transformers.js. Configurable (voir load()) au cas où
 *  la version/route changerait — alternatives : `…@3.0.2/+esm` ou
 *  `…@3.0.2/dist/transformers.min.js`. */
export const DEFAULT_TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transformers = any;

let transformersPromise: Promise<Transformers> | null = null;
let loadedFrom = '';
function loadTransformers(cdnUrl: string): Promise<Transformers> {
  if (!transformersPromise || loadedFrom !== cdnUrl) {
    loadedFrom = cdnUrl;
    const url = cdnUrl;
    // @vite-ignore : URL runtime, pas de bundling ; import ESM natif au runtime.
    transformersPromise = import(/* @vite-ignore */ url);
  }
  return transformersPromise;
}

/** Modèles Whisper dispo (multilingues, quantifiés). Plus gros = plus précis. */
export const WHISPER_MODELS = {
  tiny: { id: 'Xenova/whisper-tiny', label: 'Tiny (~40 Mo, rapide)' },
  base: { id: 'Xenova/whisper-base', label: 'Base (~150 Mo, plus précis)' },
} as const;

/**
 * « Speech commun » : prompt de contexte qui fait connaître LoL à Whisper et
 * l'amorce sur les noms des champions de la partie. Whisper a tendance à
 * réutiliser le vocabulaire du prompt → il orthographie bien mieux « Malphite »,
 * « Kha'Zix », etc. Court volontairement (le prompt Whisper est borné).
 */
export function buildLolPrompt(championNames: string[]): string {
  const names = championNames.filter(Boolean).join(', ');
  const base = "Contexte League of Legends : cooldowns d'invocateur et ultimes.";
  return names
    ? `${base} Champions ennemis : ${names}. Mots : flash, ultime, téléport, ignite.`
    : `${base} Mots : flash, ultime, téléport, ignite.`;
}

export class WhisperEngine implements SttEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private readonly transcriber: any) {}

  /** Charge transformers.js + le pipeline ASR (télécharge le modèle au 1er coup). */
  static async load(
    modelId: string,
    language = 'french',
    cdnUrl: string = DEFAULT_TRANSFORMERS_CDN,
  ): Promise<WhisperEngine> {
    const t = await loadTransformers(cdnUrl);
    t.env.allowLocalModels = false;
    t.env.allowRemoteModels = true;
    const transcriber = await t.pipeline('automatic-speech-recognition', modelId);
    const engine = new WhisperEngine(transcriber);
    engine.language = language;
    return engine;
  }

  private language = 'french';

  createSession(opts: SttSessionOptions): SttSession {
    const prompt = buildLolPrompt(opts.promptChampions ?? []);
    return new WhisperSession(this.transcriber, opts.sampleRate, opts.callbacks, this.language, prompt);
  }

  terminate(): void {
    // transformers.js gère son propre worker/cache ; rien à libérer explicitement.
  }
}

class WhisperSession implements SttSession {
  private buffers: Float32Array[] = [];
  private busy = false;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly transcriber: any,
    private readonly sampleRate: number,
    private readonly callbacks: { onResult(text: string): void; onPartial?(text: string): void },
    private readonly language: string,
    private readonly prompt: string,
  ) {}

  acceptChunk(samples: Float32Array): void {
    // Copie défensive : le buffer du worklet est réutilisé.
    this.buffers.push(samples.slice());
  }

  reset(): void {
    this.buffers = [];
  }

  flush(): void {
    const audio = concatFloat32(this.buffers);
    this.buffers = [];
    // < 0.3 s de son ou transcription déjà en cours → rien.
    if (audio.length < this.sampleRate * 0.3 || this.busy) {
      this.callbacks.onResult('');
      return;
    }
    this.busy = true;
    this.transcribeWithContext(audio)
      .then((text) => this.callbacks.onResult(text))
      .catch(() => this.callbacks.onResult(''))
      .finally(() => {
        this.busy = false;
      });
  }

  /**
   * Transcrit en amorçant Whisper avec le prompt de contexte LoL. Si la version
   * de transformers.js ne supporte pas l'option `prompt`, on retombe
   * proprement sur une transcription sans contexte (jamais de crash).
   */
  private async transcribeWithContext(audio: Float32Array): Promise<string> {
    const base = { language: this.language, task: 'transcribe' as const, chunk_length_s: 30 };
    if (this.prompt) {
      try {
        const out = await this.transcriber(audio, { ...base, prompt: this.prompt });
        return String(out?.text ?? '').trim();
      } catch {
        // option `prompt` non supportée → transcription sans contexte
      }
    }
    const out = await this.transcriber(audio, base);
    return String(out?.text ?? '').trim();
  }

  dispose(): void {
    this.buffers = [];
  }
}
