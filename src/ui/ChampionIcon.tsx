import { useState } from 'react';
import { cn } from '@/lib/utils';
import { championService } from '@/ui/state/runtime';

/** Icône ddragon du champion, avec fallback initiales si offline / introuvable. */
export function ChampionIcon({
  championId,
  name,
  size = 40,
  className,
}: {
  championId: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-bold text-muted-foreground',
          className,
        )}
        title={name}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={championService.iconUrl(championId)}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-md border', className)}
      draggable={false}
    />
  );
}
