/** Summoner spells suivis (clé interne, indépendante de la langue parlée). */
export type SummonerSpellKey =
  | 'flash'
  | 'teleport'
  | 'ignite'
  | 'heal'
  | 'exhaust'
  | 'barrier'
  | 'cleanse'
  | 'ghost';

/** Tout ce qu'on sait timer : summoners + ultime. */
export type SpellKey = SummonerSpellKey | 'ult';

export type UltRank = 1 | 2 | 3;
