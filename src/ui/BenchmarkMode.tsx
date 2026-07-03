import { useEffect, useMemo } from 'react';
import { computeMetrics } from './benchmark/metrics';
import { exportCsv, exportJson } from './benchmark/exporters';
import {
  skipTrial,
  startBenchmark,
  stopBenchmark,
  useBenchStore,
} from './benchmark/benchStore';
import { keyCodeLabel, useSettingsStore } from './state/settingsStore';
import { useVoiceStore } from './state/voiceRuntime';

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accent ? 'text-amber-300' : ''}`}>
        {value}
      </p>
    </div>
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
      <section className="mx-auto max-w-xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-black">Benchmark de reconnaissance</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          L'app affiche une commande cible, tu la dis au micro (PTT{' '}
          <b>[{keyCodeLabel(settings.pttKeyCode)}]</b>). Chaque essai enregistre :
          capté ? bon champion ? bon spell ? latence (fin de parole → intent). Le
          set stresse volontairement les cas durs : noms courts, apostrophes,
          nicknames.
        </p>
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-sm font-semibold text-amber-300">
          🎯 Objectif : ≥ 90 % de reco sur ce set. En dessous, l'hypothèse voix est
          invalidée — et on le sait sans avoir codé l'overlay.
        </p>
        {voicePhase !== 'ready' && (
          <p className="text-sm text-red-300">
            ⚠ Active d'abord la voix (bouton en haut à droite). La saisie manuelle
            du panneau Transcript marche aussi pour tester le pipeline.
          </p>
        )}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Essais
            <input
              type="number"
              min={5}
              max={200}
              value={settings.benchmarkTrials}
              onChange={(e) => settings.set({ benchmarkTrials: Number(e.target.value) || 30 })}
              className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            />
          </label>
          <button
            onClick={() => startBenchmark(settings.benchmarkTrials)}
            className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-sm font-bold text-amber-300 hover:bg-amber-400/20"
          >
            Démarrer
          </button>
        </div>
      </section>
    );
  }

  if (status === 'running') {
    const spec = plan[current];
    return (
      <section className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Essai <b className="text-zinc-100">{current + 1}</b> / {plan.length}
          </span>
          <button onClick={stopBenchmark} className="text-zinc-500 underline hover:text-zinc-300">
            Abandonner
          </button>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="text-sm text-zinc-500">
            Maintiens [{keyCodeLabel(settings.pttKeyCode)}] et dis :
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight text-amber-300">
            « {spec.command} »
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {GROUP_LABEL[spec.group]} — attendu : {spec.championName} ·{' '}
            {spec.spell === 'flash' ? 'Flash' : 'Ult'}
          </p>
          <p className="mt-4 h-5 font-mono text-sm text-zinc-400">{partial}</p>
          <button
            onClick={skipTrial}
            className="mt-4 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500"
          >
            Passer (compté comme échec)
          </button>
        </div>
        {lastResult && (
          <div
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              lastResult.intentOk
                ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
                : 'border-red-500/40 bg-red-500/5 text-red-300'
            }`}
          >
            {lastResult.intentOk ? '✅' : '❌'} #{lastResult.index} « {lastResult.command} » —
            entendu : <span className="font-mono">« {lastResult.transcript || '∅' } »</span>
            {typeof lastResult.latencyMs === 'number' && ` · ${lastResult.latencyMs} ms`}
          </div>
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
          <span
            className={`rounded-lg border px-3 py-1 text-sm font-black ${
              metrics.recoRate >= 0.9
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/50 bg-red-500/10 text-red-300'
            }`}
          >
            {metrics.recoRate >= 0.9 ? '🎯 Objectif ≥ 90 % atteint' : '💀 < 90 % — hypothèse invalidée'}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {metrics && (
            <>
              <button
                onClick={() => exportJson(results, metrics)}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
              >
                Export JSON
              </button>
              <button
                onClick={() => exportCsv(results)}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
              >
                Export CSV
              </button>
            </>
          )}
          <button
            onClick={() => startBenchmark(settings.benchmarkTrials)}
            className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-400/20"
          >
            Relancer
          </button>
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
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Par groupe
              </h3>
              <ul className="space-y-1 text-sm">
                {metrics.perGroup.map((g) => (
                  <li key={g.group} className="flex justify-between">
                    <span className="text-zinc-300">{GROUP_LABEL[g.group]}</span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      {g.intentOk}/{g.attempts} · {pct(g.rate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Par commande (pires d'abord)
              </h3>
              <ul className="space-y-1 text-sm">
                {metrics.perCommand.map((c) => (
                  <li key={c.command} className="flex justify-between gap-2">
                    <span className="truncate text-zinc-300">« {c.command} »</span>
                    <span
                      className={`font-mono tabular-nums ${
                        c.intentOk === c.attempts ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {c.intentOk}/{c.attempts}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
