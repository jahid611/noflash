import { normalizeWords, ROMAN_TO_SPOKEN } from './grammar';
import { RESET_WORDS, SPELL_WORDS } from './keywords';
import type { NicknameMap } from './nicknames';
import type { SpellKey } from '../cooldowns/types';
import type { ParseResult } from './types';

export interface ChampionRef {
  id: string;
  name: string;
}

interface Alias {
  tokens: string[];
  champ: ChampionRef;
}

/** Index de matching précompilé (aliases triés du plus long au plus court). */
export interface ParserContext {
  aliases: Alias[];
}

/** Séquences de tokens qui désignent un champion à partir de son nom. */
export function championAliasSequences(name: string): string[][] {
  const words = normalizeWords(name);
  const seqs: string[][] = [words];
  // Variante prononcée des chiffres romains : "jarvan iv" → "jarvan four".
  if (words.some((w) => ROMAN_TO_SPOKEN[w])) {
    seqs.push(words.map((w) => ROMAN_TO_SPOKEN[w] ?? w));
  }
  return seqs;
}

export function buildParserContext(
  champions: ChampionRef[],
  nicknames: NicknameMap,
): ParserContext {
  const aliases: Alias[] = [];
  const byNormalizedName = new Map<string, ChampionRef>();
  const wordOwners = new Map<string, Set<string>>();

  for (const champ of champions) {
    byNormalizedName.set(normalizeWords(champ.name).join(' '), champ);
    for (const seq of championAliasSequences(champ.name)) {
      aliases.push({ tokens: seq, champ });
    }
    for (const w of normalizeWords(champ.name)) {
      let owners = wordOwners.get(w);
      if (!owners) wordOwners.set(w, (owners = new Set()));
      owners.add(champ.id);
    }
  }

  // Alias mono-mot pour les noms multi-mots quand le mot est discriminant :
  // "jarvan" suffit pour Jarvan IV, "fortune" pour Miss Fortune, etc.
  for (const champ of champions) {
    const words = normalizeWords(champ.name);
    if (words.length < 2) continue;
    for (const w of words) {
      if (w.length >= 3 && wordOwners.get(w)?.size === 1) {
        aliases.push({ tokens: [w], champ });
      }
    }
  }

  // Nicknames (seed §11 + config), résolus par nom d'affichage.
  for (const [nick, championName] of Object.entries(nicknames)) {
    const champ = byNormalizedName.get(normalizeWords(championName).join(' '));
    if (champ) aliases.push({ tokens: normalizeWords(nick), champ });
  }

  // Match le plus long d'abord ; à longueur égale, les noms officiels
  // (insérés avant les nicknames) gagnent.
  aliases.sort((a, b) => b.tokens.length - a.tokens.length);
  return { aliases };
}

function findSubsequence(haystack: string[], needle: string[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Transcript → intent. Pur et robuste aux mots parasites : on cherche un
 * champion (match contigu le plus long sur noms + nicknames) et un mot-clé
 * spell n'importe où autour.
 */
export function parseTranscript(transcript: string, ctx: ParserContext): ParseResult {
  const tokens = normalizeWords(transcript).filter((t) => t !== 'unk');
  if (tokens.length === 0) return { ok: false, reason: 'empty', transcript };

  let champ: ChampionRef | null = null;
  let span: [number, number] | null = null;
  for (const alias of ctx.aliases) {
    const idx = findSubsequence(tokens, alias.tokens);
    if (idx !== -1) {
      champ = alias.champ;
      span = [idx, idx + alias.tokens.length];
      break;
    }
  }

  let spell: SpellKey | null = null;
  let action: 'start' | 'reset' = 'start';
  for (let i = 0; i < tokens.length; i++) {
    // On ignore les tokens qui font partie du nom du champion matché.
    if (span && i >= span[0] && i < span[1]) continue;
    const mapped = SPELL_WORDS[tokens[i]];
    if (mapped && spell === null) spell = mapped;
    if ((RESET_WORDS as readonly string[]).includes(tokens[i])) action = 'reset';
  }

  if (!champ) return { ok: false, reason: 'no-champion', transcript };
  if (!spell) return { ok: false, reason: 'no-spell', transcript };
  return {
    ok: true,
    transcript,
    intent: { championId: champ.id, championName: champ.name, spell, action },
  };
}
