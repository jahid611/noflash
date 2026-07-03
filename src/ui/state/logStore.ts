import { create } from 'zustand';
import type { Intent } from '../../voice/types';

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

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  sub?: string;
}

interface ToastState {
  toasts: Toast[];
}

const TOAST_TTL_MS = 2800;
let nextToastId = 1;

export const useToastStore = create<ToastState>(() => ({ toasts: [] }));

export function addToast(kind: ToastKind, title: string, sub?: string): void {
  const id = nextToastId++;
  useToastStore.setState((s) => ({ toasts: [...s.toasts, { id, kind, title, sub }] }));
  setTimeout(() => {
    useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, TOAST_TTL_MS);
}
