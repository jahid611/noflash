import { useState } from 'react';
import { championService } from './state/runtime';

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
        className="flex shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300"
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
      className="shrink-0 rounded-md border border-zinc-700"
    />
  );
}
