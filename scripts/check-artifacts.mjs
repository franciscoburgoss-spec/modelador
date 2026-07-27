import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const forbiddenTracked = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.vite(\/|$)/,
  /(^|\/)artifacts(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)target(\/|$)/,
  /\.log$/,
  /\.tmp$/,
  /vite\.config\.js\.timestamp-/,
];

let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
} catch (error) {
  console.error(`No se pudo inspeccionar el inventario Git: ${error.message}`);
  process.exit(1);
}

const violations = tracked.filter((file) => forbiddenTracked.some((pattern) => pattern.test(file)));

const legacyGenerated = path.join(root, 'lab', 'roofPlane', 'ejeA-planta.svg');
try {
  const entries = await readdir(path.dirname(legacyGenerated));
  if (entries.includes(path.basename(legacyGenerated))) {
    violations.push('lab/roofPlane/ejeA-planta.svg (output regenerable)');
  }
} catch {
  // El laboratorio todavía no existe: no hay artefacto que reportar.
}

if (violations.length > 0) {
  console.error('Artefactos generados detectados en el baseline:');
  [...new Set(violations)].forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log(`Baseline sin artefactos: ${tracked.length} archivos fuente/documentales inspeccionados.`);
