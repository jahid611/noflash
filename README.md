# ⚡ NoFlash — proto web

Web app de test pour valider **une seule hypothèse** : la reconnaissance vocale
en **vocabulaire fermé** est-elle assez fiable (**> 90 %**) pour piloter des
timers de cooldown ennemis à la voix, avec un accent français, en conditions de
jeu réelles (parole rapide en teamfight) ?

En game, je dis « **ahri no flash** » → un timer de 5:00 démarre pour le Flash
d'Ahri. Pareil pour l'ult (« ahri no ult »), en tenant compte de la CDR quand
l'info est disponible.

Ceci est un **banc d'essai**, pas le produit final. L'overlay transparent, la
Live Client API et le packaging Electron viendront après — mais l'architecture
est déjà découpée pour ce portage (voir [Architecture](#architecture)).

## Démarrage

Prérequis : Node 18+.

```bash
npm install
```

### Télécharger le modèle vosk (obligatoire pour la voix)

Le modèle n'est **pas commité** (~40 Mo). vosk-browser attend un `.tar.gz`.

**Option A — tar.gz prêt à l'emploi** (modèles hébergés par la démo officielle
vosk-browser) :

```bash
curl -L -o public/model/vosk-model-small-en-us-0.15.tar.gz \
  https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz
```

**Option B — depuis le site officiel vosk** (zip à réempaqueter en tar.gz) :

```bash
curl -L -o /tmp/model.zip https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip /tmp/model.zip -d /tmp
tar -czf public/model/vosk-model-small-en-us-0.15.tar.gz -C /tmp vosk-model-small-en-us-0.15
```

Une autre URL/chemin de modèle peut être configurée dans **Réglages**.

### Lancer

```bash
npm run dev
```

1. Sélectionner les 5 champions ennemis (ou « Pré-remplir l'exemple »).
2. Cliquer **🎙️ Activer la voix** (autoriser le micro).
3. Maintenir **V** (push-to-talk) et dire « ahri no flash » → timer 5:00 +
   confirmation visuelle (+ TTS si activé).

Sans micro ni modèle, le champ « Simuler » du panneau Transcript envoie du texte
dans le même pipeline de parsing (debug).

## Commandes vocales

| Phrase | Effet |
| --- | --- |
| `<champ> no <spell>` | démarre le cooldown (spell utilisé) |
| `<champ> <spell>` / `<champ> <spell> down|used` | idem |
| `<champ> <spell> up|back` | reset (spell récupéré) |

Spells : `flash`, `ult`/`r`, `tp`/`teleport`, `ignite`, `heal`, `exhaust`,
`barrier`, `cleanse`, `ghost`. Insensible à la casse, tolérant aux mots
parasites. Nicknames : `kha`, `ori`, `j4`, `mf`… (seed dans
`src/voice/nicknames.ts`, extensible).

**Échec explicite, jamais silencieux** : si du son est capté mais qu'aucun
champion/spell ne matche, l'app affiche `❓ non reconnu : "<transcript>"`. Le
pire scénario est de croire qu'un timer tourne alors qu'il ne tourne pas — un
outil qui ment est pire que pas d'outil.

## Pourquoi vosk (et pas la Web Speech API), pourquoi Vite (et pas Next)

- **vosk-browser** : offline, supporte une **grammaire fermée** (le recognizer
  choisit parmi ~200 tokens au lieu de tout l'anglais — c'est ce qui rend la
  reco fiable), et sera représentatif du moteur du produit desktop. La Web
  Speech API est online (serveurs Google), sans grammaire custom, et
  n'existera pas dans le produit final → la tester ne validerait rien.
- **Vite** : zéro backend, APIs navigateur pures (getUserMedia, AudioWorklet),
  portage Electron direct. Le SSR de Next se battrait contre ces APIs
  browser-only.
- **UI** : React + Tailwind + **shadcn/ui** (Radix primitives, sonner pour les
  toasts). Thème façon Discord : gris foncés + blurple/indigo uniquement. Les
  icônes de sorts (Flash, summoners, R de chaque champion) sont les assets
  ddragon chargés au runtime, et le cooldown s'écoule directement sur l'icône
  (balayage radial + compteur) comme dans le jeu.

## Mode Benchmark

La feature qui valide ou tue le projet. L'app affiche une commande cible
(« Dis : “Kha no ult” »), tu l'exécutes au PTT ; chaque essai enregistre :
capté ? bon champion ? bon spell ? latence (fin de parole → intent).

Le set stresse volontairement les cas durs, chacun × {no flash, no ult} :

- noms courts : Zed, Sett, Jax, Ashe ;
- apostrophes : Kha'Zix, Rek'Sai, Cho'Gath, Vel'Koz, Kai'Sa ;
- nicknames : Kha, Ori, J4, Sej, Vlad, MF, TF, Lee ;
- contrôle : Ahri, Lucian, Malphite, Orianna, Morgana.

Après N essais (défaut 30) : taux de reco, précision champion, précision
spell, latence moyenne, breakdown par commande (pires d'abord) et par groupe,
export **JSON/CSV**. **Si le score est < 90 % sur ce set, l'hypothèse est
invalidée** — et on le sait sans avoir codé l'overlay.

Vosk anglais + noms fantasy + accent FR est le point faible attendu : le
benchmark existe pour le **mesurer**, pas pour le cacher.

## Architecture

```
src/
  audio/       # capture micro (AudioWorklet 16 kHz), PTT, TTS — impls navigateur derrière interfaces
  voice/       # wrapper vosk, builder de grammaire, parser de commandes (PUR)
  game/        # interface GameStateProvider + ManualProvider web (PUR)
  cooldowns/   # maths de CD (formule haste), tables summoners, ults par rang (PUR)
  data/        # fetch ddragon + cache localStorage + dataset fallback
  timers/      # store/logique des timers (PUR)
  ui/          # React : TeamSetup, TimerBoard, TranscriptPanel, BenchmarkMode, Settings
  components/  # composants shadcn/ui (button, card, tabs, select, sonner…)
  lib/         # cn() et utilitaires UI
public/model/  # modèle vosk (téléchargé par l'utilisateur, voir plus haut)
```

Le front est entièrement en **shadcn/ui** (style new-york, Radix + Tailwind,
thème dark via variables CSS, toasts sonner). Le registry n'étant pas
accessible depuis l'environnement de build, les composants sont vendorisés
dans `src/components/ui/` — `components.json` est en place pour que
`npx shadcn add <composant>` fonctionne normalement en local.

**Règle d'or portage Electron** : `voice/`, `cooldowns/`, `timers/`, `game/`
sont des modules purs — zéro import React ou DOM. Vérifié mécaniquement par
`npm run check:pure` (inclus dans `npm run build`). Toute dépendance navigateur
est isolée derrière une interface :

| Seam | Impl web | Impl desktop (plus tard) |
| --- | --- | --- |
| `game/GameStateProvider` | `ManualProvider` (saisie manuelle) | `LiveClientProvider` (127.0.0.1:2999) |
| `audio/AudioInput` | getUserMedia + AudioWorklet | capture native |
| `audio/HotkeyBinding` | keydown/keyup window | raccourci global + boutons souris pouce |
| `audio/SpeechOutput` | SpeechSynthesis | TTS natif |

⚠️ **Limite bakée dès maintenant** : la Live Client API expose les **items**
ennemis mais **pas les runes**. Cosmic Insight ne sera donc *jamais* détectable
automatiquement → toggles manuels par ennemi (👢 bottes, 🔮 cosmic, haste
manuel), défaut = worst case 0 haste. La logique haste ne suppose nulle part
qu'on aura les runes un jour.

## Données & cooldowns

- **Data Dragon en runtime** (jamais au build) : `versions.json` → dernière
  version, `champion.json` → liste, `champion/{id}.json` → `spells[3].cooldown`
  (CD d'ult par rang, ults au 6/11/16). Cache localStorage clé par version,
  icônes carrées via le CDN ddragon.
- **Fallback bundlé** (`src/data/fallback.ts`) : 20 champions (les 10 requis +
  tout le set benchmark) pour marcher offline.
- **Formule haste** : `cdEffectif = base × 100 / (100 + haste)` — ability haste
  (ults) et summoner haste (invocs). Ex : Flash 300s + 18 (Cosmic) ≈ 254s.
- **Ults à charges** (Ahri, Kha'Zix…) : ddragon ne modélise pas les fenêtres de
  recast → liste d'override curée, tracking expérimental derrière un flag
  (Réglages). Défaut : « no ult » = cast plein → CD complet.
- ⚠️ Toutes les valeurs CD/haste sont **patch-dependent** : centralisées dans
  `src/cooldowns/summoners.ts`, `src/cooldowns/ults.ts`, `src/data/fallback.ts`,
  commentées « à revérifier par patch ».

## Scripts

```bash
npm run dev         # serveur de dev
npm test            # tests unitaires des modules purs (parser, grammaire, CD, timers)
npm run check:pure  # vérifie la règle d'or (zéro React/DOM dans les modules purs)
npm run build       # check:pure + tsc + vite build
```

## Note ToS

Input 100 % manuel (c'est le joueur qui voit le flash et le dit), APIs
officielles uniquement (Data Dragon, plus tard Live Client API), zéro lecture
mémoire → même zone tolérée que Porofessor & co.
