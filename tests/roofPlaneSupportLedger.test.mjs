// tests/roofPlaneSupportLedger.test.mjs
// ★ B4.7.8-s3 (A-01 + B.1 + B.2) — Soleras de apoyo del faldón y salud del 3D.
//
// Lo que cubre:
//   A.3  perpHighInner = cara interior del muro de apoyo alto (escala con el espesor real).
//   A.4  finding `supportLedger` cuando el perfil no cabe en la holgura de cielo (o no se resuelve).
//   A.5  el adaptador emite 2 ledgers por tramo en modo 'lateral', con la convención vertical fijada.
//   B.1  buildSupportLedgerBoxes: una caja por ledger, cara superior en supportElevation.
//   B.2  el ancho de la costanera sale de la librería, no del 40 hardcodeado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRoofPlane } from '../src/core/roofPlane.js';
import { roofPlaneToSystems } from '../src/core/roofPlaneAdapter.js';
import { getRoofSystems, getRoofPurlinBoxes } from '../src/core/roofPlaneOutputs.js';
import { buildSupportLedgerBoxes } from '../src/core/build3d.js';
import { computeTakeoff } from '../src/core/takeoff.js';
import { generateCalculixTruss } from '../src/core/exportCalculixTruss.js';
import { resolveWallGeometry } from '../src/core/elementGeometry.js';
import { buildParamsMap } from '../src/core/projectParams.js';

const TOL = 0.01;
const here = dirname(fileURLToPath(import.meta.url));
const modelReal = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));
const paramsMapReal = buildParamsMap(modelReal.projectParams || []);
const LIB = modelReal.library;

const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800,
  purlinProfile: '35OMA085',
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 },
    { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};

function resolveA(overrides = {}) {
  const plane = { ...planeEjeA, ...overrides };
  return { plane, resolved: resolveRoofPlane({ model: modelReal, plane, paramsMap: paramsMapReal, library: LIB }) };
}

/** modelo con SÓLO el faldón vivo (sin los 19 sistemas legacy residuales). */
function modelFaldon(overrides = {}) {
  const plane = { ...planeEjeA, ...overrides };
  return { model: { ...modelReal, roofSystems: [], roofPlanes: [plane] }, plane };
}

// ---------------------------------------------------------------------------------------------
// A.3 — cara interior del apoyo alto
// ---------------------------------------------------------------------------------------------
function wallPerp(wallId, runAxis) {
  const w = modelReal.elements.find(e => e.id === wallId);
  const geo = resolveWallGeometry(w, modelReal.grid, paramsMapReal, {});
  return { perp: runAxis === 'x' ? geo.p1.y : geo.p1.x, thickness: geo.thickness };
}

test('A.3 — perpHighInner cae en la cara interior del muro alto, no en su eje', () => {
  const { resolved } = resolveA();
  assert.ok(resolved.resolved);
  assert.ok(resolved.tramos.length > 0);
  for (const t of resolved.tramos) {
    const alto = wallPerp(t.wallHighId, resolved.runAxis);
    const esperado = alto.perp - resolved.spanDir * alto.thickness / 2;
    assert.ok(Math.abs(t.perpHighInner - esperado) < TOL,
      `tramo ${t.wallHighId}: perpHighInner ${t.perpHighInner} vs cara interior ${esperado}`);
    assert.ok(Math.abs(t.perpHigh - alto.perp) < TOL, 'perpHigh se conserva intacto (eje del muro)');
    // el remate de la cercha coincide con la cara interior: perpInner + spanDir·span
    assert.ok(Math.abs(resolved.perpInner + resolved.spanDir * t.span - t.perpHighInner) < TOL,
      'la luz medida entre caras interiores remata exactamente en perpHighInner');
  }
});

test('A.3 — el desfase perpHigh→perpHighInner escala con el espesor real (no es constante)', () => {
  const { resolved } = resolveA();
  const offsets = resolved.tramos.map(t => Math.abs(t.perpHigh - t.perpHighInner));
  const thicks = resolved.tramos.map(t => wallPerp(t.wallHighId, resolved.runAxis).thickness);
  for (let i = 0; i < offsets.length; i++) {
    assert.ok(Math.abs(offsets[i] - thicks[i] / 2) < TOL, `tramo ${i}: desfase = t/2`);
  }
});

// ---------------------------------------------------------------------------------------------
// A.4 — finding supportLedger
// ---------------------------------------------------------------------------------------------
const ledgerFindings = (r) => r.findings.filter(f => f.category === 'supportLedger');

test('A.4 — 90CA085 con supportOffset 100 NO produce finding de solera', () => {
  const { resolved } = resolveA();
  assert.equal(resolved.supportLedgerProfile.code, '90CA085');
  assert.equal(resolved.supportLedgerProfile.h, 90);
  assert.deepEqual(ledgerFindings(resolved), []);
});

test('A.4 — hSolera > supportOffset produce finding error/supportLedger', () => {
  const { resolved } = resolveA({ supportProfile: '150CA085' });
  const fs = ledgerFindings(resolved);
  assert.equal(fs.length, 1);
  assert.equal(fs[0].severity, 'error');
  assert.match(fs[0].message, /150CA085/);
  assert.ok(/150/.test(fs[0].message) && /100/.test(fs[0].message));
});

test('A.4 — perfil no resoluble → finding info (no se puede verificar)', () => {
  const { resolved } = resolveA({ supportProfile: 'NO-EXISTE-999' });
  const fs = ledgerFindings(resolved);
  assert.equal(fs.length, 1);
  assert.equal(fs[0].severity, 'info');
  assert.equal(resolved.supportLedgerProfile, null);
});

test('A.4 — ningún finding de solera bloquea: el faldón sigue resuelto', () => {
  const { resolved } = resolveA({ supportProfile: '150CA085' });
  assert.equal(resolved.resolved, true);
});

// ---------------------------------------------------------------------------------------------
// A.5 — el adaptador emite los ledgers
// ---------------------------------------------------------------------------------------------
test('A.5 — supportMode lateral → 2 ledgers por tramo, con la convención vertical explícita', () => {
  const { plane, resolved } = resolveA();
  const { systems } = roofPlaneToSystems(plane, resolved, paramsMapReal);
  assert.ok(systems.length > 0);
  const hSolera = resolved.supportLedgerProfile.h;
  for (const s of systems) {
    assert.equal(s.supportLedgers.length, 2, `sistema ${s.id}`);
    const [low, high] = s.supportLedgers;
    assert.equal(low.side, 'low');
    assert.equal(low.wallId, plane.canalWallId);
    assert.equal(high.side, 'high');
    assert.equal(high.wallId, s.wallHighId);
    for (const led of s.supportLedgers) {
      assert.equal(led.topElevation, resolved.supportElevation);
      assert.equal(led.elevation, undefined, '★ s5-C — el alias legacy ya no se emite');
      assert.equal(led.baseElevation + hSolera, led.topElevation);
      assert.equal(led.profile, '90CA085');
      assert.equal(led.runAxis, resolved.runAxis);
      assert.ok(led.length > 0);
    }
    // cada ledger corre sobre la cara interior de SU muro
    const perpDe = (p) => resolved.runAxis === 'x' ? p.y : p.x;
    assert.ok(Math.abs(perpDe(low.p1) - resolved.perpInner) < TOL);
    const tramo = resolved.tramos.find(t => t.wallHighId === s.wallHighId);
    assert.ok(Math.abs(perpDe(high.p1) - tramo.perpHighInner) < TOL);
  }
});

test('A.5 — supportMode distinto de lateral → 0 ledgers', () => {
  const { plane, resolved } = resolveA({ supportMode: 'coronacion' });
  const { systems } = roofPlaneToSystems(plane, resolved, paramsMapReal);
  assert.ok(systems.length > 0);
  for (const s of systems) assert.deepEqual(s.supportLedgers, []);
});

test('A.5 — el largo del ledger es el rango de corrida del tramo', () => {
  const { plane, resolved } = resolveA();
  const { systems } = roofPlaneToSystems(plane, resolved, paramsMapReal);
  for (const s of systems) {
    for (const led of s.supportLedgers) {
      assert.ok(Math.abs(led.length - (s.runRange.to - s.runRange.from)) < TOL);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// A.5 — consumidores aguas abajo: metrado y .inp
// ---------------------------------------------------------------------------------------------
test('A.5 — el metrado del faldón suma las soleras en el grupo roof (antes 0)', () => {
  const { model } = modelFaldon();
  const ledgers = getRoofSystems(model).flatMap(s => s.supportLedgers || []);
  assert.ok(ledgers.length > 0, 'hay ledgers en los sistemas expandidos');
  const mlEsperado = ledgers.reduce((a, l) => a + l.length, 0) / 1000;

  const conLedgers = computeTakeoff(model);
  const sinLedgers = computeTakeoff({
    ...model,
    roofPlanes: [{ ...model.roofPlanes[0], supportMode: 'coronacion' }]
  });
  const sumRoof = (t, k) => t.rows.filter(r => r.type === 'roof').reduce((a, r) => a + (r[k] || 0), 0);
  const dMl = sumRoof(conLedgers, 'ml') - sumRoof(sinLedgers, 'ml');
  const dCount = sumRoof(conLedgers, 'count') - sumRoof(sinLedgers, 'count');
  assert.ok(Math.abs(dMl - mlEsperado) < 0.5,
    `las soleras aportan ${mlEsperado.toFixed(2)} ml al metrado (delta medido ${dMl.toFixed(2)})`);
  assert.equal(dCount, ledgers.length, 'una unidad de count por solera');
});

test('A.5 — el .inp de cercha del faldón trae líneas APOYO LATERAL (antes ninguna)', () => {
  const { model } = modelFaldon();
  const inp = generateCalculixTruss(model);
  const n = inp.split('\n').filter(l => l.includes('** APOYO LATERAL')).length;
  const esperado = getRoofSystems(model).reduce((a, s) => a + (s.supportLedgers || []).length, 0);
  assert.ok(esperado > 0);
  assert.equal(n, esperado);
});

// ---------------------------------------------------------------------------------------------
// B.1 — cajas 3D de las soleras
// ---------------------------------------------------------------------------------------------
test('B.1 — una caja por ledger, cara superior exactamente en supportElevation', () => {
  const { model, plane } = modelFaldon();
  const resolved = resolveRoofPlane({ model, plane, paramsMap: paramsMapReal, library: LIB });
  const boxes = buildSupportLedgerBoxes(model);
  const ledgers = getRoofSystems(model).flatMap(s => s.supportLedgers || []);
  assert.equal(boxes.length, ledgers.length);
  assert.ok(boxes.length > 0);

  const h = resolved.supportLedgerProfile.h;  // 90
  const b = resolved.supportLedgerProfile.b;  // 38
  for (const box of boxes) {
    const top = box.center.y + box.size.y / 2;
    assert.ok(Math.abs(top - resolved.supportElevation) < TOL, 'cara superior en supportElevation');
    assert.ok(Math.abs(box.size.y - h) < TOL, 'alto = H del perfil');
    const ancho = resolved.runAxis === 'x' ? box.size.z : box.size.x;
    assert.ok(Math.abs(ancho - b) < TOL, 'ancho = B del perfil');
  }
});

test('B.1 — la solera no invade el cielo falso: base ≥ nivel de cielo', () => {
  const { model, plane } = modelFaldon();
  const resolved = resolveRoofPlane({ model, plane, paramsMap: paramsMapReal, library: LIB });
  const cielo = resolved.supportElevation - resolved.supportOffset;
  for (const box of buildSupportLedgerBoxes(model)) {
    assert.ok(box.center.y - box.size.y / 2 >= cielo - TOL,
      'la base de la solera queda dentro de la holgura del cielo');
  }
});

test('B.1 — sin modo lateral no se dibuja ninguna solera', () => {
  const { model } = modelFaldon({ supportMode: 'coronacion' });
  assert.deepEqual(buildSupportLedgerBoxes(model), []);
});

test('B.1 — el legacy (sólo `elevation`) también se dibuja: elevation = cara superior', () => {
  const casaL = JSON.parse(readFileSync(join(here, 'fixtures/casa-L.json'), 'utf8'));
  const boxes = buildSupportLedgerBoxes(casaL);
  const ledgers = (casaL.roofSystems || []).flatMap(s => s.supportLedgers || []);
  assert.ok(ledgers.length > 0, 'el fixture legacy trae ledgers');
  assert.equal(boxes.length, ledgers.length);
  for (const box of boxes) {
    const top = box.center.y + box.size.y / 2;
    const ok = ledgers.some(l => Math.abs(l.elevation - top) < TOL);
    assert.ok(ok, 'la cara superior de la caja coincide con el `elevation` legacy');
  }
});

// ---------------------------------------------------------------------------------------------
// B.2 — ancho de costanera desde la librería
// ---------------------------------------------------------------------------------------------
test('B.2 — con 35OMA085 la caja de costanera mide 38mm de ancho, no 40', () => {
  const { model } = modelFaldon();
  const boxes = getRoofPurlinBoxes(model);
  assert.ok(boxes.length > 0);
  const anchoDe = (b) => Math.min(b.size.x, b.size.z);
  for (const b of boxes) {
    assert.ok(Math.abs(anchoDe(b) - 38) < TOL, `ancho ${anchoDe(b)} — debe salir de la librería (B=38)`);
  }
});

test('B.2 — el 40 sólo queda como fallback: perfil fuera de librería mantiene el default', () => {
  const { model } = modelFaldon({ purlinProfile: 'NO-EXISTE-999' });
  const boxes = getRoofPurlinBoxes(model);
  assert.ok(boxes.length > 0);
  const anchoDe = (b) => Math.min(b.size.x, b.size.z);
  for (const b of boxes) assert.ok(Math.abs(anchoDe(b) - 40) < TOL);
});
