/**
 * Seam de portage desktop (§12).
 *
 * Impl web  : BrowserAudioInput (getUserMedia + AudioWorklet).
 * Impl desktop (plus tard) : capture audio native côté Electron.
 */
export interface AudioChunk {
  /** PCM mono, valeurs dans [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
}

export type AudioChunkHandler = (chunk: AudioChunk) => void;

export interface AudioInput {
  /** Ouvre le micro et pousse les chunks vers `onChunk` en continu. */
  open(onChunk: AudioChunkHandler): Promise<void>;
  close(): Promise<void>;
  readonly isOpen: boolean;
}
