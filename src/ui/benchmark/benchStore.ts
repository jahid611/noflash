import { create } from 'zustand';
import { parseTranscript } from '../../voice/parser';
import { championService } from '../state/runtime';
import {
  getOrBuildParserContext,
  setUtteranceConsumer,
  type UtteranceMeta,
} from '../state/voiceRuntime';
import type { TrialResult } from './metrics';
import { buildTrialPlan, type TrialSpec } from './trials';

export type BenchStatus = 'idle' | 'running' | 'done';

interface BenchState {
  status: BenchStatus;
  plan: TrialSpec[];
  results: TrialResult[];
  current: number;
  lastResult: TrialResult | null;
}

export const useBenchStore = create<BenchState>(() => ({
  status: 'idle',
  plan: [],
  results: [],
  current: 0,
  lastResult: null,
}));

/** Anti double-comptage : deux finals très rapprochés = même utterance. */
const MIN_MS_BETWEEN_TRIALS = 600;
let lastRecordAt = 0;

export function startBenchmark(n: number): void {
  useBenchStore.setState({
    status: 'running',
    plan: buildTrialPlan(n),
    results: [],
    current: 0,
    lastResult: null,
  });
  lastRecordAt = 0;
  setUtteranceConsumer({
    onFinal: (transcript, meta) => recordUtterance(transcript, meta),
    onSilence: () => recordUtterance('', { latencyMs: null, source: 'voice' }),
  });
}

export function stopBenchmark(): void {
  setUtteranceConsumer(null);
  useBenchStore.setState({ status: 'idle', plan: [], results: [], current: 0, lastResult: null });
}

export function skipTrial(): void {
  recordTrial('', null, true);
}

function recordUtterance(transcript: string, meta: UtteranceMeta): void {
  const nowMs = performance.now();
  if (nowMs - lastRecordAt < MIN_MS_BETWEEN_TRIALS) return;
  lastRecordAt = nowMs;
  recordTrial(transcript, meta.latencyMs, false);
}

function recordTrial(transcript: string, latencyMs: number | null, skipped: boolean): void {
  const state = useBenchStore.getState();
  if (state.status !== 'running') return;
  const spec = state.plan[state.current];
  if (!spec) return;

  const expected = championService.findByName(spec.championName);
  const ctx = getOrBuildParserContext();
  const parsed = ctx && transcript ? parseTranscript(transcript, ctx) : null;

  const champOk =
    !!parsed && parsed.ok && !!expected && parsed.intent.championId === expected.id;
  const spellOk = !!parsed && parsed.ok && parsed.intent.spell === spec.spell;
  const intentOk = champOk && spellOk && !!parsed && parsed.ok && parsed.intent.action === 'start';

  const result: TrialResult = {
    index: state.current + 1,
    command: spec.command,
    group: spec.group,
    expectedChampionName: spec.championName,
    expectedChampionId: expected?.id ?? null,
    expectedSpell: spec.spell,
    transcript,
    captured: transcript.length > 0,
    champOk,
    spellOk,
    intentOk,
    latencyMs,
    skipped,
    at: Date.now(),
  };

  const results = [...state.results, result];
  const next = state.current + 1;
  const done = next >= state.plan.length;
  useBenchStore.setState({
    results,
    current: next,
    lastResult: result,
    status: done ? 'done' : 'running',
  });
  if (done) setUtteranceConsumer(null);
}
