/**
 * Nickname → nom d'affichage ddragon (seed §11, extensible via config).
 * Les clés multi-mots sont autorisées ("jay four") : elles sont splittées en
 * tokens par le builder de grammaire et le parser.
 */
export type NicknameMap = Record<string, string>;

export const NICKNAME_SEED: NicknameMap = {
  kha: "Kha'Zix",
  ori: 'Orianna',
  j4: 'Jarvan IV',
  sej: 'Sejuani',
  vlad: 'Vladimir',
  mf: 'Miss Fortune',
  tf: 'Twisted Fate',
  lee: 'Lee Sin',
  ali: 'Alistar',
  blitz: 'Blitzcrank',
  cass: 'Cassiopeia',
  cait: 'Caitlyn',
  eve: 'Evelynn',
  ez: 'Ezreal',
  fiddle: 'Fiddlesticks',
  gp: 'Gangplank',
  heca: 'Hecarim',
  kass: 'Kassadin',
  kat: 'Katarina',
  lb: 'LeBlanc',
  malph: 'Malphite',
  morde: 'Mordekaiser',
  naut: 'Nautilus',
  noc: 'Nocturne',
  panth: 'Pantheon',
  raka: 'Soraka',
  rek: "Rek'Sai",
  rene: 'Renekton',
  sera: 'Seraphine',
  tk: 'Tahm Kench',
  trund: 'Trundle',
  tryn: 'Tryndamere',
  voli: 'Volibear',
  ww: 'Warwick',
  yi: 'Master Yi',
  zil: 'Zilean',
  // Variantes orales — un sigle comme "j4" ne sort jamais tel quel de vosk.
  'jay four': 'Jarvan IV',
};

/** Point d'extension config : merge de nicknames custom par-dessus la seed. */
export function mergeNicknames(extra: NicknameMap = {}): NicknameMap {
  return { ...NICKNAME_SEED, ...extra };
}
