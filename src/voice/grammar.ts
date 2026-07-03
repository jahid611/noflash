import { ALL_KEYWORDS } from './keywords';

/**
 * Normalise un nom/transcript en tokens : lowercase, accents retirés,
 * apostrophes et ponctuation traitées comme séparateurs.
 * "Kha'Zix" → ["kha","zix"], "Jarvan IV" → ["jarvan","iv"].
 */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Chiffres romains des noms de champions → forme prononcée ("jarvan four"). */
export const ROMAN_TO_SPOKEN: Record<string, string> = {
  ii: 'two',
  iii: 'three',
  iv: 'four',
  vi: 'six',
};

export interface GrammarInput {
  championNames: string[];
  nicknameWords: string[];
  keywords?: string[];
  /**
   * Ajoute le token spécial [unk]. ⚠️ Par défaut FALSE, et c'est capital : avec
   * [unk], vosk a le droit de répondre « inconnu » et le fait bien trop souvent
   * sur des noms fantasy criés en teamfight (« Malphite » → [unk]). SANS [unk],
   * il est OBLIGÉ de sortir le champion le plus proche phonétiquement parmi la
   * liste fermée — c'est ce qui rend la reco utilisable en jeu. À n'activer
   * qu'en mode always-on très bruyant, pour filtrer les faux positifs.
   */
  includeUnk?: boolean;
}

/**
 * Grammaire fermée passée au KaldiRecognizer : l'ensemble des mots que le
 * moteur a le droit de reconnaître. Le moteur ne cherche pas "qu'a-t-il dit
 * dans l'absolu" mais "lequel de ces tokens colle le mieux" — c'est ce qui
 * rend la reco fiable en vocabulaire fermé.
 */
export function buildGrammar(input: GrammarInput): string[] {
  const words = new Set<string>();
  for (const name of input.championNames) {
    for (const w of normalizeWords(name)) {
      words.add(w);
      const spoken = ROMAN_TO_SPOKEN[w];
      if (spoken) words.add(spoken);
    }
  }
  for (const nick of input.nicknameWords) {
    for (const w of normalizeWords(nick)) words.add(w);
  }
  for (const kw of input.keywords ?? ALL_KEYWORDS) words.add(kw);
  // [unk] uniquement si explicitement demandé (sinon vosk force le match).
  if (input.includeUnk) words.add('[unk]');
  return [...words].sort();
}
