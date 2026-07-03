import type { BenchmarkMetrics, TrialResult } from './metrics';

function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportJson(trials: TrialResult[], metrics: BenchmarkMetrics): void {
  const payload = { exportedAt: new Date().toISOString(), metrics, trials };
  downloadText(
    `noflash-benchmark-${Date.now()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportCsv(trials: TrialResult[]): void {
  const header = [
    'index',
    'command',
    'group',
    'expected_champion',
    'expected_spell',
    'transcript',
    'captured',
    'champ_ok',
    'spell_ok',
    'intent_ok',
    'latency_ms',
    'skipped',
  ];
  const rows = trials.map((t) =>
    [
      String(t.index),
      csvEscape(t.command),
      t.group,
      csvEscape(t.expectedChampionName),
      t.expectedSpell,
      csvEscape(t.transcript),
      String(t.captured),
      String(t.champOk),
      String(t.spellOk),
      String(t.intentOk),
      t.latencyMs === null ? '' : String(t.latencyMs),
      String(t.skipped),
    ].join(','),
  );
  downloadText(
    `noflash-benchmark-${Date.now()}.csv`,
    [header.join(','), ...rows].join('\n'),
    'text/csv',
  );
}
