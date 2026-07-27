// tests/wallSplitMerge.test.mjs — Sesión 15 (dividir / unir muros)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planWallSplit, planWallMerge, findMergeCandidates, nearestValidCut, CUT_AXIS_PLACEHOLDER
} from '../src/core/wallSplitMerge.js';
import { validateRoofSystems } from '../src/core/trussLayout.js';

const grid = {
  xAxes: [
    { id: 1, position: 0, label: 'A' },
    { id: 2, position: 3000, label: 'B' },
    { id: 3, position: 6000, label: 'C' }
  ],
  yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 4000, label: '2' }],
  zLevels: [
    { id: 100, elevation: 0, label: 'NPT' },
    { id: 101, elevation: 2400, label: 'CIELO' },
    { id: 102, elevation: 3000, label: 'FRONTON' }
  ]
};

// Muro en X de A a C (6 m) con una ventana centrada en 4500 (ancho 1000 -> ocupa 4000..5000).
const wall = {
  id: 50, type: 'wall', direction: 'x',
  xStart: 1, xEnd: 3, yStart: 11, yEnd: 11,
  bottomZ: 100, topZ: 102, thickness: 90, libraryId: 7,
  openings: [
    { id: 900, type: 'window', position: 1500, width: 800, height: 1200, sillHeight: 900 },
    { id: 901, type: 'window', position: 4500, width: 1000, height: 1200, sillHeight: 900 }
  ],
  studs: [{ offset: 0, zMin: 0, zMax: 3000, role: 'stud' }],
  headers: [{ role: 'header', oMin: 4000, oMax: 5000, z: 2100 }],
  osbCourses: [{ zMin: 0, zMax: 1500, panels: [] }],
  studsStale: false
};
const model = { grid, elements: [wall], projectParams: [], roofSystems: [], dimensions: [] };

const runRangeOf = (w) => {
  const pos = (id) => grid.xAxes.find((a) => a.id === id).position;
  return [pos(w.xStart), pos(w.xEnd)];
};

test('divide por un eje intermedio: dos tramos, vanos repartidos, derivados descartados', () => {
  const p = planWallSplit(model, 50, { atAxisId: 2 });
  assert.equal(p.ok, true);
  assert.equal(p.cutPosition, 3000);
  assert.equal(p.newAxis, null);           // reusa el eje B existente
  assert.deepEqual(p.lengths, [3000, 3000]);
  assert.deepEqual(p.openingCounts, [1, 1]);
  const [a, b] = p.walls;
  assert.equal(a.xStart, 1); assert.equal(a.xEnd, 2);
  assert.equal(b.xStart, 2); assert.equal(b.xEnd, 3);
  assert.equal(a.openings[0].id, 900);
  assert.equal(b.openings[0].id, 901);
  for (const w of p.walls) {
    assert.equal(w.id, undefined);         // el store asigna ids nuevos
    for (const f of ['studs', 'headers', 'osbCourses', 'studsStale', 'osbStale']) {
      assert.ok(!(f in w), `${f} no debe sobrevivir a la división`);
    }
    assert.equal(w.thickness, 90);
    assert.equal(w.libraryId, 7);
    assert.equal(w.yStart, 11);            // el eje fijo no se toca
  }
});

test('divide por distancia sin eje existente: propone eje auxiliar con etiqueta libre', () => {
  const p = planWallSplit(model, 50, { atOffset: 2000 });
  assert.equal(p.ok, true);
  assert.equal(p.cutPosition, 2000);
  assert.deepEqual(p.newAxis, { axisType: 'x', position: 2000, label: 'aux1', type: 'aux' });
  assert.equal(p.cutAxisId, CUT_AXIS_PLACEHOLDER);
  assert.equal(p.walls[0].xEnd, CUT_AXIS_PLACEHOLDER);
  assert.equal(p.walls[1].xStart, CUT_AXIS_PLACEHOLDER);
  // no choca con etiquetas aux ya usadas
  const g2 = { ...grid, xAxes: [...grid.xAxes, { id: 4, position: 9000, label: 'aux1', type: 'aux' }] };
  const p2 = planWallSplit({ ...model, grid: g2 }, 50, { atOffset: 2000 });
  assert.equal(p2.newAxis.label, 'aux2');
});

test('corte dentro de un vano: se bloquea y se proponen los dos bordes válidos', () => {
  const p = planWallSplit(model, 50, { atPosition: 4600 });
  assert.equal(p.ok, false);
  assert.match(p.error, /dentro de un vano/);
  assert.match(p.error, /4000 a 5000/);
  assert.equal(p.suggestionSides.left, 4000);
  assert.equal(p.suggestionSides.right, 5000);
  assert.equal(p.suggestion, 5000); // 4600 está más cerca del borde derecho
});

test('corte que deja un tramo menor al mínimo: error con el rango admisible y sugerencia', () => {
  const p = planWallSplit(model, 50, { atOffset: 50, minSegment: 200 });
  assert.equal(p.ok, false);
  assert.match(p.error, /tramo menor a 200 mm/);
  assert.equal(p.suggestion, 200);
});

test('muro declarado al revés (xStart > xEnd): los tramos salen igual de correctos', () => {
  const reversed = { ...wall, id: 51, xStart: 3, xEnd: 1 };
  const p = planWallSplit({ ...model, elements: [reversed] }, 51, { atAxisId: 2 });
  assert.equal(p.ok, true);
  assert.deepEqual(p.lengths, [3000, 3000]);
  assert.deepEqual(runRangeOf(p.walls[0]), [6000, 3000]); // p1 (=C) hasta el corte
  assert.deepEqual(p.openingCounts, [1, 1]);
  assert.equal(p.walls[0].openings[0].id, 901);          // el tramo C→B contiene el vano de 4500
});

test('impactos: sistemas de techumbre y cotas que referencian el muro se reportan antes de dividir', () => {
  const m = {
    ...model,
    roofSystems: [{ id: 'S1', wallLowId: 50, wallHighId: 99 }],
    dimensions: [{ id: 'D1', elementId: 50 }]
  };
  const p = planWallSplit(m, 50, { atAxisId: 2 });
  assert.deepEqual(p.impacts.roofSystemIds, ['S1']);
  assert.deepEqual(p.impacts.dimensionIds, ['D1']);
  assert.ok(p.warnings.some((w) => /despiece/.test(w)));
});

test('une dos tramos contiguos: un muro, vanos concatenados y ordenados', () => {
  const a = { ...wall, id: 60, xStart: 1, xEnd: 2, openings: [{ id: 900, position: 1500, width: 800 }] };
  const b = { ...wall, id: 61, xStart: 2, xEnd: 3, openings: [{ id: 901, position: 4500, width: 1000 }] };
  const m = { ...model, elements: [a, b] };
  const p = planWallMerge(m, [61, 60]); // orden de entrada indistinto
  assert.equal(p.ok, true);
  assert.equal(p.length, 6000);
  assert.equal(p.wall.xStart, 1);
  assert.equal(p.wall.xEnd, 3);
  assert.deepEqual(p.wall.openings.map((o) => o.id), [900, 901]);
  assert.deepEqual(p.removedIds.sort(), [60, 61]);
  assert.equal(p.wall.id, undefined);
  assert.ok(!('studs' in p.wall));
});

test('unir rechaza: hueco entre tramos, niveles distintos, sección distinta', () => {
  const a = { ...wall, id: 60, xStart: 1, xEnd: 2, openings: [] };
  const far = { ...wall, id: 62, xStart: 3, xEnd: 3, openings: [] };
  const gapGrid = { ...grid, xAxes: [...grid.xAxes, { id: 5, position: 4000, label: 'D' }] };
  const b2 = { ...wall, id: 63, xStart: 5, xEnd: 3, openings: [] }; // arranca en 4000, deja hueco 1000
  const p1 = planWallMerge({ ...model, grid: gapGrid, elements: [a, b2] }, [60, 63]);
  assert.equal(p1.ok, false);
  assert.match(p1.error, /vacío de 1000 mm/);

  const b3 = { ...wall, id: 64, xStart: 2, xEnd: 3, topZ: 101, openings: [] };
  const p2 = planWallMerge({ ...model, elements: [a, b3] }, [60, 64]);
  assert.equal(p2.ok, false);
  assert.match(p2.error, /nivel inferior y superior/);

  const b4 = { ...wall, id: 65, xStart: 2, xEnd: 3, libraryId: 8, openings: [] };
  const p3 = planWallMerge({ ...model, elements: [a, b4] }, [60, 65]);
  assert.equal(p3.ok, false);
  assert.match(p3.error, /secciones de librería distintas/);
  assert.equal(far.id, 62); // fixture sin usar, evita lint de variable muerta
});

test('unir avisa cuando se pierden parámetros de despiece del tramo más corto', () => {
  const a = { ...wall, id: 60, xStart: 1, xEnd: 2, openings: [], studSpacing: 600 };
  const b = { ...wall, id: 61, xStart: 2, xEnd: 3, openings: [], studSpacing: 400 };
  const p = planWallMerge({ ...model, elements: [a, b] }, [60, 61]);
  assert.equal(p.ok, true);
  assert.ok(p.warnings.some((w) => /studSpacing/.test(w)));
});

test('findMergeCandidates encadena solo muros compatibles y contiguos', () => {
  const a = { ...wall, id: 60, xStart: 1, xEnd: 2, openings: [] };
  const b = { ...wall, id: 61, xStart: 2, xEnd: 3, openings: [] };
  const otroNivel = { ...wall, id: 62, xStart: 2, xEnd: 3, topZ: 101, openings: [] };
  const otroEje = { ...wall, id: 63, xStart: 1, xEnd: 2, yStart: 12, yEnd: 12, openings: [] };
  const m = { ...model, elements: [a, b, otroNivel, otroEje] };
  assert.deepEqual(findMergeCandidates(m, 60).map((w) => w.id), [61]);
  assert.deepEqual(findMergeCandidates(m, 63).map((w) => w.id), []);
});

test('dividir y volver a unir devuelve el muro original', () => {
  const p = planWallSplit(model, 50, { atAxisId: 2 });
  const a = { ...p.walls[0], id: 70 };
  const b = { ...p.walls[1], id: 71 };
  const m = { ...model, elements: [a, b] };
  const back = planWallMerge(m, [70, 71]);
  assert.equal(back.ok, true);
  assert.equal(back.wall.xStart, wall.xStart);
  assert.equal(back.wall.xEnd, wall.xEnd);
  assert.deepEqual(back.wall.openings.map((o) => o.id), [900, 901]);
});

test('validateRoofSystems marca el apoyo inválido cuando el muro ya no existe', () => {
  const m = { ...model, roofSystems: [{ id: 'S1', wallLowId: 50, wallHighId: 999 }] };
  const findings = validateRoofSystems(m);
  const f = findings.find((x) => x.category === 'invalidSupport');
  assert.ok(f, 'debe emitirse invalidSupport');
  assert.equal(f.severity, 'error');
  assert.match(f.message, /apoyo alto ya no existe/);
  assert.deepEqual(f.roofSystemIds, ['S1']);
});

test('nearestValidCut respeta vanos y tramo mínimo', () => {
  const intervals = [{ lo: 1000, hi: 2000 }];
  assert.equal(nearestValidCut(1200, 0, 5000, intervals, 200), 1000);
  assert.equal(nearestValidCut(1900, 0, 5000, intervals, 200), 2000);
  assert.equal(nearestValidCut(3000, 0, 5000, intervals, 200), 3000);
  assert.equal(nearestValidCut(50, 0, 5000, intervals, 200), 200);
});
