# ROADMAP — tester NoFlash chez toi (LoL installé)

Plan de test **phasé** à exécuter sur ta machine, League installé. Pour chaque
phase : ce qu'on teste, comment, le résultat attendu, et **si ça rate → quoi
regarder / dire à Claude**. Fais les phases dans l'ordre : chacune valide une
brique avant la suivante.

> Astuce : à chaque souci, **copie-colle à Claude** ce que tu vois (le panneau
> Transcript, un message d'erreur, ou le JSON de l'API — voir Phase 3). C'est ce
> qui lui permet de corriger en une passe.

---

## Phase 0 — Setup (5 min, hors jeu)

```bash
git pull
npm install          # récupère Electron (~100 Mo la 1re fois)
npm test             # doit afficher 44 passed
npm run build        # doit finir sans erreur
```

- ✅ Attendu : tests verts, build OK.
- ❌ `npm install` bloque sur `onnxruntime` → tu n'en as pas besoin ici (c'est
  pour Whisper) : `npm install --onnxruntime-node-install-cuda=skip`.
- ❌ Autre erreur d'install → colle la sortie à Claude.

Les modèles vosk (FR + EN) sont **déjà dans le repo** (`public/model/`) : rien à
télécharger.

---

## Phase 1 — Web sanity (5 min, hors jeu, sans micro)

```bash
npm run dev          # ouvre http://localhost:5173
```

1. « Pré-remplir l'exemple » → Valider.
2. Dans le panneau **Transcript**, champ « Simuler », tape `ahri no flash` ↵.
3. Onglets Benchmark / Réglages s'ouvrent.

- ✅ Attendu : un timer 5:00 démarre sur l'icône Flash d'Ahri + toast de confirm ;
  `banana hello` → « Non reconnu » (échec explicite).
- ❌ Rien ne se passe / erreur → colle la console navigateur (F12) à Claude.

But : valider que le **pipeline de parsing** (hors voix/micro) marche. Le web
NE lira PAS ta partie (normal, voir CLAUDE.md §4).

---

## Phase 2 — Voix au vrai micro (LE test de l'hypothèse) 🎯

C'est le test qui valide ou tue le projet. Idéalement en desktop :

```bash
npm run electron:dev
```

1. Réglages → « Langue du modèle vocal » = **🇫🇷 Français** (défaut). Active la voix.
2. « Pré-remplir l'exemple » (Ahri/Lucian/Malphite/Zed/Kha'Zix).
3. Maintiens **V** (ou F8 global) et dis clairement : « **malphite no flash** ».
4. **Regarde le panneau Transcript** : il montre ce que vosk a entendu + l'intent.

- ✅ Attendu : timer Flash de Malphite démarre. Transcript ≈ « malphite no flash ».
- ⚠️ Le champion testé DOIT être dans les 5 sélectionnés (la grammaire ne contient
  que ton équipe). Malphite est dans l'exemple.
- ❌ Toujours mauvais ? **Note ce que le Transcript affiche** et dis-le à Claude.
  Selon le cas :
  - Transcript vide / « rien capté » → problème **micro** (mauvais device, gain).
    Vérifie le micro système ; essaie le mode « always-on » (Réglages).
  - Transcript = un AUTRE champion → le modèle t'entend mais confond : teste en
    isolant (équipe de 1-2 champions), ou bascule le toggle « Anti-bruit strict ».
  - Transcript plausible mais pas de timer → souci de **parsing** (`parser.ts`) :
    donne l'exact transcript à Claude, il ajuste le mapping / fuzzy.
  - FR clairement pire que EN pour toi → change le modèle en English (Réglages).
  - **Rien n'y fait** → c'est le signal pour passer à **Whisper** (CLAUDE.md §11) :
    demande à Claude « branche Whisper ».

Objectif chiffré : le mode **Benchmark** (onglet) fait défiler des commandes
cibles et sort un taux de reco. Vise ≥ 90 %. Exporte le JSON/CSV et donne-le à
Claude pour analyser quels noms échouent.

---

## Phase 3 — Lecture de la vraie partie (Live Client) 🎮

Lance une partie **Practice Tool** ou une vraie game. Garde `npm run electron:dev`
ouvert.

1. Une fois **en jeu** (chargé, pas en lobby), regarde l'en-tête de l'app :
   badge « **Partie · N ennemis** » doit s'allumer.
2. Les 5 ennemis se remplissent **tout seuls** : champions, **leurs 2 summoners
   réels**, niveaux ; les **bottes ioniennes** s'affichent quand ils les achètent.
3. Tu ne fais que parler pour lancer les timers.

- ✅ Attendu : équipe ennemie exacte, summoners corrects, niveaux qui montent.
- ❌ Badge reste « En attente de partie » alors que tu es en jeu, OU champions/
  summoners faux/manquants → **dump le JSON brut** et donne-le à Claude :

  ```bash
  curl -k https://127.0.0.1:2999/liveclientdata/allgamedata
  ```

  (`-k` = accepte le certificat auto-signé.) Le format du JSON de Riot bouge
  parfois (`summonerName` ↔ `riotId`, noms de champions…). Avec ce JSON, Claude
  corrige `src/game/liveMapping.ts` en une passe. Fichiers concernés :
  `electron/liveclient.cjs` (fetch), `src/game/liveMapping.ts` (extraction),
  `src/ui/state/desktop.ts` (résolution nom→id).

Rappel : **Cosmic Insight reste manuel** (🔮) — Riot n'expose pas les runes
ennemies. Normal, ne pas essayer de l'automatiser.

---

## Phase 4 — Overlay + raccourci global (in-game)

1. Bouton **Overlay** dans l'en-tête → la fenêtre passe transparente, au-dessus
   du jeu, clic traversant (interactive au survol de l'UI).
2. En partie (League au premier plan), appuie **F8** → l'écoute s'ouvre ~3,5 s :
   dis ta commande.

- ✅ Attendu : overlay visible par-dessus LoL ; F8 déclenche l'écoute hors focus.
- ❌ Overlay illisible / pas cliquable / F8 inactif → dis à Claude l'OS exact et
  le comportement. Code : `electron/main.cjs` (`setOverlayMode`, `globalShortcut`).
  ⚠️ L'overlay est **expérimental** et non testé — c'est attendu qu'il demande des
  ajustements. Alternative si LoL est en « plein écran » exclusif : passer LoL en
  **fenêtré sans bordure** (l'overlay ne s'affiche pas au-dessus du plein écran
  exclusif — c'est une contrainte OS, pas un bug).

---

## Phase 5 — Packaging .exe (quand le reste marche)

```bash
npm run dist:win     # sortie dans release/
```

- ✅ Attendu : un installeur `.exe` + une version portable dans `release/`.
- ❌ Erreur electron-builder → colle la sortie à Claude. Config :
  `electron-builder.yml` (asar désactivé exprès ; modèles inclus via `dist/`).

---

## Backlog / prochaines étapes (après validation)

Par priorité, à lancer quand tu veux (dis-le à Claude) :

1. **Whisper togglable** si vosk FR insuffisant (CLAUDE.md §11).
2. **Anti-aliasing** du rééchantillonnage 48k→16k du micro (`src/audio/
   resamplerWorklet.ts`) — peut aider les fricatives (fl-a-sh, kha-zix).
3. **Design Claude Design** à implémenter (fichier `NoFlash - Redesign.dc.html`)
   — pas encore récupéré ; via « Send to Claude Code Web » ou HTML collé.
4. **Tracking des ults à charges** (Ahri, Kha'Zix) — sortir du flag expérimental
   une fois les fenêtres de recast vérifiées par patch.
5. **Boutons souris pouce** pour le PTT global (nécessite un module natif type
   uiohook — plus lourd).
6. **Vérifier les valeurs patch-dependent** (`summoners.ts`, `ults.ts`,
   `fallback.ts`) au patch courant.

---

## Aide-mémoire diagnostic

| Symptôme | Fichier(s) | À donner à Claude |
| --- | --- | --- |
| Reco vocale mauvaise | `voiceRuntime.ts`, `keywords.ts`, `parser.ts` | le texte du Transcript |
| Partie non détectée / données fausses | `liveMapping.ts`, `desktop.ts`, `liveclient.cjs` | le JSON `curl -k …/allgamedata` |
| Cooldown faux | `haste.ts`, `summoners.ts`, `ults.ts` | champion + valeur attendue vs affichée |
| Overlay/hotkey | `main.cjs` | OS + comportement observé |
| Build/packaging | `electron-builder.yml`, `package.json` | la sortie d'erreur |
