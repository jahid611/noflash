import { describe, expect, it } from 'vitest';
import { extractEnemies, isGameReadable, summonerSpellKey } from './liveMapping';
import type { LiveAllGameData } from './liveTypes';

function player(over: Record<string, unknown>) {
  return {
    championName: 'Ahri',
    team: 'CHAOS',
    level: 6,
    items: [],
    summonerSpells: {
      summonerSpellOne: { displayName: 'Flash', rawDisplayName: 'SummonerFlash' },
      summonerSpellTwo: { displayName: 'Ignite', rawDisplayName: 'SummonerDot' },
    },
    ...over,
  };
}

const game: LiveAllGameData = {
  activePlayer: { riotId: 'Me#EUW' },
  allPlayers: [
    player({ championName: 'Lucian', summonerName: 'Ally1', riotId: 'Ally1#EUW', team: 'ORDER' }),
    player({ championName: 'Me', summonerName: 'Me', riotId: 'Me#EUW', team: 'ORDER' }),
    player({
      championName: 'Zed',
      riotId: 'Foe1#EUW',
      team: 'CHAOS',
      level: 11,
      items: [{ itemID: 3158 }],
      summonerSpells: {
        summonerSpellOne: { displayName: 'Flash' },
        summonerSpellTwo: { displayName: 'Teleport' },
      },
    }),
    player({ championName: "Kha'Zix", riotId: 'Foe2#EUW', team: 'CHAOS' }),
  ],
};

describe('summonerSpellKey', () => {
  it('reconnaît les sorts par displayName et rawDisplayName', () => {
    expect(summonerSpellKey({ displayName: 'Flash' })).toBe('flash');
    expect(summonerSpellKey({ displayName: 'Unleashed Teleport' })).toBe('teleport');
    expect(summonerSpellKey({ rawDisplayName: 'SummonerDot' })).toBe('ignite');
    expect(summonerSpellKey({ rawDisplayName: 'SummonerHaste' })).toBe('ghost');
    expect(summonerSpellKey({ displayName: 'Smite' })).toBeNull();
    expect(summonerSpellKey(undefined)).toBeNull();
  });
});

describe('extractEnemies', () => {
  it("prend l'équipe opposée à celle du joueur actif", () => {
    const enemies = extractEnemies(game);
    expect(enemies.map((e) => e.championName)).toEqual(['Zed', "Kha'Zix"]);
  });

  it('extrait niveau, bottes ioniennes et les DEUX summoners (Flash en tête)', () => {
    const zed = extractEnemies(game).find((e) => e.championName === 'Zed');
    expect(zed).toMatchObject({
      level: 11,
      hasIonianBoots: true,
      summoners: ['flash', 'teleport'],
    });
  });

  it('ennemi sans bottes → hasIonianBoots false, summoners lus', () => {
    const kha = extractEnemies(game).find((e) => e.championName === "Kha'Zix");
    expect(kha?.hasIonianBoots).toBe(false);
    expect(kha?.summoners).toEqual(['flash', 'ignite']);
  });

  it('gère une paire de summoners SANS Flash (les deux sont suivis)', () => {
    const noFlash: LiveAllGameData = {
      activePlayer: { riotId: 'Me#EUW' },
      allPlayers: [
        player({ championName: 'Me', riotId: 'Me#EUW', team: 'ORDER' }),
        player({
          championName: 'Singed',
          riotId: 'Foe#EUW',
          team: 'CHAOS',
          summonerSpells: {
            summonerSpellOne: { displayName: 'Ghost' },
            summonerSpellTwo: { displayName: 'Teleport' },
          },
        }),
      ],
    };
    const singed = extractEnemies(noFlash).find((e) => e.championName === 'Singed');
    expect(singed?.summoners).toEqual(['ghost', 'teleport']);
  });

  it("retourne [] si le joueur actif est introuvable (pas de fausse équipe)", () => {
    const spectator: LiveAllGameData = { allPlayers: game.allPlayers };
    expect(extractEnemies(spectator)).toEqual([]);
    expect(isGameReadable(spectator)).toBe(false);
  });

  it('gère un joueur actif dans ORDER (ennemis = CHAOS) et inversement', () => {
    const flipped: LiveAllGameData = {
      activePlayer: { riotId: 'Foe1#EUW' },
      allPlayers: game.allPlayers,
    };
    const enemies = extractEnemies(flipped);
    expect(enemies.every((e) => e.championName === 'Lucian' || e.championName === 'Me')).toBe(true);
  });

  it('isGameReadable true pour une vraie partie', () => {
    expect(isGameReadable(game)).toBe(true);
  });
});
