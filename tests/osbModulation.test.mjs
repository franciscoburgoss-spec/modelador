import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { computeOsbPanelLayout, computeCourseBreaks, hasNestingSource } from '../src/core/osbModulation.js';

const baseGrid = (length, wallHeight = 2400) => ({
  xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: length }],
  yAxes: [{ id: 'Y1', position: 0 }],
  zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: wallHeight }]
});

const baseWall = (length, wallHeight, openings = []) => ({
  id: 1, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1',
  bottomZ: 'Z0', topZ: 'Z1', thickness: 90, openings
});

test('osbModulation: sin vanos, studs alineados a panelWidth → maximiza placas enteras, anclado desde el extremo start', () => {
  const grid = baseGrid(5000);
  const wall = baseWall(5000, 2400);
  // studs sintéticos exactos en múltiplos de 1220 (caso ideal, calce perfecto)
  const studs = [0, 1220, 2440, 3660, 4880, 5000].map(offset => ({ offset, zMin: 0, zMax: 2400, role: offset === 0 || offset === 5000 ? 'edge' : 'stud' }));

  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studs, { panelWidth: 1220, minPanelWidth: 200 });

  assert.equal(osb.warnings.length, 0);
  const panels = osb.courses[0].panels;
  const wholePanels = panels.filter(p => Math.abs(p.width - 1220) < 0.5);
  assert.equal(wholePanels.length, 4, 'debería maximizar 4 placas enteras de 1220mm');
  assert.equal(panels[panels.length - 1].width, 120, 'el remanente concentrado queda al final (anclado desde el extremo start)');
  const total = panels.reduce((a, p) => a + p.width, 0);
  assert.ok(Math.abs(total - 5000) < 1);
});

test('osbModulation: corredor entre dos vanos ancla desde ambos bordes, remanente al medio', () => {
  const grid = baseGrid(6000);
  // dos vanos separados por un corredor de 2500mm — con studs cada 1220 exactos hacia cada lado
  const wall = baseWall(6000, 2400, [
    // altura completa (2400) → vacío total del curso → columna excluida, el tramo entre ambas es un corredor 'both'
    { id: 'o1', axisType: 'x', type: 'door', position: 610, width: 1220, height: 2400 }, // oMin=0,oMax=1220
    { id: 'o2', axisType: 'x', type: 'door', position: 5390, width: 1220, height: 2400 } // oMin=4780,oMax=6000
  ]);
  // corredor entre vanos: [1220, 4780], largo 3560. Anclado 'both': studs en 1220+1220=2440 (desde
  // la izq) y 4780-1220=3560 (desde la der) — entre ambos queda un remanente centrado.
  const studs = [0, 1220, 2440, 3560, 4780, 6000].map(offset => ({ offset, zMin: 0, zMax: 2400, role: 'stud' }));

  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studs, { panelWidth: 1220, minPanelWidth: 200 });

  assert.equal(osb.warnings.length, 0);
  const middle = osb.courses[0].panels.filter(p => p.start >= 1220 - 1 && p.end <= 4780 + 1);
  assert.ok(middle.length >= 1);
  // los dos extremos del corredor (pegados a cada vano) deben ser placas enteras
  const firstOfCorridor = middle[0];
  const lastOfCorridor = middle[middle.length - 1];
  assert.ok(Math.abs(firstOfCorridor.width - 1220) < 0.5 || middle.length === 1);
  assert.ok(Math.abs(lastOfCorridor.width - 1220) < 0.5 || middle.length === 1);
});

test('osbModulation: vano se centra en una placa con margen ≥100mm a cada lado (curso que no toca el vacío)', () => {
  const grid = baseGrid(5000, 4800);
  const wall = baseWall(5000, 4800, [
    { id: 'op1', axisType: 'x', type: 'window', position: 2500, width: 800, height: 600, sillHeight: 1500 } // oMin=2100,oMax=2900, topRel=2100
  ]);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  // curso 1 (índice 1, z 2400-4800) no toca el vacío [1500,2100] de la ventana → columna sólida
  const course1 = osb.courses[1];
  const total = course1.panels.reduce((a, p) => a + p.width, 0);
  assert.ok(Math.abs(total - osb.length) < 1, 'curso sin vacío debe cubrir el largo completo');

  // margen: el primer borde de placa a la izquierda de oMin, y a la derecha de oMax, deben
  // quedar a ≥100mm del vano (oMin=2100, oMax=2900)
  const boundaries = [...new Set(course1.panels.flatMap(p => [p.start, p.end]))].sort((a, b) => a - b);
  const leftEdge = Math.max(...boundaries.filter(b => b <= 2100 + 1));
  const rightEdge = Math.min(...boundaries.filter(b => b >= 2900 - 1));
  assert.ok(2100 - leftEdge >= 100 - 1, `margen izquierdo insuficiente: ${2100 - leftEdge}`);
  assert.ok(rightEdge - 2900 >= 100 - 1, `margen derecho insuficiente: ${rightEdge - 2900}`);
});

test('osbModulation: vacío parcial en el curso → la placa centrada CUBRE el vano con cutout (antepecho+dintel en la misma pieza)', () => {
  const grid = baseGrid(5000, 4800);
  const wall = baseWall(5000, 4800, [
    { id: 'op1', axisType: 'x', type: 'window', position: 2500, width: 800, height: 600, sillHeight: 1500 }
  ]);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  const course0 = osb.courses[0]; // z 0-2400: el vacío [1500,2100] cae parcial dentro → cutout
  const overVano = course0.panels.filter(p => p.start < 2900 - 1 && p.end > 2100 + 1);
  assert.ok(overVano.length >= 1, 'debe haber placa cubriendo la columna del vano');
  for (const p of overVano) {
    assert.ok(p.cutouts?.length >= 1, 'la placa sobre el vano debe llevar el recorte del vacío');
    for (const ct of p.cutouts) {
      assert.ok(ct.zMin >= 1500 - 1 && ct.zMax <= 2100 + 1, 'el cutout debe ser exactamente el vacío real');
      assert.ok(ct.start >= 2100 - 1 && ct.end <= 2900 + 1, 'el cutout no puede exceder el ancho del vano');
    }
  }
  // cobertura de material del curso = largo - área del vacío proyectada (el ancho del vano NO
  // se descuenta del ancho placado: la placa lo cubre, solo se recorta el hueco)
  const total = course0.panels.reduce((a, p) => a + p.width, 0);
  assert.ok(Math.abs(total - osb.length) < 1, 'el ancho placado cubre el muro completo (el hueco es recorte, no ausencia de placa)');
});

test('osbModulation: vacío que cubre TODO el alto del curso → columna excluida (hueco pasante)', () => {
  const grid = baseGrid(5000, 2400);
  const wall = baseWall(5000, 2400, [
    { id: 'p1', axisType: 'x', type: 'door', position: 2500, width: 900, height: 2400 } // puerta de piso a cielo
  ]);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, minPanelWidth: 200 });

  const coversVoid = osb.courses[0].panels.some(p => p.start < 2950 - 1 && p.end > 2050 + 1);
  assert.equal(coversVoid, false, 'vacío de altura completa → sin placa en esa columna');
});

test('osbModulation: caso reportado — dintel sobre puerta y antepecho/dintel de ventanas SÍ se placan (2 cursos)', () => {
  const grid = baseGrid(8700, 2500);
  const wall = baseWall(8700, 2500, [
    { id: 'v1', axisType: 'x', type: 'window', position: 1500, width: 1000, height: 1200, sillHeight: 900 },
    { id: 'p1', axisType: 'x', type: 'door', position: 4000, width: 900, height: 2100 },
    { id: 'v2', axisType: 'x', type: 'window', position: 6800, width: 1000, height: 1200, sillHeight: 900 }
  ]);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  // hiladas completas desde abajo: 2440 + remanente 60 arriba (antes: 2 cursos de 1250)
  assert.equal(osb.numCourses, 2);
  assert.deepEqual(osb.courses.map(c => [c.zMin, c.zMax]), [[0, 2440], [2440, 2500]]);
  assert.ok(osb.warnings.some(w => w.includes('hilada superior de 60mm')), 'debe avisar que la tira superior es muy baja');

  // curso 1 (superior): TODO el largo placado, incluida la columna de la puerta (dintel) y de
  // las ventanas (dintel), con cutouts donde corresponde
  const c1total = osb.courses[1].panels.reduce((a, p) => a + p.width, 0);
  assert.ok(Math.abs(c1total - osb.length) < 1, 'el curso superior debe placar el largo completo');
  const doorPanels = osb.courses[1].panels.filter(p => p.start < 4450 - 1 && p.end > 3550 + 1);
  assert.ok(doorPanels.length >= 1, 'la tira superior cruza la columna de la puerta');

  // curso 0 (inferior, 0..2440): la puerta (0..2100) es vacío PARCIAL — sobre el dintel quedan
  // 340mm de material, así que la columna lleva placa con cutout (ya no se excluye)
  const c0doorPanels = osb.courses[0].panels.filter(p => p.start < 4450 - 1 && p.end > 3550 + 1);
  assert.ok(c0doorPanels.length >= 1 && c0doorPanels.every(p => p.cutouts?.length >= 1));
  const c0winPanels = osb.courses[0].panels.filter(p => p.start < 2000 - 1 && p.end > 1000 + 1);
  assert.ok(c0winPanels.length >= 1 && c0winPanels.every(p => p.cutouts?.length >= 1));
});

test('osbModulation: muro de doble altura (4800mm) sin vanos — 2 cursos, cobertura total exacta', () => {
  const grid = baseGrid(5000, 4800);
  const wall = baseWall(5000, 4800);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  assert.equal(osb.numCourses, 2);
  for (const c of osb.courses) {
    const total = c.panels.reduce((a, p) => a + p.width, 0);
    assert.ok(Math.abs(total - osb.length) < 1);
    assert.ok(c.panels.every(p => p.width <= 1220.5));
  }
});

test('osbModulation: nunca genera coordenadas fuera de rango (0..length) aunque no encuentre respaldo válido', () => {
  // spacing deliberadamente disparejo respecto a panelWidth, para forzar el camino de fallback
  const grid = baseGrid(5000, 4800);
  const wall = baseWall(5000, 4800, [
    { id: 'op1', axisType: 'x', type: 'window', position: 2500, width: 1200, height: 600, sillHeight: 1500 }
  ]);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  for (const c of osb.courses) {
    for (const p of c.panels) {
      assert.ok(p.start >= -1 && p.end <= osb.length + 1, `panel fuera de rango: ${JSON.stringify(p)}`);
      assert.ok(p.end > p.start);
    }
    const total = c.panels.reduce((a, p) => a + p.width, 0);
    // cobertura total del curso = largo del muro menos cualquier vacío real en ese curso
    assert.ok(total <= osb.length + 1);
  }
});

test('osbModulation: stagger activado por defecto → cursos consecutivos sin vanos no repiten el mismo patrón de juntas', () => {
  const grid = baseGrid(5000, 4800);
  const wall = baseWall(5000, 4800);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  const joints0 = osb.courses[0].panels.slice(0, -1).map(p => p.end);
  const joints1 = osb.courses[1].panels.slice(0, -1).map(p => p.end);
  assert.notDeepEqual(joints0, joints1);
});

test('osbModulation: sin wall.studs → no resuelve y avisa que falta generar metalcon primero', () => {
  const grid = baseGrid(5000);
  const wall = baseWall(5000, 2400);
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, [], { panelWidth: 1220, minPanelWidth: 200 });

  assert.equal(osb.resolved, false);
  assert.match(osb.warnings[0], /generarla primero/);
});

test('osbModulation: vano muy ancho necesita varias placas centradas, todas ≤ panelWidth', () => {
  const grid = baseGrid(8000, 2400);
  // vano ancho (3000mm, tipo portón) — oMin=2500, oMax=5500
  const wall = baseWall(8000, 2400, [
    { id: 'op1', axisType: 'x', type: 'window', position: 4000, width: 3000, height: 300, sillHeight: 2100 }
  ]);
  // curso único (2400 ≤ panelHeight) — pero para aislar el centrado probamos con panelHeight
  // chico para forzar 2 cursos y que el vano (alto 300mm cerca del cielo) quede en un curso
  // distinto al resto del muro.
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 1200, minPanelWidth: 200 });

  for (const c of osb.courses) {
    assert.ok(c.panels.every(p => p.width <= 1220.5), `curso con placa > panelWidth: ${JSON.stringify(c.panels)}`);
  }
});

// ---- código de pieza + tabla de despiece ------------------------------------------------------
import { assignOsbPieceCodes, buildOsbPieceScheduleRows } from '../src/core/osbModulation.js';

test('assignOsbPieceCodes: correlativo P1..Pn, curso por curso, izquierda a derecha', () => {
  const osbCourses = [
    { zMin: 0, zMax: 1200, panels: [{ start: 0, end: 500 }, { start: 500, end: 1200 }] },
    { zMin: 1200, zMax: 2400, panels: [{ start: 0, end: 700 }, { start: 700, end: 1200 }] }
  ];
  const codes = assignOsbPieceCodes(osbCourses);
  assert.equal(codes.get(osbCourses[0].panels[0]), 'P1');
  assert.equal(codes.get(osbCourses[0].panels[1]), 'P2');
  assert.equal(codes.get(osbCourses[1].panels[0]), 'P3');
  assert.equal(codes.get(osbCourses[1].panels[1]), 'P4');
});

test('buildOsbPieceScheduleRows: ancho/alto/curso correctos y "-" sin cutout', () => {
  const osbCourses = [
    { zMin: 0, zMax: 2400, panels: [{ start: 0, end: 400 }, { start: 400, end: 1600, cutouts: [{ start: 400, end: 1200, zMin: 900, zMax: 2100 }] }] }
  ];
  const rows = buildOsbPieceScheduleRows(osbCourses);
  assert.deepEqual(rows[0], ['P1', '1', '400', '2400', '-']);
  assert.equal(rows[1][0], 'P2');
  assert.equal(rows[1][2], '1200'); // ancho = end-start
  assert.ok(rows[1][4].includes('800x1200'), 'describe el cutout (ancho x alto @ z)');
});

test('buildOsbPieceScheduleRows: vacío sin cursos/paneles', () => {
  assert.deepEqual(buildOsbPieceScheduleRows([]), []);
  assert.deepEqual(buildOsbPieceScheduleRows(undefined), []);
});


// ---- Sesión 19: hiladas de placa completa + cadeneta -------------------------------------------

test('computeCourseBreaks: placas completas desde abajo, remanente arriba', () => {
  // muro exacto de una placa → una sola hilada, sin corte en altura
  assert.deepEqual(computeCourseBreaks(2440, 2440).bounds, [0, 2440]);
  // muro más bajo que la placa → una hilada (se corta en alto, inevitable)
  assert.deepEqual(computeCourseBreaks(2400, 2440).bounds, [0, 2400]);
  // caso reportado por Fran: 2600 → 2440 + 160 (antes: 1300 + 1300, ninguna placa entera)
  assert.deepEqual(computeCourseBreaks(2600, 2440).bounds, [0, 2440, 2600]);
  // doble altura: 2440 + 2440 + 120
  assert.deepEqual(computeCourseBreaks(5000, 2440).bounds, [0, 2440, 4880, 5000]);
  // múltiplo exacto → hiladas completas, sin remanente
  assert.deepEqual(computeCourseBreaks(4880, 2440).bounds, [0, 2440, 4880]);
});

test('computeCourseBreaks: remanente bajo el mínimo → warning y, con enforceMinCourse, baja la junta', () => {
  const libre = computeCourseBreaks(2600, 2440, 300, false);
  assert.ok(libre.warning?.includes('160mm'));
  assert.deepEqual(libre.bounds, [0, 2440, 2600]);

  const ajustado = computeCourseBreaks(2600, 2440, 300, true);
  assert.deepEqual(ajustado.bounds, [0, 2300, 2600]); // hilada superior de 300mm, fijable
  assert.ok(ajustado.warning?.includes('2300'));

  // remanente holgado → sin warning
  assert.equal(computeCourseBreaks(3000, 2440, 300).warning, null);
});

test('osbModulation: junta horizontal a cota constante (2440) sin importar la altura del muro', () => {
  const studsFor = (h) => [0, 1220, 2440, 3660, 4880, 5000].map(offset => ({ offset, zMin: 0, zMax: h, role: 'stud' }));
  for (const h of [2600, 3000, 4000]) {
    const osb = computeOsbPanelLayout(baseWall(5000, h), baseGrid(5000, h), {}, {}, studsFor(h), { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });
    assert.equal(osb.courses[0].zMax, 2440, `muro de ${h}mm: la junta debe quedar en 2440`);
    assert.equal(osb.courses[0].height, 2440);
  }
});

test('osbModulation: las cadenetas ya no se emiten como subproducto de las placas', () => {
  const grid = baseGrid(5000, 3000);
  const wall = baseWall(5000, 3000, [
    { id: 'p1', axisType: 'x', type: 'door', position: 2500, width: 900, height: 2600 } // cruza z=2440
  ]);
  const studLayout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const osb = computeOsbPanelLayout(wall, grid, {}, {}, studLayout.studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });

  assert.equal(osb.courses.length, 2);
  assert.deepEqual(osb.noggings, []);
});

test('osbModulation: muro de una sola hilada no lleva cadeneta', () => {
  const studs = [0, 1220, 2440, 3660, 4880, 5000].map(offset => ({ offset, zMin: 0, zMax: 2400, role: 'stud' }));
  const osb = computeOsbPanelLayout(baseWall(5000, 2400), baseGrid(5000, 2400), {}, {}, studs, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });
  assert.equal(osb.courses.length, 1);
  assert.equal(osb.noggings.length, 0);
});

test('buildOsbPieceScheduleRows: las cadenetas se listan al final con las hiladas que unen', () => {
  const courses = [
    { zMin: 0, zMax: 2440, height: 2440, panels: [{ start: 0, end: 1220 }] },
    { zMin: 2440, zMax: 2600, height: 160, panels: [{ start: 0, end: 1220 }] }
  ];
  const noggings = [{ z: 2440, oMin: 0, oMax: 1220, role: 'nogging' }];
  const rows = buildOsbPieceScheduleRows(courses, noggings);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], ['C1', '1-2', '1220', '-', 'CADENETA @z=2440']);
});

test('osbModulation: la tabla de despiece suma la columna PLACA solo si el despiece pasó por la optimización de despuntes', () => {
  const plain = [{ zMin: 0, zMax: 2440, panels: [{ start: 0, end: 600, width: 600 }] }];
  assert.equal(hasNestingSource(plain), false);
  assert.equal(buildOsbPieceScheduleRows(plain)[0].length, 5, 'sin optimizar, formato de siempre');

  const nested = [{ zMin: 0, zMax: 2440, panels: [{ start: 0, end: 600, width: 600, sourcePanel: 'PL2' }] }];
  assert.equal(hasNestingSource(nested), true);
  const row = buildOsbPieceScheduleRows(nested)[0];
  assert.equal(row.length, 6);
  assert.equal(row[0], 'P1');
  assert.equal(row[1], 'PL2', 'la placa madre va justo después del código de pieza');

  // la cadeneta es perfil metálico: no sale de una placa OSB
  const withNog = buildOsbPieceScheduleRows(nested, [{ z: 2440, oMin: 0, oMax: 3000 }]);
  assert.equal(withNog[1][1], '-');
  assert.equal(withNog[1].length, 6);
});
