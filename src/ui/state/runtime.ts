import { ManualProvider } from '../../game/ManualProvider';
import type { GameStateProvider } from '../../game/GameStateProvider';
import { createTimerEngine } from '../../timers/engine';
import { ChampionService } from '../../data/championService';
import { LocalStorageCache } from '../../data/cache';
import { BrowserTts, type SpeechOutput } from '../../audio/SpeechOutput';
import { normalizeSummoners, type EnemyConfig } from '../../game/types';
import type { SummonerSpellKey } from '../../cooldowns/types';

/**
 * Composition root web : c'est ICI (et seulement ici) que les modules purs
 * sont câblés sur leurs implémentations navigateur. La version Electron
 * remplacera ManualProvider par LiveClientProvider, BrowserTts par un TTS
 * natif, etc., sans toucher aux modules purs.
 */
export const manualProvider = new ManualProvider();
export const gameState: GameStateProvider = manualProvider;
export const timerEngine = createTimerEngine();
export const championService = new ChampionService(new LocalStorageCache());
export const tts: SpeechOutput = new BrowserTts();

const ROSTER_KEY = 'noflash:roster:v1';

export function hydrateRoster(): void {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<
      EnemyConfig & { secondSummoner?: SummonerSpellKey | null }
    >;
    if (!Array.isArray(parsed)) return;
    // Migration : ancien format (secondSummoner) → summoners[].
    const migrated: EnemyConfig[] = parsed.map((e) => {
      if (Array.isArray(e.summoners)) return { ...e, summoners: normalizeSummoners(e.summoners) };
      const second = e.secondSummoner;
      return { ...e, summoners: second ? ['flash', second] : ['flash'] };
    });
    manualProvider.replaceTeam(migrated);
  } catch {
    localStorage.removeItem(ROSTER_KEY);
  }
}

let persistenceStarted = false;
export function startRosterPersistence(): void {
  if (persistenceStarted) return;
  persistenceStarted = true;
  manualProvider.subscribe(() => {
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(manualProvider.getEnemyTeam()));
    } catch {
      // best-effort
    }
    // Précharge les CD d'ult de tous les champions suivis.
    for (const enemy of manualProvider.getEnemyTeam()) {
      void championService.prefetchUlt(enemy.championId);
    }
  });
}
