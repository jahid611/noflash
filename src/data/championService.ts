import type { SummonerSpellKey } from '../cooldowns/types';
import type { KeyValueCache } from './cache';
import {
  SUMMONER_SPELL_ICON,
  championIconUrl,
  fetchChampionList,
  fetchLatestVersion,
  fetchUltData,
  spellIconUrl,
  type ChampionUltData,
} from './ddragon';
import { FALLBACK_CHAMPIONS, FALLBACK_VERSION } from './fallback';
import type { ChampionDataset, ChampionSummary } from './types';

const KEY_PREFIX = 'noflash:ddragon';
const versionKey = `${KEY_PREFIX}:version`;
const listKey = (version: string) => `${KEY_PREFIX}:list:${version}`;
const ultKey = (version: string, id: string) => `${KEY_PREFIX}:ult2:${version}:${id}`;

/**
 * Source de données champions : ddragon en runtime (jamais au build), cache
 * localStorage clé par version, fallback bundlé si tout échoue.
 */
export class ChampionService {
  private dataset: ChampionDataset | null = null;
  private ultData = new Map<string, ChampionUltData>();

  constructor(private readonly cache: KeyValueCache) {
    // Seed hors-ligne : les valeurs ddragon écraseront au prefetch.
    for (const champ of FALLBACK_CHAMPIONS) {
      this.ultData.set(champ.id, { cooldowns: [...champ.ultCooldowns], iconFile: null });
    }
  }

  getDataset(): ChampionDataset | null {
    return this.dataset;
  }

  private version(): string {
    return this.dataset?.version ?? FALLBACK_VERSION;
  }

  async load(): Promise<ChampionDataset> {
    let version: string | null = null;
    try {
      version = await fetchLatestVersion();
      this.cache.set(versionKey, version);
    } catch {
      version = this.cache.get(versionKey);
    }

    if (version) {
      const champions = await this.loadChampionList(version);
      if (champions) {
        this.dataset = { version, source: 'ddragon', champions };
        return this.dataset;
      }
    }

    this.dataset = {
      version: FALLBACK_VERSION,
      source: 'fallback',
      champions: FALLBACK_CHAMPIONS.map(({ id, name }) => ({ id, name })),
    };
    return this.dataset;
  }

  private async loadChampionList(version: string): Promise<ChampionSummary[] | null> {
    const cached = this.cache.get(listKey(version));
    if (cached) {
      try {
        return JSON.parse(cached) as ChampionSummary[];
      } catch {
        this.cache.remove(listKey(version));
      }
    }
    try {
      const champions = await fetchChampionList(version);
      this.cache.set(listKey(version), JSON.stringify(champions));
      return champions;
    } catch {
      return null;
    }
  }

  /** Charge (et met en cache) CD + icône d'ult d'un champion. Best-effort. */
  async prefetchUlt(championId: string): Promise<void> {
    const ds = this.dataset;
    if (!ds || ds.source !== 'ddragon') return; // fallback déjà seedé
    const cached = this.cache.get(ultKey(ds.version, championId));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ChampionUltData;
        if (Array.isArray(parsed.cooldowns)) {
          this.ultData.set(championId, parsed);
          return;
        }
      } catch {
        // format invalide → refetch
      }
      this.cache.remove(ultKey(ds.version, championId));
    }
    try {
      const data = await fetchUltData(ds.version, championId);
      this.ultData.set(championId, data);
      this.cache.set(ultKey(ds.version, championId), JSON.stringify(data));
    } catch {
      // pas bloquant : computeCooldown passera en valeur approximative
    }
  }

  /** Accès synchrone (après prefetch) pour le calcul de CD. */
  getCachedUltCooldowns(championId: string): number[] | undefined {
    return this.ultData.get(championId)?.cooldowns;
  }

  /** Icône d'ult ddragon (comme en jeu), null si pas encore connue. */
  getUltIconUrl(championId: string): string | null {
    const iconFile = this.ultData.get(championId)?.iconFile;
    return iconFile ? spellIconUrl(this.version(), iconFile) : null;
  }

  /** Icône d'un summoner spell (mêmes assets qu'en jeu). */
  getSummonerIconUrl(spell: SummonerSpellKey): string {
    return spellIconUrl(this.version(), SUMMONER_SPELL_ICON[spell]);
  }

  iconUrl(championId: string): string {
    return championIconUrl(this.version(), championId);
  }

  findByName(name: string): ChampionSummary | undefined {
    return this.dataset?.champions.find((c) => c.name === name);
  }

  clearCache(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(KEY_PREFIX)) this.cache.remove(key);
    }
  }
}
