import { effectiveCooldown } from './haste';
import {
  COSMIC_INSIGHT_SUMMONER_HASTE,
  IONIAN_BOOTS_ABILITY_HASTE,
  IONIAN_BOOTS_SUMMONER_HASTE,
  summonerBaseCd,
} from './summoners';
import { CHARGE_ULT_OVERRIDES, ultBaseCd } from './ults';
import type { SpellKey, UltRank } from './types';

/**
 * Sources de haste d'un ennemi. Tout est manuel en web (§5) et le restera en
 * partie en desktop : la Live Client API expose les items (→ bottes) mais PAS
 * les runes (→ Cosmic Insight). Défaut = worst case, 0 haste.
 */
export interface HasteInputs {
  hasIonianBoots: boolean;
  hasCosmicInsight: boolean;
  /** Summoner spell haste additionnel saisi manuellement. */
  extraSummonerHaste: number;
  /** Ability haste additionnel saisi manuellement (pour l'ult). */
  extraAbilityHaste: number;
}

export interface UltInputs {
  /** cooldown[] de ddragon (spells[3]), un CD de base par rang. */
  cooldowns: number[] | undefined;
  rank: UltRank;
  championId: string;
  /** Flag expérimental : prise en compte de la fenêtre de recast des ults à charges. */
  chargeTrackingEnabled: boolean;
}

export function summonerSpellHaste(h: HasteInputs): number {
  return (
    (h.hasIonianBoots ? IONIAN_BOOTS_SUMMONER_HASTE : 0) +
    (h.hasCosmicInsight ? COSMIC_INSIGHT_SUMMONER_HASTE : 0) +
    (h.extraSummonerHaste || 0)
  );
}

export function abilityHaste(h: HasteInputs): number {
  // Cosmic Insight ne donne pas d'ability haste — uniquement bottes + saisie manuelle.
  return (h.hasIonianBoots ? IONIAN_BOOTS_ABILITY_HASTE : 0) + (h.extraAbilityHaste || 0);
}

export interface ComputedCooldown {
  seconds: number;
  /** true si une partie de la valeur est approximative (fallback, TP linéaire…). */
  approximate: boolean;
  note?: string;
}

export function computeCooldown(
  spell: SpellKey,
  haste: HasteInputs,
  opts: { level: number; ult?: UltInputs },
): ComputedCooldown {
  if (spell === 'ult') {
    const ult = opts.ult;
    if (!ult) return { seconds: effectiveCooldown(120, abilityHaste(haste)), approximate: true };
    const { base, approximate } = ultBaseCd(ult.cooldowns, ult.rank);
    let seconds = effectiveCooldown(base, abilityHaste(haste));
    let note: string | undefined;
    const override = CHARGE_ULT_OVERRIDES[ult.championId];
    if (override && ult.chargeTrackingEnabled) {
      // Le CD ne démarre qu'à la fin de la fenêtre de recast (approximation).
      seconds += override.recastWindowSeconds;
      note = `+${override.recastWindowSeconds}s fenêtre de recast (expérimental)`;
    }
    return { seconds, approximate, note };
  }
  const base = summonerBaseCd(spell, opts.level);
  return {
    seconds: effectiveCooldown(base, summonerSpellHaste(haste)),
    approximate: spell === 'teleport',
  };
}
