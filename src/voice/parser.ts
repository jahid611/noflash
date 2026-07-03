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

/** Distance d'édition (Levenshtein), bornée pour rester bon marché. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99; // trop éloigné, inutile de calculer
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Matching phonétique de secours : rattrape les quasi-erreurs de vosk (accent
 * FR + noms fantasy) quand le match exact échoue. Très conservateur — au plus
 * UNE lettre d'écart sur l'ensemble du nom — pour ne jamais lancer un timer sur
 * un mot au hasard (un faux timer est pire que pas de timer). Sur une grammaire
 * restreinte aux 5 ennemis, les candidats sont peu nombreux → c'est sûr.
 */
function fuzzyFindChampion(
  tokens: string[],
  aliases: Alias[],
): { champ: ChampionRef; span: [number, number] } | null {
  for (const alias of aliases) {
    const need = alias.tokens;
    // On ignore les alias mono-lettre / très courts : trop de collisions.
    if (need.join('').length < 3) continue;
    for (let i = 0; i + need.length <= tokens.length; i++) {
      let total = 0;
      let ok = true;
      for (let j = 0; j < need.length; j++) {
        const d = editDistance(tokens[i + j], need[j]);
        total += d;
        if (d > 1 || total > 1) {
          ok = false;
          break;
        }
      }
      if (ok && total >= 1) {
        return { champ: alias.champ, span: [i, i + need.length] };
      }
    }
  }
  return null;
}

/**
 * Transcript → intent. Pur et robuste aux mots parasites : on cherche un
 * champion (match contigu le plus long sur noms + nicknames, puis fallback
 * phonétique) et un mot-clé spell n'importe où autour.
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

  // Aucun match exact : on tente le rattrapage phonétique (1 lettre d'écart max).
  if (!champ) {
    const fuzzy = fuzzyFindChampion(tokens, ctx.aliases);
    if (fuzzy) {
      champ = fuzzy.champ;
      span = fuzzy.span;
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
