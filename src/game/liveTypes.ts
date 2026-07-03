import type { SummonerSpellKey } from '../cooldowns/types';

/**
 * Sous-ensemble du payload de la Live Client Data API de League
 * (https://127.0.0.1:2999/liveclientdata/allgamedata). On ne type que ce qu'on
 * consomme — le reste du JSON est ignoré. ⚠️ Riot fait évoluer ces champs
 * (summonerName → riotId) : le mapping ci-dessous reste défensif.
 */
export interface LiveSummonerSpell {
  displayName?: string;
  rawDisplayName?: string;
}

export interface LivePlayer {
  championName?: string;
  rawChampionName?: string;
  summonerName?: string;
  riotId?: string;
  riotIdGameName?: string;
  team?: string; // "ORDER" | "CHAOS"
  level?: number;
  isBot?: boolean;
  items?: Array<{ itemID?: number }>;
  summonerSpells?: {
    summonerSpellOne?: LiveSummonerSpell;
    summonerSpellTwo?: LiveSummonerSpell;
  };
}

export interface LiveActivePlayer {
  summonerName?: string;
  riotId?: string;
  riotIdGameName?: string;
}

export interface LiveAllGameData {
  activePlayer?: LiveActivePlayer;
  allPlayers?: LivePlayer[];
}

/** Ce qu'on extrait d'un ennemi depuis la partie en cours. */
export interface LiveEnemy {
  /** Nom d'affichage Riot (ex "Kha'Zix") — résolu en id côté renderer. */
  championName: string;
  level: number;
  hasIonianBoots: boolean;
  hasFlash: boolean;
  /** Second summoner (hors Flash) suivi, si reconnu. */
  secondSummoner: SummonerSpellKey | null;
}
