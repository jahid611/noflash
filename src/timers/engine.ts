import { createStore } from 'zustand/vanilla';
import type { SpellKey } from '../cooldowns/types';

export interface ActiveTimer {
  key: string;
  championId: string;
  spell: SpellKey;
  /** ms epoch (Date.now()). */
  startedAt: number;
  /** Durée totale en secondes. */
  duration: number;
  /** ms epoch. */
  endsAt: number;
  /** true si la durée repose sur une valeur approximative. */
  approximate: boolean;
}

export interface TimerStartInput {
  championId: string;
  spell: SpellKey;
  duration: number;
  startedAt: number;
  approximate?: boolean;
}

export interface TimerState {
  timers: Record<string, ActiveTimer>;
  start(input: TimerStartInput): ActiveTimer;
  clear(championId: string, spell: SpellKey): ActiveTimer | null;
  clearAll(): void;
  /** Retire les timers expirés et les retourne (pour notifier "de nouveau up"). */
  pruneExpired(nowMs: number): ActiveTimer[];
}

export const timerKey = (championId: string, spell: SpellKey): string =>
  `${championId}:${spell}`;

export function createTimerEngine() {
  return createStore<TimerState>((set, get) => ({
    timers: {},
    start(input) {
      const key = timerKey(input.championId, input.spell);
      const timer: ActiveTimer = {
        key,
        championId: input.championId,
        spell: input.spell,
        startedAt: input.startedAt,
        duration: input.duration,
        endsAt: input.startedAt + input.duration * 1000,
        approximate: input.approximate ?? false,
      };
      set((s) => ({ timers: { ...s.timers, [key]: timer } }));
      return timer;
    },
    clear(championId, spell) {
      const key = timerKey(championId, spell);
      const existing = get().timers[key] ?? null;
      if (existing) {
        set((s) => {
          const timers = { ...s.timers };
          delete timers[key];
          return { timers };
        });
      }
      return existing;
    },
    clearAll() {
      set({ timers: {} });
    },
    pruneExpired(nowMs) {
      const expired = Object.values(get().timers).filter((t) => t.endsAt <= nowMs);
      if (expired.length > 0) {
        set((s) => {
          const timers = { ...s.timers };
          for (const t of expired) delete timers[t.key];
          return { timers };
        });
      }
      return expired;
    },
  }));
}

export type TimerEngine = ReturnType<typeof createTimerEngine>;

export function remainingSeconds(timer: ActiveTimer, nowMs: number): number {
  return Math.max(0, (timer.endsAt - nowMs) / 1000);
}

export function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
