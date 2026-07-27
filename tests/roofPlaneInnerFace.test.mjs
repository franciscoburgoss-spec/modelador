// tests/roofPlaneInnerFace.test.mjs
// ★ B4.7.8 / B-01 — El x_local = 0 de la cercha es la CARA INTERIOR de la canaleta, no su eje.
//
// Regresión que cubre: resolveRoofPlane devolvía `perp` = eje del muro canaleta y el adaptador lo
// usaba como origen local, pero `span` está medido entre CARAS INTERIORES. La cercha quedaba
// corrida medio espesor: embebida en el muro bajo y despegada del alto (mismo error en las
// costaneras, que parten del mismo origen). Afectaba a 3D, DXF, metrado y .inp, no solo al dibujo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRoofPlane } from '../src/core/roofPlane.js';
import { roofPlaneToSystems, expandRoofPlanes } from '../src/core/roofPlaneAdapter.js';
import { getRoofPurlinBoxes } from '../src/core/roofPlaneOutputs.js';
import { resolveWallGeometry } from '../src/core/elementGeometry.js';
import { buildParamsMap } from '../src/core/projectParams.js';

const TOL = 0.01;

// ---------------------------------------------------------------------------------------------
// Caso mínimo con números redondos: dos muros paralelos de 100mm, ejes en y=0 e y=3000.
// Caras interiores en y=50 e y=2950 → luz 2900. El origen local debe ser 50, no 0.
// ---------------------------------------------------------------------------------------------
function minimalModel(thickness = 100) {
  const zLevels = [
    { id: 'z0', elevation: 0, label: 'NTN', levelType: 'terreno' },
    { id: 'z1', elevation: 2400, label: 'CIELO', levelType: 'cieloGeneral' },
    { id: 'z2', elevation: 3400, label: 'FRONTON', levelType: 'frontonGeneral' }
  ];
  const wall = (id, axisY) => ({
    id, type: 'wall', direction: 'x',
    xStart: 'ax1', xEnd: 'ax2', yStart: axisY, yEnd: axisY,
    thickness, bottomZ: 'z0', topZ: 'z2'
  });
  return {
    grid: {
      xAxes: [{ id: 'ax1', position: 0 }, { id: 'ax2', position: 6000 }],
      yAxes: [{ id: 'ayA', position: 0 }, { id: 'ayB', position: 3000 }],
      zLevels
    },
    elements: [wall('A', 'ayA'), wall('B', 'ayB')],
    roofSystems: [],
    roofPlanes: []
  };
}

const minimalPlane = {
  id: 'p1', canalWallId: 'A', supportLevelId: 'z1', supportOffset: 100,
  crownClearance: 200, heelHeight: 0, gutterNotchWidth: 0, trussSpacing: 1200,
  purlinSpacing: 600, purlinProfileH: 35,
  polygon: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 3000 }, { x: 0, y: 3000 }]
};

test('caso mínimo: el origen local de la cercha es la cara interior de la canaleta', () => {
  const model = minimalModel(100);
  const resolved = resolveRoofPlane({ model, plane: minimalPlane });
  assert.ok(resolved.resolved, 'faldón resuelto');
  assert.equal(resolved.perp, 0, 'perp sigue siendo el eje del muro (dato informativo)');
  assert.equal(resolved.perpInner, 50, 'perpInner = eje + spanDir·t/2');

  const { systems } = roofPlaneToSystems(minimalPlane, resolved);
  assert.equal(systems.length, 1);
  const s = systems[0];
  assert.equal(Math.round(s.span), 2900, 'luz entre caras interiores');
  for (const p of s.trussPositions) {
    assert.equal(p.world.y, 50, 'x_local=0 en la cara interior del muro bajo');
  }
});

test('caso mínimo: el extremo alto de la cercha llega a la cara interior del muro alto', () => {
  const model = minimalModel(100);
  const resolved = resolveRoofPlane({ model, plane: minimalPlane });
  const { systems } = roofPlaneToSystems(minimalPlane, resolved);
  const s = systems[0];
  const perp0 = s.trussPositions[0].world.y;
  assert.equal(perp0 + s.spanDir * s.span, 2950, 'x_local=span en la cara interior del muro alto');
});

test('el desfase escala con el espesor real del muro (no es una constante)', () => {
  for (const t of [90, 101.1, 150]) {
    const model = minimalModel(t);
    const resolved = resolveRoofPlane({ model, plane: minimalPlane });
    assert.ok(Math.abs(resolved.perpInner - t / 2) < TOL, `t=${t}: perpInner = t/2`);
    const { systems } = roofPlaneToSystems(minimalPlane, resolved);
    const s = systems[0];
    assert.ok(Math.abs(s.trussPositions[0].world.y + s.spanDir * s.span - (3000 - t / 2)) < TOL,
      `t=${t}: el extremo alto cae en la cara interior del muro alto`);
  }
});

// ---------------------------------------------------------------------------------------------
// Modelo real (casa en L): mismas invariantes contra la geometría de los muros del modelo.
// ---------------------------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const modelReal = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));
const paramsMapReal = buildParamsMap(modelReal.projectParams || []);

const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfileH: 35,
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 },
    { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};

/** Coordenada perpendicular del eje de un muro del modelo real. */
function wallPerp(model, wallId, runAxis) {
  const w = model.elements.find(e => e.id === wallId);
  const geo = resolveWallGeometry(w, model.grid, paramsMapReal, {});
  return { perp: runAxis === 'x' ? geo.p1.y : geo.p1.x, thickness: geo.thickness };
}

test('modelo real: world de cada cercha está en la cara interior de la canaleta', () => {
  const resolved = resolveRoofPlane({ model: modelReal, plane: planeEjeA, paramsMap: paramsMapReal });
  const canal = wallPerp(modelReal, planeEjeA.canalWallId, resolved.runAxis);
  const esperado = canal.perp + resolved.spanDir * canal.thickness / 2;
  assert.ok(Math.abs(resolved.perpInner - esperado) < TOL, 'perpInner = cara interior de la canaleta');

  const { systems } = roofPlaneToSystems(planeEjeA, resolved, paramsMapReal);
  for (const s of systems) {
    for (const p of s.trussPositions) {
      const perp = s.runAxis === 'x' ? p.world.y : p.world.x;
      assert.ok(Math.abs(perp - esperado) < TOL, `sistema ${s.id}: origen en la cara interior`);
    }
  }
});

test('modelo real: cada tramo remata en la cara interior de SU muro de apoyo alto', () => {
  const resolved = resolveRoofPlane({ model: modelReal, plane: planeEjeA, paramsMap: paramsMapReal });
  const { systems } = roofPlaneToSystems(planeEjeA, resolved, paramsMapReal);
  for (const s of systems) {
    const alto = wallPerp(modelReal, s.wallHighId, s.runAxis);
    const caraAlta = alto.perp - s.spanDir * alto.thickness / 2;
    const extremo = resolved.perpInner + s.spanDir * s.span;
    assert.ok(Math.abs(extremo - caraAlta) < TOL,
      `sistema ${s.id}: extremo ${extremo} vs cara interior alta ${caraAlta}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Costaneras: parten del mismo origen, así que arrastraban el mismo desfase.
// ---------------------------------------------------------------------------------------------
test('las costaneras del faldón parten de la cara interior, no del eje', () => {
  const resolved = resolveRoofPlane({ model: modelReal, plane: planeEjeA, paramsMap: paramsMapReal });
  const m2 = { ...modelReal, roofSystems: [], roofPlanes: [planeEjeA] };
  const { purlinsByPlane } = expandRoofPlanes(
    m2, (plane) => resolveRoofPlane({ model: m2, plane, paramsMap: paramsMapReal }), paramsMapReal
  );
  assert.ok(Math.abs(purlinsByPlane[0].perp - resolved.perpInner) < TOL,
    'purlinsByPlane usa perpInner como origen');
});

test('las cajas 3D de costanera quedan dentro de la luz de la cercha', () => {
  const m2 = { ...modelReal, roofSystems: [], roofPlanes: [planeEjeA] };
  const resolved = resolveRoofPlane({ model: m2, plane: planeEjeA, paramsMap: paramsMapReal });
  const boxes = getRoofPurlinBoxes(m2);
  assert.ok(boxes.length > 0, 'hay cajas de costanera');

  const canal = wallPerp(modelReal, planeEjeA.canalWallId, resolved.runAxis);
  const caraBaja = canal.perp + resolved.spanDir * canal.thickness / 2;
  // la costanera más cercana a la canaleta no puede quedar dentro del muro (perp < cara interior)
  const perpDe = (b) => resolved.runAxis === 'x' ? b.center.z : b.center.x;
  const minPerp = Math.min(...boxes.map(perpDe));
  assert.ok(resolved.spanDir * (minPerp - caraBaja) >= -TOL,
    `costanera más baja en ${minPerp}, cara interior en ${caraBaja} — ninguna dentro del muro`);
});
