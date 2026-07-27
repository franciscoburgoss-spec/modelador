import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { planRoofSystemsFromLowWall, findBandConflicts } from '../src/core/roofZoneGenerator.js';
import { computeRoofSystemLayout } from '../src/core/trussLayout.js';
import { buildParamsMap } from '../src/core/projectParams.js';
import { buildElementsById } from '../src/core/elementReferences.js';

const model = JSON.parse(fs.readFileSync(
  path.join(import.meta.dirname, 'fixtures', 'casa-L.json'), 'utf8'));

const MURO_BAJO = 1784600403613;   // y=0, x 3000→14500, común a los dos brazos
const ALTO_LARGO = 1784604634483;  // y=1200, x 0→12800
const ALTO_CORTO = 1784819708086;  // y=2000, x 12800→14500

const plan = (opts = {}) => planRoofSystemsFromLowWall(model, {
  wallLowId: MURO_BAJO,
  supportElevation: 3350,
  paramsMap: buildParamsMap(model.projectParams),
  elementsById: buildElementsById(model.elements),
  ...opts
});

test('el generador reproduce los dos sistemas que Fran armó a mano en la casa en L', () => {
  const { bands, runAxis } = plan();
  assert.equal(runAxis, 'x');
  assert.equal(bands.length, 2);

  const [b1, b2] = bands;
  assert.equal(b1.wallHighId, ALTO_LARGO);
  assert.deepEqual(b1.runRange, { from: 3000, to: 12800 });
  assert.equal(b2.wallHighId, ALTO_CORTO);
  assert.deepEqual(b2.runRange, { from: 12800, to: 14500 });
  assert.ok(bands.every(b => b.wallLowId === MURO_BAJO));
});

test('cada banda trae la luz de SU brazo: en una L los dos tramos no comparten geometría de cercha', () => {
  const { bands } = plan();
  const spans = bands.map(b => b.span);
  assert.ok(Math.abs(spans[0] - 1098.9) < 1, `brazo largo ~1099mm, dio ${spans[0]}`);
  assert.ok(Math.abs(spans[1] - 1898.9) < 1, `brazo corto ~1899mm, dio ${spans[1]}`);
  assert.notEqual(spans[0], spans[1]);
});

test('gana el muro alto MÁS CERCANO donde dos candidatos se solapan', () => {
  // se clona el frontón lejano (y=2000) y se lo extiende sobre todo el largo: pasa a competir con
  // el cercano (y=1200) en x<12800. La cercha apoya en el primero que encuentra, no en el lejano.
  const lejano = JSON.parse(JSON.stringify(model.elements.find(e => e.id === ALTO_CORTO)));
  lejano.id = 999001;
  lejano.xStart = model.grid.xAxes.find(a => a.position === 0).id;
  const m2 = { ...model, elements: [...model.elements, lejano] };

  const { bands } = planRoofSystemsFromLowWall(m2, {
    wallLowId: MURO_BAJO, supportElevation: 3350,
    paramsMap: buildParamsMap(model.projectParams),
    elementsById: buildElementsById(m2.elements)
  });

  const antes12800 = bands.filter(b => b.runRange.to <= 12800 + 1);
  assert.ok(antes12800.length > 0);
  assert.ok(antes12800.every(b => b.wallHighId === ALTO_LARGO),
    'el muro de y=1200 gana sobre el de y=2000 en el tramo donde ambos existen');
  assert.ok(antes12800.every(b => Math.abs(b.span - 1098.9) < 1), 'y la luz es la del cercano');
});

test('un frontón que cruza por el medio parte la zona en dos en vez de dejar cerchas embebidas', () => {
  // se clona un frontón real del modelo y se lo lleva al eje 4 (x=6400), a media banda del brazo largo
  const ejeMedio = model.grid.xAxes.find(a => a.position === 6400);
  const partidor = JSON.parse(JSON.stringify(model.elements.find(e => e.id === 1784751024158)));
  partidor.id = 999003;
  partidor.xStart = ejeMedio.id;
  partidor.xEnd = ejeMedio.id;
  const m2 = { ...model, elements: [...model.elements, partidor] };

  const { bands, warnings } = planRoofSystemsFromLowWall(m2, {
    wallLowId: MURO_BAJO, supportElevation: 3350,
    paramsMap: buildParamsMap(model.projectParams),
    elementsById: buildElementsById(m2.elements)
  });

  assert.equal(bands.length, 3, 'el brazo largo se parte en dos y el corto queda igual');
  assert.equal(Math.round(bands[0].runRange.to), 6350, 'primera banda cierra en la cara del frontón');
  assert.equal(Math.round(bands[1].runRange.from), 6451, 'la segunda arranca en la cara opuesta');
  assert.equal(bands[0].wallHighId, bands[1].wallHighId, 'las dos siguen apoyando en el mismo muro alto');
  assert.ok(warnings.some(w => /frontón/.test(w)));

  // ninguna banda atraviesa el frontón
  for (const b of bands) {
    const dentro = ejeMedio.position > b.runRange.from + 60 && ejeMedio.position < b.runRange.to - 60;
    assert.equal(dentro, false, `la banda ${b.runRange.from}→${b.runRange.to} atraviesa el frontón`);
  }
});

test('sin muro de apoyo alto válido a esa cota se avisa en vez de generar basura', () => {
  const { bands, warnings } = plan({ supportElevation: 99000 });
  assert.equal(bands.length, 0);
  assert.ok(warnings.some(w => /ningún muro paralelo/.test(w)));
});

test('findBandConflicts detecta que las bandas ya existen como sistemas', () => {
  const { bands } = plan();
  const existing = model.roofSystems.map(s => ({
    id: s.id, wallLowId: s.wallLowId, wallHighId: s.wallHighId,
    runRange: { from: 3000, to: 12800 }
  }));
  const conflicts = findBandConflicts(bands, existing);
  assert.ok(conflicts.length > 0, 'no se debe duplicar la techumbre al regenerar');
  assert.ok(conflicts.every(c => c.reason));

  assert.equal(findBandConflicts(bands, []).length, 0, 'sin sistemas previos no hay conflicto');
});

test('el generador es puro: no toca el modelo', () => {
  const before = JSON.stringify(model);
  plan();
  assert.equal(JSON.stringify(model), before);
});
