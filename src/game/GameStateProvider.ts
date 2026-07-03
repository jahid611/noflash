import type { EnemyConfig } from './types';

/**
 * Seam de portage desktop (§12).
 *
 * Impl web  : ManualProvider (saisie manuelle).
 * Impl desktop (plus tard) : LiveClientProvider branché sur la Live Client
 * Data API (https://127.0.0.1:2999/liveclientdata/...).
 *
 * ⚠️ Limite structurante de la Live Client API : elle expose les ITEMS ennemis
 * mais PAS leurs RUNES. Cosmic Insight & co ne seront donc jamais détectables
 * automatiquement — la logique haste ne doit jamais supposer qu'on aura les
 * runes un jour (d'où les toggles manuels dans EnemyConfig).
 */
export interface GameStateProvider {
  /** Les ennemis suivis (jusqu'à 5). */
  getEnemyTeam(): EnemyConfig[];
  /** Ids d'items connus pour un champion (web : dérivé des toggles manuels). */
  getItems(championId: string): string[];
  /** Niveaux connus, indexés par championId. */
  getLevels(): Record<string, number>;
  /** Notifie tout changement d'état. Retourne la fonction de désinscription. */
  subscribe(listener: () => void): () => void;
}
