import { useState } from 'react';
import { SPELL_LABEL } from './state/actions';
import { useLogStore, type LogEntry } from './state/logStore';
import { simulateTranscript, useVoiceStore } from './state/voiceRuntime';

function EntryRow({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.at).toLocaleTimeString('fr-FR', { hour12: false });

  const icon =
    entry.kind === 'intent'
      ? '✅'
      : entry.kind === 'unrecognized'
        ? '❓'
        : entry.kind === 'silence'
          ? '🔇'
          : entry.kind === 'error'
            ? '❌'
            : 'ℹ️';

  return (
    <li className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-zinc-500">{time}</span>
        {typeof entry.latencyMs === 'number' && (
          <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {entry.latencyMs} ms
          </span>
        )}
      </div>
      {entry.transcript && (
        <p className="mt-1 font-mono text-zinc-300">« {entry.transcript} »</p>
      )}
      {entry.intent && (
        <p className="mt-0.5 font-semibold text-emerald-300">
          → {entry.intent.championName} · {SPELL_LABEL[entry.intent.spell]} ·{' '}
          {entry.intent.action === 'start' ? 'cooldown lancé' : 'reset'}
        </p>
      )}
      {entry.detail && <p className="mt-0.5 text-zinc-500">{entry.detail}</p>}
    </li>
  );
}

/** Flux live : entendu + intent + latence (§8) — essentiel pour debug et benchmark. */
export function TranscriptPanel() {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const partial = useVoiceStore((s) => s.partial);
  const listening = useVoiceStore((s) => s.listening);
  const [manual, setManual] = useState('');

  return (
    <aside className="flex max-h-[75vh] flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Transcript</h2>
        <button
          onClick={clear}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-500"
        >
          Vider
        </button>
      </div>

      {(listening || partial) && (
        <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/5 px-2.5 py-1.5 text-xs">
          <span className="font-bold text-red-300">🎙️ {listening ? 'écoute…' : ''}</span>{' '}
          <span className="font-mono text-zinc-300">{partial}</span>
        </div>
      )}

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <li className="py-6 text-center text-xs text-zinc-600">
            Active la voix puis maintiens la touche PTT en parlant.
          </li>
        )}
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = manual.trim();
          if (!text) return;
          simulateTranscript(text);
          setManual('');
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder='Simuler : "ahri no flash"'
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400/60"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
        >
          ↵
        </button>
      </form>
    </aside>
  );
}
