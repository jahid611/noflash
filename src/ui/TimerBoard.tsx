import { useState } from 'react';
import { useStore } from 'zustand';
import type { SpellKey, SummonerSpellKey, UltRank } from '../cooldowns/types';
import { ultRankForLevel } from '../cooldowns/ults';
import type { EnemyConfig } from '../game/types';
import { formatMMSS, remainingSeconds, timerKey } from '../timers/engine';
import { ChampionIcon } from './ChampionIcon';
import { SPELL_LABEL, resetCooldown, startCooldown } from './state/actions';
import { manualProvider, timerEngine } from './state/runtime';
import { useNow } from './state/useNow';

/** En dessous de ce reliquat, le timer passe "bientôt prêt" (jaune). */
const SOON_THRESHOLD_S = 15;

const SECOND_SUMMONERS: SummonerSpellKey[] = [
  'teleport',
  'ignite',
  'heal',
  'exhaust',
  'barrier',
  'cleanse',
  'ghost',
];

function TimerChip({ enemy, spell, now }: { enemy: EnemyConfig; spell: SpellKey; now: number }) {
  const timer = useStore(timerEngine, (s) => s.timers[timerKey(enemy.championId, spell)]);
  const remaining = timer ? remainingSeconds(timer, now) : 0;
  const running = Boolean(timer) && remaining > 0;
  const soon = running && remaining <= SOON_THRESHOLD_S;

  const onClick = () => {
    // Fallback manuel au clic (§8) : start si prêt, reset si en cours.
    if (running) resetCooldown(enemy, spell, { source: 'click' });
    else startCooldown(enemy, spell, { source: 'click' });
  };

  const style = running
    ? soon
      ? 'border-amber-400/60 bg-amber-400/10 text-amber-300 animate-pulse'
      : 'border-red-500/50 bg-red-500/10 text-red-300'
    : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15';

  return (
    <button
      onClick={onClick}
      title={running ? 'Clic : reset (récupéré)' : 'Clic : démarrer le cooldown'}
      className={`flex min-w-[86px] flex-col items-center rounded-lg border px-2.5 py-1.5 transition ${style}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
        {SPELL_LABEL[spell]}
        {timer?.approximate && ' ~'}
      </span>
      <span className="font-mono text-base font-bold tabular-nums leading-tight">
        {running ? formatMMSS(remaining) : 'UP'}
      </span>
    </button>
  );
}

function EnemyRow({ enemy, now }: { enemy: EnemyConfig; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const activeTimers = useStore(timerEngine, (s) => s.timers);

  const chips: SpellKey[] = ['flash'];
  if (enemy.secondSummoner) chips.push(enemy.secondSummoner);
  chips.push('ult');
  // Chips éphémères : spells démarrés à la voix mais pas suivis en permanence.
  for (const timer of Object.values(activeTimers)) {
    if (timer.championId === enemy.championId && !chips.includes(timer.spell)) {
      chips.push(timer.spell);
    }
  }

  const update = (patch: Partial<Omit<EnemyConfig, 'championId'>>) =>
    manualProvider.updateEnemy(enemy.championId, patch);

  const cycleRank = () =>
    update({ ultRank: (enemy.ultRank === 3 ? 1 : enemy.ultRank + 1) as UltRank });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-3 p-2.5">
        <ChampionIcon championId={enemy.championId} name={enemy.championName} size={44} />
        <div className="min-w-[90px]">
          <p className="text-sm font-bold leading-tight">{enemy.championName}</p>
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => update({ hasIonianBoots: !enemy.hasIonianBoots })}
              title="Bottes Ioniennes de Lucidité (summoner + ability haste)"
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                enemy.hasIonianBoots
                  ? 'border-sky-400/60 bg-sky-400/15 text-sky-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              👢
            </button>
            <button
              onClick={() => update({ hasCosmicInsight: !enemy.hasCosmicInsight })}
              title="Cosmic Insight (summoner haste — rune, jamais auto-détectable)"
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                enemy.hasCosmicInsight
                  ? 'border-violet-400/60 bg-violet-400/15 text-violet-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              🔮
            </button>
            <button
              onClick={cycleRank}
              title="Rang de l'ult (défaut 1, ajustable)"
              className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 hover:border-zinc-500"
            >
              R{enemy.ultRank}
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              title="Détails (niveau, haste manuel, 2e summoner)"
              className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500"
            >
              ⚙
            </button>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {chips.map((spell) => (
            <TimerChip key={spell} enemy={enemy} spell={spell} now={now} />
          ))}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-end gap-4 border-t border-zinc-800 px-3 py-2 text-xs">
          <label className="flex flex-col gap-1 text-zinc-400">
            Niveau (TP + rang d'ult inféré)
            <input
              type="number"
              min={1}
              max={18}
              value={enemy.level}
              onChange={(e) => {
                const level = Number(e.target.value) || 1;
                update({ level, ultRank: ultRankForLevel(level) });
              }}
              className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Summoner haste manuel
            <input
              type="number"
              min={0}
              value={enemy.extraSummonerHaste}
              onChange={(e) => update({ extraSummonerHaste: Number(e.target.value) || 0 })}
              className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Ability haste manuel (ult)
            <input
              type="number"
              min={0}
              value={enemy.extraAbilityHaste}
              onChange={(e) => update({ extraAbilityHaste: Number(e.target.value) || 0 })}
              className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            2e summoner suivi
            <select
              value={enemy.secondSummoner ?? ''}
              onChange={(e) =>
                update({ secondSummoner: (e.target.value || null) as SummonerSpellKey | null })
              }
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            >
              <option value="">—</option>
              {SECOND_SUMMONERS.map((s) => (
                <option key={s} value={s}>
                  {SPELL_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export function TimerBoard({ onEditTeam }: { onEditTeam: () => void }) {
  const enemies = useStore(manualProvider.store, (s) => s.enemies);
  const now = useNow(200);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Cooldowns ennemis
        </h2>
        <button
          onClick={onEditTeam}
          className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Modifier l'équipe
        </button>
      </div>
      {enemies.map((enemy) => (
        <EnemyRow key={enemy.championId} enemy={enemy} now={now} />
      ))}
      <p className="pt-1 text-[11px] leading-relaxed text-zinc-600">
        Voix : « ahri no flash », « zed no ult », « lucian flash up »… Clic sur un
        chip = start/reset manuel. 👢/🔮 = haste (défaut : worst case 0 haste). ~ =
        valeur approximative.
      </p>
    </section>
  );
}
