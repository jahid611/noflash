#!/usr/bin/env node
/**
 * Règle d'or portage Electron (§3, critère d'acceptation §13) :
 * src/voice, src/cooldowns, src/timers, src/game sont des modules PURS —
 * zéro import React, zéro accès direct au DOM ou aux APIs navigateur.
 * Toute dépendance navigateur vit derrière une interface dans audio/, data/,
 * game/ (impl) ou dans ui/.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PURE_DIRS = ['src/voice', 'src/cooldowns', 'src/timers', 'src/game'];

const FORBIDDEN = [
  { pattern: /from\s+['"]react/, label: 'import React' },
  { pattern: /require\(\s*['"]react/, label: 'require React' },
  { pattern: /\bwindow\./, label: 'accès window' },
  { pattern: /\bdocument\./, label: 'accès document' },
  { pattern: /\bnavigator\./, label: 'accès navigator' },
  { pattern: /\blocalStorage\b/, label: 'accès localStorage' },
  { pattern: /\bfetch\s*\(/, label: 'appel fetch' },
  { pattern: /\bgetUserMedia\b/, label: 'getUserMedia' },
  { pattern: /\bAudioContext\b/, label: 'AudioContext' },
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const violations = [];
for (const dir of PURE_DIRS) {
  let files = [];
  try {
    files = walk(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(line)) {
          violations.push(`${file}:${i + 1} — ${label} : ${line.trim()}`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('❌ Modules purs contaminés par des dépendances React/DOM :\n');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(`✅ check:pure — ${PURE_DIRS.join(', ')} sans import React ni API navigateur.`);
