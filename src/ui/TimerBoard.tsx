import { useState } from 'react';
import { useStore } from 'zustand';
import { Footprints, Pencil, Settings2, Sparkles } from 'lucide-react';
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
import { championService, manualProvider, timerEngine } from '@/ui/state/runtime';
import { useNow } from '@/ui/state/useNow';

/** En dessous de ce reliquat, le compteur passe en bleu clair ("bientôt prêt"). */
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

/** Libellé de secours quand l'icône ddragon est injoignable (offline). */
const SPELL_FALLBACK_LABEL: Record<SpellKey, string> = {
  flash: 'F',
  ult: 'R',
  teleport: 'TP',
  ignite: 'IGN',
  heal: 'HL',
  exhaust: 'EXH',
  barrier: 'BAR',
  cleanse: 'CLN',
  ghost: 'GH',
};

/** Affichage façon LoL : secondes entières sous la minute, m:ss au-dessus. */
function formatCooldown(remaining: number): string {
  return remaining >= 60 ? formatMMSS(remaining) : String(Math.ceil(remaining));
}

/**
 * Icône de sort comme en jeu : asset ddragon (summoner spell ou R du champion),
 * grisée pendant le cooldown avec balayage radial + compteur, re-colorée quand up.
 * Clic = start/reset manuel (§8).
 */
function SpellIcon({ enemy, spell, now }: { enemy: EnemyConfig; spell: SpellKey; now: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const timer = useStore(timerEngine, (s) => s.timers[timerKey(enemy.championId, spell)]);
  const remaining = timer ? remainingSeconds(timer, now) : 0;
  const running = Boolean(timer) && remaining > 0;
  const soon = running && remaining <= SOON_THRESHOLD_S;
  // Fraction écoulée : l'ombre balaie en horaire et disparaît, comme dans LoL.
  const elapsedDeg = running && timer ? Math.min(360, (1 - remaining / timer.duration) * 360) : 360;

  const url =
    spell === 'ult'
      ? (championService.getUltIconUrl(enemy.championId) ??
        championService.iconUrl(enemy.championId))
      : championService.getSummonerIconUrl(spell);

  const onClick = () => {
    if (running) resetCooldown(enemy, spell, { source: 'click' });
    else startCooldown(enemy, spell, { source: 'click' });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-popover transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            running ? 'border-border' : 'border-border hover:border-primary/70',
          )}
        >
          {imgFailed ? (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
              {SPELL_FALLBACK_LABEL[spell]}
            </span>
          ) : (
            <img
              src={url}
              alt={SPELL_LABEL[spell]}
              className={cn(
                'h-full w-full object-cover',
                running && 'brightness-[.45] grayscale',
              )}
              onError={() => setImgFailed(true)}
              draggable={false}
            />
          )}
          {running && (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `conic-gradient(transparent ${elapsedDeg}deg, hsl(225 6% 8% / 0.8) ${elapsedDeg}deg)`,
                }}
              />
              <span
                className={cn(
                  'absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]',
                  soon && 'animate-pulse text-indigo-300',
                )}
              >
                {formatCooldown(remaining)}
              </span>
              {timer?.approximate && (
                <span className="absolute right-0.5 top-0 text-[10px] leading-none text-white/60">
                  ~
                </span>
              )}
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {SPELL_LABEL[spell]} — {enemy.championName} ·{' '}
        {running ? 'clic : reset (récupéré)' : 'clic : démarrer le cooldown'}
      </TooltipContent>
    </Tooltip>
  );
}

function EnemyRow({ enemy, now }: { enemy: EnemyConfig; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const activeTimers = useStore(timerEngine, (s) => s.timers);

  // Les summoners réels de l'ennemi (lus en jeu, ou [flash] par défaut) + l'ult.
  const chips: SpellKey[] = [...enemy.summoners, 'ult'];
  // Icônes éphémères : spells démarrés à la voix mais pas suivis en permanence.
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
    <Card className="bg-card">
      <div className="flex flex-wrap items-center gap-3 p-2.5">
        <ChampionIcon
          championId={enemy.championId}
          name={enemy.championName}
          size={44}
          className="rounded-full"
        />
        <div className="min-w-[110px]">
          <p className="text-sm font-semibold leading-tight">{enemy.championName}</p>
          <div className="mt-1 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={enemy.hasIonianBoots}
                  onPressedChange={(v) => update({ hasIonianBoots: v })}
                  className="h-6 min-w-0 px-1.5 data-[state=on]:border-primary/60 data-[state=on]:bg-primary/20 data-[state=on]:text-indigo-300"
                >
                  <Footprints className="!size-3.5" />
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
                  className="h-6 min-w-0 px-1.5 data-[state=on]:border-primary/60 data-[state=on]:bg-primary/20 data-[state=on]:text-indigo-300"
                >
                  <Sparkles className="!size-3.5" />
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
            <SpellIcon key={spell} enemy={enemy} spell={spell} now={now} />
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
            <Label className="text-xs text-muted-foreground">
              2e summoner (auto en jeu)
            </Label>
            <Select
              value={enemy.summoners.find((s) => s !== 'flash') ?? 'none'}
              onValueChange={(v) =>
                update({
                  summoners: v === 'none' ? ['flash'] : ['flash', v as SummonerSpellKey],
                })
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
  const now = useNow(150);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Cooldowns ennemis
        </h2>
        <Button variant="secondary" size="sm" onClick={onEditTeam}>
          <Pencil /> Modifier l'équipe
        </Button>
      </div>
      {enemies.map((enemy) => (
        <EnemyRow key={enemy.championId} enemy={enemy} now={now} />
      ))}
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground/80">
        Voix : « ahri no flash », « zed no ult », « lucian flash up »… Clic sur une
        icône = start/reset manuel. Bottes/Cosmic = haste (défaut : worst case 0
        haste). ~ = valeur approximative.
      </p>
    </section>
  );
}
