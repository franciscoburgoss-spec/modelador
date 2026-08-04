import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMutationMatrixMarkdown } from '../src/core/derivedInvalidation.js';
import { EXPORT_POLICIES } from '../src/core/exportPolicy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrixPath = path.join(root, 'governance', 'DERIVED_STATE_MATRIX.md');
const expectedMatrix = renderMutationMatrixMarkdown();
const actualMatrix = fs.readFileSync(matrixPath, 'utf8');

if (actualMatrix !== expectedMatrix) {
  console.error('governance/DERIVED_STATE_MATRIX.md no coincide con el registro central.');
  process.exit(1);
}

const guardedSources = new Map([
  ['agnostic-geometry-json', 'src/core/agnosticGeometry.js'],
  ['agnostic-geometry-audit-json', 'src/core/agnosticGeometry.js'],
  ['takeoff-csv', 'src/core/takeoff.js'],
  ['dxf-plan', 'src/core/exportDxf.js'],
  ['dxf-framing', 'src/core/exportFramingDxf.js'],
  ['dxf-osb', 'src/core/exportOsbDxf.js'],
  ['dxf-truss', 'src/core/exportTrussDxf.js'],
  ['dxf-foundation', 'src/core/exportFoundationsDxf.js'],
  ['dxf-framing-sheets', 'src/core/exportSheetsDxf.js'],
  ['dxf-osb-sheets', 'src/core/exportSheetsDxf.js'],
  ['dxf-truss-sheets', 'src/core/exportSheetsDxf.js'],
  ['calculix-global', 'src/core/exportCalculix.js'],
  ['calculix-truss', 'src/core/exportCalculixTruss.js'],
  ['calculix-foundation', 'src/core/exportCalculixFoundation.js']
]);

for (const exporter of Object.keys(EXPORT_POLICIES)) {
  const relativePath = guardedSources.get(exporter);
  if (!relativePath) {
    console.error(`Exportador sin entry point inventariado: ${exporter}`);
    process.exit(1);
  }
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (!source.includes(`guardExport(model, '${exporter}')`)) {
    console.error(`${relativePath} no aplica la política ${exporter}.`);
    process.exit(1);
  }
}

console.log(
  `Contrato de derivados válido: ${Object.keys(EXPORT_POLICIES).length} exportadores y `
  + `${expectedMatrix.split('\n').filter((line) => line.startsWith('| `')).length} mutadores.`
);
