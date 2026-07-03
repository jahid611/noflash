import { describe, expect, it } from 'vitest';
import { buildGrammar, normalizeWords } from './grammar';
import { ALL_KEYWORDS } from './keywords';
import { NICKNAME_SEED } from './nicknames';

describe('normalizeWords', () => {
  it('splitte les apostrophes et retire la ponctuation', () => {
    expect(normalizeWords("Kha'Zix")).toEqual(['kha', 'zix']);
    expect(normalizeWords('Jarvan IV')).toEqual(['jarvan', 'iv']);
    expect(normalizeWords('  Miss   Fortune ')).toEqual(['miss', 'fortune']);
  });
});

describe('buildGrammar', () => {
  const grammar = buildGrammar({
    championNames: ["Kha'Zix", 'Jarvan IV', 'Miss Fortune', 'Ahri'],
    nicknameWords: Object.keys(NICKNAME_SEED),
  });

  it('contient les mots des noms splittés en lowercase', () => {
    for (const w of ['kha', 'zix', 'jarvan', 'miss', 'fortune', 'ahri']) {
      expect(grammar).toContain(w);
    }
  });

  it('ajoute la variante prononcée des chiffres romains', () => {
    expect(grammar).toContain('four');
  });

  it('contient tous les keywords, SANS [unk] par défaut (forced match)', () => {
    for (const kw of ALL_KEYWORDS) expect(grammar).toContain(kw);
    expect(grammar).not.toContain('[unk]');
  });

  it('inclut [unk] uniquement si includeUnk est demandé', () => {
    const withUnk = buildGrammar({
      championNames: ['Ahri'],
      nicknameWords: [],
      includeUnk: true,
    });
    expect(withUnk).toContain('[unk]');
  });

  it('ne contient pas de doublons', () => {
    expect(new Set(grammar).size).toBe(grammar.length);
  });
});
