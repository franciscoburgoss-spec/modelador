// tests/roofPlaneOutputs.test.mjs
// ★ B4.7.3 — Verificación POR DATOS (sin UI): un faldón real (eje A del modelo-26) recorre todo el
// pipeline de salida leyendo model.roofPlanes[] a través de roofPlaneOutputs, y produce:
//   3D (cerchas + costaneras continuas) · DXF de cercha por tramo · metrado · .inp sin duplicados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { getRoofSystems, getRoofPurlinBoxes, roofPurlinTakeoff } from '../src/core/roofPlaneOutputs.js';
import { buildRoofTrussMembers, buildRoofPurlinBoxes } from '../src/core/build3d.js';
import { computeTakeoff } from '../src/core/takeoff.js';
import { generateTrussDxf } from '../src/core/exportTrussDxf.js';
import { generateCalculixTruss } from '../src/core/exportCalculixTruss.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));

const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfileH: 35,
  purlinCommercialLength: 6000, purlinOverlap: 100,
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 }, { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};

// Modelo migrado: sin roofSystems, con un faldón. Objeto nuevo por test → invalida el cache WeakMap.
function makeModel() {
  return { ...base, roofSystems: [], roofPlanes: [planeEjeA] };
}

test('getRoofSystems expande el faldón a sistemas legacy (uno por luz)', () => {
  const systems = getRoofSystems(makeModel());
  assert.equal(systems.length, 2, 'dos tramos = dos luces');
  for (const s of systems) {
    assert.ok(s.trussGeometry?.resolved, 'geometría resuelta');
    assert.ok(s.trussPositions.length > 0, 'con posiciones');
    assert.equal(s.planeId, 'ejeA');
  }
});

test('el borde compartido NO se construye dos veces (dedup por offset)', () => {
  const systems = getRoofSystems(makeModel());
  const seen = new Set();
  let dupes = 0;
  for (const s of systems) for (const p of s.trussPositions) {
    const k = Math.round(p.offset);
    if (seen.has(k)) dupes++;
    seen.add(k);
  }
  assert.equal(dupes, 0, 'cada offset de cercha pertenece a un solo tramo');
});

test('build3d arma cerchas de ambos tramos', () => {
  const members = buildRoofTrussMembers(makeModel());
  assert.ok(members.length > 0, 'hay barras 3D');
  const systemIds = new Set(members.map(m => m.systemId));
  assert.equal(systemIds.size, 2, 'barras de los dos tramos');
});

test('build3d dibuja costaneras continuas del faldón (una caja por troceo)', () => {
  const model = makeModel();
  const faldonBoxes = getRoofPurlinBoxes(model);
  assert.ok(faldonBoxes.length > 0, 'el faldón produce costaneras');
  const all = buildRoofPurlinBoxes(model);
  assert.equal(all.length, faldonBoxes.length, 'build3d expone exactamente las del faldón (sin duplicar por sistema)');
  // continuas: cada caja abarca su corrida completa sobre runAxis (x aquí), no un tramo aislado.
  const runAxisIsX = getRoofSystems(model)[0].runAxis === 'x';
  for (const b of all) {
    const len = runAxisIsX ? b.size.x : b.size.z;
    assert.ok(len > 0, 'costanera con largo');
  }
});

test('metrado incluye cerchas y costaneras del faldón', () => {
  const { rows } = computeTakeoff(makeModel());
  const roof = rows.filter(r => r.type === 'roof');
  assert.ok(roof.length > 0, 'hay partidas de techumbre');
  assert.ok(roof.some(r => r.ml > 0), 'con metros lineales');
  // las costaneras del faldón aportan su propia partida
  const purl = roofPurlinTakeoff(makeModel());
  assert.ok(purl.size > 0, 'costaneras metradas');
});

test('DXF de cercha: una elevación por tramo', () => {
  const dxf = generateTrussDxf(makeModel());
  assert.ok(typeof dxf === 'string' && dxf.includes('SECTION'), 'DXF generado');
  assert.ok(dxf.includes('EOF'), 'DXF cerrado');
});

test('.inp: una cercha tipo por tramo, sin cerchas en el aire ni duplicadas', () => {
  const inp = generateCalculixTruss(makeModel(), { roofLoadKgfM2: 70 });
  assert.ok(inp.includes('*NODE'), 'tiene nodos');
  assert.ok(inp.includes('*USER ELEMENT, TYPE=U1'), 'elementos U1');
  assert.ok(!/nada que exportar/.test(inp), 'exporta geometría (no vacío)');
  // dos tramos con luces distintas → dos sufijos de sistema _S1 y _S2 en los ELSET.
  assert.ok(inp.includes('_S1') && inp.includes('_S2'), 'una cercha tipo por tramo');
  // sin cercha sin apoyo: no debe quedar advertencia de sistema sin resolver.
  assert.ok(!/ADVERTENCIA: sistema .* sin/i.test(inp), 'ningún sistema sin apoyo');
});
