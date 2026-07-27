// tests/roofSourceUnification.test.mjs
// ★ B4.7.8 sesión 2 (B-02 + B-03 + B-04) — Fuente única de techumbre.
//
// Regresión que cubre: con la techumbre persistida como faldones (`model.roofPlanes`),
// `model.roofSystems` queda vacío. Tres consumidores seguían leyéndolo directo:
//   B-02  computeRoofPlanSegments / computeRoofElevationSegments → sin snap ni hit-test de cerchas
//   B-03  exportCalculix.js → el .inp global salía con muros pero sin cerchas
//   B-04  getRoofSystems daba precedencia al legacy → un modelo migrado que conservara sistemas
//         viejos los seguía exportando y los faldones nuevos quedaban invisibles
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeRoofPlanSegments, computeRoofElevationSegments } from '../src/core/roofSegments.js';
import { getRoofSystems } from '../src/core/roofPlaneOutputs.js';
import { findRoofSystemAtPoint } from '../src/core/hitTest.js';
import { buildRoofPurlinBoxes } from '../src/core/build3d.js';
import { generateCalculix } from '../src/core/exportCalculix.js';
import { validateRoofSystems } from '../src/core/trussLayout.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));

// Mismo faldón que tests/roofPlaneInnerFace.test.mjs: eje A de la casa en L, dos tramos.
const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfileH: 35,
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 },
    { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};

/** Modelo migrado: sólo faldones, `roofSystems` vacío (el estado real tras B4.7). */
const planeOnly = { ...base, roofPlanes: [planeEjeA], roofSystems: [] };
/** Modelo a medio migrar: faldón nuevo + los 19 sistemas legacy del fixture todavía en el JSON. */
const bothSources = { ...base, roofPlanes: [planeEjeA] };
/** Modelo legacy puro. */
const legacyOnly = { ...base, roofPlanes: [] };

// ---------------------------------------------------------------------------------------------
// B-02 — segmentos de planta y elevación
// ---------------------------------------------------------------------------------------------

test('B-02: computeRoofPlanSegments ve las cerchas del faldón (roofSystems vacío)', () => {
  assert.equal(planeOnly.roofSystems.length, 0, 'premisa: la fuente legacy está vacía');
  const segs = computeRoofPlanSegments(planeOnly);
  assert.ok(segs.length > 0, 'antes devolvía [] y no había nada que enganchar ni seleccionar');
  const ids = new Set(segs.map(s => s.systemId));
  assert.deepEqual([...ids].sort(), ['ejeA__t0', 'ejeA__t1'], 'un systemId por tramo del faldón');
  for (const s of segs) {
    assert.ok(Number.isFinite(s.h1) && Number.isFinite(s.v1), 'segmento con coordenadas válidas');
  }
});

test('B-02: los segmentos de planta cuadran con las posiciones de cercha del faldón', () => {
  const systems = getRoofSystems(planeOnly);
  const total = systems.reduce((n, s) => n + s.trussPositions.length, 0);
  assert.equal(computeRoofPlanSegments(planeOnly).length, total, 'un segmento por cercha');
});

test('B-02: hit-test selecciona el sistema del faldón bajo el punto', () => {
  const seg = computeRoofPlanSegments(planeOnly)[0];
  const mid = { x: (seg.h1 + seg.h2) / 2, y: (seg.v1 + seg.v2) / 2 };
  assert.equal(findRoofSystemAtPoint(planeOnly, mid, 50), seg.systemId);
  // control: lejos de toda cercha no selecciona nada
  assert.equal(findRoofSystemAtPoint(planeOnly, { x: -50000, y: -50000 }, 50), null);
});

test('B-02: computeRoofElevationSegments dibuja la cercha del faldón en su corte', () => {
  // eje x=4200 cae dentro del rango de cerchas del tramo t0 (3050,55 → 12650,55)
  const axis = base.grid.xAxes.find(a => a.position === 4200);
  assert.ok(axis, 'premisa: el fixture tiene el eje x=4200');
  const segs = computeRoofElevationSegments(planeOnly, `elevation-x-${axis.id}`);
  assert.ok(segs.length > 0, 'antes devolvía [] — sin celosía en elevación');
  // un corte fuera del rango de cerchas no inventa geometría
  const outside = base.grid.xAxes.find(a => a.position === 0);
  assert.equal(computeRoofElevationSegments(planeOnly, `elevation-x-${outside.id}`).length, 0);
});

test('B-02: el legacy sigue funcionando igual (misma cuenta de segmentos)', () => {
  const segs = computeRoofPlanSegments(legacyOnly);
  const total = (legacyOnly.roofSystems || [])
    .filter(s => s.trussGeometry?.resolved && s.trussPositions?.length)
    .reduce((n, s) => n + s.trussPositions.length, 0);
  assert.ok(total > 0, 'premisa: el fixture trae sistemas legacy resueltos');
  assert.equal(segs.length, total);
});

// ---------------------------------------------------------------------------------------------
// B-03 — .inp global
// ---------------------------------------------------------------------------------------------

const chordMarks = (inp) => (inp.match(/CUERDA_/g) || []).length;

test('B-03: el .inp global incluye las cerchas del faldón', () => {
  assert.ok(chordMarks(generateCalculix(planeOnly)) > 0,
    'antes el .inp salía con muros y sin ninguna cuerda de cercha');
});

test('B-03: sin techumbre el .inp no inventa cuerdas', () => {
  assert.equal(chordMarks(generateCalculix({ ...base, roofPlanes: [], roofSystems: [] })), 0);
});

// ---------------------------------------------------------------------------------------------
// B-04 — precedencia invertida
// ---------------------------------------------------------------------------------------------

test('B-04: con ambas fuentes presentes manda el faldón', () => {
  assert.ok(bothSources.roofSystems.length > 0, 'premisa: quedan sistemas legacy en el JSON');
  assert.deepEqual(getRoofSystems(bothSources).map(s => s.id), ['ejeA__t0', 'ejeA__t1']);
});

test('B-04: sin faldones se cae al legacy tal cual', () => {
  // ★ s5-C — el legacy se devuelve sin tocar salvo por la normalización del alias `elevation`
  // de los ledgers persistidos: mismos sistemas, mismo orden, mismas cerchas.
  const got = getRoofSystems(legacyOnly);
  assert.deepEqual(got.map(s => s.id), legacyOnly.roofSystems.map(s => s.id));
  assert.deepEqual(
    got.map(s => ({ ...s, supportLedgers: undefined })),
    legacyOnly.roofSystems.map(s => ({ ...s, supportLedgers: undefined })),
    'sólo cambian los ledgers'
  );
  assert.equal(getRoofSystems(legacyOnly), got, 'memoizado: misma referencia entre llamadas');
  assert.deepEqual(getRoofSystems({ roofPlanes: [], roofSystems: [] }), []);
  assert.deepEqual(getRoofSystems(null), []);
});

test('B-04: las costaneras no se duplican al coexistir ambas fuentes', () => {
  // Los sistemas expandidos traen geo.purlins=[] a propósito: el bucle legacy de build3d no
  // debe volver a emitirlas ni arrastrar las de los 19 sistemas viejos.
  assert.deepEqual(buildRoofPurlinBoxes(bothSources), buildRoofPurlinBoxes(planeOnly));
});

// ---------------------------------------------------------------------------------------------
// B-05 (parche s2b) — validateRoofSystems deja de reportar geometría fantasma
// ---------------------------------------------------------------------------------------------

test('B-05: con faldones vivos, el legacy sombreado se reporta UNA vez y sin findings de geometría', () => {
  const findings = validateRoofSystems(bothSources);
  assert.equal(findings.length, 1, 'un solo finding, no los solapes/apoyos de 19 sistemas fantasma');
  assert.equal(findings[0].category, 'legacyShadowed');
  assert.equal(findings[0].severity, 'info', 'no bloquea nada: son datos muertos, no un error');
  assert.match(findings[0].message, /19 sistemas de techumbre legacy/);
  assert.deepEqual(findings[0].roofSystemIds, [], 'sin ids apuntables: el modal no debe seleccionar un fantasma');
});

test('B-05: el finding sombreado reemplaza a los de geometría, que sí existían', () => {
  const legacyFindings = validateRoofSystems(legacyOnly);
  assert.ok(legacyFindings.length > 1, 'premisa: el fixture legacy sí produce varios findings');
  assert.ok(legacyFindings.every(f => f.category !== 'legacyShadowed'), 'sin faldones no aplica');
});

test('B-05: faldones sin legacy residual → nada que reportar', () => {
  assert.deepEqual(validateRoofSystems(planeOnly), []);
});

test('B-05: singular cuando queda un solo sistema legacy', () => {
  const one = { ...base, roofPlanes: [planeEjeA], roofSystems: [base.roofSystems[0]] };
  assert.match(validateRoofSystems(one)[0].message, /^1 sistema de techumbre legacy quedó/);
});
