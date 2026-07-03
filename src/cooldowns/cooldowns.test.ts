import { describe, expect, it } from 'vitest';
import { computeCooldown } from './compute';
import { effectiveCooldown } from './haste';
import { teleportBaseCd } from './summoners';
import { ultRankForLevel } from './ults';

const NO_HASTE = {
  hasIonianBoots: false,
  hasCosmicInsight: false,
  extraSummonerHaste: 0,
  extraAbilityHaste: 0,
};

describe('effectiveCooldown', () => {
  it('applique la formule base × 100 / (100 + haste)', () => {
    expect(effectiveCooldown(300, 0)).toBe(300);
    // Exemple du cahier des charges : Flash 300s + 18 de Cosmic Insight ≈ 254s.
    expect(effectiveCooldown(300, 18)).toBeCloseTo(254.24, 1);
  });
});

describe('computeCooldown', () => {
  it('flash sans haste = worst case 300s', () => {
    expect(computeCooldown('flash', NO_HASTE, { level: 6 }).seconds).toBe(300);
  });

  it('flash avec bottes + cosmic cumule le summoner haste', () => {
    const { seconds } = computeCooldown(
      'flash',
      { ...NO_HASTE, hasIonianBoots: true, hasCosmicInsight: true },
      { level: 6 },
    );
    // 300 × 100 / (100 + 10 + 18)
    expect(seconds).toBeCloseTo(234.375, 2);
  });

  it("ult : base = cooldown[rank] des données champion, réduit par l'ability haste", () => {
    const ult = {
      cooldowns: [130, 105, 80],
      rank: 2 as const,
      championId: 'Ahri',
      chargeTrackingEnabled: false,
    };
    expect(computeCooldown('ult', NO_HASTE, { level: 11, ult }).seconds).toBe(105);
    const withHaste = computeCooldown('ult', { ...NO_HASTE, extraAbilityHaste: 50 }, { level: 11, ult });
    expect(withHaste.seconds).toBe(70);
  });

  it('ult sans données → fallback marqué approximatif', () => {
    const res = computeCooldown('ult', NO_HASTE, {
      level: 6,
      ult: { cooldowns: undefined, rank: 1, championId: 'Zed', chargeTrackingEnabled: false },
    });
    expect(res.approximate).toBe(true);
    expect(res.seconds).toBeGreaterThan(0);
  });

  it('flag charges : la fenêtre de recast est ajoutée pour les ults overridés', () => {
    const base = { cooldowns: [130, 105, 80], rank: 1 as const, championId: 'Ahri' };
    const off = computeCooldown('ult', NO_HASTE, {
      level: 6,
      ult: { ...base, chargeTrackingEnabled: false },
    });
    const on = computeCooldown('ult', NO_HASTE, {
      level: 6,
      ult: { ...base, chargeTrackingEnabled: true },
    });
    expect(off.seconds).toBe(130);
    expect(on.seconds).toBe(140);
    expect(on.note).toContain('recast');
  });

  it('teleport scale linéairement avec le niveau', () => {
    expect(teleportBaseCd(1)).toBe(360);
    expect(teleportBaseCd(18)).toBe(240);
  });
});

describe('ultRankForLevel', () => {
  it('infère 1/2/3 aux paliers 6/11/16', () => {
    expect(ultRankForLevel(6)).toBe(1);
    expect(ultRankForLevel(11)).toBe(2);
    expect(ultRankForLevel(16)).toBe(3);
  });
});
