// tests/exportCalculixFoundation.test.mjs — Sesión 14 (Fundaciones C: CalculiX)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectFoundationSupportModel, generateCalculixFoundation,
  parseCalculixDatDisplacements, computeFoundationPressures,
  resolveSigmaAdm, KGF_CM3_TO_N_MM3, KGF_CM2_TO_MPA
} from '../src/core/exportCalculixFoundation.js';

const grid = {
  xAxes: [{ id: 1, position: 0, label: 'A' }, { id: 2, position: 5000, label: 'B' }],
  yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 4000, label: '2' }],
  zLevels: [{ id: 100, elevation: 0, label: 'NPT' }]
};
// Cimiento corrido en L (5 m en X + 4 m en Y, comparten el nodo del vértice) + poyo aislado.
const corridaX = {
  id: 1, type: 'foundation', foundationType: 'corrida', direction: 'x',
  fixedAxisId: 11, startAxisId: 1, endAxisId: 2, levelZ: 100, topOffset: 0,
  cimiento: { width: 400, depth: 600 }, sobrecimiento: { width: 200, height: 400 }, libraryId: 'S1'
};
const corridaY = { ...corridaX, id: 2, direction: 'y', fixedAxisId: 1, startAxisId: 11, endAxisId: 12 };
const poyo = {
  id: 3, type: 'foundation', foundationType: 'aislada', axisXId: 2, axisYId: 12,
  levelZ: 100, topOffset: 0, aislada: { lengthX: 1000, lengthY: 1200, depth: 500 }, libraryId: 'S2'
};
const library = {
  foundationSections: [
    { id: 'S1', itemType: 'cimiento', subgradeModulus: 4 },
    { id: 'S2', itemType: 'aislada', subgradeModulus: 6 }
  ]
};
const model = {
  grid, elements: [corridaX, corridaY, poyo], library, roofSystems: [],
  projectParams: [{ name: 'sigmaAdm', value: 1.8 }]
};

test('discretiza cada corrida por nodeSpacing y comparte el nodo del vértice en L', () => {
  const s = collectFoundationSupportModel(model, { nodeSpacing: 500 });
  assert.equal(s.runs.length, 2);
  assert.equal(s.runs[0].nodeIds.length, 11); // 5000 / 500 = 10 barras
  assert.equal(s.runs[1].nodeIds.length, 9);  // 4000 / 500 = 8 barras
  assert.equal(s.runs[0].nodeIds[0], s.runs[1].nodeIds[0]); // vértice compartido
  assert.equal(s.pads.length, 1);
  assert.equal(s.nodes.length, 11 + 8 + 1); // 19 de la L + 1 del poyo
});

test('rigidez del resorte = balasto x area tributaria (nodo interior verificado a mano)', () => {
  const s = collectFoundationSupportModel(model, { nodeSpacing: 500 });
  const interior = s.runs[0].nodeIds[5];
  const info = s.nodeInfo.get(interior);
  // tributaria: 500 mm (media barra a cada lado) x 400 mm de ancho de cimiento
  assert.ok(Math.abs(info.area - 500 * 400) < 1e-6);
  assert.ok(Math.abs(info.kArea - 4 * KGF_CM3_TO_N_MM3 * 200000) < 1e-6);
  // extremo libre: media tributaria
  const end = s.runs[0].nodeIds[10];
  assert.ok(Math.abs(s.nodeInfo.get(end).area - 250 * 400) < 1e-6);
  // poyo: area completa de la planta, con su propio balasto
  const pad = s.nodeInfo.get(s.pads[0].nodeId);
  assert.ok(Math.abs(pad.area - 1000 * 1200) < 1e-6);
  assert.ok(Math.abs(pad.kArea - 6 * KGF_CM3_TO_N_MM3 * 1200000) < 1e-6);
});

test('carga nodal = (linea + peso propio) x tributaria; presion media = 0.35 kgf/cm2', () => {
  const s = collectFoundationSupportModel(model, {
    nodeSpacing: 500, lineLoadKgfM: 600, padLoadKgf: 2000, includeSelfWeight: true
  });
  // seccion 400x600 + 200x400 = 0.32 m2 -> 800 kgf/m de peso propio; total 1400 kgf/m
  // sobre 400 mm de ancho => 1400 kgf / 4000 cm2 = 0.35 kgf/cm2
  const interior = s.runs[0].nodeIds[5];
  const loadKgf = s.nodeInfo.get(interior).load / 9.80665;
  assert.ok(Math.abs(loadKgf - 700) < 0.5); // 1400 kgf/m x 0.5 m tributario (media barra a cada lado)
  const padKgf = s.nodeInfo.get(s.pads[0].nodeId).load / 9.80665;
  assert.ok(Math.abs(padKgf - (2000 + 1500)) < 1); // 2000 + 0.6 m3 x 2500 kgf/m3
});

test('sin peso propio la carga baja a la linea pura', () => {
  const s = collectFoundationSupportModel(model, { nodeSpacing: 500, lineLoadKgfM: 600, includeSelfWeight: false });
  const loadKgf = s.nodeInfo.get(s.runs[0].nodeIds[5]).load / 9.80665;
  assert.ok(Math.abs(loadKgf - 300) < 0.5); // 600 kgf/m x 0.5 m
});

test('apoyos: torsion bloqueada solo donde no hay tramo transversal; poyo con 5 gdl fijos', () => {
  const s = collectFoundationSupportModel(model, { nodeSpacing: 500 });
  const byNode = new Map(s.boundaries.map((b) => [b.node, b.dofs]));
  const vertex = s.runs[0].nodeIds[0];               // esquina L: corre en X y en Y
  assert.deepEqual(byNode.get(vertex), [1, 2, 6]);   // 4 y 5 son flexion de algun tramo -> libres
  const onlyX = s.runs[0].nodeIds[5];
  assert.deepEqual(byNode.get(onlyX), [1, 2, 4, 6]); // gdl 4 = torsion del tramo en X
  const onlyY = s.runs[1].nodeIds[5];
  assert.deepEqual(byNode.get(onlyY), [1, 2, 5, 6]);
  assert.deepEqual(byNode.get(s.pads[0].nodeId), [1, 2, 4, 5, 6]);
});

test('el .inp lleva barras B31, resortes SPRING1 en gdl 3, cargas y salida, todo ASCII', () => {
  const inp = generateCalculixFoundation(model, { nodeSpacing: 500 });
  assert.ok(/^\*NODE$/m.test(inp));
  assert.ok(/\*ELEMENT, TYPE=B31, ELSET=FUND_1/.test(inp));
  assert.ok(/\*ELEMENT, TYPE=SPRING1, ELSET=RES_1/.test(inp));
  assert.match(inp, /\*BEAM SECTION, ELSET=FUND_1, MATERIAL=HORMIGON, SECTION=RECT\n1000\.0, 400\.0\n0\.0, 0\.0, 1\.0/);
  assert.match(inp, /\*SPRING, ELSET=RES_1\n3\n/); // gdl 3 = vertical
  assert.ok(inp.includes('*NSET, NSET=NFUND'));
  assert.ok(inp.includes('*STATIC') && inp.includes('*CLOAD') && inp.includes('*END STEP'));
  assert.ok(inp.includes('*NODE PRINT, NSET=NFUND'));
  assert.ok(!/[^\x00-\x7F]/.test(inp), 'el .inp debe ser ASCII puro');
});

test('sigmaAdm sale del parametro de proyecto y cae al default si no existe', () => {
  assert.equal(resolveSigmaAdm(model), 1.8);
  assert.equal(resolveSigmaAdm({ ...model, projectParams: [] }), 1.5);
  assert.equal(resolveSigmaAdm({ ...model, projectParams: [] }, { sigmaAdmKgfCm2: 2.2 }), 2.2);
});

test('post-proceso: p = balasto x asentamiento, comparada con la admisible', () => {
  const s = collectFoundationSupportModel(model, { nodeSpacing: 2500 });
  // .dat sintético con el formato real de CalculiX (asentamiento uniforme de 0.875 mm)
  const ids = [...new Set([...s.runs.flatMap((r) => r.nodeIds), s.pads[0].nodeId])];
  const dat = [
    '', '                        S T E P       1', '', '',
    ' displacements (vx,vy,vz) for set NFUND and time  0.1000000E+01', '',
    ...ids.map((id) => `      ${id}  0.000000E+00  0.000000E+00 -8.750000E-01`)
  ].join('\n');
  const disp = parseCalculixDatDisplacements(dat);
  assert.equal(disp.size, ids.length);

  const res = computeFoundationPressures(s, disp);
  assert.equal(res.sigmaAdmKgfCm2, 1.8);
  assert.equal(res.missingNodes.length, 0);
  const corrida = res.rows.find((r) => r.elementId === 1);
  // 4 kgf/cm3 x 0.0875 cm = 0.35 kgf/cm2
  assert.ok(Math.abs(corrida.pMaxKgfCm2 - 0.35) < 1e-6);
  assert.ok(Math.abs(corrida.settleMaxMm - 0.875) < 1e-9);
  assert.equal(corrida.ok, true);
  const pad = res.rows.find((r) => r.kind === 'aislada');
  assert.ok(Math.abs(pad.pMaxKgfCm2 - 6 * 0.0875) < 1e-6); // balasto propio del poyo
  assert.ok(Math.abs(res.maxRatio - (6 * 0.0875) / 1.8) < 1e-9);
});

test('presion sobre la admisible marca ok=false', () => {
  const s = collectFoundationSupportModel({ ...model, projectParams: [{ name: 'sigmaAdm', value: 0.2 }] }, { nodeSpacing: 2500 });
  const disp = new Map(s.runs[0].nodeIds.map((id) => [id, { ux: 0, uy: 0, uz: -0.875 }]));
  const res = computeFoundationPressures(s, disp);
  const corrida = res.rows.find((r) => r.elementId === 1);
  assert.equal(corrida.ok, false);
  assert.ok(corrida.ratio > 1.7);
  assert.ok(res.missingNodes.length > 0); // los nodos del otro tramo no vinieron en el .dat
});

test('modelo sin fundaciones: .inp con aviso y sin nodos', () => {
  const empty = { ...model, elements: [] };
  const s = collectFoundationSupportModel(empty);
  assert.equal(s.nodes.length, 0);
  assert.ok(generateCalculixFoundation(empty).includes('nada que exportar'));
});

test('unidades: 1 kgf/cm2 = 0.0980665 MPa y 1 kgf/cm3 = 0.00980665 N/mm3', () => {
  assert.ok(Math.abs(KGF_CM2_TO_MPA - 0.0980665) < 1e-9);
  assert.ok(Math.abs(KGF_CM3_TO_N_MM3 - 0.00980665) < 1e-9);
});
