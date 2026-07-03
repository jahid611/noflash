# CLAUDE.md — contexte projet NoFlash

> Ce fichier est lu automatiquement par Claude Code à chaque session. Il te donne
> **tout le contexte** d'un coup. Le `README.md` est orienté utilisateur ; ce
> fichier est orienté agent/dev. Le plan de test in-game détaillé est dans
> **`docs/ROADMAP.md`** ; l'historique des décisions dans **`docs/HANDOFF.md`**.

## 1. C'est quoi

**NoFlash** : tracker de cooldowns ennemis à la **voix** pour League of Legends.
Le joueur dit « ahri no flash » / « malphite erre » → un timer démarre pour le
Flash / l'ult de ce champion, en tenant compte de la CDR.

**Hypothèse à valider** : la reconnaissance vocale offline en **vocabulaire
fermé** est-elle assez fiable (>90 %) pour piloter ces timers, avec un **accent
français**, en conditions de jeu (parole rapide en teamfight) ?

Deux cibles depuis le même codebase :
- **Web** (Vite/React) = **banc de test** déployable (Vercel). Saisie manuelle
  de l'équipe. NE PEUT PAS lire la partie (voir §4).
- **Desktop** (Electron) = **le vrai produit**. Lit la partie en direct via la
  Live Client API de Riot (équipe ennemie, summoners, niveaux, items).

Branche de travail : `claude/vosk-cooldown-timer-o0e4as`. Repo : `jahid611/noflash`.

## 2. Stack & commandes

Vite + React + TS + Tailwind + **shadcn/ui** (vendorisé dans `src/components/ui/`,
thème façon Discord : gris foncés + blurple/indigo only). State : Zustand.
Voix : **vosk-browser** (offline, WASM). Desktop : **Electron** (CommonJS).

```bash
npm install            # au 1er coup récupère Electron (~100 Mo)
npm run dev            # front web seul (banc de test)
npm run electron:dev   # APP DESKTOP en dev (Vite + Electron) ← pour tester en jeu
npm run electron:prod  # app desktop, rendu prod (serveur statique), sans packaging
npm run dist:win       # construit l'installeur / .exe (sortie: release/)
npm test               # 44 tests unitaires (modules purs)
npm run check:pure     # règle d'or (voir §3)
npm run build          # check:pure + tsc + vite build
```

⚠️ Si `npm install` casse sur `onnxruntime-node`/CUDA (seulement si on ajoute
Whisper) : `npm install --onnxruntime-node-install-cuda=skip`.

## 3. Règle d'or — modules purs (NE PAS CASSER)

`src/voice/`, `src/cooldowns/`, `src/timers/`, `src/game/` sont **PURS** : zéro
import React, zéro DOM/`window`/`document`/`navigator`/`localStorage`/`fetch`/
`getUserMedia`/`AudioContext`. Vérifié mécaniquement par `npm run check:pure`
(inclus dans `npm run build`). But : réutilisables tels quels en Electron.

Toute dépendance navigateur vit dans `src/audio/`, `src/data/`, `src/ui/`, ou
`electron/`. Le pont Electron est dans `electron/` (pas typé par tsc, `.cjs`).

## 4. LE point le plus important : web ≠ lecture de partie

Un **navigateur ne peut PAS** joindre la Live Client API (`https://127.0.0.1:2999`) :
**CORS** (Riot ne renvoie pas les en-têtes) **+ certificat auto-signé** refusé.
Aucune page web ne le peut. → La lecture de partie est **exclusivement desktop
(Electron)**, où le **process principal Node** interroge l'API et transmet le
JSON au renderer.

Ne JAMAIS proposer de lire la partie depuis le web. Ne pas désactiver la
vérif TLS globalement : dans `electron/liveclient.cjs`, le certificat auto-signé
n'est accepté que pour cette requête précise (`rejectUnauthorized:false` sur un
agent dédié).

## 5. Reconnaissance vocale — état actuel & LES 3 leviers (ordre d'impact)

C'est le nerf du projet. Historique : ça sortait `[unk]` même sur « Malphite »
clairement articulé. Corrigé en 3 couches :

1. **Modèle acoustique FRANÇAIS par défaut** (`vosk-model-small-fr-pguyot-0.3`,
   bundlé dans `public/model/`). Un locuteur FR + un modèle EN = incompréhension
   phonétique totale. Le modèle FR prononce les noms de champions à la française.
   Le modèle EN est aussi bundlé. Sélecteur : Réglages → « Langue du modèle
   vocal ». C'est **le plus gros levier**.
2. **Grammaire fermée restreinte aux champions ACTIFS** (les 5 ennemis, ou le
   set benchmark) — ~20 tokens, pas les 165 du roster. Reconstruite à chaud
   quand l'équipe change. Code : `buildScopedGrammar`/`makeSession` dans
   `src/ui/state/voiceRuntime.ts`.
3. **Pas de `[unk]` par défaut** (`grammar.ts`, option `includeUnk`, défaut
   false) : sans lui, vosk est OBLIGÉ de sortir le champion le plus proche au
   lieu de « inconnu ». Toggle « Anti-bruit strict » (Réglages,
   `settings.rejectUnknown`) pour le réactiver en environnement très bruyant.

En plus, la **« mini-IA » sans ressources** (`src/voice/parser.ts`) : un moteur
**phonétique** qui relie ce que dit le joueur aux champions/sorts connus **même
si vosk transcrit de travers**. `phoneticKey()` réduit un mot à une clé
phonétique FR-tolérante (ph→f, h muet, doubles, finales muettes…) : « malphite »,
« malfite », « mal fit » → même clé. `phoneticFindChampion` teste des fenêtres de
1–3 tokens contre les alias des **5 ennemis** et prend le plus proche SOUS un
seuil (0.34) — « closest-of-5 », mais un mot éloigné (« banana ») est rejeté
(jamais de faux timer). Zéro modèle, quelques µs, offline. Match exact
prioritaire ; phonétique en second. Idem pour les sorts (`matchSpell`). Ne PAS
remplacer par un LLM/modèle lourd : le problème est un classement sur ~15 options
connues, le scoreur phonétique est supérieur (latence nulle, déterministe).
**Variantes FR** de mots-clés dans `src/voice/keywords.ts` (« ulti »/« ultime »→
ult, « erre »/« ar »→ult (lettre R), « télé »→teleport, etc.).

⚠️ **Découverte terrain (capture utilisateur)** : avec le modèle FR, les
mots-clés FR passent parfaitement MAIS les noms de champions écrits à l'anglaise
(`lucian`, `malphite`) ne sortent JAMAIS de vosk (« Lucian no R » → « no erre »,
le nom disparaît) — le modèle FR ne sait pas prononcer ces graphies anglaises.
Fix : **`FRENCH_ALIASES`** dans `src/voice/nicknames.ts` — orthographes que le
modèle FR sait prononcer (« lucien », « ari », « malfite », « kazix »…), injectées
dans la grammaire ET le parser via `mergeNicknames()`. Couvre l'équipe d'exemple
+ le benchmark. ⚠️ **Limite** : ça ne scale pas aux 165 champions (curation
manuelle). Pour le roster complet, c'est **Whisper** (§11) qui est la vraie
réponse — vosk small ne fait pas les noms fantasy de façon générale.

Anti-pattern à éviter : remettre la grammaire sur TOUT le roster, ou remettre
`[unk]` par défaut. Les deux re-cassent la reco.

**Push-to-talk** : maintien touche V (web, `src/audio/BrowserHotkey.ts`). Desktop :
raccourci global F8 (`electron/main.cjs`, `globalShortcut`) qui ouvre une fenêtre
d'écoute bornée (`pulseDesktopListen`) car globalShortcut n'a pas de keyup.

## 6. Lecture de partie (Live Client) — comment ça marche

- `electron/liveclient.cjs` : poll `…/liveclientdata/allgamedata` toutes les 2 s,
  transmet le JSON BRUT au renderer (aucune logique ici).
- `src/game/liveMapping.ts` (**pur, testé**) : `extractEnemies(data)` = identifie
  le joueur actif, prend l'**équipe opposée**, et pour chaque ennemi extrait :
  nom de champion, **les DEUX summoners réels**, niveau, bottes ioniennes
  (item id 3158). Retourne `[]` si l'équipe active est indéterminable (spectateur).
- `src/ui/state/desktop.ts` : reçoit le JSON, résout nom→id ddragon
  (`championService.findByName`), appelle `manualProvider.syncFromLive`.
- `src/game/ManualProvider.ts::syncFromLive` : **fusion** — composition / niveau /
  rang d'ult / bottes / summoners viennent du jeu ; **Cosmic Insight & haste
  manuels sont PRÉSERVÉS**. La Live Client API n'expose **jamais** les runes
  ennemies → Cosmic Insight reste manuel, ne jamais supposer le contraire.

## 7. Cooldowns

Formule haste : `cdEffectif = base × 100 / (100 + haste)` (identique à
`base / (1 + haste/100)`) — `src/cooldowns/haste.ts`. Ability haste (ults) et
summoner haste (invocs). ⚠️ **Toutes les valeurs CD/haste sont patch-dependent** :
`src/cooldowns/summoners.ts`, `src/cooldowns/ults.ts`, `src/data/fallback.ts`
(commentées « patch-dependent »). Ults d'ult par rang via ddragon
(`spells[3].cooldown`), rang inféré du niveau (6/11/16). Ults à charges (Ahri…) :
override curé, tracking derrière un flag expérimental.

## 8. Données champions

Data Dragon **au runtime** (jamais au build : le sandbox n'a pas accès à
ddragon ; en local/chez toi si). Cache localStorage par version. **Dataset
fallback** bundlé (`src/data/fallback.ts`, 20 champions) pour l'offline. Icônes
(champion + summoners + R) depuis le CDN ddragon.

## 9. Ce qui est VÉRIFIÉ vs ce qui NE L'EST PAS

Vérifié en cloud : `check:pure`, `tsc`, 44 tests unitaires, build web, smoke
test Chromium (setup équipe, commande simulée→timer, échec explicite, reset,
onglets).

**NON vérifiable en cloud (pas de micro, pas de client LoL, ddragon+HF bloqués)** —
à valider CHEZ TOI (voir `docs/ROADMAP.md`) :
- reco vocale au **vrai micro** (le cœur de l'hypothèse) ;
- tout le pont **Electron ↔ Live Client** contre une vraie partie ;
- **overlay** (transparent/always-on-top/click-through) ;
- **raccourci global** F8 ;
- **packaging** `.exe`.

## 10. Modèles vosk & git

Les deux `.tar.gz` (FR ~44 Mo, EN ~40 Mo) sont **commités** dans `public/model/`
(temporairement, pour un déploiement/clone zéro-config). Pour les sortir du repo :
voir `.gitignore`. `release/`, `dist/`, `node_modules/` sont ignorés.

## 11. Whisper (moteur STT alternatif) — FAIT, togglable

Interface commune `src/voice/stt.ts` (`SttEngine`/`SttSession`) : vosk et
Whisper sont interchangeables. Réglages → « Moteur de reconnaissance » (vosk ⇄
whisper) ; changer recharge la voix à chaud. `src/voice/whisperEngine.ts` :

- transformers.js chargé **depuis un CDN au runtime** (`import(/* @vite-ignore */
  url)`) → **AUCUNE dépendance npm** (évite l'enfer `onnxruntime-node`), non
  bundlé, marche en web ET Electron. URL configurable (Réglages, avancé) si la
  route CDN change ; défaut `DEFAULT_TRANSFORMERS_CDN`. Alternatives si échec :
  `…@3.0.2/+esm` ou `…/dist/transformers.min.js`.
- Bufferise l'audio 16 kHz pendant l'écoute, transcrit au `flush` (asynchrone) →
  `silenceTimeoutMs()` monte à 7 s en mode whisper. `session.reset()` vide le
  buffer à chaque ouverture de gate.
- Modèles : `whisper-tiny` (~40 Mo) / `whisper-base` (~150 Mo), langue forcée FR.
- Transcription **libre** (pas de grammaire) → c'est le parser phonétique qui
  relie au champion. Couvre donc TOUT le roster, contrairement aux
  `FRENCH_ALIASES` vosk (curés).

⚠️ **Non testé en vrai** (CDN HF + micro absents du cloud) : vérifier chez
l'utilisateur. 1er chargement = réseau requis (modèle mis en cache ensuite) ;
vosk reste le défaut 100 % offline. Latence Whisper ~1-2 s/commande.

## 12. Conventions

- Commits : messages descriptifs, terminés par les lignes Co-Authored-By /
  Claude-Session déjà utilisées dans l'historique.
- Ne PAS créer de PR sauf demande explicite.
- Après une modif non triviale : `npm run build` + `npm test` + (si UI) un smoke
  test navigateur avant de commit.
- Ne jamais committer le model identifier interne dans le repo.
