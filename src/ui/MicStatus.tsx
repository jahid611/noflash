import { Loader2, Mic, MicOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useDataStore } from '@/ui/state/dataStore';
import { keyCodeLabel, useSettingsStore } from '@/ui/state/settingsStore';
import { disableVoice, enableVoice, useVoiceStore } from '@/ui/state/voiceRuntime';

/** Cluster header : état données + contrôle voix + indicateur d'écoute. */
export function MicStatus() {
  const dataset = useDataStore((s) => s.dataset);
  const phase = useVoiceStore((s) => s.phase);
  const listening = useVoiceStore((s) => s.listening);
  const error = useVoiceStore((s) => s.error);
  const pttKeyCode = useSettingsStore((s) => s.pttKeyCode);
  const alwaysOn = useSettingsStore((s) => s.alwaysOn);

  return (
    <div className="flex items-center gap-2">
      {dataset && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden sm:inline-flex">
              <Badge variant="secondary" className="font-normal text-muted-foreground">
                {dataset.source === 'ddragon' ? `ddragon ${dataset.version}` : 'fallback offline'}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent>Source des données champions</TooltipContent>
        </Tooltip>
      )}

      {phase === 'ready' && (
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5 font-semibold',
            listening
              ? 'border-red-500/60 bg-red-500/15 text-red-300'
              : 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              listening ? 'animate-pulse bg-red-400' : 'bg-zinc-500',
            )}
          />
          {alwaysOn ? 'ALWAYS ON' : `PTT [${keyCodeLabel(pttKeyCode)}]`}
        </Badge>
      )}

      {phase === 'error' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Badge variant="destructive" className="max-w-[200px]">
                <span className="truncate">⚠ voix : {error}</span>
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[320px]">{error}</TooltipContent>
        </Tooltip>
      )}

      <Button
        size="sm"
        variant={phase === 'ready' ? 'secondary' : 'default'}
        disabled={phase === 'starting'}
        onClick={() => (phase === 'ready' || phase === 'starting' ? disableVoice() : enableVoice())}
      >
        {phase === 'starting' ? (
          <>
            <Loader2 className="animate-spin" /> Chargement…
          </>
        ) : phase === 'ready' ? (
          <>
            <MicOff /> Couper la voix
          </>
        ) : (
          <>
            <Mic /> Activer la voix
          </>
        )}
      </Button>
    </div>
  );
}
