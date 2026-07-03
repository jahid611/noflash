import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { normalizeWords } from '@/voice/grammar';
import type { ChampionSummary } from '@/data/types';
import { ChampionIcon } from '@/ui/ChampionIcon';
import { useDataStore } from '@/ui/state/dataStore';
import { manualProvider } from '@/ui/state/runtime';

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <CardTitle>
              Équipe ennemie ({picked.length}/{MAX_TEAM})
            </CardTitle>
            <CardDescription className="mt-1">
              Les 5 champions dont tu veux suivre les cooldowns à la voix.
            </CardDescription>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={fillExample}>
              Pré-remplir l'exemple
            </Button>
            <Button size="sm" onClick={confirm} disabled={picked.length === 0}>
              Valider
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {picked.map((champ) => (
              <Badge
                key={champ.id}
                variant="secondary"
                className="cursor-pointer gap-1.5 py-1 pl-1 pr-2 hover:bg-destructive/40"
                onClick={() => toggle(champ)}
              >
                <ChampionIcon championId={champ.id} name={champ.name} size={20} />
                {champ.name}
                <X className="h-3 w-3 opacity-60" />
              </Badge>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un champion…"
            className="pl-8"
          />
        </div>

        <ScrollArea className="h-[420px] pr-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {filtered.map((champ) => {
              const selected = picked.some((c) => c.id === champ.id);
              return (
                <Button
                  key={champ.id}
                  variant="outline"
                  onClick={() => toggle(champ)}
                  className={cn(
                    'flex h-auto flex-col items-center gap-1 p-2 text-xs',
                    selected && 'border-primary/70 bg-primary/10 text-primary hover:bg-primary/15',
                  )}
                >
                  <ChampionIcon championId={champ.id} name={champ.name} size={44} />
                  <span className="w-full truncate text-center">{champ.name}</span>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
