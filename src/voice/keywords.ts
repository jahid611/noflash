import type { SpellKey } from '../cooldowns/types';

/**
 * Mots-clés reconnus → spell (§6). Inclut des variantes FR d'usage (« ulti »,
 * « télé ») : un joueur francophone ne dit pas « ult » ni « teleport » à
 * l'anglaise, et le modèle vosk français les prononce à la française.
 */
export const SPELL_WORDS: Record<string, SpellKey> = {
  flash: 'flash',
  ult: 'ult',
  ulti: 'ult',
  ultime: 'ult',
  // La lettre R pour l'ult : quand tu la prononces, vosk entend « erre » (FR)
  // ou « ar » (EN), pas la lettre « r » brute → on mappe les trois.
  r: 'ult',
  erre: 'ult',
  ar: 'ult',
  tp: 'teleport',
  tepe: 'teleport',
  teleport: 'teleport',
  teleportation: 'teleport',
  ignite: 'ignite',
  ignit: 'ignite',
  heal: 'heal',
  soin: 'heal',
  exhaust: 'exhaust',
  fatigue: 'exhaust',
  barrier: 'barrier',
  barriere: 'barrier',
  cleanse: 'cleanse',
  purge: 'cleanse',
  ghost: 'ghost',
  fantome: 'ghost',
};

/** Déclencheur "<champ> no <spell>" — optionnel pour le parser. */
export const TRIGGER_WORDS = ['no'] as const;

/** "<champ> <spell> down/used" → même sens que "no <spell>" : démarrer le CD. */
export const START_WORDS = ['down', 'used', 'parti', 'pose'] as const;

/** "<champ> <spell> up/back" → annuler/reset le timer (spell récupéré). */
export const RESET_WORDS = ['up', 'back', 'dispo', 'revenu'] as const;

export const ALL_KEYWORDS: string[] = [
  ...new Set([
    ...Object.keys(SPELL_WORDS),
    ...TRIGGER_WORDS,
    ...START_WORDS,
    ...RESET_WORDS,
  ]),
];
