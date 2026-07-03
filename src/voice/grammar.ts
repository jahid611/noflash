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
  // Permet à vosk de classer le bruit hors-vocabulaire au lieu de forcer un match.
  words.add('[unk]');
  return [...words].sort();
}
