import { createStore } from 'zustand/vanilla';
import type { GameStateProvider } from './GameStateProvider';
import { defaultEnemyConfig, type EnemyConfig } from './types';

/** id ddragon de l'item Ionian Boots of Lucidity. ⚠️ PATCH-DEPENDENT. */
export const IONIAN_BOOTS_ITEM_ID = '3158';

interface ManualState {
  enemies: EnemyConfig[];
}

/**
 * Implémentation web du GameStateProvider : tout est saisi manuellement.
 * Zéro import React/DOM — l'UI se branche dessus via `store` (zustand vanilla).
 */
export class ManualProvider implements GameStateProvider {
  readonly store = createStore<ManualState>(() => ({ enemies: [] }));

  getEnemyTeam(): EnemyConfig[] {
    return this.store.getState().enemies;
  }

  getItems(championId: string): string[] {
    const enemy = this.findEnemy(championId);
    return enemy?.hasIonianBoots ? [IONIAN_BOOTS_ITEM_ID] : [];
  }

  getLevels(): Record<string, number> {
    return Object.fromEntries(this.getEnemyTeam().map((e) => [e.championId, e.level]));
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  findEnemy(championId: string): EnemyConfig | undefined {
    return this.getEnemyTeam().find((e) => e.championId === championId);
  }

  /** Définit l'équipe ; la config existante d'un champion conservé est préservée. */
  setTeam(champions: Array<{ id: string; name: string }>): void {
    const current = this.getEnemyTeam();
    const enemies = champions.slice(0, 5).map((c) => {
      const existing = current.find((e) => e.championId === c.id);
      return existing ?? defaultEnemyConfig(c.id, c.name);
    });
    this.store.setState({ enemies });
  }

  /** Restauration brute (hydratation depuis un storage). */
  replaceTeam(enemies: EnemyConfig[]): void {
    this.store.setState({ enemies: enemies.slice(0, 5) });
  }

  updateEnemy(championId: string, patch: Partial<Omit<EnemyConfig, 'championId'>>): void {
    this.store.setState((s) => ({
      enemies: s.enemies.map((e) => (e.championId === championId ? { ...e, ...patch } : e)),
    }));
  }

  clearTeam(): void {
    this.store.setState({ enemies: [] });
  }
}
