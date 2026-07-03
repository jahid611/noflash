import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BenchmarkMode } from '@/ui/BenchmarkMode';
import { MicStatus } from '@/ui/MicStatus';
import { SettingsView } from '@/ui/Settings';
import { TeamSetup } from '@/ui/TeamSetup';
import { TimerBoard } from '@/ui/TimerBoard';
import { TranscriptPanel } from '@/ui/TranscriptPanel';
import { startTimerJanitor } from '@/ui/state/actions';
import { loadChampionData, useDataStore } from '@/ui/state/dataStore';
import { hydrateRoster, manualProvider, startRosterPersistence } from '@/ui/state/runtime';

type View = 'game' | 'benchmark' | 'settings';

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
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen">
        <Toaster position="top-center" closeButton={false} />
        <header className="sticky top-0 z-40 border-b bg-popover/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
            <h1 className="flex items-center gap-1.5 text-lg font-black tracking-tight">
              <Zap className="h-5 w-5 fill-primary text-primary" />
              NoFlash
            </h1>
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                <TabsTrigger value="game">Game</TabsTrigger>
                <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
                <TabsTrigger value="settings">Réglages</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="ml-auto">
              <MicStatus />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-4">
          {dataStatus === 'loading' ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
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
    </TooltipProvider>
  );
}
