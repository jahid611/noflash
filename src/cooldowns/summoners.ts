import type { SummonerSpellKey } from './types';

/**
 * ⚠️ PATCH-DEPENDENT — toutes ces valeurs sont à revérifier à chaque patch LoL.
 * Cooldowns de base des summoner spells, en secondes.
 */
export const SUMMONER_BASE_CD: Record<SummonerSpellKey, number> = {
  flash: 300,
  teleport: 360, // scaling par niveau — voir teleportBaseCd()
  ignite: 180,
  heal: 240,
  exhaust: 210,
  barrier: 180,
  cleanse: 210,
  ghost: 210,
};

/**
 * ⚠️ PATCH-DEPENDENT — Teleport scale avec le niveau (~360s au nv 1 → ~240s au nv 18).
 * Approximation linéaire, suffisante pour le proto.
 */
export function teleportBaseCd(level: number): number {
  const lvl = Math.min(18, Math.max(1, Math.round(level)));
  return 360 - ((360 - 240) * (lvl - 1)) / 17;
}

export function summonerBaseCd(spell: SummonerSpellKey, level: number): number {
  return spell === 'teleport' ? teleportBaseCd(level) : SUMMONER_BASE_CD[spell];
}

// ⚠️ PATCH-DEPENDENT — sources de haste togglables manuellement (§12 : la Live
// Client API n'expose PAS les runes ennemies, donc Cosmic Insight ne sera
// JAMAIS détectable automatiquement ; les bottes le seront via les items).
export const IONIAN_BOOTS_SUMMONER_HASTE = 10;
export const IONIAN_BOOTS_ABILITY_HASTE = 15;
export const COSMIC_INSIGHT_SUMMONER_HASTE = 18;
