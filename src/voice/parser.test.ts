import { describe, expect, it } from 'vitest';
import { FALLBACK_CHAMPIONS } from '../data/fallback';
import { buildParserContext, parseTranscript, phoneticKey } from './parser';
import { NICKNAME_SEED, mergeNicknames } from './nicknames';

const ctx = buildParserContext(
  FALLBACK_CHAMPIONS.map(({ id, name }) => ({ id, name })),
  NICKNAME_SEED,
);

// Contexte complet (alias FR inclus) — comme en jeu.
const ctxFr = buildParserContext(
  FALLBACK_CHAMPIONS.map(({ id, name }) => ({ id, name })),
  mergeNicknames(),
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

describe('parseTranscript — moteur phonétique (comprend même de travers)', () => {
  it('rattrape une quasi-erreur sur un nom court', () => {
    const set = parseTranscript('set no flash', ctx);
    expect(set.ok && set.intent.championId).toBe('Sett');
    const ari = parseTranscript('ari no flash', ctx);
    expect(ari.ok && ari.intent.championId).toBe('Ahri');
  });

  it('rattrape une lettre manquante sur un nom long', () => {
    const morg = parseTranscript('morgan no ult', ctx);
    expect(morg.ok && morg.intent.championId).toBe('Morgana');
  });

  it('relie une transcription phonétiquement proche au bon champion', () => {
    // Ce que vosk peut sortir sur une voix FR, orthographié « de travers ».
    for (const said of ['malfite', 'malfit', 'mal fite']) {
      const res = parseTranscript(`${said} no flash`, ctx);
      expect(res.ok && res.intent.championId, said).toBe('Malphite');
    }
    expect((parseTranscript('lucianne no flash', ctx) as never) && true).toBeTruthy();
    const luc = parseTranscript('lucianne no flash', ctx);
    expect(luc.ok && luc.intent.championId).toBe('Lucian');
    const kha = parseTranscript('kazix no ult', ctx);
    expect(kha.ok && kha.intent.championId).toBe('Khazix');
    const ori = parseTranscript('oriana no ult', ctx);
    expect(ori.ok && ori.intent.championId).toBe('Orianna');
  });

  it('rattrape un mot-clé de sort mal transcrit (phonétique)', () => {
    const flache = parseTranscript('ahri flache', ctx);
    expect(flache.ok && flache.intent.spell).toBe('flash');
  });

  it('ne matche PAS un mot vraiment éloigné (pas de faux timer)', () => {
    expect(parseTranscript('banana no flash', ctx)).toMatchObject({
      ok: false,
      reason: 'no-champion',
    });
    expect(parseTranscript('hello no flash', ctx)).toMatchObject({
      ok: false,
      reason: 'no-champion',
    });
  });

  it('le match exact reste prioritaire', () => {
    const res = parseTranscript('sett no flash', ctx);
    expect(res.ok && res.intent.championId).toBe('Sett');
  });

  it('un mot courant proche (« has ») ne vole pas le match au vrai nom', () => {
    const res = parseTranscript('has malphite no flash', ctx);
    expect(res.ok && res.intent.championId).toBe('Malphite');
  });
});

describe('alias français (grammaire prononçable par le modèle FR)', () => {
  it('« lucien no erre » → Lucian ult (ce que vosk FR sort vraiment)', () => {
    const res = parseTranscript('lucien no erre', ctxFr);
    expect(res.ok && res.intent.championId).toBe('Lucian');
    expect(res.ok && res.intent.spell).toBe('ult');
  });

  it('« malfite no flash » → Malphite flash', () => {
    const res = parseTranscript('malfite no flash', ctxFr);
    expect(res.ok && res.intent.championId).toBe('Malphite');
    expect(res.ok && res.intent.spell).toBe('flash');
  });

  it('« ari no flash » → Ahri', () => {
    expect((parseTranscript('ari no flash', ctxFr) as { intent?: { championId: string } }).intent?.championId).toBe(
      'Ahri',
    );
  });
});

describe('phoneticKey', () => {
  it('réduit les variantes d’un même nom à la même clé', () => {
    expect(phoneticKey('malphite')).toBe(phoneticKey('malfite'));
    expect(phoneticKey('khazix')).toBe(phoneticKey('kazix'));
    expect(phoneticKey('ph')).toBe('f');
    expect(phoneticKey('lucian')).toBe(phoneticKey('lucian'));
  });
});
