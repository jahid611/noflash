import { Gamepad2, PictureInPicture2, Swords } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isElectron, toggleOverlay, useDesktopStore } from '@/ui/state/desktop';

/** Cluster desktop-only : statut de lecture de partie + toggle overlay. */
export function DesktopBar() {
  const gameConnected = useDesktopStore((s) => s.gameConnected);
  const enemyCount = useDesktopStore((s) => s.enemyCount);
  const overlay = useDesktopStore((s) => s.overlay);

  if (!isElectron) return null;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 font-semibold',
              gameConnected
                ? 'border-primary/60 bg-primary/15 text-indigo-300'
                : 'text-muted-foreground',
            )}
          >
            {gameConnected ? <Swords className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}
            {gameConnected ? `Partie · ${enemyCount} ennemis` : 'En attente de partie'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {gameConnected
            ? "Équipe ennemie lue en direct depuis la partie"
            : "Lance une partie League — l'équipe se remplira automatiquement"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={overlay ? 'default' : 'secondary'}
            size="sm"
            onClick={() => void toggleOverlay()}
          >
            <PictureInPicture2 />
            {overlay ? 'Overlay ON' : 'Overlay'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Fenêtre transparente au-dessus du jeu, clic traversant (expérimental)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
