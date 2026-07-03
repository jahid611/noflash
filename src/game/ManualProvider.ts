import { createStore } from 'zustand/vanilla';
import { ultRankForLevel } from '../cooldowns/ults';
import type { SummonerSpellKey } from '../cooldowns/types';
import type { GameStateProvider } from './GameStateProvider';
import { defaultEnemyConfig, type EnemyConfig } from './types';

/** Ennemi résolu depuis la Live Client Data API (côté renderer). */
export interface LiveSyncEnemy {
  championId: string;
  championName: string;
  level: number;
  hasIonianBoots: boolean;
  /** Les deux summoners réels de l'ennemi (Flash en tête si présent). */
  summoners: SummonerSpellKey[];
}

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

  /**
   * Synchronise l'équipe depuis une partie en cours (desktop). Fusion :
   * composition / niveau / rang d'ult / bottes / 2e summoner viennent du jeu,
   * MAIS les réglages purement manuels (Cosmic Insight, haste additionnels) sont
   * préservés — la Live Client API n'expose jamais les runes ennemies (§12).
   * No-op si rien n'a changé, pour éviter le churn du polling (~toutes les 2s).
   */
  syncFromLive(live: LiveSyncEnemy[]): void {
    const current = this.getEnemyTeam();
    const next: EnemyConfig[] = live.slice(0, 5).map((l) => {
      const existing = current.find((e) => e.championId === l.championId);
      const base = existing ?? defaultEnemyConfig(l.championId, l.championName);
      return {
        ...base,
        championName: l.championName,
        level: l.level,
        ultRank: ultRankForLevel(l.level),
        hasIonianBoots: l.hasIonianBoots,
        // Les vrais summoners lus en jeu ; si l'API n'en donne pas, on garde l'existant.
        summoners: l.summoners.length > 0 ? l.summoners : base.summoners,
      };
    });
    if (liveSignature(current) === liveSignature(next)) return; // rien de neuf
    this.store.setState({ enemies: next });
  }
}

/** Signature des champs pilotés par le live — pour détecter un vrai changement. */
function liveSignature(enemies: EnemyConfig[]): string {
  return enemies
    .map(
      (e) =>
        `${e.championId}:${e.level}:${e.hasIonianBoots ? 1 : 0}:${e.summoners.join('+')}`,
    )
    .join('|');
}
