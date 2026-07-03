import { create } from 'zustand';
import { extractEnemies } from '../../game/liveMapping';
import type { LiveAllGameData } from '../../game/liveTypes';
import type { LiveSyncEnemy } from '../../game/ManualProvider';
import { addLog } from './logStore';
import { championService, manualProvider } from './runtime';
import { pulseDesktopListen } from './voiceRuntime';

/** Payload poussé par le main Electron à chaque tick de polling. */
interface GameDataMessage {
  running: boolean;
  data?: LiveAllGameData;
  reason?: string;
}

/** API exposée par electron/preload.cjs sous window.noflash (absente en web). */
interface NoFlashDesktopApi {
  isElectron: true;
  getInfo(): Promise<{ isElectron: boolean; hotkey: string; overlay: boolean }>;
  onGameData(cb: (msg: GameDataMessage) => void): () => void;
  onToggleListen(cb: () => void): () => void;
  onOverlayChanged(cb: (on: boolean) => void): () => void;
  setOverlay(on: boolean): Promise<boolean>;
  setInteractive(interactive: boolean): void;
}

declare global {
  interface Window {
    noflash?: NoFlashDesktopApi;
  }
}

function desktopApi(): NoFlashDesktopApi | undefined {
  return typeof window !== 'undefined' ? window.noflash : undefined;
}

export const isElectron = Boolean(desktopApi()?.isElectron);

interface DesktopState {
  /** true quand une partie League est lue en direct. */
  gameConnected: boolean;
  enemyCount: number;
  overlay: boolean;
  hotkey: string;
}

export const useDesktopStore = create<DesktopState>(() => ({
  gameConnected: false,
  enemyCount: 0,
  overlay: false,
  hotkey: 'F8',
}));

let started = false;

/** Branche le renderer sur l'API desktop. No-op en web. */
export function initDesktop(): void {
  const api = desktopApi();
  if (!api || started) return;
  started = true;

  void api.getInfo().then((info) => useDesktopStore.setState({ hotkey: info.hotkey, overlay: info.overlay }));

  // Raccourci global PTT (fonctionne même quand League a le focus).
  api.onToggleListen(() => pulseDesktopListen());

  api.onOverlayChanged((on) => useDesktopStore.setState({ overlay: on }));

  let wasConnected = false;
  api.onGameData((msg) => {
    if (!msg.running || !msg.data) {
      if (wasConnected) {
        wasConnected = false;
        addLog({ kind: 'info', detail: 'Partie terminée / non détectée — lecture en pause' });
      }
      useDesktopStore.setState({ gameConnected: false, enemyCount: 0 });
      return;
    }
    syncFromGame(msg.data);
    if (!wasConnected) {
      wasConnected = true;
      addLog({ kind: 'info', detail: 'Partie détectée — équipe ennemie synchronisée en direct' });
    }
  });
}

/** Résout les noms d'ennemis en ids ddragon et pousse dans le ManualProvider. */
function syncFromGame(data: LiveAllGameData): void {
  const mapped: LiveSyncEnemy[] = [];
  for (const enemy of extractEnemies(data)) {
    const champ = championService.findByName(enemy.championName);
    if (!champ) continue; // dataset pas encore prêt / nom inconnu → prochain tick
    mapped.push({
      championId: champ.id,
      championName: champ.name,
      level: enemy.level,
      hasIonianBoots: enemy.hasIonianBoots,
      summoners: enemy.summoners,
    });
  }
  useDesktopStore.setState({ gameConnected: true, enemyCount: mapped.length });
  if (mapped.length > 0) manualProvider.syncFromLive(mapped);
}

export async function toggleOverlay(): Promise<void> {
  const api = desktopApi();
  if (!api) return;
  const current = useDesktopStore.getState().overlay;
  const next = await api.setOverlay(!current);
  useDesktopStore.setState({ overlay: next });
}

/** En overlay click-through : rend l'UI cliquable le temps d'un survol. */
export function setOverlayInteractive(interactive: boolean): void {
  desktopApi()?.setInteractive(interactive);
}
