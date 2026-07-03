import type { SummonerSpellKey } from '../cooldowns/types';
import type { ChampionSummary } from './types';

export const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ddragon ${res.status} sur ${url}`);
  return (await res.json()) as T;
}

/** https://ddragon.leagueoflegends.com/api/versions.json → [0] = dernière version. */
export async function fetchLatestVersion(): Promise<string> {
  const versions = await fetchJson<string[]>(`${DDRAGON_BASE}/api/versions.json`);
  if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
    throw new Error('versions.json inattendu');
  }
  return versions[0];
}

interface DDragonChampionList {
  data: Record<string, { id: string; name: string }>;
}

export async function fetchChampionList(version: string): Promise<ChampionSummary[]> {
  const payload = await fetchJson<DDragonChampionList>(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`,
  );
  return Object.values(payload.data)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface DDragonChampionDetail {
  data: Record<
    string,
    { spells: Array<{ cooldown: number[]; image?: { full?: string } }> }
  >;
}

export interface ChampionUltData {
  /** CD de base par rang (spells[3].cooldown — les ults montent au 6/11/16). */
  cooldowns: number[];
  /** Fichier d'icône ddragon de l'ult (ex "AhriR.png"), null si inconnu. */
  iconFile: string | null;
}

/** spells[3] = R → cooldown[] par rang + icône du sort. */
export async function fetchUltData(
  version: string,
  championId: string,
): Promise<ChampionUltData> {
  const payload = await fetchJson<DDragonChampionDetail>(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion/${championId}.json`,
  );
  const ult = payload.data[championId]?.spells?.[3];
  if (!ult || !Array.isArray(ult.cooldown) || ult.cooldown.length === 0) {
    throw new Error(`pas de cooldown d'ult pour ${championId}`);
  }
  return { cooldowns: ult.cooldown, iconFile: ult.image?.full ?? null };
}

export function championIconUrl(version: string, championId: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championId}.png`;
}

/**
 * Icônes des summoner spells sur le CDN ddragon (mêmes assets qu'en jeu).
 * ⚠️ Noms de fichiers stables historiquement, à revérifier si Riot les renomme.
 */
export const SUMMONER_SPELL_ICON: Record<SummonerSpellKey, string> = {
  flash: 'SummonerFlash.png',
  teleport: 'SummonerTeleport.png',
  ignite: 'SummonerDot.png',
  heal: 'SummonerHeal.png',
  exhaust: 'SummonerExhaust.png',
  barrier: 'SummonerBarrier.png',
  cleanse: 'SummonerBoost.png',
  ghost: 'SummonerHaste.png',
};

export function spellIconUrl(version: string, iconFile: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/spell/${iconFile}`;
}
