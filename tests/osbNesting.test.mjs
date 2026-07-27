import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectOsbPieces, nestPieces, computeOsbNesting, buildNestingPatches,
  buildPurchaseReportRows, buildOffcutRows, buildCutPlanRows
} from '../src/core/osbNesting.js';

/** Muro sintético con despiece OSB ya persistido (formato de computeOsbPanelLayout). */
const wall = (id, courses, extra = {}) => ({
  id, type: 'wall', osbPanelWidth: 1220, osbPanelHeight: 2440,
  osbCourses: courses.map(c => ({
    zMin: c.zMin ?? 0, zMax: c.zMax ?? c.height, height: c.height,
    panels: c.widths.map((w, i) => ({ start: i * w, end: (i + 1) * w, width: w }))
  })),
  ...extra
});

const modelOf = (...walls) => ({ grid: null, elements: walls, osbDefaults: { panelWidth: 1220, panelHeight: 2440 } });

const piece = (id, width, height, role = null) => ({ id, width, height, role, wallId: 1, code: id, wallLabel: 'Muro 1', course: 1, cutoutArea: 0 });

test('nestPieces: caso con óptimo conocido a mano — 4 piezas de 610x1220 llenan exactamente 1 placa de 1220x2440', () => {
  const pieces = [1, 2, 3, 4].map(i => piece(`P${i}`, 610, 1220));
  const { boards, unplaced } = nestPieces(pieces, 1220, 2440, { kerf: 0 });

  assert.equal(boards.length, 1, 'el óptimo es 1 placa');
  assert.equal(unplaced.length, 0);
  assert.equal(boards[0].placements.length, 4);
  assert.equal(Math.round(boards[0].wasteArea), 0, 'sin desperdicio: la placa queda llena');
  // las 4 piezas ocupan cuadrantes distintos (no se pisan)
  const keys = new Set(boards[0].placements.map(p => `${p.x},${p.y}`));
  assert.equal(keys.size, 4);
});

test('nestPieces: el kerf de sierra se descuenta — con 5mm de corte las mismas 4 piezas ya no caben en 1 placa', () => {
  const pieces = [1, 2, 3, 4].map(i => piece(`P${i}`, 610, 1220));
  const { boards } = nestPieces(pieces, 1220, 2440, { kerf: 5 });
  assert.ok(boards.length > 1, 'no se puede prometer una placa que en obra no sale');
});

test('nestPieces: ninguna pieza queda sin asignar y los m² usados coinciden con la suma de piezas', () => {
  const pieces = [
    piece('A', 1220, 2440), piece('B', 900, 2440), piece('C', 610, 1200),
    piece('D', 305, 800), piece('E', 1220, 1200), piece('F', 450, 2440)
  ];
  const { boards, unplaced } = nestPieces(pieces, 1220, 2440, {});

  assert.equal(unplaced.length, 0);
  const placed = boards.flatMap(b => b.placements);
  assert.equal(placed.length, pieces.length);
  assert.deepEqual(new Set(placed.map(p => p.id)), new Set(pieces.map(p => p.id)));

  const usedArea = boards.reduce((a, b) => a + b.usedArea, 0);
  const pieceArea = pieces.reduce((a, p) => a + p.width * p.height, 0);
  assert.equal(Math.round(usedArea), Math.round(pieceArea));
});

test('nestPieces: piezas colocadas en la misma placa nunca se superponen', () => {
  const pieces = [
    piece('A', 800, 1500), piece('B', 400, 1500), piece('C', 1220, 900),
    piece('D', 600, 500), piece('E', 300, 400), piece('F', 1000, 2000)
  ];
  const { boards } = nestPieces(pieces, 1220, 2440, {});
  for (const b of boards) {
    for (let i = 0; i < b.placements.length; i++) {
      for (let j = i + 1; j < b.placements.length; j++) {
        const a = b.placements[i], c = b.placements[j];
        const disjoint = a.x + a.w <= c.x + 0.5 || c.x + c.w <= a.x + 0.5 ||
                         a.y + a.h <= c.y + 0.5 || c.y + c.h <= a.y + 0.5;
        assert.ok(disjoint, `${a.id} y ${c.id} se superponen en ${b.code}`);
      }
    }
    // y ninguna se sale de la placa
    for (const p of b.placements) {
      assert.ok(p.x + p.w <= b.width + 0.5 && p.y + p.h <= b.height + 0.5, `${p.id} se sale de ${b.code}`);
    }
  }
});

test('nestPieces: una pieza más grande que la placa se reporta sin asignar, no rompe el resto', () => {
  const { boards, unplaced } = nestPieces(
    [piece('A', 2000, 2440), piece('B', 600, 1200)], 1220, 2440, {}
  );
  assert.equal(unplaced.length, 1);
  assert.equal(unplaced[0].id, 'A');
  assert.match(unplaced[0].reason, /excede la placa/);
  assert.equal(boards.length, 1, 'la pieza válida igual se coloca');
});

test('R5-C: sólo tabique rota; MP1/MP2/MP3/sin rol ignoran el antiguo allowRotation', () => {
  for (const role of ['MP1', 'MP2', 'MP3', null]) {
    const result = nestPieces([piece(`A-${role}`, 2000, 1000, role)], 1220, 2440, {
      allowRotation: true
    });
    assert.equal(result.unplaced.length, 1, `${role ?? 'sin rol'} no debe rotar`);
    assert.equal(Object.hasOwn(result.config, 'allowRotation'), false);
  }
  const tabique = nestPieces([piece('T', 2000, 1000, 'tabique')], 1220, 2440);
  assert.equal(tabique.unplaced.length, 0);
  assert.equal(tabique.boards[0].placements[0].rotated, true);
});

test('R5-C: collectOsbPieces propaga el rol resuelto del tipo a cada pieza', () => {
  const model = modelOf(wall(1, [{ height: 1000, widths: [2000] }], {
    wallTypeId: 'tabique-60'
  }));
  model.library = {
    metalconProfiles: [{ id: 'C60', shape: 'C' }, { id: 'U60', shape: 'U' }]
  };
  model.wallTypes = [{
    id: 'tabique-60',
    name: 'Tabique 60',
    role: 'tabique',
    metalconDefaults: {
      spacing: 600, studProfileId: 'C60', trackProfileId: 'U60', materialId: null
    },
    osbDefaults: {
      panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap: 3
    }
  }];
  assert.equal(collectOsbPieces(model).groups[0].pieces[0].role, 'tabique');
  assert.equal(computeOsbNesting(model).unplaced.length, 0);
});

test('nestPieces: los despuntes bajo el mínimo configurable se marcan como no reutilizables', () => {
  const { boards } = nestPieces([piece('A', 1000, 2200)], 1220, 2440, { minOffcutWidth: 300, minOffcutHeight: 300 });
  const offcuts = boards[0].offcuts;
  assert.ok(offcuts.length > 0);
  // sobra una franja de 215x2440 (ancho < 300) y una de 1220x235 (alto < 300): ninguna reutilizable
  assert.equal(offcuts.filter(o => o.reusable).length, 0);

  const { boards: b2 } = nestPieces([piece('A', 800, 2000)], 1220, 2440, {});
  assert.ok(b2[0].offcuts.some(o => o.reusable), 'un sobrante de 415x2440 sí es reutilizable');
});

test('computeOsbNesting: compartir despuntes entre muros baja el número de placas', () => {
  // dos muros, cada uno con una sola pieza de 600x2440: aislados son 2 placas, juntos 1
  const model = modelOf(
    wall(1, [{ height: 2440, widths: [600] }]),
    wall(2, [{ height: 2440, widths: [600] }])
  );
  const r = computeOsbNesting(model);

  assert.equal(r.totals.boardCount, 1);
  assert.equal(r.baseline.perWallBoards, 2);
  assert.equal(r.savings.boards, 1);
  assert.equal(Math.round(r.savings.pct), 50);
  assert.equal(r.baseline.naiveBoards, 2);
});

test('computeOsbNesting: idempotente — dos corridas dan exactamente el mismo plan de corte', () => {
  const model = modelOf(
    wall(1, [{ height: 2440, widths: [1220, 900, 480] }, { zMin: 2440, zMax: 3200, height: 760, widths: [1220, 600] }]),
    wall(2, [{ height: 2440, widths: [700, 700, 350] }]),
    wall(3, [{ height: 2440, widths: [1220, 1220] }])
  );
  const a = computeOsbNesting(model);
  const b = computeOsbNesting(model);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('computeOsbNesting: reporte de compra coherente (comprado = usado + pérdida, % de pérdida)', () => {
  const model = modelOf(
    wall(1, [{ height: 2440, widths: [1220, 900, 480] }]),
    wall(2, [{ height: 2440, widths: [700, 700, 350] }])
  );
  const r = computeOsbNesting(model);
  const t = r.totals;

  assert.ok(t.boardCount > 0);
  assert.ok(Math.abs(t.boughtArea - (t.usedArea + t.wasteArea)) < 1e-6, 'comprado = usado + pérdida');
  assert.ok(Math.abs(t.wasteArea - (t.reusableArea + t.scrapArea)) < 1e-6, 'pérdida = despuntes reutilizables + merma');
  assert.ok(t.wastePct >= 0 && t.wastePct < 100);
  assert.equal(t.boughtArea, t.boardCount * (1220 * 2440 * 1e-6));

  // ninguna pieza del modelo queda fuera
  const { totalPieces } = collectOsbPieces(model);
  const placed = r.groups.flatMap(g => g.boards.flatMap(b => b.placements)).length;
  assert.equal(placed, totalPieces);
  assert.equal(r.unplaced.length, 0);
});

test('computeOsbNesting: muros con distinto tamaño de placa se nestean por separado (SKU distintos)', () => {
  const model = modelOf(
    wall(1, [{ height: 2440, widths: [600] }]),
    wall(2, [{ height: 2440, widths: [600] }], {}),
  );
  model.elements[1].osbPanelWidth = 1200;
  model.elements[1].osbPanelHeight = 2400;
  model.elements[1].osbCourses[0].height = 2400;
  model.elements[1].osbCourses[0].zMax = 2400;

  const r = computeOsbNesting(model);
  assert.equal(r.groups.length, 2);
  assert.deepEqual(r.groups.map(g => g.key).sort(), ['1200x2400', '1220x2440']);
  assert.equal(r.totals.boardCount, 2, 'no se pueden mezclar formatos en una misma placa');
});

test('collectOsbPieces: el área de los cutouts de vano se contabiliza aparte, no descuenta la pieza', () => {
  const model = modelOf(wall(1, [{ height: 2440, widths: [1220] }]));
  model.elements[0].osbCourses[0].panels[0].cutouts = [{ start: 200, end: 1000, zMin: 900, zMax: 2100 }];

  const { groups } = collectOsbPieces(model);
  const p = groups[0].pieces[0];
  assert.equal(p.width, 1220, 'la placa se corta entera y el hueco se recorta de ella');
  assert.equal(p.cutoutArea, 800 * 1200);

  const r = computeOsbNesting(model);
  assert.ok(Math.abs(r.totals.cutoutArea - 800 * 1200 * 1e-6) < 1e-9);
});

test('buildNestingPatches: cada placa del despiece queda con sourcePanel trazable al plan de corte', () => {
  const model = modelOf(
    wall(1, [{ height: 2440, widths: [600, 600] }]),
    wall(2, [{ height: 2440, widths: [1220] }])
  );
  const r = computeOsbNesting(model);
  const patches = buildNestingPatches(model, r);

  assert.equal(patches.length, 2);
  const allPanels = patches.flatMap(p => p.patch.osbCourses.flatMap(c => c.panels));
  assert.equal(allPanels.length, 3);
  for (const p of allPanels) {
    assert.match(p.sourcePanel, /^PL\d+$/);
    assert.ok(Number.isFinite(p.sourceXY.x) && Number.isFinite(p.sourceXY.y));
  }
  // el código de placa madre coincide con el del plan de corte
  const planCodes = new Set(r.groups[0].boards.flatMap(b => b.placements.map(p => p.sourcePanel)));
  for (const p of allPanels) assert.ok(planCodes.has(p.sourcePanel));

  // idempotente: aplicar sobre un modelo ya anotado no genera patch nuevo
  const applied = { ...model, elements: model.elements.map(el => {
    const patch = patches.find(p => p.wallId === el.id);
    return patch ? { ...el, ...patch.patch } : el;
  }) };
  assert.equal(buildNestingPatches(applied, computeOsbNesting(applied)).length, 0);
});

test('reportes: filas de compra, de despuntes y de plan de corte se construyen sin datos vacíos', () => {
  const model = modelOf(
    wall(1, [{ height: 2440, widths: [1220, 800] }]),
    wall(2, [{ height: 1200, widths: [600, 600] }])
  );
  const r = computeOsbNesting(model);

  const rows = buildPurchaseReportRows(r);
  assert.ok(rows.length >= 5);
  assert.ok(rows.every(row => row.label && row.value != null));
  assert.match(rows[0].label, /Placas 1220x2440/);

  const offcuts = buildOffcutRows(r);
  assert.ok(offcuts.every(o => o.length === 4 && o[0].startsWith('PL')));

  const plan = buildCutPlanRows(r);
  assert.equal(plan.length, 4, 'una fila por pieza');
  assert.ok(plan.every(row => row.length === 5));
});

test('computeOsbNesting: modelo sin despiece OSB devuelve reporte vacío sin romper', () => {
  const r = computeOsbNesting({ grid: null, elements: [{ id: 1, type: 'wall' }] });
  assert.equal(r.groups.length, 0);
  assert.equal(r.totals.boardCount, 0);
  assert.equal(r.totals.wastePct, 0);
  assert.equal(buildPurchaseReportRows(r).length, 0);
});
