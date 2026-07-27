import test from 'node:test';
import assert from 'node:assert/strict';
import {
  invalidateDerived, invalidateSystemsForWall, applyWallPatchFlags,
  patchInvalidatesWall, collectStale, formatStaleWarning
} from '../src/core/derivedInvalidation.js';

const grid = {
  xAxes: [{ id: 'x1', position: 0, label: '1' }, { id: 'x2', position: 4000, label: '2' }],
  yAxes: [{ id: 'y1', position: 0, label: 'A' }, { id: 'y2', position: 3000, label: 'B' }],
  zLevels: [{ id: 'z0', elevation: 0, label: 'N0' }, { id: 'z1', elevation: 2400, label: 'N1' }]
};

function makeModel() {
  return {
    grid,
    elements: [
      {
        id: 'w1', type: 'wall', xStart: 'x1', xEnd: 'x2', yStart: 'y1', yEnd: 'y1',
        bottomZ: 'z0', topZ: 'z1', thickness: 90,
        studs: [{ x: 0 }], headers: [], osbCourses: [{ panels: [{}] }]
      },
      {
        id: 'w2', type: 'wall', xStart: 'x1', xEnd: 'x1', yStart: 'y1', yEnd: 'y2',
        bottomZ: 'z0', topZ: 'z1', thickness: 90, studs: [{ x: 0 }]
      },
      { id: 'c1', type: 'column', axisXId: 'x1', axisYId: 'y1' }
    ],
    roofSystems: [
      { id: 'r1', name: 'Cercha P1', wallLowId: 'w1', wallHighId: 'w2', trussGeometry: { ok: true } },
      { id: 'r2', name: 'Cercha P2', wallLowId: 'w9', wallHighId: 'w8', trussGeometry: { ok: true } }
    ]
  };
}

const wallById = (m, id) => m.elements.find((e) => e.id === id);
const sysById = (m, id) => m.roofSystems.find((s) => s.id === id);

test('editar el largo de un muro invalida studs y OSB de ese muro', () => {
  const m = makeModel();
  const patched = { ...m, elements: m.elements.map((e) => e.id === 'w1' ? applyWallPatchFlags(e, { xEnd: 'x1' }) : e) };
  assert.equal(wallById(patched, 'w1').studsStale, true);
  assert.equal(wallById(patched, 'w1').osbStale, true);
  assert.equal(wallById(patched, 'w2').studsStale, undefined);
});

test('editar vanos invalida el muro y sus roofSystems, no los ajenos', () => {
  const m = invalidateDerived(makeModel(), 'w1');
  assert.equal(wallById(m, 'w1').studsStale, true);
  assert.equal(wallById(m, 'w1').osbStale, true);
  assert.equal(sysById(m, 'r1').stale, true);
  assert.equal(sysById(m, 'r2').stale, undefined, 'sistema que no referencia w1 no se invalida');
});

test('un muro sin despiece OSB no recibe osbStale', () => {
  const m = invalidateDerived(makeModel(), 'w2');
  assert.equal(wallById(m, 'w2').studsStale, true);
  assert.equal(wallById(m, 'w2').osbStale, undefined);
});

test('patch no geométrico (solo name) no invalida', () => {
  assert.equal(patchInvalidatesWall({ name: 'Muro eje A' }), false);
  const w = wallById(makeModel(), 'w1');
  const next = applyWallPatchFlags(w, { name: 'Muro eje A' });
  assert.equal(next.studsStale, undefined);
  assert.equal(next.osbStale, undefined);
  const m = makeModel();
  assert.equal(invalidateSystemsForWall(m, 'w404'), m, 'sin coincidencias devuelve la misma referencia');
});

test('regenerar la modulación limpia studsStale pero deja el OSB stale', () => {
  const w = { ...wallById(makeModel(), 'w1'), studsStale: true, osbStale: true };
  const next = applyWallPatchFlags(w, { studs: [{ x: 100 }], headers: [] });
  assert.equal(next.studsStale, false);
  assert.equal(next.osbStale, true, 'el OSB depende de wall.studs');
});

test('regenerar el OSB limpia osbStale', () => {
  const w = { ...wallById(makeModel(), 'w1'), osbStale: true };
  const next = applyWallPatchFlags(w, { osbCourses: [{ panels: [] }], osbNoggings: [] });
  assert.equal(next.osbStale, false);
});

test('invalidación global marca todo lo generado', () => {
  const m = invalidateDerived(makeModel(), 'all');
  assert.equal(wallById(m, 'w1').studsStale, true);
  assert.equal(wallById(m, 'w2').studsStale, true);
  assert.equal(sysById(m, 'r1').stale, true);
  assert.equal(sysById(m, 'r2').stale, true);
});

test('collectStale lista lo desactualizado con nombre legible', () => {
  const st = collectStale(invalidateDerived(makeModel(), 'all'));
  assert.equal(st.isEmpty, false);
  assert.equal(st.walls.length, 2);
  assert.equal(st.systems.length, 2);
  assert.ok(st.walls[0].name.length > 0);
  assert.equal(collectStale(makeModel()).isEmpty, true);
});

test('formatStaleWarning se acota al alcance del exportador', () => {
  const m = invalidateDerived(makeModel(), 'w1');
  assert.match(formatStaleWarning(m, 'framing'), /modulación/);
  assert.match(formatStaleWarning(m, 'osb'), /OSB/);
  assert.match(formatStaleWarning(m, 'truss'), /Cercha P1/);
  assert.equal(formatStaleWarning(m, 'truss').includes('Cercha P2'), false);
  assert.equal(formatStaleWarning(makeModel(), 'all'), null);
});
