import { create } from 'zustand';
import type { ChampionDataset } from '../../data/types';
import { championService, manualProvider } from './runtime';
import { addLog } from './logStore';

interface DataState {
  status: 'loading' | 'ready';
  dataset: ChampionDataset | null;
}

export const useDataStore = create<DataState>(() => ({ status: 'loading', dataset: null }));

let loadStarted = false;

export async function loadChampionData(): Promise<void> {
  if (loadStarted) return;
  loadStarted = true;
  const dataset = await championService.load();
  useDataStore.setState({ status: 'ready', dataset });
  addLog({
    kind: 'info',
    detail:
      dataset.source === 'ddragon'
        ? `Données champions ddragon ${dataset.version} (${dataset.champions.length} champions)`
        : `ddragon injoignable — dataset fallback bundlé (${dataset.champions.length} champions)`,
  });
  // Ults du roster déjà hydraté (localStorage) : prefetch maintenant.
  for (const enemy of manualProvider.getEnemyTeam()) {
    void championService.prefetchUlt(enemy.championId);
  }
}
