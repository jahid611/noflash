/**
 * Dataset fallback bundlé : permet de marcher offline / si le fetch ddragon
 * échoue. Couvre les 10 champions requis (§4) + tout le set benchmark (§10).
 *
 * ⚠️ PATCH-DEPENDENT — les cooldowns d'ult ci-dessous sont des approximations
 * à revérifier par patch. En ligne, les valeurs ddragon les remplacent.
 */
export const FALLBACK_VERSION = '14.24.1';

export interface FallbackChampion {
  id: string;
  name: string;
  /** CD de base de l'ult par rang [R1, R2, R3], en secondes. */
  ultCooldowns: [number, number, number];
}

export const FALLBACK_CHAMPIONS: FallbackChampion[] = [
  { id: 'Ahri', name: 'Ahri', ultCooldowns: [130, 105, 80] },
  { id: 'Ashe', name: 'Ashe', ultCooldowns: [100, 80, 60] },
  { id: 'Chogath', name: "Cho'Gath", ultCooldowns: [80, 70, 60] },
  { id: 'JarvanIV', name: 'Jarvan IV', ultCooldowns: [120, 105, 90] },
  { id: 'Jax', name: 'Jax', ultCooldowns: [100, 90, 80] },
  { id: 'Kaisa', name: "Kai'Sa", ultCooldowns: [130, 100, 70] },
  { id: 'Khazix', name: "Kha'Zix", ultCooldowns: [100, 85, 70] },
  { id: 'LeeSin', name: 'Lee Sin', ultCooldowns: [110, 85, 60] },
  { id: 'Lucian', name: 'Lucian', ultCooldowns: [110, 100, 90] },
  { id: 'Malphite', name: 'Malphite', ultCooldowns: [130, 105, 80] },
  { id: 'MissFortune', name: 'Miss Fortune', ultCooldowns: [120, 95, 70] },
  { id: 'Morgana', name: 'Morgana', ultCooldowns: [120, 110, 100] },
  { id: 'Orianna', name: 'Orianna', ultCooldowns: [110, 95, 80] },
  { id: 'RekSai', name: "Rek'Sai", ultCooldowns: [100, 85, 70] },
  { id: 'Sejuani', name: 'Sejuani', ultCooldowns: [120, 100, 80] },
  { id: 'Sett', name: 'Sett', ultCooldowns: [120, 100, 80] },
  { id: 'TwistedFate', name: 'Twisted Fate', ultCooldowns: [180, 150, 120] },
  { id: 'Velkoz', name: "Vel'Koz", ultCooldowns: [120, 100, 80] },
  { id: 'Vladimir', name: 'Vladimir', ultCooldowns: [120, 100, 80] },
  { id: 'Zed', name: 'Zed', ultCooldowns: [120, 90, 60] },
];
