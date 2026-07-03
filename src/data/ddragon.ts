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
  data: Record<string, { spells: Array<{ cooldown: number[] }> }>;
}

/** spells[3] = R → cooldown[] par rang (les ults montent au 6/11/16). */
export async function fetchUltCooldowns(
  version: string,
  championId: string,
): Promise<number[]> {
  const payload = await fetchJson<DDragonChampionDetail>(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion/${championId}.json`,
  );
  const cooldown = payload.data[championId]?.spells?.[3]?.cooldown;
  if (!Array.isArray(cooldown) || cooldown.length === 0) {
    throw new Error(`pas de cooldown d'ult pour ${championId}`);
  }
  return cooldown;
}

export function championIconUrl(version: string, championId: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championId}.png`;
}
