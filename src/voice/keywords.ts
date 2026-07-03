import type { SpellKey } from '../cooldowns/types';

/** Mots-clés reconnus → spell (§6). */
export const SPELL_WORDS: Record<string, SpellKey> = {
  flash: 'flash',
  ult: 'ult',
  r: 'ult',
  tp: 'teleport',
  teleport: 'teleport',
  ignite: 'ignite',
  heal: 'heal',
  exhaust: 'exhaust',
  barrier: 'barrier',
  cleanse: 'cleanse',
  ghost: 'ghost',
};

/** Déclencheur "<champ> no <spell>" — purement optionnel pour le parser. */
export const TRIGGER_WORDS = ['no'] as const;

/** "<champ> <spell> down/used" → même sens que "no <spell>" : démarrer le CD. */
export const START_WORDS = ['down', 'used'] as const;

/** "<champ> <spell> up/back" → annuler/reset le timer (spell récupéré). */
export const RESET_WORDS = ['up', 'back'] as const;

export const ALL_KEYWORDS: string[] = [
  ...new Set([
    ...Object.keys(SPELL_WORDS),
    ...TRIGGER_WORDS,
    ...START_WORDS,
    ...RESET_WORDS,
  ]),
];
