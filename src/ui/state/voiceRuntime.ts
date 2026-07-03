import { create } from 'zustand';
import { BrowserAudioInput } from '../../audio/BrowserAudioInput';
import { BrowserHotkey } from '../../audio/BrowserHotkey';
import { buildGrammar } from '../../voice/grammar';
import { NICKNAME_SEED, mergeNicknames } from '../../voice/nicknames';
import {
  buildParserContext,
  parseTranscript,
  type ParserContext,
} from '../../voice/parser';
import { VoskEngine, type VoskRecognizerSession } from '../../voice/voskEngine';
import { resetCooldown, startCooldown } from './actions';
import { addLog, addToast } from './logStore';
import { manualProvider } from './runtime';
import { useDataStore } from './dataStore';
import { useSettingsStore } from './settingsStore';

const TARGET_SAMPLE_RATE = 16000;
/** Après le relâchement du PTT, on continue d'écouter un court instant pour attraper la fin du mot. */
const RELEASE_GRACE_MS = 250;
/** Si aucun résultat n'arrive après le flush, on déclare "rien capté". */
const SILENCE_TIMEOUT_MS = 1400;

export type VoicePhase = 'off' | 'starting' | 'ready' | 'error';

interface VoiceUiState {
  phase: VoicePhase;
  error?: string;
  /** true quand l'audio est forwardé au recognizer (PTT tenu ou always-on). */
  listening: boolean;
  partial: string;
  grammarSize: number;
}

export const useVoiceStore = create<VoiceUiState>(() => ({
  phase: 'off',
  listening: false,
  partial: '',
  grammarSize: 0,
}));

export interface UtteranceMeta {
  /** Latence fin de parole (relâchement PTT) → intent. null si non mesurable (always-on, saisie manuelle). */
  latencyMs: number | null;
  source: 'voice' | 'manual';
}

/** Le mode Benchmark détourne le flux d'utterances en s'enregistrant ici. */
export interface UtteranceConsumer {
  onFinal(transcript: string, meta: UtteranceMeta): void;
  onSilence?(): void;
}

let engine: VoskEngine | null = null;
let session: VoskRecognizerSession | null = null;
let audio: BrowserAudioInput | null = null;
let hotkey: BrowserHotkey | null = null;
let parserCtx: ParserContext | null = null;
let consumer: UtteranceConsumer | null = null;

let gateOpen = false;
let pttDown = false;
let releaseAt: number | null = null;
let utteranceHadResult = false;
let graceTimer: number | null = null;
let silenceTimer: number | null = null;

function clearPttTimers(): void {
  if (graceTimer !== null) window.clearTimeout(graceTimer);
  if (silenceTimer !== null) window.clearTimeout(silenceTimer);
  graceTimer = null;
  silenceTimer = null;
}

/** Contexte de parsing construit sur TOUT le dataset (roster + benchmark). */
export function getOrBuildParserContext(): ParserContext | null {
  if (parserCtx) return parserCtx;
  const dataset = useDataStore.getState().dataset;
  if (!dataset) return null;
  parserCtx = buildParserContext(dataset.champions, mergeNicknames());
  return parserCtx;
}

export async function enableVoice(): Promise<void> {
  const phase = useVoiceStore.getState().phase;
  if (phase === 'starting' || phase === 'ready') return;
  const dataset = useDataStore.getState().dataset;
  if (!dataset) {
    addToast('error', 'Données champions pas encore chargées, réessaie dans une seconde');
    return;
  }
  useVoiceStore.setState({ phase: 'starting', error: undefined });
  try {
    const settings = useSettingsStore.getState();
    // Grammaire fermée : mots de tous les noms de champions + nicknames + keywords.
    const grammar = buildGrammar({
      championNames: dataset.champions.map((c) => c.name),
      nicknameWords: Object.keys(NICKNAME_SEED),
    });
    parserCtx = buildParserContext(dataset.champions, mergeNicknames());

    engine = await VoskEngine.load(settings.modelUrl);
    session = engine.createSession(grammar, TARGET_SAMPLE_RATE, {
      onResult: handleFinalResult,
      onPartial: (text) => {
        if (gateOpen || useSettingsStore.getState().alwaysOn) {
          useVoiceStore.setState({ partial: text });
        }
      },
    });

    audio = new BrowserAudioInput(TARGET_SAMPLE_RATE);
    await audio.open((chunk) => {
      // Gate PTT : le micro reste ouvert (latence), mais le recognizer ne
      // reçoit l'audio que pendant l'appui (précision).
      if (gateOpen || useSettingsStore.getState().alwaysOn) {
        session?.acceptChunk(chunk.samples, chunk.sampleRate);
      }
    });

    bindHotkey();
    useVoiceStore.setState({
      phase: 'ready',
      grammarSize: grammar.length,
      listening: useSettingsStore.getState().alwaysOn,
    });
    addLog({ kind: 'info', detail: `Voix activée — grammaire fermée de ${grammar.length} tokens` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await teardown();
    useVoiceStore.setState({ phase: 'error', error: message, listening: false, partial: '' });
    addLog({
      kind: 'error',
      detail: `Activation voix impossible : ${message}. Modèle présent dans public/model/ ? (voir README)`,
    });
    addToast('error', 'Activation voix impossible', message);
  }
}

export async function disableVoice(): Promise<void> {
  await teardown();
  useVoiceStore.setState({ phase: 'off', listening: false, partial: '' });
  addLog({ kind: 'info', detail: 'Voix désactivée' });
}

async function teardown(): Promise<void> {
  clearPttTimers();
  hotkey?.unbind();
  hotkey = null;
  session?.dispose();
  session = null;
  if (audio) {
    await audio.close().catch(() => undefined);
    audio = null;
  }
  engine?.terminate();
  engine = null;
  gateOpen = false;
  pttDown = false;
  releaseAt = null;
}

function bindHotkey(): void {
  hotkey?.unbind();
  hotkey = new BrowserHotkey();
  hotkey.bind(useSettingsStore.getState().pttKeyCode, {
    onDown: onPttDown,
    onUp: onPttUp,
  });
}

// Rebind à chaud quand la touche PTT ou le mode always-on change.
useSettingsStore.subscribe((state, prev) => {
  if (useVoiceStore.getState().phase !== 'ready') return;
  if (state.pttKeyCode !== prev.pttKeyCode) bindHotkey();
  if (state.alwaysOn !== prev.alwaysOn) {
    clearPttTimers();
    gateOpen = false;
    pttDown = false;
    releaseAt = null;
    useVoiceStore.setState({ listening: state.alwaysOn, partial: '' });
  }
});

function onPttDown(): void {
  if (useVoiceStore.getState().phase !== 'ready') return;
  if (useSettingsStore.getState().alwaysOn) return;
  clearPttTimers();
  gateOpen = true;
  pttDown = true;
  releaseAt = null;
  utteranceHadResult = false;
  useVoiceStore.setState({ listening: true, partial: '' });
}

function onPttUp(): void {
  if (!pttDown) return;
  pttDown = false;
  releaseAt = performance.now();
  graceTimer = window.setTimeout(() => {
    gateOpen = false;
    session?.flush();
    useVoiceStore.setState({ listening: false });
    silenceTimer = window.setTimeout(() => {
      if (utteranceHadResult) return;
      useVoiceStore.setState({ partial: '' });
      if (consumer?.onSilence) {
        consumer.onSilence();
      } else {
        // Échec explicite, jamais silencieux (§9).
        addLog({ kind: 'silence', detail: 'Rien capté pendant l’appui' });
        addToast('info', 'Rien capté');
      }
    }, SILENCE_TIMEOUT_MS);
  }, RELEASE_GRACE_MS);
}

function handleFinalResult(rawText: string): void {
  const text = rawText.replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return; // le timer de silence gèrera le cas "PTT sans parole"
  utteranceHadResult = true;
  // Latence "fin de parole → intent" : mesurée depuis le relâchement du PTT.
  // Si vosk a finalisé avant le relâchement, l'intent était prête → 0 ms.
  const latencyMs =
    releaseAt !== null
      ? Math.max(0, Math.round(performance.now() - releaseAt))
      : pttDown
        ? 0
        : null;
  useVoiceStore.setState({ partial: '' });
  dispatchTranscript(text, { latencyMs, source: 'voice' });
}

export function dispatchTranscript(transcript: string, meta: UtteranceMeta): void {
  if (consumer) {
    consumer.onFinal(transcript, meta);
    return;
  }
  handleGameTranscript(transcript, meta);
}

/** Entrée texte manuelle (debug sans micro/modèle) — même pipeline de parsing. */
export function simulateTranscript(transcript: string): void {
  dispatchTranscript(transcript, { latencyMs: null, source: 'manual' });
}

export function setUtteranceConsumer(next: UtteranceConsumer | null): void {
  consumer = next;
}

function handleGameTranscript(transcript: string, meta: UtteranceMeta): void {
  const ctx = getOrBuildParserContext();
  if (!ctx) return;
  const result = parseTranscript(transcript, ctx);

  if (!result.ok) {
    // Échec explicite (§9) : du son a été capté mais rien ne matche.
    addLog({
      kind: 'unrecognized',
      transcript,
      latencyMs: meta.latencyMs,
      detail:
        result.reason === 'no-spell'
          ? 'champion détecté mais aucun spell reconnu'
          : 'aucun champion reconnu',
    });
    addToast('error', `Non reconnu : « ${transcript} »`);
    return;
  }

  const { intent } = result;
  const enemy = manualProvider.findEnemy(intent.championId);
  if (!enemy) {
    addLog({
      kind: 'unrecognized',
      transcript,
      intent,
      latencyMs: meta.latencyMs,
      detail: `${intent.championName} n'est pas dans l'équipe suivie`,
    });
    addToast('error', `${intent.championName} n'est pas dans l'équipe ennemie`);
    return;
  }

  addLog({ kind: 'intent', transcript, intent, latencyMs: meta.latencyMs });
  if (intent.action === 'start') startCooldown(enemy, intent.spell, { source: meta.source });
  else resetCooldown(enemy, intent.spell, { source: meta.source });
}
