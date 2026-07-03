import { useEffect, useMemo } from 'react';
import { Download, Play, RotateCcw, SkipForward } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { computeMetrics } from '@/ui/benchmark/metrics';
import { exportCsv, exportJson } from '@/ui/benchmark/exporters';
import {
  skipTrial,
  startBenchmark,
  stopBenchmark,
  useBenchStore,
} from '@/ui/benchmark/benchStore';
import { keyCodeLabel, useSettingsStore } from '@/ui/state/settingsStore';
import { useVoiceStore } from '@/ui/state/voiceRuntime';

const GROUP_LABEL: Record<string, string> = {
  short: 'Noms courts',
  apostrophe: 'Apostrophes',
  nickname: 'Nicknames',
  control: 'Contrôle',
};

function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}

function MetricTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-black tabular-nums', accent && 'text-primary')}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/** Le mode qui valide ou tue le projet (§10) : objectif ≥ 90 % sur ce set. */
export function BenchmarkMode() {
  const status = useBenchStore((s) => s.status);
  const plan = useBenchStore((s) => s.plan);
  const current = useBenchStore((s) => s.current);
  const results = useBenchStore((s) => s.results);
  const lastResult = useBenchStore((s) => s.lastResult);
  const voicePhase = useVoiceStore((s) => s.phase);
  const partial = useVoiceStore((s) => s.partial);
  const settings = useSettingsStore();

  // Sécurité : si on quitte l'onglet en plein run, on rend le flux au mode game.
  useEffect(() => () => stopBenchmark(), []);

  const metrics = useMemo(
    () => (results.length > 0 ? computeMetrics(results) : null),
    [results],
  );

  if (status === 'idle') {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg font-black">Benchmark de reconnaissance</CardTitle>
          <CardDescription className="leading-relaxed">
            L'app affiche une commande cible, tu la dis au micro (PTT{' '}
            <b>[{keyCodeLabel(settings.pttKeyCode)}]</b>). Chaque essai enregistre :
            capté ? bon champion ? bon spell ? latence (fin de parole → intent). Le
            set stresse volontairement les cas durs : noms courts, apostrophes,
            nicknames.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">
            Objectif : ≥ 90 % de reco sur ce set. En dessous, l'hypothèse voix est
            invalidée — et on le sait sans avoir codé l'overlay.
          </p>
          {voicePhase !== 'ready' && (
            <p className="text-sm text-indigo-300">
              Active d'abord la voix (bouton en haut à droite). La saisie manuelle
              du panneau Transcript marche aussi pour tester le pipeline.
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trials" className="text-sm text-muted-foreground">
                Essais
              </Label>
              <Input
                id="trials"
                type="number"
                min={5}
                max={200}
                value={settings.benchmarkTrials}
                onChange={(e) => settings.set({ benchmarkTrials: Number(e.target.value) || 30 })}
                className="w-24"
              />
            </div>
            <Button onClick={() => startBenchmark(settings.benchmarkTrials)}>
              <Play /> Démarrer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'running') {
    const spec = plan[current];
    return (
      <section className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Essai <b className="text-foreground">{current + 1}</b> / {plan.length}
          </span>
          <Button variant="link" size="sm" onClick={stopBenchmark} className="text-muted-foreground">
            Abandonner
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Maintiens [{keyCodeLabel(settings.pttKeyCode)}] et dis :
            </p>
            <p className="mt-3 text-4xl font-black tracking-tight text-primary">
              « {spec.command} »
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {GROUP_LABEL[spec.group]} — attendu : {spec.championName} ·{' '}
              {spec.spell === 'flash' ? 'Flash' : 'Ult'}
            </p>
            <p className="mt-4 h-5 font-mono text-sm text-muted-foreground">{partial}</p>
            <Button variant="outline" size="sm" onClick={skipTrial} className="mt-4">
              <SkipForward /> Passer (compté comme échec)
            </Button>
          </CardContent>
        </Card>
        {lastResult && (
          <Card
            className={cn(
              lastResult.intentOk
                ? 'border-primary/50 bg-primary/10'
                : 'border-border bg-muted/40',
            )}
          >
            <CardContent
              className={cn(
                'px-4 py-2.5 text-sm',
                lastResult.intentOk ? 'text-indigo-200' : 'text-muted-foreground',
              )}
            >
              {lastResult.intentOk ? '✓' : '✗'} #{lastResult.index} « {lastResult.command} » —
              entendu : <span className="font-mono">« {lastResult.transcript || '∅'} »</span>
              {typeof lastResult.latencyMs === 'number' && ` · ${lastResult.latencyMs} ms`}
            </CardContent>
          </Card>
        )}
      </section>
    );
  }

  // status === 'done'
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-black">Résultats — {metrics?.n} essais</h2>
        {metrics && (
          <Badge
            variant="outline"
            className={cn(
              'px-3 py-1 text-sm font-black',
              metrics.recoRate >= 0.9
                ? 'border-primary/60 bg-primary/15 text-indigo-300'
                : 'border-border bg-muted text-muted-foreground',
            )}
          >
            {metrics.recoRate >= 0.9
              ? 'Objectif ≥ 90 % atteint'
              : '< 90 % — hypothèse invalidée'}
          </Badge>
        )}
        <div className="ml-auto flex gap-2">
          {metrics && (
            <>
              <Button variant="outline" size="sm" onClick={() => exportJson(results, metrics)}>
                <Download /> JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCsv(results)}>
                <Download /> CSV
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => startBenchmark(settings.benchmarkTrials)}>
            <RotateCcw /> Relancer
          </Button>
        </div>
      </div>

      {metrics && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricTile label="Taux de reco" value={pct(metrics.recoRate)} accent />
            <MetricTile label="Précision champion" value={pct(metrics.champAccuracy)} />
            <MetricTile label="Précision spell" value={pct(metrics.spellAccuracy)} />
            <MetricTile
              label="Latence moyenne"
              value={metrics.avgLatencyMs === null ? '—' : `${metrics.avgLatencyMs} ms`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="bg-card/60">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Par groupe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Groupe</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.perGroup.map((g) => (
                      <TableRow key={g.group}>
                        <TableCell>{GROUP_LABEL[g.group]}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {g.intentOk}/{g.attempts} · {pct(g.rate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="bg-card/60">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Par commande (pires d'abord)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ScrollArea className="h-64 pr-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commande</TableHead>
                        <TableHead className="text-right">OK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.perCommand.map((c) => (
                        <TableRow key={c.command}>
                          <TableCell className="truncate">« {c.command} »</TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-mono tabular-nums',
                              c.intentOk === c.attempts ? 'text-indigo-300' : 'text-muted-foreground',
                            )}
                          >
                            {c.intentOk}/{c.attempts}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
