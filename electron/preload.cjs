'use strict';
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Pont sécurisé renderer ↔ main (contextIsolation). Le renderer web ne voit que
 * cette petite API sous window.noflash — jamais Node ni ipcRenderer directement.
 */
contextBridge.exposeInMainWorld('noflash', {
  isElectron: true,

  /** Infos runtime (raccourci global, état overlay). */
  getInfo: () => ipcRenderer.invoke('noflash:get-info'),

  /** Données de partie poussées par le polling Live Client (~toutes les 2s). */
  onGameData: (callback) => {
    const handler = (_e, payload) => callback(payload);
    ipcRenderer.on('noflash:game-data', handler);
    return () => ipcRenderer.removeListener('noflash:game-data', handler);
  },

  /** Le raccourci global PTT a été pressé → bascule l'écoute. */
  onToggleListen: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('noflash:hotkey-toggle-listen', handler);
    return () => ipcRenderer.removeListener('noflash:hotkey-toggle-listen', handler);
  },

  /** Notifié quand le mode overlay change (depuis le main). */
  onOverlayChanged: (callback) => {
    const handler = (_e, on) => callback(Boolean(on));
    ipcRenderer.on('noflash:overlay-changed', handler);
    return () => ipcRenderer.removeListener('noflash:overlay-changed', handler);
  },

  /** Active/désactive le mode overlay (transparent, always-on-top, click-through). */
  setOverlay: (on) => ipcRenderer.invoke('noflash:set-overlay', on),

  /** En overlay : rendre l'UI cliquable (true) le temps d'un survol, sinon laisser passer. */
  setInteractive: (interactive) => ipcRenderer.send('noflash:set-interactive', interactive),
});
