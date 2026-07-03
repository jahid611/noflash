import type { UltRank } from './types';

/** Rang d'ult inféré du niveau (R au 6/11/16). Défaut rank 1, ajustable manuellement. */
export function ultRankForLevel(level: number): UltRank {
  if (level >= 16) return 3;
  if (level >= 11) return 2;
  return 1;
}

/** ⚠️ PATCH-DEPENDENT — fallback grossier quand aucune donnée ddragon n'est dispo. */
export const DEFAULT_ULT_CD: readonly [number, number, number] = [120, 100, 80];

export interface UltBaseCd {
  base: number;
  /** true si la valeur vient du fallback générique, pas des données champion. */
  approximate: boolean;
}

export function ultBaseCd(cooldowns: number[] | undefined, rank: UltRank): UltBaseCd {
  const value = cooldowns?.[rank - 1];
  if (typeof value === 'number' && value > 0) return { base: value, approximate: false };
  return { base: DEFAULT_ULT_CD[rank - 1], approximate: true };
}

/**
 * Ults à charges / recast — ddragon ne modélise pas proprement les fenêtres de
 * recast, donc liste d'override curée. ⚠️ PATCH-DEPENDENT.
 *
 * Comportement par défaut (flag OFF) : "no ult" = cast plein → CD complet.
 * Flag expérimental ON : on ajoute la fenêtre de recast avant le départ du CD.
 */
export interface ChargeUltOverride {
  recastWindowSeconds: number;
  note: string;
}

export const CHARGE_ULT_OVERRIDES: Record<string, ChargeUltOverride> = {
  // clé = id ddragon du champion
  Ahri: { recastWindowSeconds: 10, note: 'Spirit Rush : 3 casts dans une fenêtre de ~10s' },
  Khazix: { recastWindowSeconds: 12, note: 'Void Assault : recasts dans une fenêtre de ~12s' },
};
