import { useEffect, useState } from 'react';

/** Horloge partagée pour les countdowns (Date.now, tick régulier). */
export function useNow(intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
