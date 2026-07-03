import { describe, expect, it } from 'vitest';
import { createTimerEngine, formatMMSS, remainingSeconds, timerKey } from './engine';

describe('timer engine', () => {
  it('start → remaining décroît avec le temps', () => {
    const engine = createTimerEngine();
    const t0 = 1_000_000;
    engine.getState().start({ championId: 'Ahri', spell: 'flash', duration: 300, startedAt: t0 });
    const timer = engine.getState().timers[timerKey('Ahri', 'flash')];
    expect(timer).toBeDefined();
    expect(remainingSeconds(timer, t0)).toBe(300);
    expect(remainingSeconds(timer, t0 + 60_000)).toBe(240);
    expect(remainingSeconds(timer, t0 + 400_000)).toBe(0);
  });

  it('un restart écrase le timer existant', () => {
    const engine = createTimerEngine();
    engine.getState().start({ championId: 'Zed', spell: 'ult', duration: 120, startedAt: 0 });
    engine.getState().start({ championId: 'Zed', spell: 'ult', duration: 90, startedAt: 1000 });
    expect(Object.keys(engine.getState().timers)).toHaveLength(1);
    expect(engine.getState().timers[timerKey('Zed', 'ult')].duration).toBe(90);
  });

  it('clear retire le timer et le retourne', () => {
    const engine = createTimerEngine();
    engine.getState().start({ championId: 'Ahri', spell: 'flash', duration: 300, startedAt: 0 });
    const cleared = engine.getState().clear('Ahri', 'flash');
    expect(cleared?.championId).toBe('Ahri');
    expect(engine.getState().timers).toEqual({});
    expect(engine.getState().clear('Ahri', 'flash')).toBeNull();
  });

  it('pruneExpired ne retire que les timers finis', () => {
    const engine = createTimerEngine();
    engine.getState().start({ championId: 'Ahri', spell: 'flash', duration: 10, startedAt: 0 });
    engine.getState().start({ championId: 'Zed', spell: 'ult', duration: 100, startedAt: 0 });
    const expired = engine.getState().pruneExpired(20_000);
    expect(expired.map((t) => t.championId)).toEqual(['Ahri']);
    expect(Object.keys(engine.getState().timers)).toHaveLength(1);
  });

  it('formatMMSS arrondit à la seconde supérieure', () => {
    expect(formatMMSS(300)).toBe('5:00');
    expect(formatMMSS(59.2)).toBe('1:00');
    expect(formatMMSS(0)).toBe('0:00');
    expect(formatMMSS(254.2)).toBe('4:15');
  });
});
