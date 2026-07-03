import { create } from 'zustand';
import { BrowserAudioInput } from '../../audio/BrowserAudioInput';
import { BrowserHotkey } from '../../audio/BrowserHotkey';
import { buildGrammar, normalizeWords } from '../../voice/grammar';
import { mergeNicknames } from '../../voice/nicknames';
import {
  buildParserContext,
  parseTranscript,
  type ChampionRef,
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
const RELEASE_GRACE_MS = 350;
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

// Champions couverts par la grammaire active. null = suit l'équipe ennemie
// (mode game) ; non-null = set figé (mode benchmark).
let activeChampions: ChampionRef[] | null = null;
let lastGrammarKey = '';

const NICKNAMES = mergeNicknames();

let gateOpen = false;
let pttDown = false;
let releaseAt: number | null = null;
let utteranceHadResult = false;
let graceTimer: number | null = null;
let silenceTimer: number | null = null;
let desktopWindowTimer: number | null = null;

/** Fenêtre d'écoute déclenchée au raccourci global desktop (pas de keyup possible). */
const DESKTOP_LISTEN_WINDOW_MS = 3500;

function clearPttTimers(): void {
  if (graceTimer !== null) window.clearTimeout(graceTimer);
  if (silenceTimer !== null) window.clearTimeout(silenceTimer);
  if (desktopWindowTimer !== null) window.clearTimeout(desktopWindowTimer);
  graceTimer = null;
  silenceTimer = null;
  desktopWindowTimer = null;
}

function rosterChampions(): ChampionRef[] {
  return manualProvider
    .getEnemyTeam()
    .map((e) => ({ id: e.championId, name: e.championName }));
}

/** Champions couverts par la grammaire : set benchmark figé, sinon l'équipe. */
function getActiveChampions(): ChampionRef[] {
  return activeChampions ?? rosterChampions();
}

function championsKey(champs: ChampionRef[]): string {
  return champs
    .map((c) => c.id)
    .sort()
    .join(',');
}

/**
 * Grammaire fermée RESTREINTE aux champions actifs (5 ennemis en jeu, ou le set
 * benchmark). C'est LE levier de fiabilité : vosk choisit parmi ~20 tokens au
 * lieu des ~250 de tout le roster ddragon — décisif avec un accent FR. On ne
 * garde que les nicknames des champions présents (sinon bruit inutile).
 */
function buildScopedGrammar(champs: ChampionRef[]): string[] {
  const nicknameWords = Object.entries(NICKNAMES)
    .filter(([, displayName]) => champs.some((c) => c.name === displayName))
    .flatMap(([nick]) => normalizeWords(nick));
  return buildGrammar({
    championNames: champs.map((c) => c.name),
    nicknameWords,
    // Défaut : pas de [unk] → vosk force le champion le plus proche (fin des [unk]).
    includeUnk: useSettingsStore.getState().rejectUnknown,
  });
}

function buildScopedParser(champs: ChampionRef[]): ParserContext {
  return buildParserContext(champs, NICKNAMES);
}

function onPartialResult(text: string): void {
  if (gateOpen || useSettingsStore.getState().alwaysOn) {
    useVoiceStore.setState({ partial: text });
  }
}

/** (Re)crée le recognizer avec la grammaire scoped courante. Modèle inchangé. */
function makeSession(): void {
  if (!engine) return;
  const champs = getActiveChampions();
  const grammar = buildScopedGrammar(champs);
  parserCtx = buildScopedParser(champs);
  lastGrammarKey = championsKey(champs);
  session?.dispose();
  session = engine.createSession(grammar, TARGET_SAMPLE_RATE, {
    onResult: handleFinalResult,
    onPartial: onPartialResult,
  });
  useVoiceStore.setState({ grammarSize: grammar.length });
}

/** Contexte de parsing scoped sur les champions actifs (équipe ou benchmark). */
export function getOrBuildParserContext(): ParserContext | null {
  if (parserCtx) return parserCtx;
  const champs = getActiveChampions();
  if (champs.length === 0) return null;
  parserCtx = buildScopedParser(champs);
  return parserCtx;
}

/**
 * Mode benchmark : restreint la grammaire au set d'essai puis la restaure sur
 * l'équipe (null). Reconstruit le recognizer à chaud si la voix est active.
 */
export function setBenchmarkChampions(champs: ChampionRef[] | null): void {
  activeChampions = champs;
  parserCtx = null; // forcera un rebuild scoped au prochain accès
  if (useVoiceStore.getState().phase === 'ready') makeSession();
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
    engine = await VoskEngine.load(settings.modelUrl);
    // Grammaire fermée RESTREINTE aux champions actifs (voir buildScopedGrammar).
    makeSession();

    audio = new BrowserAudioInput(TARGET_SAMPLE_RATE);
    await audio.open((chunk) => {
      // Gate PTT : le micro reste ouvert (latence), mais le recognizer ne
      // reçoit l'audio que pendant l'appui (précision).
      if (gateOpen || useSettingsStore.getState().alwaysOn) {
        session?.acceptChunk(chunk.samples, chunk.sampleRate);
      }
    });

    bindHotkey();
    const grammarSize = useVoiceStore.getState().grammarSize;
    const champCount = getActiveChampions().length;
    useVoiceStore.setState({
      phase: 'ready',
      listening: useSettingsStore.getState().alwaysOn,
    });
    addLog({
      kind: 'info',
      detail: `Voix activée — grammaire fermée de ${grammarSize} tokens (${champCount} champions)`,
    });
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

// Reconstruit la grammaire quand la COMPOSITION de l'équipe change (mode game).
// Un simple toggle de haste ne change pas la liste → pas de rebuild.
manualProvider.subscribe(() => {
  if (activeChampions !== null) return; // benchmark : grammaire figée
  if (useVoiceStore.getState().phase !== 'ready') return;
  if (championsKey(rosterChampions()) === lastGrammarKey) return;
  makeSession();
  addLog({
    kind: 'info',
    detail: `Grammaire mise à jour — ${useVoiceStore.getState().grammarSize} tokens (${rosterChampions().length} champions)`,
  });
});

// Rebind à chaud quand la touche PTT ou le mode always-on change.
useSettingsStore.subscribe((state, prev) => {
  if (useVoiceStore.getState().phase !== 'ready') return;
  if (state.pttKeyCode !== prev.pttKeyCode) bindHotkey();
  // Le rejet des sons inconnus change la grammaire → on recrée le recognizer.
  if (state.rejectUnknown !== prev.rejectUnknown) makeSession();
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

/** Ferme la gate, force la finalisation vosk et programme l'échec explicite. */
function finalizeAndScheduleSilence(): void {
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
      addLog({ kind: 'silence', detail: 'Rien capté pendant l’écoute' });
      addToast('info', 'Rien capté');
    }
  }, SILENCE_TIMEOUT_MS);
}

function onPttUp(): void {
  if (!pttDown) return;
  pttDown = false;
  releaseAt = performance.now();
  graceTimer = window.setTimeout(finalizeAndScheduleSilence, RELEASE_GRACE_MS);
}

/**
 * Raccourci global desktop : ouvre une fenêtre d'écoute bornée puis finalise.
 * Electron ne fournit pas de keyup global (donc pas de vrai maintien) — cette
 * pulsation « appuie, dis ta commande, ça se coupe seul » est le compromis.
 */
export function pulseDesktopListen(): void {
  if (useVoiceStore.getState().phase !== 'ready') return;
  if (useSettingsStore.getState().alwaysOn) return; // déjà en écoute continue
  clearPttTimers();
  gateOpen = true;
  pttDown = false;
  releaseAt = null;
  utteranceHadResult = false;
  useVoiceStore.setState({ listening: true, partial: '' });
  desktopWindowTimer = window.setTimeout(() => {
    desktopWindowTimer = null;
    releaseAt = performance.now();
    finalizeAndScheduleSilence();
  }, DESKTOP_LISTEN_WINDOW_MS);
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
