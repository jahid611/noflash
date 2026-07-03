'use strict';
const path = require('node:path');
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { startPolling } = require('./liveclient.cjs');
const { serve } = require('./staticServer.cjs');

// Dev = process Electron non packagé, SAUF si on force le mode prod (pour tester
// le rendu packagé — serveur statique — sans construire l'installeur).
const isDev = !app.isPackaged && process.env.NOFLASH_PROD !== '1';
/** URL du renderer : serveur Vite en dev, serveur statique loopback en prod. */
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';
/** Raccourci global (fonctionne même quand League a le focus). Configurable. */
const GLOBAL_LISTEN_HOTKEY = process.env.NOFLASH_HOTKEY || 'F8';

let mainWindow = null;
let stopPolling = null;
let staticServer = null;
let overlayMode = false;

async function resolveStartUrl() {
  if (isDev) return DEV_URL;
  const served = await serve(path.join(__dirname, '..', 'dist'));
  staticServer = served.server;
  return served.url;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 380,
    minHeight: 300,
    backgroundColor: '#313338',
    show: false,
    title: 'NoFlash',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const startUrl = await resolveStartUrl();
  await mainWindow.loadURL(startUrl);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Autorise le micro sans prompt (app desktop de confiance, pas un site web).
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media' || permission === 'microphone');
  });

  startGamePolling();
}

function startGamePolling() {
  stopPolling?.();
  stopPolling = startPolling((update) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('noflash:game-data', update);
    }
  });
}

/**
 * Bascule la fenêtre en mode overlay : sans cadre, toujours au-dessus, clic
 * traversant (⚠️ expérimental, à tester in-game côté utilisateur). Un nouveau
 * toggle rétablit la fenêtre normale et interactive.
 */
function setOverlayMode(on) {
  if (!mainWindow) return;
  overlayMode = on;
  mainWindow.setAlwaysOnTop(on, 'screen-saver');
  mainWindow.setSkipTaskbar(on);
  // Clic traversant : on laisse passer la souris vers le jeu, tout en gardant
  // l'overlay visible. { forward: true } permet quand même le hover.
  mainWindow.setIgnoreMouseEvents(on, { forward: true });
  mainWindow.webContents.send('noflash:overlay-changed', on);
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  try {
    globalShortcut.register(GLOBAL_LISTEN_HOTKEY, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('noflash:hotkey-toggle-listen');
      }
    });
  } catch {
    // accélérateur invalide : on ignore, la voix reste pilotable à la souris.
  }
}

// ---- IPC depuis le renderer ----
ipcMain.handle('noflash:get-info', () => ({
  isElectron: true,
  hotkey: GLOBAL_LISTEN_HOTKEY,
  overlay: overlayMode,
}));
ipcMain.handle('noflash:set-overlay', (_e, on) => {
  setOverlayMode(Boolean(on));
  return overlayMode;
});
// Permet au renderer de (dé)verrouiller le clic quand la souris survole l'UI en overlay.
ipcMain.on('noflash:set-interactive', (_e, interactive) => {
  if (mainWindow && overlayMode) {
    mainWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  }
});

app.whenReady().then(() => {
  createWindow();
  registerHotkey();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopPolling?.();
  staticServer?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
