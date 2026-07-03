/**
 * Set benchmark curé (§10) : stresse volontairement les cas durs.
 * Chaque cible est déclinée en "no flash" et "no ult".
 */
export type BenchGroup = 'short' | 'apostrophe' | 'nickname' | 'control';

export interface BenchmarkTarget {
  /** Ce que le testeur doit dire pour désigner le champion. */
  say: string;
  /** Nom d'affichage ddragon attendu. */
  championName: string;
  group: BenchGroup;
}

export const BENCHMARK_TARGETS: BenchmarkTarget[] = [
  // Noms courts (peu d'info acoustique)
  { say: 'Zed', championName: 'Zed', group: 'short' },
  { say: 'Sett', championName: 'Sett', group: 'short' },
  { say: 'Jax', championName: 'Jax', group: 'short' },
  { say: 'Ashe', championName: 'Ashe', group: 'short' },
  // Noms à apostrophe
  { say: "Kha'Zix", championName: "Kha'Zix", group: 'apostrophe' },
  { say: "Rek'Sai", championName: "Rek'Sai", group: 'apostrophe' },
  { say: "Cho'Gath", championName: "Cho'Gath", group: 'apostrophe' },
  { say: "Vel'Koz", championName: "Vel'Koz", group: 'apostrophe' },
  { say: "Kai'Sa", championName: "Kai'Sa", group: 'apostrophe' },
  // Nicknames
  { say: 'Kha', championName: "Kha'Zix", group: 'nickname' },
  { say: 'Ori', championName: 'Orianna', group: 'nickname' },
  { say: 'J4', championName: 'Jarvan IV', group: 'nickname' },
  { say: 'Sej', championName: 'Sejuani', group: 'nickname' },
  { say: 'Vlad', championName: 'Vladimir', group: 'nickname' },
  { say: 'MF', championName: 'Miss Fortune', group: 'nickname' },
  { say: 'TF', championName: 'Twisted Fate', group: 'nickname' },
  { say: 'Lee', championName: 'Lee Sin', group: 'nickname' },
  // Noms normaux (contrôle)
  { say: 'Ahri', championName: 'Ahri', group: 'control' },
  { say: 'Lucian', championName: 'Lucian', group: 'control' },
  { say: 'Malphite', championName: 'Malphite', group: 'control' },
  { say: 'Orianna', championName: 'Orianna', group: 'control' },
  { say: 'Morgana', championName: 'Morgana', group: 'control' },
];

export type BenchSpell = 'flash' | 'ult';

export interface TrialSpec extends BenchmarkTarget {
  spell: BenchSpell;
  /** Phrase cible affichée, ex "Kha no ult". */
  command: string;
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Plan de n essais : le set complet mélangé, recyclé si n dépasse sa taille. */
export function buildTrialPlan(n: number): TrialSpec[] {
  const all: TrialSpec[] = BENCHMARK_TARGETS.flatMap((target) =>
    (['flash', 'ult'] as const).map((spell) => ({
      ...target,
      spell,
      command: `${target.say} no ${spell}`,
    })),
  );
  const plan: TrialSpec[] = [];
  while (plan.length < n) {
    plan.push(...shuffled(all));
  }
  return plan.slice(0, n);
}
