import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { normalizeWords } from '../voice/grammar';
import type { ChampionSummary } from '../data/types';
import { ChampionIcon } from './ChampionIcon';
import { useDataStore } from './state/dataStore';
import { manualProvider } from './state/runtime';

const EXAMPLE_TEAM = ['Ahri', 'Lucian', 'Malphite', 'Zed', "Kha'Zix"];
const MAX_TEAM = 5;

/** Sélection manuelle de l'équipe ennemie (§1) — search + icônes ddragon. */
export function TeamSetup({ onDone }: { onDone: () => void }) {
  const dataset = useDataStore((s) => s.dataset);
  const current = useStore(manualProvider.store, (s) => s.enemies);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ChampionSummary[]>(
    current.map((e) => ({ id: e.championId, name: e.championName })),
  );

  const filtered = useMemo(() => {
    if (!dataset) return [];
    const q = normalizeWords(query).join(' ');
    if (!q) return dataset.champions;
    return dataset.champions.filter((c) => normalizeWords(c.name).join(' ').includes(q));
  }, [dataset, query]);

  if (!dataset) return null;

  const toggle = (champ: ChampionSummary) => {
    setPicked((prev) => {
      if (prev.some((c) => c.id === champ.id)) return prev.filter((c) => c.id !== champ.id);
      if (prev.length >= MAX_TEAM) return prev;
      return [...prev, champ];
    });
  };

  const fillExample = () => {
    const team = EXAMPLE_TEAM.map((name) => dataset.champions.find((c) => c.name === name)).filter(
      (c): c is ChampionSummary => Boolean(c),
    );
    setPicked(team);
  };

  const confirm = () => {
    manualProvider.setTeam(picked);
    onDone();
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold">Équipe ennemie ({picked.length}/{MAX_TEAM})</h2>
        <button
          onClick={fillExample}
          className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Pré-remplir l'exemple (Ahri / Lucian / Malphite / Zed / Kha'Zix)
        </button>
        <button
          onClick={confirm}
          disabled={picked.length === 0}
          className="ml-auto rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-1.5 text-sm font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40"
        >
          Valider
        </button>
      </div>

      {picked.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {picked.map((champ) => (
            <button
              key={champ.id}
              onClick={() => toggle(champ)}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm hover:border-red-500/60"
              title="Retirer"
            >
              <ChampionIcon championId={champ.id} name={champ.name} size={22} />
              {champ.name}
              <span className="text-zinc-500">✕</span>
            </button>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un champion…"
        className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-400/60"
      />

      <div className="grid max-h-[420px] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 overflow-y-auto pr-1">
        {filtered.map((champ) => {
          const selected = picked.some((c) => c.id === champ.id);
          return (
            <button
              key={champ.id}
              onClick={() => toggle(champ)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition ${
                selected
                  ? 'border-amber-400/70 bg-amber-400/10 text-amber-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <ChampionIcon championId={champ.id} name={champ.name} size={44} />
              <span className="truncate">{champ.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
