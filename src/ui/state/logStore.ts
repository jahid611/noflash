import { create } from 'zustand';
import { toast } from 'sonner';
import type { Intent } from '@/voice/types';

export type LogKind = 'intent' | 'unrecognized' | 'silence' | 'info' | 'error';

export interface LogEntry {
  id: number;
  at: number;
  kind: LogKind;
  transcript?: string;
  intent?: Intent;
  latencyMs?: number | null;
  detail?: string;
}

interface LogState {
  entries: LogEntry[];
  clear(): void;
}

const MAX_ENTRIES = 120;
let nextLogId = 1;

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  clear: () => set({ entries: [] }),
}));

export function addLog(entry: Omit<LogEntry, 'id' | 'at'>): void {
  useLogStore.setState((s) => ({
    entries: [{ ...entry, id: nextLogId++, at: Date.now() }, ...s.entries].slice(0, MAX_ENTRIES),
  }));
}

export type ToastKind = 'success' | 'error' | 'info';

const TOAST_TTL_MS = 2800;

/** Confirmations visuelles (§9) via sonner — grosses, centrées, jamais silencieuses. */
export function addToast(kind: ToastKind, title: string, sub?: string): void {
  const options = { description: sub, duration: TOAST_TTL_MS };
  if (kind === 'success') toast.success(title, options);
  else if (kind === 'error') toast.error(title, options);
  else toast.info(title, options);
}
