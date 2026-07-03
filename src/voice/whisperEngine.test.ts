import { describe, expect, it } from 'vitest';
import { buildLolPrompt } from './whisperEngine';

describe('buildLolPrompt', () => {
  it('amorce Whisper sur le contexte LoL + les champions actifs', () => {
    const p = buildLolPrompt(['Ahri', 'Lucian', 'Malphite', 'Zed', "Kha'Zix"]);
    expect(p).toContain('League of Legends');
    expect(p).toContain('Malphite');
    expect(p).toContain("Kha'Zix");
    expect(p).toContain('flash');
    expect(p).toContain('Champions ennemis :');
    // Pas de phrase-exemple (risque d'hallucination Whisper).
    expect(p.toLowerCase()).not.toContain('no flash');
  });

  it('reste valide sans champions (fallback)', () => {
    const p = buildLolPrompt([]);
    expect(p).toContain('League of Legends');
    expect(p).not.toContain('Champions ennemis :');
  });
});
