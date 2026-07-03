import { useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SPELL_LABEL } from '@/ui/state/actions';
import { useLogStore, type LogEntry } from '@/ui/state/logStore';
import { simulateTranscript, useVoiceStore } from '@/ui/state/voiceRuntime';

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
    <li className="rounded-lg border bg-background/60 px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-muted-foreground">{time}</span>
        {typeof entry.latencyMs === 'number' && (
          <Badge variant="secondary" className="ml-auto px-1.5 py-0 font-mono text-[10px] font-normal">
            {entry.latencyMs} ms
          </Badge>
        )}
      </div>
      {entry.transcript && (
        <p className="mt-1 font-mono text-foreground/80">« {entry.transcript} »</p>
      )}
      {entry.intent && (
        <p className="mt-0.5 font-semibold text-emerald-300">
          → {entry.intent.championName} · {SPELL_LABEL[entry.intent.spell]} ·{' '}
          {entry.intent.action === 'start' ? 'cooldown lancé' : 'reset'}
        </p>
      )}
      {entry.detail && <p className="mt-0.5 text-muted-foreground">{entry.detail}</p>}
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
    <Card className="flex max-h-[75vh] flex-col bg-card/60">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-3 pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Transcript
        </CardTitle>
        <Button variant="outline" size="sm" onClick={clear} className="h-6 px-2 text-[11px]">
          Vider
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-3 pt-0">
        {(listening || partial) && (
          <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/5 px-2.5 py-1.5 text-xs">
            <span className="font-bold text-red-300">🎙️ {listening ? 'écoute…' : ''}</span>{' '}
            <span className="font-mono text-foreground/80">{partial}</span>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 pr-3">
          <ul className="space-y-1.5">
            {entries.length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">
                Active la voix puis maintiens la touche PTT en parlant.
              </li>
            )}
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </ScrollArea>

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
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder='Simuler : "ahri no flash"'
            className="h-8 min-w-0 flex-1 text-xs"
          />
          <Button type="submit" variant="outline" size="sm" className="h-8 px-2.5">
            <CornerDownLeft />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
