import { describe, expect, it } from 'vitest';
import { FALLBACK_CHAMPIONS } from '../data/fallback';
import { buildParserContext, parseTranscript } from './parser';
import { NICKNAME_SEED } from './nicknames';

const ctx = buildParserContext(
  FALLBACK_CHAMPIONS.map(({ id, name }) => ({ id, name })),
  NICKNAME_SEED,
);

describe('parseTranscript', () => {
  it('parse la commande canonique "<champ> no <spell>"', () => {
    const res = parseTranscript('ahri no flash', ctx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.intent.championId).toBe('Ahri');
      expect(res.intent.spell).toBe('flash');
      expect(res.intent.action).toBe('start');
    }
  });

  it('gère les noms à apostrophe splittés par vosk', () => {
    const res = parseTranscript('kha zix no ult', ctx);
    expect(res.ok && res.intent.championId).toBe('Khazix');
  });

  it('accepte "<champ> <spell>" et "<champ> <spell> down/used"', () => {
    expect(parseTranscript('lucian flash', ctx).ok).toBe(true);
    const down = parseTranscript('zed ult down', ctx);
    expect(down.ok && down.intent.action).toBe('start');
    const used = parseTranscript('sett flash used', ctx);
    expect(used.ok && used.intent.action).toBe('start');
  });

  it('"up"/"back" produisent un reset', () => {
    const up = parseTranscript('malphite ult up', ctx);
    expect(up.ok && up.intent.action).toBe('reset');
    const back = parseTranscript('ashe flash back', ctx);
    expect(back.ok && back.intent.action).toBe('reset');
  });

  it('est robuste aux mots parasites', () => {
    const res = parseTranscript('uh the ahri no flash please', ctx);
    expect(res.ok && res.intent.championId).toBe('Ahri');
  });

  it('résout les nicknames de la seed', () => {
    expect(parseTranscript('ori no ult', ctx).ok && (parseTranscript('ori no ult', ctx) as never)).toBeTruthy();
    const kha = parseTranscript('kha no flash', ctx);
    expect(kha.ok && kha.intent.championId).toBe('Khazix');
    const j4 = parseTranscript('j4 no tp', ctx);
    expect(j4.ok && j4.intent.championId).toBe('JarvanIV');
    expect(j4.ok && j4.intent.spell).toBe('teleport');
  });

  it('matche les noms multi-mots et leurs variantes prononcées', () => {
    const full = parseTranscript('jarvan four no ult', ctx);
    expect(full.ok && full.intent.championId).toBe('JarvanIV');
    const spoken = parseTranscript('jay four no ult', ctx);
    expect(spoken.ok && spoken.intent.championId).toBe('JarvanIV');
    const single = parseTranscript('jarvan no flash', ctx);
    expect(single.ok && single.intent.championId).toBe('JarvanIV');
  });

  it('préfère le match le plus long', () => {
    const res = parseTranscript('twisted fate no ult', ctx);
    expect(res.ok && res.intent.championId).toBe('TwistedFate');
  });

  it('mappe "r" sur l\'ult', () => {
    const res = parseTranscript('zed no r', ctx);
    expect(res.ok && res.intent.spell).toBe('ult');
  });

  it('échoue explicitement : champion inconnu', () => {
    const res = parseTranscript('banana no flash', ctx);
    expect(res).toMatchObject({ ok: false, reason: 'no-champion' });
  });

  it('échoue explicitement : pas de spell', () => {
    const res = parseTranscript('ahri hello', ctx);
    expect(res).toMatchObject({ ok: false, reason: 'no-spell' });
  });

  it('échoue explicitement : transcript vide ou [unk] pur', () => {
    expect(parseTranscript('', ctx)).toMatchObject({ ok: false, reason: 'empty' });
    expect(parseTranscript('[unk] [unk]', ctx)).toMatchObject({ ok: false, reason: 'empty' });
  });
});
