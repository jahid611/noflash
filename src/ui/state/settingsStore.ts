import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
  /** KeyboardEvent.code de la touche push-to-talk. */
  pttKeyCode: string;
  /** Micro toujours actif au lieu du push-to-talk. */
  alwaysOn: boolean;
  ttsEnabled: boolean;
  ttsLang: 'en-US' | 'fr-FR';
  /**
   * Anti-bruit strict : ajoute [unk] à la grammaire vosk. Défaut FALSE — sans
   * [unk], vosk force le champion le plus proche au lieu de sortir « inconnu »
   * (fin du problème « je dis Malphite → [unk] »).
   */
  rejectUnknown: boolean;
  /** Flag expérimental : fenêtre de recast des ults à charges (§5). */
  chargeTracking: boolean;
  modelUrl: string;
  benchmarkTrials: number;

  set(patch: Partial<SettingsState>): void;
}

export const DEFAULT_MODEL_URL = '/model/vosk-model-small-en-us-0.15.tar.gz';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pttKeyCode: 'KeyV',
      alwaysOn: false,
      ttsEnabled: false,
      ttsLang: 'en-US',
      rejectUnknown: false,
      chargeTracking: false,
      modelUrl: DEFAULT_MODEL_URL,
      benchmarkTrials: 30,
      set: (patch) => set(patch),
    }),
    { name: 'noflash:settings:v2' },
  ),
);

export function keyCodeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
