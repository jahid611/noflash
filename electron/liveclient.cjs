'use strict';
/**
 * Polling de la Live Client Data API de League depuis le PROCESS PRINCIPAL
 * (Node) — c'est le seul endroit qui peut la joindre :
 *   - pas de CORS ici (contrairement au navigateur) ;
 *   - le certificat auto-signé de 127.0.0.1:2999 est accepté UNIQUEMENT pour
 *     cette requête (rejectUnauthorized:false sur cet agent), jamais globalement.
 *
 * On ne fait qu'interroger et transmettre le JSON brut au renderer, qui contient
 * toute la logique d'extraction (module pur src/game/liveMapping, testé).
 */
const https = require('node:https');

const LIVE_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const POLL_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 1500;

// Agent dédié : ignore le certificat auto-signé de Riot, et seulement lui.
const insecureAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function fetchGameData() {
  return new Promise((resolve) => {
    const req = https.get(LIVE_URL, { agent: insecureAgent, timeout: REQUEST_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve({ running: false, reason: `HTTP ${res.statusCode}` });
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ running: true, data: JSON.parse(body) });
        } catch {
          resolve({ running: false, reason: 'JSON invalide' });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ running: false, reason: 'timeout' });
    });
    // ECONNREFUSED = pas de partie lancée : cas nominal, pas une erreur.
    req.on('error', (err) => resolve({ running: false, reason: err.code || 'offline' }));
  });
}

/**
 * Démarre le polling ; appelle onUpdate({running, data?, reason?}) à chaque tick.
 * Retourne une fonction d'arrêt.
 */
function startPolling(onUpdate) {
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;
    const result = await fetchGameData();
    if (stopped) return;
    onUpdate(result);
    timer = setTimeout(tick, POLL_INTERVAL_MS);
  }
  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

module.exports = { startPolling, fetchGameData, LIVE_URL };
