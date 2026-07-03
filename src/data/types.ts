export interface ChampionSummary {
  /** id ddragon, ex "KhaZix". */
  id: string;
  /** Nom d'affichage, ex "Kha'Zix". */
  name: string;
}

export interface ChampionDataset {
  version: string;
  source: 'ddragon' | 'fallback';
  champions: ChampionSummary[];
}
