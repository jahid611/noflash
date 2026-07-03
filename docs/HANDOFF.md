# HANDOFF — journal des décisions & état des lieux

Pour l'agent qui reprend le projet : le **pourquoi** derrière le code, les
**impasses déjà explorées** (ne pas les refaire), et l'**état** de chaque brique.
Référence technique : `CLAUDE.md`. Plan de test : `docs/ROADMAP.md`.

## Ordre de construction (ce qui a été fait, dans l'ordre)

1. Proto web complet : modules purs (voice/cooldowns/timers/game), pipeline vosk,
   moteur de CD, timers, benchmark, données ddragon + fallback, UI.
2. Front migré en **shadcn/ui**.
3. Refonte visuelle **style Discord** (gris foncés + blurple only) + icônes de
   sorts ddragon avec cooldown radial « façon LoL » sur l'icône.
4. Modèle vosk **commité** pour un déploiement Vercel zéro-config.
5. **Fix reco #1** : grammaire restreinte aux champions actifs (pas les 165) +
   rattrapage phonétique dans le parser.
6. **App desktop Electron** : lecture de la partie via Live Client API.
7. **Fix reco #2** : suppression de `[unk]` par défaut (forced match).
8. **Fix reco #3 (le gros)** : modèle vosk **FRANÇAIS** par défaut + variantes FR
   de mots-clés (dont « erre »/« ar » pour la lettre R).
9. **Deux summoners** de l'ennemi lus en direct (fin du « 2e summoner » manuel).

## Décisions clés & rationale

- **Vite (pas Next)** : zéro backend, APIs navigateur pures, portage Electron
  direct. Le SSR de Next se battrait contre getUserMedia/AudioWorklet.
- **vosk (pas Web Speech API)** : offline, grammaire fermée, représentatif du
  produit desktop. Web Speech = online (Google), sans grammaire → tester ne
  validerait rien.
- **Modèle FR par défaut** : l'utilisateur est francophone. Un modèle EN sur une
  voix FR ne matche pas les phonèmes → c'était LA cause des `[unk]` sur
  « Malphite ». Le levier n°1, découvert tard (cf. §5 CLAUDE.md).
- **Pas de `[unk]`** : avec lui, vosk répond « inconnu » trop souvent. Sans lui,
  il est forcé de choisir le champion le plus proche. Le filet anti-bruit reste
  l'exigence « champion + mot-spell » pour lancer un timer.
- **Grammaire scopée aux 5 ennemis** : ~20 tokens au lieu de ~250. Décisif.
- **Modèle « fusion » pour le live** : le jeu pilote composition/niveau/summoners/
  bottes ; l'humain garde Cosmic Insight + haste manuels. Parce que **la Live
  Client API n'expose jamais les runes ennemies** — contrainte Riot bakée dès le
  départ, ne pas supposer qu'on aura les runes un jour.
- **Serveur statique loopback en prod Electron** (pas `file://`) : `file://`
  casse getUserMedia (secure context) et le fetch du modèle par vosk. `http://
  127.0.0.1` est un secure context et fetch y marche. Loopback = pas de firewall.
- **Electron en CommonJS `.cjs`** : pas d'étape de build pour le process principal ;
  tsc ne type que `src/`.

## Impasses / limites (NE PAS refaire)

- ❌ **Lire la partie depuis le web** : impossible (CORS + cert auto-signé sur
  127.0.0.1:2999). Définitif. Desktop only.
- ❌ **Runes ennemies via Live Client** : jamais exposées. Cosmic Insight = manuel.
- ⚠️ **Whisper** : tenté, non intégré. En cloud : CDN HuggingFace bloqué (403) +
  `onnxruntime-node` échoue à télécharger ses binaires (CUDA). Faisable **chez
  l'utilisateur** (réseau OK). À faire seulement si le modèle FR échoue en jeu.
- ⚠️ **Overlay** : codé mais non testé (pas de GUI en cloud). Contraintes OS
  connues : ne s'affiche pas au-dessus d'un plein écran EXCLUSIF (passer LoL en
  fenêtré sans bordure).
- ⚠️ **Raccourci global** : `globalShortcut` d'Electron n'a **pas de keyup** → pas
  de vrai « maintien » ; on ouvre une fenêtre d'écoute bornée à la place. Un vrai
  hold (et les boutons souris pouce) nécessiterait un module natif (uiohook).
- 🔒 **Sandbox cloud** : ddragon, GitHub Pages, HuggingFace, alphacephei sont
  bloqués par le proxy. Les modèles vosk ont pu être récupérés via
  `raw.githubusercontent.com` (branche gh-pages de ccoreilly/vosk-browser).
- 🎨 **Design Claude Design** : le fichier `NoFlash - Redesign.dc.html` n'a pas pu
  être récupéré (MCP design non authentifiable en session web ; fetch direct 403).
  En attente que l'utilisateur le fournisse (« Send to Claude Code Web » ou HTML).

## État des briques

| Brique | État | Testé ? |
| --- | --- | --- |
| Modules purs (voice/cd/timers/game) | ✅ | 44 tests unitaires |
| UI web (shadcn, thème Discord) | ✅ | smoke test Chromium |
| Pipeline parsing (intent, fuzzy, FR) | ✅ | tests + smoke |
| Modèle vosk FR par défaut | ✅ code | ⏳ reco réelle : chez toi |
| Benchmark + export | ✅ | smoke |
| Electron shell + serveur statique | ✅ code | ⏳ chez toi |
| Live Client → équipe/summoners/bottes | ✅ code + tests purs | ⏳ vraie partie : chez toi |
| Overlay transparent | ⚠️ expérimental | ⏳ chez toi |
| Raccourci global F8 | ✅ code | ⏳ chez toi |
| Packaging .exe | ✅ config | ⏳ chez toi |
| Whisper (fallback STT) | ❌ non fait | — |
| Design redesign | ❌ fichier manquant | — |

## Questions ouvertes pour l'utilisateur

1. Le modèle vosk FR suffit-il en jeu, ou faut-il Whisper ?
2. L'overlay s'affiche-t-il correctement par-dessus TON setup LoL ?
3. Le JSON de la Live Client API correspond-il au mapping (dumper avec
   `curl -k https://127.0.0.1:2999/liveclientdata/allgamedata`) ?
4. Fournir le fichier de design pour l'implémenter.
