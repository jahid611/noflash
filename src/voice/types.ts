import type { SpellKey } from '../cooldowns/types';

export type IntentAction = 'start' | 'reset';

/** Commande vocale comprise : "ahri no flash" → { Ahri, flash, start }. */
export interface Intent {
  championId: string;
  championName: string;
  spell: SpellKey;
  action: IntentAction;
}

export type ParseFailureReason = 'empty' | 'no-champion' | 'no-spell';

export type ParseResult =
  | { ok: true; intent: Intent; transcript: string }
  | { ok: false; reason: ParseFailureReason; transcript: string };
