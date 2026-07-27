// Tests de Node (sin framework) para core/metalconModulation.js + core/metalconCatalog.js
import assert from 'node:assert/strict';
import { computeStudLayout, detectWallCorners } from '../src/core/metalconModulation.js';
import { findMetalconProfile, metalconProfilesByShape } from '../src/core/metalconCatalog.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const grid = {
  xAxes: [{ id: 'x1', position: 0 }, { id: 'x2', position: 4000 }],
  yAxes: [{ id: 'y1', position: 0 }, { id: 'y2', position: 3000 }],
  zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 2400 }]
};

function makeWall(overrides = {}) {
  return {
    id: 1, type: 'wall',
    xStart: 'x1', xEnd: 'x2', yStart: 'y1', yEnd: 'y1',
    direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90,
    openings: [],
    ...overrides
  };
}

// --- catálogo ---
test('catálogo: findMetalconProfile encuentra por código', () => {
  const p = findMetalconProfile('90CA085p');
  assert.equal(p.H, 90);
  assert.equal(p.perforated, true);
});

test('catálogo: metalconProfilesByShape filtra por forma', () => {
  const us = metalconProfilesByShape('U');
  assert.ok(us.length >= 9);
  assert.ok(us.every(p => p.shape === 'U'));
});

// --- computeStudLayout: caso simple sin vanos ---
test('modulación: muro de 4000mm sin vanos, spacing 400 → montantes en extremos + relleno', () => {
  const wall = makeWall();
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  assert.equal(r.resolved, true);
  assert.equal(r.length, 4000);
  assert.equal(r.wallHeight, 2400);
  const edges = r.studs.filter(s => s.role === 'edge');
  assert.equal(edges.length, 2);
  assert.equal(edges[0].offset, 0);
  assert.equal(edges[1].offset, 4000);
  // relleno esperado en 400,800,...,3600 (9 montantes) — 4000 exacto no genera duplicado en el extremo
  const fill = r.studs.filter(s => s.role === 'stud');
  assert.equal(fill.length, 9);
  assert.equal(fill[0].offset, 400);
  assert.equal(fill[fill.length - 1].offset, 3600);
});

test('modulación: último tramo se ajusta sin recentrar (largo no múltiplo de spacing)', () => {
  const wall = makeWall({ xEnd: 'x2' });
  // 4000mm de largo, spacing 600 → 600,1200,1800,2400,3000,3600 (tramo final 3600-4000=400)
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 600 });
  const fill = r.studs.filter(s => s.role === 'stud').map(s => s.offset);
  assert.deepEqual(fill, [600, 1200, 1800, 2400, 3000, 3600]);
});

// --- vano tipo puerta (sin antepecho) ---
test('modulación: vano puerta agrega king+jack en las jambas y suprime relleno interior', () => {
  const wall = makeWall({
    openings: [{ id: 'op1', axisType: 'x', type: 'door', position: 2000, width: 900, height: 2100, sillHeight: 0 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const king = r.studs.filter(s => s.role === 'king');
  const jack = r.studs.filter(s => s.role === 'jack');
  assert.equal(king.length, 2);
  assert.deepEqual(king.map(s => s.offset).sort((a, b) => a - b), [1550, 2450]);
  assert.equal(jack.length, 2);
  assert.equal(jack[0].zMax, 2100); // topRel = sill(0) + height(2100)
  // ningún montante de relleno debe caer estrictamente dentro del vano (1550,2450)
  const fillInside = r.studs.filter(s => s.role === 'stud' && s.offset > 1550 && s.offset < 2450);
  assert.equal(fillInside.length, 0);
  // sin antepecho → no debe haber cripple
  assert.equal(r.studs.filter(s => s.role === 'cripple').length, 0);
});

// --- vano tipo ventana (con antepecho) ---
test('modulación: vano ventana agrega cripple en jambas bajo el antepecho', () => {
  const wall = makeWall({
    openings: [{ id: 'op2', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 1200, sillHeight: 900 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const crippleAtJambs = r.studs.filter(s => s.role === 'cripple' && (s.offset === 1400 || s.offset === 2600));
  assert.equal(crippleAtJambs.length, 2);
  assert.equal(crippleAtJambs[0].zMax, 900);
  const jack = r.studs.filter(s => s.role === 'jack');
  assert.equal(jack[0].zMax, 2100); // sill(900)+height(1200)
});

// --- el relleno regular NO se corta entero dentro del vano: sigue bajo el antepecho y sobre el dintel,
// medido y centrado desde los propios bordes del vano (no desde la grilla global del muro) ---
test('modulación: relleno regular continúa bajo antepecho y sobre dintel, centrado en el ancho del vano', () => {
  const wall = makeWall({
    openings: [{ id: 'op2', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 1200, sillHeight: 900 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  // vano (1400,2600), ancho 1200 → 3 tramos de 400 exactos, centrado: montantes en 1800 y 2200
  const crippleFill = r.studs.filter(s => s.role === 'cripple' && [1800, 2200].includes(s.offset));
  const crippleTopFill = r.studs.filter(s => s.role === 'crippleTop' && [1800, 2200].includes(s.offset));
  assert.equal(crippleFill.length, 2);
  assert.equal(crippleFill[0].zMin, 0);
  assert.equal(crippleFill[0].zMax, 900); // bajo antepecho
  assert.equal(crippleTopFill.length, 2);
  assert.equal(crippleTopFill[0].zMin, 2100); // sobre el dintel
  assert.equal(crippleTopFill[0].zMax, 2400);
  // ningún 'stud' de relleno normal debe caer dentro del ancho del vano
  const studInside = r.studs.filter(s => s.role === 'stud' && s.offset > 1400 && s.offset < 2600);
  assert.equal(studInside.length, 0);
});

test('modulación: puerta también agrega relleno sobre el dintel (crippleTop), sin cripple bajo (no hay antepecho)', () => {
  const wall = makeWall({
    openings: [{ id: 'op1', axisType: 'x', type: 'door', position: 2000, width: 900, height: 2100, sillHeight: 0 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  // vano (1550,2450), ancho 900 → round(900/400)=2 tramos de 450, centrado: 1 montante de relleno en el medio (2000)
  // + 2 en las jambas (1550, 2450) — igual que cripple, crippleTop también refuerza la jamba
  const crippleTop = r.studs.filter(s => s.role === 'crippleTop');
  assert.equal(crippleTop.length, 3);
  assert.deepEqual(crippleTop.map(s => s.offset).sort((a, b) => a - b), [1550, 2000, 2450]);
  assert.equal(crippleTop[0].zMin, 2100);
  assert.equal(crippleTop[0].zMax, 2400);
  assert.equal(r.studs.filter(s => s.role === 'cripple').length, 0);
});

// --- jamba coincide con el extremo del muro (no duplica el edge) ---
test('modulación: jamba de vano pegada al extremo no duplica montante', () => {
  const wall = makeWall({
    openings: [{ id: 'op3', axisType: 'x', type: 'door', position: 450, width: 900, height: 2100, sillHeight: 0 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const atStart = r.studs.filter(s => Math.abs(s.offset - 0) < 1);
  // debe existir el 'edge' y el 'jack' en offset 0, pero no un 'king' duplicado
  assert.ok(atStart.some(s => s.role === 'edge'));
  assert.ok(atStart.some(s => s.role === 'jack'));
  assert.equal(atStart.filter(s => s.role === 'king').length, 0);
});

// --- esquina/T: corner + backup ---
test('modulación: con corners.start agrega corner + backup', () => {
  const wall = makeWall();
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400, corners: { start: true, end: false }, backupOffset: 100 });
  const corner = r.studs.filter(s => s.role === 'corner');
  const backup = r.studs.filter(s => s.role === 'backup');
  assert.equal(corner.length, 1);
  assert.equal(corner[0].offset, 0);
  assert.equal(backup.length, 1);
  assert.equal(backup[0].offset, 100);
});

// --- detectWallCorners: L y T ---
test('detectWallCorners: detecta esquina L (extremo con extremo)', () => {
  const wallA = makeWall({ id: 1, xStart: 'x1', xEnd: 'x2', yStart: 'y1', yEnd: 'y1', direction: 'x' });
  const wallB = { id: 2, type: 'wall', xStart: 'x1', xEnd: 'x1', yStart: 'y1', yEnd: 'y2', direction: 'y', bottomZ: 0, topZ: 2400, thickness: 90, openings: [] };
  const r = detectWallCorners(wallA, [wallA, wallB], grid, {}, {});
  assert.equal(r.start, true);
  assert.equal(r.end, false);
});

test('detectWallCorners: detecta encuentro en T (extremo sobre el cuerpo de otro muro)', () => {
  const wallA = makeWall({ id: 1 }); // corre en x de (0,0) a (4000,0)
  const wallB = { id: 2, type: 'wall', xStart: 'x1', xEnd: 'x1', yStart: 'y1', yEnd: 'y2', direction: 'y', bottomZ: 0, topZ: 2400, thickness: 90, openings: [] };
  // wallA parte en (0,0), que es el extremo de wallB (x=0,y de 0 a 3000) → esto es L, probemos T real:
  const wallC = { id: 3, type: 'wall', xStart: 'x2', xEnd: 'x2', yStart: 'y1', yEnd: 'y2', direction: 'y', bottomZ: 0, topZ: 2400, thickness: 90, openings: [] };
  const rEnd = detectWallCorners(wallA, [wallA, wallC], grid, {}, {});
  assert.equal(rEnd.end, true);
});

// --- sin geometría resoluble ---
// --- dos ventanas apiladas (mismo ancho/posición, distinto Z): el relleno de una no debe invadir el vidrio de la otra ---
test('modulación: dos ventanas apiladas en el mismo ancho no invaden el vidrio de la otra', () => {
  const wall = makeWall({
    xEnd: 'x2', // 4000mm de largo (ver grid)
    openings: [
      { id: 'w1', axisType: 'x', type: 'window', position: 2000, width: 2400, height: 500, sillHeight: 900 },
      { id: 'w2', axisType: 'x', type: 'window', position: 2000, width: 2400, height: 500, sillHeight: 1800 } // 900+500+400
    ]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  // vano: oMin=800, oMax=3200. Vidrio ventana1: [900,1400]. Vidrio ventana2: [1800,2300].
  const invadesGlass = r.studs.filter(s =>
    s.offset > 800 && s.offset < 3200 &&
    ((s.zMin < 1400 && s.zMax > 900) || (s.zMin < 2300 && s.zMax > 1800)) &&
    s.role !== 'jack' // jack es soporte de jamba (en oMin/oMax), puede atravesar la altura completa
  );
  assert.equal(invadesGlass.length, 0);
  // la zona entre ambas ventanas (1400-1800, "entrevano") sigue existiendo como cripple
  const spandrel = r.studs.filter(s => s.role === 'cripple' && s.zMin === 1400 && s.zMax === 1800);
  assert.ok(spandrel.length > 0);
});

test('modulación: ejes inexistentes → resolved:false, sin lanzar', () => {
  const wall = makeWall({ xEnd: 'no-existe' });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  assert.equal(r.resolved, false);
  assert.equal(r.studs.length, 0);
});

// --- headers: dintel (siempre) + antepecho (solo ventana) ---
test('modulación: vano puerta agrega dintel horizontal, sin antepecho', () => {
  const wall = makeWall({
    openings: [{ id: 'op1', axisType: 'x', type: 'door', position: 2000, width: 900, height: 2100, sillHeight: 0 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  assert.equal(r.headers.length, 1);
  assert.equal(r.headers[0].role, 'header');
  assert.equal(r.headers[0].oMin, 1550);
  assert.equal(r.headers[0].oMax, 2450);
  assert.equal(r.headers[0].z, 2100);
});

test('modulación: vano ventana agrega dintel + antepecho horizontales', () => {
  const wall = makeWall({
    openings: [{ id: 'op2', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 1200, sillHeight: 900 }]
  });
  const r = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  const header = r.headers.find(h => h.role === 'header');
  const sill = r.headers.find(h => h.role === 'sill');
  assert.ok(header && sill);
  assert.equal(header.z, 2100); // sill(900)+height(1200)
  assert.equal(sill.z, 900);
  assert.equal(sill.oMin, 1400);
  assert.equal(sill.oMax, 2600);
});

console.log(`\n${passed} tests OK`);
