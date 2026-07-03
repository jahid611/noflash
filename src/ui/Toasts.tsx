import { useToastStore, type Toast } from './state/logStore';

const STYLES: Record<Toast['kind'], string> = {
  success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100',
  error: 'border-red-500/60 bg-red-950/90 text-red-100',
  info: 'border-zinc-600 bg-zinc-900/95 text-zinc-100',
};

/** Confirmations visuelles (§9) : gros, lisibles en jeu, jamais silencieux. */
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed left-1/2 top-14 z-50 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`w-full rounded-xl border px-4 py-2.5 text-center shadow-xl backdrop-blur ${STYLES[toast.kind]}`}
        >
          <p className="text-base font-bold leading-tight">{toast.title}</p>
          {toast.sub && <p className="mt-0.5 text-xs opacity-80">{toast.sub}</p>}
        </div>
      ))}
    </div>
  );
}
