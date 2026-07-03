import { useState } from 'react';
import { useStore } from 'zustand';
import { Pencil, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SpellKey, SummonerSpellKey, UltRank } from '@/cooldowns/types';
import { ultRankForLevel } from '@/cooldowns/ults';
import type { EnemyConfig } from '@/game/types';
import { formatMMSS, remainingSeconds, timerKey } from '@/timers/engine';
import { ChampionIcon } from '@/ui/ChampionIcon';
import { SPELL_LABEL, resetCooldown, startCooldown } from '@/ui/state/actions';
import { manualProvider, timerEngine } from '@/ui/state/runtime';
import { useNow } from '@/ui/state/useNow';

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          onClick={onClick}
          className={cn(
            'flex h-auto min-w-[86px] flex-col items-center px-2.5 py-1.5',
            running
              ? soon
                ? 'animate-pulse border-amber-400/60 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15 hover:text-amber-200'
                : 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:text-red-200'
              : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200',
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
            {SPELL_LABEL[spell]}
            {timer?.approximate && ' ~'}
          </span>
          <span className="font-mono text-base font-bold tabular-nums leading-tight">
            {running ? formatMMSS(remaining) : 'UP'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {running ? 'Clic : reset (récupéré)' : 'Clic : démarrer le cooldown'}
      </TooltipContent>
    </Tooltip>
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
    <Card className="bg-card/60">
      <div className="flex flex-wrap items-center gap-3 p-2.5">
        <ChampionIcon championId={enemy.championId} name={enemy.championName} size={44} />
        <div className="min-w-[100px]">
          <p className="text-sm font-bold leading-tight">{enemy.championName}</p>
          <div className="mt-1 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={enemy.hasIonianBoots}
                  onPressedChange={(v) => update({ hasIonianBoots: v })}
                  className="h-6 min-w-0 px-1.5 text-[11px] data-[state=on]:border-sky-400/60 data-[state=on]:bg-sky-400/15 data-[state=on]:text-sky-300"
                >
                  👢
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                Bottes Ioniennes de Lucidité (summoner + ability haste)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={enemy.hasCosmicInsight}
                  onPressedChange={(v) => update({ hasCosmicInsight: v })}
                  className="h-6 min-w-0 px-1.5 text-[11px] data-[state=on]:border-violet-400/60 data-[state=on]:bg-violet-400/15 data-[state=on]:text-violet-300"
                >
                  🔮
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                Cosmic Insight (summoner haste — rune, jamais auto-détectable)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cycleRank}
                  className="h-6 px-1.5 text-[11px] font-bold"
                >
                  R{enemy.ultRank}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rang de l'ult (défaut 1, ajustable)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((v) => !v)}
                  className="h-6 px-1.5"
                >
                  <Settings2 className="!size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Détails (niveau, haste manuel, 2e summoner)</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {chips.map((spell) => (
            <TimerChip key={spell} enemy={enemy} spell={spell} now={now} />
          ))}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-end gap-4 border-t px-3 py-2.5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Niveau (TP + rang d'ult inféré)
            </Label>
            <Input
              type="number"
              min={1}
              max={18}
              value={enemy.level}
              onChange={(e) => {
                const level = Number(e.target.value) || 1;
                update({ level, ultRank: ultRankForLevel(level) });
              }}
              className="h-8 w-20"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Summoner haste manuel</Label>
            <Input
              type="number"
              min={0}
              value={enemy.extraSummonerHaste}
              onChange={(e) => update({ extraSummonerHaste: Number(e.target.value) || 0 })}
              className="h-8 w-20"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ability haste manuel (ult)</Label>
            <Input
              type="number"
              min={0}
              value={enemy.extraAbilityHaste}
              onChange={(e) => update({ extraAbilityHaste: Number(e.target.value) || 0 })}
              className="h-8 w-20"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">2e summoner suivi</Label>
            <Select
              value={enemy.secondSummoner ?? 'none'}
              onValueChange={(v) =>
                update({ secondSummoner: v === 'none' ? null : (v as SummonerSpellKey) })
              }
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SECOND_SUMMONERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SPELL_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </Card>
  );
}

export function TimerBoard({ onEditTeam }: { onEditTeam: () => void }) {
  const enemies = useStore(manualProvider.store, (s) => s.enemies);
  const now = useNow(200);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Cooldowns ennemis
        </h2>
        <Button variant="outline" size="sm" onClick={onEditTeam}>
          <Pencil /> Modifier l'équipe
        </Button>
      </div>
      {enemies.map((enemy) => (
        <EnemyRow key={enemy.championId} enemy={enemy} now={now} />
      ))}
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground/70">
        Voix : « ahri no flash », « zed no ult », « lucian flash up »… Clic sur un
        chip = start/reset manuel. 👢/🔮 = haste (défaut : worst case 0 haste). ~ =
        valeur approximative.
      </p>
    </section>
  );
}
