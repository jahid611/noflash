import { computeCooldown } from '../../cooldowns/compute';
import type { SpellKey } from '../../cooldowns/types';
import type { EnemyConfig } from '../../game/types';
import { formatMMSS } from '../../timers/engine';
import { addToast } from './logStore';
import { championService, manualProvider, timerEngine, tts } from './runtime';
import { useSettingsStore } from './settingsStore';

export const SPELL_LABEL: Record<SpellKey, string> = {
  flash: 'Flash',
  ult: 'R',
  teleport: 'TP',
  ignite: 'Ignite',
  heal: 'Heal',
  exhaust: 'Exhaust',
  barrier: 'Barrier',
  cleanse: 'Cleanse',
  ghost: 'Ghost',
};

/** Mot prononcé par le TTS pour chaque spell. */
const SPELL_TTS: Record<SpellKey, string> = {
  flash: 'flash',
  ult: 'ult',
  teleport: 'teleport',
  ignite: 'ignite',
  heal: 'heal',
  exhaust: 'exhaust',
  barrier: 'barrier',
  cleanse: 'cleanse',
  ghost: 'ghost',
};

interface ActionMeta {
  source: 'voice' | 'click' | 'manual';
}

/** "<champ> no <spell>" : l'ennemi a utilisé son spell → départ du cooldown. */
export function startCooldown(enemy: EnemyConfig, spell: SpellKey, meta: ActionMeta): void {
  const settings = useSettingsStore.getState();
  const computed = computeCooldown(spell, enemy, {
    level: enemy.level,
    ult:
      spell === 'ult'
        ? {
            cooldowns: championService.getCachedUltCooldowns(enemy.championId),
            rank: enemy.ultRank,
            championId: enemy.championId,
            chargeTrackingEnabled: settings.chargeTracking,
          }
        : undefined,
  });
  timerEngine.getState().start({
    championId: enemy.championId,
    spell,
    duration: computed.seconds,
    startedAt: Date.now(),
    approximate: computed.approximate,
  });
  addToast(
    'success',
    `${SPELL_LABEL[spell]} — ${enemy.championName} ${formatMMSS(computed.seconds)}`,
    computed.note ?? (computed.approximate ? 'valeur approximative' : undefined),
  );
  if (settings.ttsEnabled && meta.source !== 'click') {
    tts.speak(`${SPELL_TTS[spell]} ${enemy.championName}`, settings.ttsLang);
  }
}

/** "<champ> <spell> up/back" : le spell est de nouveau disponible → reset. */
export function resetCooldown(enemy: EnemyConfig, spell: SpellKey, meta: ActionMeta): void {
  const settings = useSettingsStore.getState();
  timerEngine.getState().clear(enemy.championId, spell);
  addToast('info', `${SPELL_LABEL[spell]} — ${enemy.championName} up`);
  if (settings.ttsEnabled && meta.source !== 'click') {
    tts.speak(`${SPELL_TTS[spell]} ${enemy.championName} up`, settings.ttsLang);
  }
}

/**
 * Janitor : retire les timers expirés et annonce le retour du spell —
 * savoir quand le flash ennemi revient est tout l'intérêt de l'outil.
 */
export function startTimerJanitor(): () => void {
  const id = window.setInterval(() => {
    const expired = timerEngine.getState().pruneExpired(Date.now());
    if (expired.length === 0) return;
    const settings = useSettingsStore.getState();
    for (const timer of expired) {
      const enemy = manualProvider.findEnemy(timer.championId);
      const name = enemy?.championName ?? timer.championId;
      addToast('info', `${SPELL_LABEL[timer.spell]} — ${name} de nouveau up`);
      if (settings.ttsEnabled) {
        tts.speak(`${SPELL_TTS[timer.spell]} ${name} up`, settings.ttsLang);
      }
    }
  }, 500);
  return () => window.clearInterval(id);
}
