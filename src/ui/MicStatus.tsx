import { useDataStore } from './state/dataStore';
import { keyCodeLabel, useSettingsStore } from './state/settingsStore';
import { disableVoice, enableVoice, useVoiceStore } from './state/voiceRuntime';

/** Cluster header : état données + contrôle voix + indicateur d'écoute. */
export function MicStatus() {
  const dataset = useDataStore((s) => s.dataset);
  const phase = useVoiceStore((s) => s.phase);
  const listening = useVoiceStore((s) => s.listening);
  const error = useVoiceStore((s) => s.error);
  const pttKeyCode = useSettingsStore((s) => s.pttKeyCode);
  const alwaysOn = useSettingsStore((s) => s.alwaysOn);

  return (
    <div className="flex items-center gap-3 text-xs">
      {dataset && (
        <span
          className="hidden rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-400 sm:block"
          title="Source des données champions"
        >
          {dataset.source === 'ddragon' ? `ddragon ${dataset.version}` : 'fallback offline'}
        </span>
      )}

      {phase === 'ready' && (
        <span
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-semibold ${
            listening
              ? 'border-red-500/60 bg-red-500/15 text-red-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-300'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              listening ? 'animate-pulse bg-red-400' : 'bg-zinc-500'
            }`}
          />
          {alwaysOn ? 'ALWAYS ON' : `PTT [${keyCodeLabel(pttKeyCode)}]`}
        </span>
      )}

      {phase === 'error' && (
        <span
          className="max-w-[200px] truncate rounded-md border border-red-500/50 bg-red-950/60 px-2 py-1 text-red-300"
          title={error}
        >
          ⚠ voix : {error}
        </span>
      )}

      <button
        onClick={() => (phase === 'ready' || phase === 'starting' ? disableVoice() : enableVoice())}
        disabled={phase === 'starting'}
        className={`rounded-md border px-3 py-1 font-semibold transition ${
          phase === 'ready'
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-zinc-400'
        } disabled:opacity-50`}
      >
        {phase === 'starting'
          ? 'Chargement…'
          : phase === 'ready'
            ? '🎙️ Voix ON'
            : '🎙️ Activer la voix'}
      </button>
    </div>
  );
}
