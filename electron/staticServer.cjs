'use strict';
/**
 * Micro serveur statique loopback (127.0.0.1) pour servir le build Vite en prod.
 *
 * Pourquoi pas file:// ? Une app à micro a besoin d'un "secure context" pour
 * getUserMedia, et vosk-browser fait des fetch() du modèle .tar.gz — deux choses
 * qui cassent sous file://. http://127.0.0.1 EST un secure context et fetch y
 * marche normalement. Loopback = pas de prompt firewall Windows.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.map': 'application/json; charset=utf-8',
};

function serve(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let rel = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        if (rel === '/' || rel === '\\' || rel === '') rel = '/index.html';
        let filePath = path.join(rootDir, rel);
        // Garde-fou anti path-traversal : on reste dans rootDir.
        if (!filePath.startsWith(path.resolve(rootDir))) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          // SPA fallback : tout ce qui n'est pas un asset connu → index.html.
          filePath = path.join(rootDir, 'index.html');
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500);
        res.end('error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

module.exports = { serve };
