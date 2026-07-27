// tests/snapEngine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSnapPoint, buildPlanSnapSegments, buildElevationSnapSegments } from '../src/core/snapEngine.js';

const near = (a, b, tol = 0.5) => Math.abs(a - b) < tol;

test('findSnapPoint: extremo de segmento dentro de tolerancia', () => {
  const segments = [{ h1: 1000, v1: 2000, h2: 4000, v2: 2000 }];
  const p = findSnapPoint(segments, { h: 1005, v: 1998 }, 50);
  assert.ok(p);
  assert.ok(near(p.h, 1000) && near(p.v, 2000));
});

test('findSnapPoint: fuera de tolerancia → null', () => {
  const segments = [{ h1: 1000, v1: 2000, h2: 4000, v2: 2000 }];
  assert.equal(findSnapPoint(segments, { h: 1200, v: 2200 }, 50), null);
});

test('findSnapPoint: intersección real entre dos segmentos (cruce en X)', () => {
  const segments = [
    { h1: 0, v1: 0, h2: 2000, v2: 2000 },   // diagonal /
    { h1: 0, v1: 2000, h2: 2000, v2: 0 }    // diagonal \
  ];
  // se cruzan en (1000,1000), ninguno es extremo de ambos segmentos
  const p = findSnapPoint(segments, { h: 990, v: 1010 }, 50);
  assert.ok(p);
  assert.ok(near(p.h, 1000) && near(p.v, 1000));
});

test('findSnapPoint: segmentos paralelos no generan intersección falsa', () => {
  const segments = [
    { h1: 0, v1: 0, h2: 1000, v2: 0 },
    { h1: 0, v1: 500, h2: 1000, v2: 500 }
  ];
  // cursor lejos de cualquier extremo → no debe inventar una intersección
  assert.equal(findSnapPoint(segments, { h: 500, v: 250 }, 50), null);
});

test('findSnapPoint: intersección fuera del rango de alguno de los dos segmentos → no cuenta', () => {
  const segments = [
    { h1: 0, v1: 0, h2: 1000, v2: 0 },     // horizontal, termina en h=1000
    { h1: 2000, v1: -500, h2: 2000, v2: 500 } // vertical en h=2000, fuera del rango del primero
  ];
  // las rectas que las contienen se cruzarían en (2000,0), pero el primer segmento no llega ahí
  assert.equal(findSnapPoint(segments, { h: 2000, v: 0 }, 50), null);
});

test('findSnapPoint: elige el candidato más cercano cuando hay varios en tolerancia', () => {
  const segments = [
    { h1: 100, v1: 100, h2: 500, v2: 100 },
    { h1: 120, v1: 120, h2: 600, v2: 120 }
  ];
  const p = findSnapPoint(segments, { h: 105, v: 105 }, 100);
  assert.ok(near(p.h, 100) && near(p.v, 100));
});

// ---- integración con geometría real del modelo ----------------------------------------------

const fixtureModel = () => ({
  grid: {
    xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: 4000 }],
    yAxes: [{ id: 'Y1', position: 0 }, { id: 'Y2', position: 3000 }],
    zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
  },
  elements: [
    { id: 1, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1', bottomZ: 'Z0', topZ: 'Z1', thickness: 100 },
    { id: 2, type: 'wall', direction: 'y', xStart: 'X1', xEnd: 'X1', yStart: 'Y1', yEnd: 'Y2', bottomZ: 'Z0', topZ: 'Z1', thickness: 100 }
  ],
  roofSystems: []
});

test('buildPlanSnapSegments: la esquina de dos muros perpendiculares es un punto snap (endpoint o intersección)', () => {
  const model = fixtureModel();
  const segments = buildPlanSnapSegments(model, {}, {});
  // esquina física esperada cerca de (0,0) — encuentro de las caras interiores/exteriores de ambos muros
  const p = findSnapPoint(segments, { h: 3, v: -3 }, 60);
  assert.ok(p, 'debe encontrar un punto snap cerca de la esquina de los muros');
});

test('buildPlanSnapSegments: cruce de ejes de grilla es snapeable', () => {
  const model = fixtureModel();
  const segments = buildPlanSnapSegments(model, {}, {});
  const p = findSnapPoint(segments, { h: 10, v: 10 }, 60);
  assert.ok(p && near(p.h, 0) && near(p.v, 0));
});

test('buildElevationSnapSegments: muro fuera del corte no aporta segmentos; muro en el corte sí', () => {
  const model = fixtureModel();
  // corte y-N en Y1 (posición 0) → el muro X-run (yStart=Y1) SÍ aparece (categoría 1)
  const segsOnCut = buildElevationSnapSegments(model, 'elevation-y-Y1', {}, {});
  assert.ok(segsOnCut.length > 0);
  // esquina inferior del muro en elevación: h=0 (o 4000), v=0 (nivel Z0)
  const p = findSnapPoint(segsOnCut, { h: 5, v: 5 }, 60);
  assert.ok(p && near(p.v, 0));
});

test('buildElevationSnapSegments: nivel Z cruzado con el eje de referencia es snapeable (no cualquier punto de la línea)', () => {
  const model = fixtureModel();
  const segs = buildElevationSnapSegments(model, 'elevation-y-Y1', {}, {});
  // cruce esperado: eje X1 (h=0, línea vertical de referencia) con el nivel Z1 (v=2400)
  const p = findSnapPoint(segs, { h: 5, v: 2405 }, 20);
  assert.ok(p && near(p.h, 0) && near(p.v, 2400));
  // un punto intermedio de la línea de nivel, lejos de cualquier cruce, NO debe snapear
  // (el motor solo reconoce extremos/intersecciones reales, no "cualquier punto de la recta")
  assert.equal(findSnapPoint(segs, { h: 1500, v: 2405 }, 20), null);
});

// ---- sesión 6: columnas/vigas en elevación con cota Z real ----------------------------------
// NOTA: los ids de eje/nivel son NUMÉRICOS (parseElevationMode hace parseInt del sufijo).

const fixtureModelZ = () => ({
  grid: {
    xAxes: [{ id: 1, position: 0 }, { id: 2, position: 4000 }],
    yAxes: [{ id: 3, position: 0 }, { id: 4, position: 3000 }],
    zLevels: [{ id: 5, elevation: 0 }, { id: 6, elevation: 2400 }, { id: 7, elevation: 5000 }]
  },
  elements: [
    { id: 10, type: 'column', axisXId: 1, axisYId: 3, bottomZ: 5, topZ: 6, widthX: 300, widthY: 300 },
    { id: 20, type: 'beam', direction: 'y', fixedAxisId: 1, startAxisId: 3, endAxisId: 4, levelZ: 6, width: 200, height: 300 },
    { id: 21, type: 'beam', direction: 'y', fixedAxisId: 2, startAxisId: 3, endAxisId: 4, levelZ: 6, width: 200, height: 300 }
  ],
  roofSystems: []
});

test('buildElevationSnapSegments: columna en corte aporta esquina superior en su cota Z real', () => {
  const segs = buildElevationSnapSegments(fixtureModelZ(), 'elevation-y-3', {}, {});
  // corte y-3 (h = x). Columna centro x=0, ancho 300 → borde h=±150; tope v=2400 (Z real).
  const p = findSnapPoint(segs, { h: 152, v: 2403 }, 20);
  assert.ok(p && near(p.h, 150) && near(p.v, 2400), 'esquina superior de columna en Z real');
});

test('buildElevationSnapSegments: viga en el plano del corte aporta esquina en su cota Z real', () => {
  const segs = buildElevationSnapSegments(fixtureModelZ(), 'elevation-x-1', {}, {});
  // corte x-1 (h = y). Viga alzado y=0..3000, v=[2400, 2700]. Esquina lejana (3000, 2700).
  const p = findSnapPoint(segs, { h: 3003, v: 2703 }, 20);
  assert.ok(p && near(p.h, 3000) && near(p.v, 2700), 'esquina de viga en [Z1, Z1+alto]');
});

test('buildElevationSnapSegments: viga fuera del corte no aporta (punto medio de cara no snapea)', () => {
  const segs = buildElevationSnapSegments(fixtureModelZ(), 'elevation-x-1', {}, {});
  // viga #21 (fija en X2) no cruza x=0 → no aporta. El punto medio de la cara de la viga #20 tampoco
  // snapea (solo esquinas reales), confirmando que no hay caras extra por vigas ausentes.
  assert.equal(findSnapPoint(segs, { h: 1500, v: 2550 }, 5), null);
});

// ---- sesión 6 (Tarea B): snap de planta con vanos descontados -------------------------------

const fixtureWallOpening = () => ({
  grid: {
    xAxes: [{ id: 1, position: 0 }, { id: 2, position: 4000 }],
    yAxes: [{ id: 3, position: 0 }],
    zLevels: [{ id: 5, elevation: 0 }, { id: 6, elevation: 2400 }]
  },
  elements: [
    // muro X-run de 0..4000 en y=0, espesor 100, con una puerta centrada en x=2000, ancho 900
    { id: 30, type: 'wall', direction: 'x', xStart: 1, xEnd: 2, yStart: 3, yEnd: 3, bottomZ: 5, topZ: 6, thickness: 100,
      openings: [{ id: 'o1', axisType: 'x', type: 'door', position: 2000, width: 900, height: 2100 }] }
  ],
  roofSystems: []
});

test('buildPlanSnapSegments: la esquina de jamba de un vano es snapeable', () => {
  const segs = buildPlanSnapSegments(fixtureWallOpening(), {}, {});
  // borde de vano en x=2000-450=1550, cara y=+50 (mitad espesor). Esquina de jamba (1550, 50).
  const p = findSnapPoint(segs, { h: 1552, v: 52 }, 20);
  assert.ok(p && near(p.h, 1550) && near(p.v, 50), 'esquina de jamba en el borde del vano');
});

test('buildPlanSnapSegments: el punto medio del vano en la cara del muro ya NO snapea', () => {
  const segs = buildPlanSnapSegments(fixtureWallOpening(), {}, {});
  // centro del vano x=2000, cara y=50: la cara está cortada ahí → no hay extremo ni cruce continuo.
  assert.equal(findSnapPoint(segs, { h: 2000, v: 50 }, 5), null);
});
