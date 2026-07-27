// lab/roofPlane/harness.mjs
// Render de planta del faldón resuelto a SVG, para inspección visual sin levantar la app.
// Uso: node lab/roofPlane/harness.mjs > /tmp/plane.svg
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRoofPlane } from './core/roofPlane.js';
import { buildParamsMap } from '../../src/core/projectParams.js';

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, 'fixtures/modelo-26.json'), 'utf8'));
const paramsMap = buildParamsMap(model.projectParams || []);

const plane = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132,
  supportOffset: 100, crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200,
  trussSpacing: 1200, chainOrigin: 'start', shortSpanThreshold: 500,
  purlinSpacing: 800, purlinProfileH: 35, purlinCommercialLength: 6000, purlinOverlap: 100,
  highWalls: [1784604634483, 1784819708086]
};

const r = resolveRoofPlane({ model, plane, paramsMap });

// bbox en coordenadas de faldón: run (horizontal) x perp-desde-canaleta (vertical)
const perpCanal = r.perp;
const spanMax = Math.max(...r.tramos.map(t => t.span));
const runMin = Math.min(...r.tramos.map(t => t.runFrom));
const runMax = Math.max(...r.tramos.map(t => t.runTo));
const W = runMax - runMin, H = spanMax;
const pad = 300, sc = 900 / W;
const X = v => pad + (v - runMin) * sc;
const Y = v => pad + v * sc; // perp desde canaleta hacia arriba (canaleta en 0)

const el = [];
el.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * sc + 2 * pad}" height="${H * sc + 2 * pad}" font-family="sans-serif" font-size="11">`);
el.push(`<rect width="100%" height="100%" fill="#fff"/>`);

// tramos (huella del agua)
for (const t of r.tramos) {
  el.push(`<rect x="${X(t.runFrom)}" y="${Y(0)}" width="${(t.runTo - t.runFrom) * sc}" height="${t.span * sc}" fill="#e8f0fe" stroke="#88a" stroke-width="1"/>`);
  el.push(`<text x="${X((t.runFrom + t.runTo) / 2)}" y="${Y(t.span / 2)}" text-anchor="middle" fill="#446">luz ${Math.round(t.span)}</text>`);
}
// canaleta (línea baja)
el.push(`<line x1="${X(runMin)}" y1="${Y(0)}" x2="${X(runMax)}" y2="${Y(0)}" stroke="#c33" stroke-width="3"/>`);
el.push(`<text x="${X(runMin)}" y="${Y(0) + 18}" fill="#c33">canaleta</text>`);

// cerchas (línea de canaleta a su tramo)
for (const p of r.trussPositions) {
  const t = r.tramos.find(tr => p.offset >= tr.runFrom - 1 && p.offset <= tr.runTo + 1);
  const span = t ? t.span : spanMax;
  const color = p.kind === 'shifted' ? '#e80' : '#2a2';
  el.push(`<line x1="${X(p.offset)}" y1="${Y(0)}" x2="${X(p.offset)}" y2="${Y(span)}" stroke="${color}" stroke-width="1.5"/>`);
}
// costaneras (líneas paralelas a canaleta, troceadas)
for (const pu of r.purlins) {
  for (const pc of pu.pieces) {
    el.push(`<line x1="${X(pc.runFrom)}" y1="${Y(pu.s)}" x2="${X(pc.runTo)}" y2="${Y(pu.s)}" stroke="#39c" stroke-width="1" opacity="0.8"/>`);
    if (pc.spliceAtTruss) el.push(`<circle cx="${X(pc.runTo - plane.purlinOverlap)}" cy="${Y(pu.s)}" r="3" fill="#39c"/>`);
  }
}
el.push(`<text x="${pad}" y="20" fill="#000">Faldón eje A — pendiente ${r.slopePercent.toFixed(2)}% · ${r.trussPositions.length} cerchas · quiebre en x=12800</text>`);
el.push('</svg>');

process.stdout.write(el.join('\n'));
console.error(`OK: pendiente ${r.slopePercent.toFixed(2)}%, ${r.trussPositions.length} cerchas, ${r.purlins.length} costaneras, ${r.findings.filter(f => f.severity === 'error').length} errores`);
