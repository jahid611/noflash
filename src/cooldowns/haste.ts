/**
 * Formule LoL de réduction par haste :
 *   cdEffectif = base × 100 / (100 + haste)
 *
 * Vaut pour l'ability haste (ults) ET le summoner spell haste (invocs).
 * Ex : Flash 300s + 18 summoner haste (Cosmic Insight) → 300 × 100/118 ≈ 254s.
 */
export function effectiveCooldown(baseSeconds: number, haste: number): number {
  return (baseSeconds * 100) / (100 + Math.max(0, haste));
}
