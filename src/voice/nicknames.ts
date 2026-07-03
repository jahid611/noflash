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

/**
 * ⚠️ CRUCIAL avec le modèle vosk FRANÇAIS. Les noms de champions écrits à
 * l'anglaise (« lucian », « malphite ») ont une mauvaise correspondance
 * phonétique dans un modèle FR → vosk ne les sort JAMAIS (constaté : « Lucian
 * no R » → « no erre », le nom disparaît). On ajoute donc des orthographes que
 * le modèle FR sait prononcer (souvent de vrais mots/prénoms FR). Le moteur
 * phonétique du parser (phoneticKey) les remappe sur le bon champion.
 *
 * Couvre l'équipe d'exemple + le set benchmark. Extensible pour le roster
 * complet ; pour les champions non couverts, c'est Whisper qui prendra le relais.
 */
export const FRENCH_ALIASES: NicknameMap = {
  ari: 'Ahri',
  arie: 'Ahri',
  lucien: 'Lucian',
  lucianne: 'Lucian',
  lussian: 'Lucian',
  malfite: 'Malphite',
  malfit: 'Malphite',
  malphit: 'Malphite',
  zede: 'Zed',
  kazix: "Kha'Zix",
  kaziks: "Kha'Zix",
  cazix: "Kha'Zix",
  ache: 'Ashe',
  chogate: "Cho'Gath",
  chogat: "Cho'Gath",
  jarvane: 'Jarvan IV',
  jaks: 'Jax',
  jacks: 'Jax',
  kaissa: "Kai'Sa",
  kaisa: "Kai'Sa",
  lissine: 'Lee Sin',
  lissin: 'Lee Sin',
  morgane: 'Morgana',
  oriana: 'Orianna',
  oriane: 'Orianna',
  reksai: "Rek'Sai",
  rexai: "Rek'Sai",
  sejuane: 'Sejuani',
  twistedfate: 'Twisted Fate',
  velkoz: "Vel'Koz",
  velcoss: "Vel'Koz",
  vladimir: 'Vladimir',
};

/** Point d'extension config : merge FR + seed + nicknames custom. */
export function mergeNicknames(extra: NicknameMap = {}): NicknameMap {
  return { ...NICKNAME_SEED, ...FRENCH_ALIASES, ...extra };
}
