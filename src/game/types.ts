import type { SummonerSpellKey, UltRank } from '../cooldowns/types';

/**
 * Config d'un ennemi suivi. En web tout est saisi à la main (ManualProvider) ;
 * en desktop une partie viendra de la Live Client API (LiveClientProvider) :
 * niveaux et items OUI, runes NON → les toggles haste restent manuels.
 */
export interface EnemyConfig {
  /** id ddragon, ex "KhaZix". */
  championId: string;
  /** Nom d'affichage, ex "Kha'Zix". */
  championName: string;
  level: number;
  ultRank: UltRank;
  hasIonianBoots: boolean;
  hasCosmicInsight: boolean;
  extraSummonerHaste: number;
  extraAbilityHaste: number;
  /** Second summoner affiché en plus de Flash (les ennemis en ont deux). */
  secondSummoner: SummonerSpellKey | null;
}

export function defaultEnemyConfig(championId: string, championName: string): EnemyConfig {
  return {
    championId,
    championName,
    level: 6,
    ultRank: 1, // défaut rank 1 (§5), ajustable manuellement
    hasIonianBoots: false,
    hasCosmicInsight: false, // worst case par défaut : 0 haste
    extraSummonerHaste: 0,
    extraAbilityHaste: 0,
    secondSummoner: null,
  };
}
