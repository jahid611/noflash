import type { SummonerSpellKey } from '../cooldowns/types';
import { IONIAN_BOOTS_ITEM_ID } from './ManualProvider';
import type { LiveAllGameData, LiveEnemy, LivePlayer, LiveSummonerSpell } from './liveTypes';

/**
 * Mappe le nom d'un summoner spell (Live Client API) vers notre clé interne.
 * Robuste au displayName ("Flash", "Unleashed Teleport") ET au rawDisplayName
 * ("...SummonerFlash..."). ⚠️ PATCH-DEPENDENT si Riot renomme les sorts.
 */
const SPELL_MATCHERS: Array<{ key: SummonerSpellKey; needles: string[] }> = [
  { key: 'flash', needles: ['flash'] },
  { key: 'teleport', needles: ['teleport'] },
  { key: 'ignite', needles: ['ignite', 'summonerdot'] },
  { key: 'exhaust', needles: ['exhaust'] },
  { key: 'barrier', needles: ['barrier'] },
  { key: 'heal', needles: ['heal'] },
  { key: 'cleanse', needles: ['cleanse', 'summonerboost'] },
  { key: 'ghost', needles: ['ghost', 'summonerhaste'] },
];

export function summonerSpellKey(spell: LiveSummonerSpell | undefined): SummonerSpellKey | null {
  if (!spell) return null;
  const haystack = `${spell.displayName ?? ''} ${spell.rawDisplayName ?? ''}`.toLowerCase();
  for (const { key, needles } of SPELL_MATCHERS) {
    if (needles.some((n) => haystack.includes(n))) return key;
  }
  return null;
}

/** Identifiant comparable d'un joueur (riotId > riotIdGameName > summonerName). */
function playerIdentity(p: { riotId?: string; riotIdGameName?: string; summonerName?: string }): string {
  return (p.riotId ?? p.riotIdGameName ?? p.summonerName ?? '').toLowerCase().trim();
}

function hasIonianBoots(player: LivePlayer): boolean {
  return (player.items ?? []).some((i) => i.itemID === Number(IONIAN_BOOTS_ITEM_ID));
}

function toEnemy(player: LivePlayer): LiveEnemy | null {
  const championName = player.championName?.trim();
  if (!championName) return null;
  const one = summonerSpellKey(player.summonerSpells?.summonerSpellOne);
  const two = summonerSpellKey(player.summonerSpells?.summonerSpellTwo);
  const spells = [one, two].filter((s): s is SummonerSpellKey => s !== null);
  const hasFlash = spells.includes('flash');
  const secondSummoner = spells.find((s) => s !== 'flash') ?? null;
  return {
    championName,
    level: typeof player.level === 'number' ? player.level : 1,
    hasIonianBoots: hasIonianBoots(player),
    hasFlash,
    secondSummoner,
  };
}

/**
 * Extrait la liste des ennemis d'un payload allgamedata : on identifie le
 * joueur actif, on prend son équipe, et les ennemis sont l'équipe opposée.
 * Retourne [] si on ne peut pas déterminer l'équipe active (spectateur, format
 * inattendu) — jamais de fausse équipe.
 */
export function extractEnemies(data: LiveAllGameData): LiveEnemy[] {
  const players = data.allPlayers ?? [];
  if (players.length === 0) return [];

  const activeId = playerIdentity(data.activePlayer ?? {});
  const activePlayer = activeId
    ? players.find((p) => playerIdentity(p) === activeId)
    : undefined;
  const activeTeam = activePlayer?.team;
  if (!activeTeam) return [];

  return players
    .filter((p) => p.team && p.team !== activeTeam)
    .map(toEnemy)
    .filter((e): e is LiveEnemy => e !== null);
}

/** true si le payload décrit une partie exploitable (équipe active trouvable). */
export function isGameReadable(data: LiveAllGameData): boolean {
  return extractEnemies(data).length > 0;
}
