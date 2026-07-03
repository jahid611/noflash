import type { BenchGroup, BenchSpell } from './trials';

export interface TrialResult {
  index: number;
  command: string;
  group: BenchGroup;
  expectedChampionName: string;
  expectedChampionId: string | null;
  expectedSpell: BenchSpell;
  transcript: string;
  /** Un transcript non vide a été capté. */
  captured: boolean;
  champOk: boolean;
  spellOk: boolean;
  /** Champion ET spell corrects, action = start. */
  intentOk: boolean;
  latencyMs: number | null;
  skipped: boolean;
  at: number;
}

export interface CommandBreakdown {
  command: string;
  group: BenchGroup;
  attempts: number;
  intentOk: number;
  transcripts: string[];
}

export interface BenchmarkMetrics {
  n: number;
  captured: number;
  intentOk: number;
  /** % d'essais entièrement corrects (l'objectif : ≥ 90 %). */
  recoRate: number;
  /** % de bons champions parmi les essais captés. */
  champAccuracy: number;
  /** % de bons spells parmi les essais captés. */
  spellAccuracy: number;
  avgLatencyMs: number | null;
  perCommand: CommandBreakdown[];
  perGroup: Array<{ group: BenchGroup; attempts: number; intentOk: number; rate: number }>;
}

export function computeMetrics(trials: TrialResult[]): BenchmarkMetrics {
  const n = trials.length;
  const captured = trials.filter((t) => t.captured);
  const intentOk = trials.filter((t) => t.intentOk);
  const latencies = intentOk
    .map((t) => t.latencyMs)
    .filter((v): v is number => typeof v === 'number');

  const byCommand = new Map<string, CommandBreakdown>();
  for (const t of trials) {
    let entry = byCommand.get(t.command);
    if (!entry) {
      byCommand.set(
        t.command,
        (entry = { command: t.command, group: t.group, attempts: 0, intentOk: 0, transcripts: [] }),
      );
    }
    entry.attempts += 1;
    if (t.intentOk) entry.intentOk += 1;
    if (t.transcript) entry.transcripts.push(t.transcript);
  }

  const groups: BenchGroup[] = ['short', 'apostrophe', 'nickname', 'control'];
  const perGroup = groups
    .map((group) => {
      const inGroup = trials.filter((t) => t.group === group);
      const ok = inGroup.filter((t) => t.intentOk).length;
      return {
        group,
        attempts: inGroup.length,
        intentOk: ok,
        rate: inGroup.length ? ok / inGroup.length : 0,
      };
    })
    .filter((g) => g.attempts > 0);

  return {
    n,
    captured: captured.length,
    intentOk: intentOk.length,
    recoRate: n ? intentOk.length / n : 0,
    champAccuracy: captured.length
      ? captured.filter((t) => t.champOk).length / captured.length
      : 0,
    spellAccuracy: captured.length
      ? captured.filter((t) => t.spellOk).length / captured.length
      : 0,
    avgLatencyMs: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null,
    // Les commandes qui échouent le plus d'abord.
    perCommand: [...byCommand.values()].sort(
      (a, b) => a.intentOk / a.attempts - b.intentOk / b.attempts,
    ),
    perGroup,
  };
}
