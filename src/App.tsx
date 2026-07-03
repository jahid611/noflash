import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { BenchmarkMode } from './ui/BenchmarkMode';
import { MicStatus } from './ui/MicStatus';
import { SettingsView } from './ui/Settings';
import { TeamSetup } from './ui/TeamSetup';
import { TimerBoard } from './ui/TimerBoard';
import { Toasts } from './ui/Toasts';
import { TranscriptPanel } from './ui/TranscriptPanel';
import { startTimerJanitor } from './ui/state/actions';
import { loadChampionData, useDataStore } from './ui/state/dataStore';
import {
  hydrateRoster,
  manualProvider,
  startRosterPersistence,
} from './ui/state/runtime';

type View = 'game' | 'benchmark' | 'settings';

const TABS: Array<{ id: View; label: string }> = [
  { id: 'game', label: 'Game' },
  { id: 'benchmark', label: 'Benchmark' },
  { id: 'settings', label: 'Réglages' },
];

export default function App() {
  const [view, setView] = useState<View>('game');
  const [editingTeam, setEditingTeam] = useState(false);
  const dataStatus = useDataStore((s) => s.status);
  const enemies = useStore(manualProvider.store, (s) => s.enemies);

  useEffect(() => {
    hydrateRoster();
    startRosterPersistence();
    void loadChampionData();
    return startTimerJanitor();
  }, []);

  const showSetup = view === 'game' && (enemies.length === 0 || editingTeam);

  return (
    <div className="min-h-screen">
      <Toasts />
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <h1 className="text-lg font-black tracking-tight">
            <span className="text-amber-300">⚡ No</span>Flash
          </h1>
          <nav className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                  view === tab.id
                    ? 'bg-zinc-700 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto">
            <MicStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {dataStatus === 'loading' ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Chargement des données champions…
          </p>
        ) : view === 'game' ? (
          showSetup ? (
            <TeamSetup onDone={() => setEditingTeam(false)} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <TimerBoard onEditTeam={() => setEditingTeam(true)} />
              <TranscriptPanel />
            </div>
          )
        ) : view === 'benchmark' ? (
          <BenchmarkMode />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
