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
  /** Clé phonétique de la séquence jointe (voir phoneticKey). */
  phonetic: string;
}

/** Index de matching précompilé (aliases triés du plus long au plus court). */
export interface ParserContext {
  aliases: Alias[];
}

/**
 * « Mini-IA » qui comprend LoL sans aucune ressource : réduit un mot à une clé
 * phonétique tolérante (FR + noms fantasy). But : que « malphite », « malfite »,
 * « mal fit » produisent la MÊME clé, pour relier ce que dit le joueur au bon
 * champion même quand vosk transcrit de travers. Purement des règles de
 * folding — zéro modèle, quelques microsecondes.
 */
export function phoneticKey(word: string): string {
  let k = word.toLowerCase();
  k = k.replace(/ph/g, 'f'); // malphite → malfite
  k = k.replace(/gh/g, 'g'); // cho'gath
  k = k.replace(/th/g, 't');
  k = k.replace(/ch/g, 'k'); // kha, chogath
  k = k.replace(/sh/g, 's');
  k = k.replace(/qu?/g, 'k');
  k = k.replace(/ck/g, 'k');
  k = k.replace(/c([eiy])/g, 's$1'); // lucian → lusian
  k = k.replace(/c/g, 'k');
  k = k.replace(/x/g, 'ks'); // zix → ziks
  k = k.replace(/y/g, 'i');
  k = k.replace(/w/g, 'v');
  k = k.replace(/h/g, ''); // h muet
  k = k.replace(/(.)\1+/g, '$1'); // consonnes/lettres doublées → simple
  k = k.replace(/[aeiou]+/g, (m) => m[0]); // suites de voyelles → première
  k = k.replace(/e+$/g, '').replace(/s$/g, ''); // finales muettes FR
  return k;
}

/** Distance d'édition (Levenshtein), bornée pour rester bon marché. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
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

/** Similarité phonétique normalisée dans [0,1] (0 = identique). */
function phoneticDistance(a: string, b: string): number {
  if (!a || !b) return 1;
  return editDistance(a, b) / Math.max(a.length, b.length);
}

/** Clés phonétiques des mots-clés de sorts, précalculées une fois. */
const SPELL_PHONETICS: Array<{ key: string; spell: SpellKey }> = Object.entries(SPELL_WORDS).map(
  ([word, spell]) => ({ key: phoneticKey(word), spell }),
);

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

  const add = (tokens: string[], champ: ChampionRef) =>
    aliases.push({ tokens, champ, phonetic: phoneticKey(tokens.join('')) });

  for (const champ of champions) {
    byNormalizedName.set(normalizeWords(champ.name).join(' '), champ);
    for (const seq of championAliasSequences(champ.name)) add(seq, champ);
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
      if (w.length >= 3 && wordOwners.get(w)?.size === 1) add([w], champ);
    }
  }

  // Nicknames (seed §11 + config), résolus par nom d'affichage.
  for (const [nick, championName] of Object.entries(nicknames)) {
    const champ = byNormalizedName.get(normalizeWords(championName).join(' '));
    if (champ) add(normalizeWords(nick), champ);
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

/** En dessous de ce score phonétique, on considère que c'est le bon champion. */
const CHAMP_PHONETIC_CUTOFF = 0.34;
const SPELL_PHONETIC_CUTOFF = 0.3;
/** Longueur max (en tokens) d'une fenêtre testée comme nom de champion. */
const MAX_CHAMP_WINDOW = 3;

/**
 * Cœur de la « mini-IA » : parmi les champions du contexte (= les 5 ennemis en
 * jeu), lequel colle le mieux phonétiquement à un morceau du transcript ?
 * Teste des fenêtres de 1 à 3 tokens (vosk découpe/fusionne les noms), compare
 * leur clé phonétique aux alias, et prend le meilleur SOUS le seuil. Un mot
 * vraiment éloigné (« banana ») dépasse le seuil → aucun match, jamais de faux
 * timer.
 */
function phoneticFindChampion(
  tokens: string[],
  aliases: Alias[],
): { champ: ChampionRef; span: [number, number] } | null {
  let best: { champ: ChampionRef; span: [number, number]; score: number } | null = null;
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= MAX_CHAMP_WINDOW && i + len <= tokens.length; len++) {
      const spanKey = phoneticKey(tokens.slice(i, i + len).join(''));
      // Clés trop courtes (< 3) = collisions avec des mots courants (« as »,
      // « no ») : on les laisse au match exact. Les noms courts restent gérés
      // par la grammaire fermée + le forced match vosk.
      if (spanKey.length < 3) continue;
      for (const alias of aliases) {
        if (alias.phonetic.length < 3) continue;
        const score = phoneticDistance(alias.phonetic, spanKey);
        if (score > CHAMP_PHONETIC_CUTOFF) continue;
        // À score égal, on préfère l'alias le plus long (plus discriminant).
        if (
          !best ||
          score < best.score ||
          (score === best.score && len > best.span[1] - best.span[0])
        ) {
          best = { champ: alias.champ, span: [i, i + len], score };
        }
      }
    }
  }
  return best ? { champ: best.champ, span: best.span } : null;
}

/** Mot → spell : exact d'abord, sinon plus proche phonétiquement sous le seuil. */
function matchSpell(token: string): SpellKey | null {
  const exact = SPELL_WORDS[token];
  if (exact) return exact;
  const key = phoneticKey(token);
  if (key.length < 2) return null;
  let best: { spell: SpellKey; score: number } | null = null;
  for (const { key: spellKey, spell } of SPELL_PHONETICS) {
    const score = phoneticDistance(spellKey, key);
    if (score <= SPELL_PHONETIC_CUTOFF && (!best || score < best.score)) {
      best = { spell, score };
    }
  }
  return best?.spell ?? null;
}

/**
 * Transcript → intent. Robuste aux mots parasites ET aux erreurs de
 * transcription : on relie ce qui est dit aux champions/sorts connus (les 5
 * ennemis), par match exact puis par proximité phonétique.
 */
export function parseTranscript(transcript: string, ctx: ParserContext): ParseResult {
  const tokens = normalizeWords(transcript).filter((t) => t !== 'unk');
  if (tokens.length === 0) return { ok: false, reason: 'empty', transcript };

  // 1) Champion — match exact contigu (le plus long) prioritaire…
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
  // … sinon proximité phonétique (le levier « comprend même de travers »).
  if (!champ) {
    const phon = phoneticFindChampion(tokens, ctx.aliases);
    if (phon) {
      champ = phon.champ;
      span = phon.span;
    }
  }

  // 2) Spell — exact ou phonétique, en ignorant les tokens du nom du champion.
  let spell: SpellKey | null = null;
  let action: 'start' | 'reset' = 'start';
  for (let i = 0; i < tokens.length; i++) {
    if (span && i >= span[0] && i < span[1]) continue;
    const mapped = matchSpell(tokens[i]);
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
