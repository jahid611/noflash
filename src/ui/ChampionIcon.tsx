import { useState } from 'react';
import { championService } from '@/ui/state/runtime';

/** Icône carrée ddragon, avec fallback initiales si offline / icône introuvable. */
export function ChampionIcon({
  championId,
  name,
  size = 40,
}: {
  championId: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-bold text-muted-foreground"
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
      className="shrink-0 rounded-md border"
    />
  );
}
