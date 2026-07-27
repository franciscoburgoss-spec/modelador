import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findRoofObstructions, applyObstructionsToRun, edgeChordMembers, countFullTrusses } from '../src/core/roofObstructions.js';
import { buildRoofTrussMembers } from '../src/core/build3d.js';
import { generateTrussDxf } from '../src/core/exportTrussDxf.js';
import { collectTypicalTruss } from '../src/core/exportCalculixTruss.js';
import { makeNodeRegistry } from '../src/core/calculixCommon.js';
import { computeRoofSystemLayout, validateRoofSystems } from '../src/core/trussLayout.js';
import { computeRoofPlanSegments, computeRoofElevationSegments } from '../src/core/roofSegments.js';
import { buildParamsMap } from '../src/core/projectParams.js';
import { buildElementsById } from '../src/core/elementReferences.js';
import { computeTakeoff } from '../src/core/takeoff.js';

// Modelo real de Fran (casa en L, dos sistemas de un agua sobre el mismo muro bajo).
// Se usa como fixture porque los tres bugs de la sesión 25 aparecen juntos ahí:
// cercha embebida en frontón izquierdo, en frontón derecho, y offset duplicado en x=12800.
const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'casa-L.json');
const model = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

const layoutOf = (systemId) => {
  const sys = model.roofSystems.find(s => s.id === systemId);
  return computeRoofSystemLayout(
    sys, model.grid, buildParamsMap(model.projectParams),
    buildElementsById(model.elements), model.elements, model.library
  );
};

const BRAZO_LARGO = 1784863900200; // luz 1099mm, corre x 3000→12800
const BRAZO_CORTO = 1784863870695; // luz 1899mm, corre x 12800→14500

test('applyObstructionsToRun: el frontón del extremo empuja el arranque a su cara interior', () => {
  const obs = [{ wallId: 9, oMin: 2949.45, oMax: 3050.55, center: 3000, thickness: 101.1 }];
  const r = applyObstructionsToRun(3000, 12800, obs);
  assert.equal(Math.round(r.from), 3051);
  assert.equal(r.to, 12800);
  assert.equal(r.edgeLow.wallId, 9);
  assert.equal(r.edgeHigh, null);
  assert.equal(r.blocking.length, 0);
  assert.equal(r.collapsed, false);
});

test('applyObstructionsToRun: un frontón en el medio no se resuelve moviendo cerchas', () => {
  const obs = [{ wallId: 7, oMin: 6000, oMax: 6100, center: 6050, thickness: 100 }];
  const r = applyObstructionsToRun(3000, 12800, obs);
  assert.equal(r.from, 3000);
  assert.equal(r.to, 12800);
  assert.equal(r.blocking.length, 1);
  assert.equal(r.blocking[0].wallId, 7);
});

test('applyObstructionsToRun: sin frontones el rango queda intacto (comportamiento previo)', () => {
  const r = applyObstructionsToRun(3000, 12800, []);
  assert.deepEqual({ from: r.from, to: r.to }, { from: 3000, to: 12800 });
  assert.equal(r.edgeLow, null);
  assert.equal(r.edgeHigh, null);
});

test('findRoofObstructions: solo cuenta muros perpendiculares a la corrida, vivos en la cota de apoyo', () => {
  const walls = model.elements.filter(e => e.type === 'wall');
  const { obstacles, crossing } = findRoofObstructions({
    walls, grid: model.grid,
    paramsMap: buildParamsMap(model.projectParams),
    elementsById: buildElementsById(model.elements),
    runAxis: 'x',
    bandFrom: 50.55, bandTo: 1949.45,   // banda del brazo corto, entre caras interiores
    supportElevation: 3350,
    excludeIds: [1784600403613, 1784819708086]
  });
  const ids = obstacles.map(o => o.wallId);
  assert.ok(ids.includes(1784753322528), 'frontón interior de la L (x=12800)');
  assert.ok(ids.includes(1784754251210), 'frontón de testera (x=14500)');
  // el muro que corre paralelo a la corrida no es frontón: va a `crossing`, no a `obstacles`
  assert.ok(!ids.includes(1784604634483));
  assert.ok(crossing.some(c => c.wallId === 1784604634483));
});

test('brazo corto: las dos cerchas de borde se desplazan a la cara del frontón y quedan como cuerda superior', () => {
  const l = layoutOf(BRAZO_CORTO);
  assert.equal(l.resolved, true);

  // antes: offsets 12800 / 13650 / 14500 — las dos de los extremos embebidas en muro
  const offsets = l.trussPositions.map(p => Math.round(p.offset));
  assert.ok(!offsets.includes(12800), 'ya no arranca dentro del frontón interior');
  assert.ok(!offsets.includes(14500), 'ya no remata dentro del frontón de testera');
  assert.equal(Math.round(l.runRange.from), 12851, 'cara interior del frontón x=12800 (+ medio espesor)');
  assert.equal(Math.round(l.runRange.to), 14449, 'cara interior del frontón x=14500 (− medio espesor)');

  const first = l.trussPositions[0];
  const last = l.trussPositions[l.trussPositions.length - 1];
  assert.equal(first.kind, 'edgeChord');
  assert.equal(first.againstWallId, 1784753322528);
  assert.equal(last.kind, 'edgeChord');
  assert.equal(last.againstWallId, 1784754251210);
  assert.ok(l.trussPositions.slice(1, -1).every(p => p.kind === 'full'), 'las intermedias siguen siendo cerchas completas');
});

test('brazo largo: solo el extremo con frontón se corrige; el otro queda como estaba', () => {
  const l = layoutOf(BRAZO_LARGO);
  assert.equal(l.resolved, true);
  assert.equal(Math.round(l.runRange.from), 3051, 'frontón en x=3000 → cara interior');
  assert.equal(Math.round(l.runRange.to), 12800, 'el extremo alto no tiene frontón: no se toca');
  assert.equal(l.trussPositions[0].kind, 'edgeChord');
  assert.equal(l.trussPositions[l.trussPositions.length - 1].kind, 'full');
});

test('el duplicado en el borde entre los dos brazos desaparece al desplazar la cercha de borde', () => {
  const a = layoutOf(BRAZO_LARGO).trussPositions.map(p => Math.round(p.offset));
  const b = layoutOf(BRAZO_CORTO).trussPositions.map(p => Math.round(p.offset));
  const dup = a.filter(o => b.includes(o));
  assert.deepEqual(dup, [], 'antes ambos sistemas ponían una cercha en x=12800');
});

test('las cerchas ya no caen dentro del espesor de ningún frontón', () => {
  for (const id of [BRAZO_LARGO, BRAZO_CORTO]) {
    const l = layoutOf(id);
    const { obstacles } = findRoofObstructions({
      walls: model.elements.filter(e => e.type === 'wall'),
      grid: model.grid,
      paramsMap: buildParamsMap(model.projectParams),
      elementsById: buildElementsById(model.elements),
      runAxis: l.runAxis,
      bandFrom: l.trussPositions[0].world.y,
      bandTo: l.trussPositions[0].world.y + l.spanDir * l.span,
      supportElevation: l.supportElevation,
      excludeIds: []
    });
    for (const p of l.trussPositions) {
      if (p.kind === 'edgeChord') continue;
      const inside = obstacles.find(ob => p.offset > ob.oMin + 1 && p.offset < ob.oMax - 1);
      assert.equal(inside, undefined, `sistema ${id}: cercha en ${Math.round(p.offset)} embebida en el muro ${inside?.wallId}`);
    }
  }
});

test('validateRoofSystems: el modelo guardado ANTES de la 25 se marca con trussInsideWall', () => {
  const findings = validateRoofSystems(model); // trussPositions persistidas, sin `kind`
  const buried = findings.filter(f => f.category === 'trussInsideWall');
  assert.ok(buried.length > 0, 'el modelo original tiene cerchas embebidas y hay que avisarlo');
  assert.ok(buried.every(f => f.severity === 'error'));
});

test('metrado: la cuerda de borde se cuenta como cuerda, no como cercha completa', () => {
  const l = layoutOf(BRAZO_CORTO);
  const withKinds = {
    ...model,
    roofSystems: [{ ...model.roofSystems.find(s => s.id === BRAZO_CORTO), ...l }]
  };
  const { rows } = computeTakeoff(withKinds);
  const edgeRows = rows.filter(r => r.type === 'roof' && r.section.includes('cuerda de borde'));
  assert.equal(edgeRows.length, 1, 'una fila propia para la cuerda superior de borde');
  assert.equal(edgeRows[0].count, 2, 'las dos cuerdas de borde del brazo corto');

  // y esas dos posiciones NO suman en las filas de cercha completa
  const nFull = l.trussPositions.filter(p => p.kind === 'full').length;
  const bottomChordProfile = l.trussGeometry.members.find(m => m.role === 'bottomChord').profile;
  const chordRow = rows.find(r => r.type === 'roof' && r.section === bottomChordProfile);
  assert.equal(chordRow.count % nFull, 0, 'la cuerda inferior solo existe en las cerchas completas');
});

test('edgeChordMembers: de la cercha solo sobrevive la cuerda superior', () => {
  const l = layoutOf(BRAZO_CORTO);
  const members = edgeChordMembers(l.trussGeometry);
  assert.ok(members.length > 0);
  assert.ok(members.every(m => m.role === 'topChord'));
  assert.ok(members.length < l.trussGeometry.members.length);
});

// ---- paso 2: propagación a 3D, planta, elevación y DXF ---------------------------------------

test('3D: en la posición de borde solo se construye la cuerda superior', () => {
  const l = layoutOf(BRAZO_CORTO);
  const m = { ...model, roofSystems: [{ ...model.roofSystems.find(s => s.id === BRAZO_CORTO), ...l }] };
  const members = buildRoofTrussMembers(m);

  const edge = members.filter(x => x.kind === 'edgeChord');
  const full = members.filter(x => x.kind === 'full');
  assert.ok(edge.length > 0 && full.length > 0);
  assert.ok(edge.every(x => x.role === 'topChord'), 'la cuerda de borde no lleva celosía');
  assert.ok(full.some(x => x.role === 'bottomChord'), 'las cerchas reales sí');

  const nEdgePos = l.trussPositions.filter(p => p.kind === 'edgeChord').length;
  const nTopPerTruss = l.trussGeometry.members.filter(x => x.role === 'topChord').length;
  assert.equal(edge.length, nEdgePos * nTopPerTruss);
});

test('planta: el segmento de la cuerda de borde se marca para dibujarse distinto', () => {
  const l = layoutOf(BRAZO_CORTO);
  const m = { ...model, roofSystems: [{ ...model.roofSystems.find(s => s.id === BRAZO_CORTO), ...l }] };
  const segs = computeRoofPlanSegments(m);
  assert.equal(segs.length, l.trussPositions.length);
  assert.equal(segs.filter(s => s.kind === 'edgeChord').length, 2);
  assert.ok(segs.every(s => s.systemId === BRAZO_CORTO));
});

test('elevación: un corte justo sobre la cuerda de borde no dibuja la celosía', () => {
  const l = layoutOf(BRAZO_CORTO);
  const edgeOffset = l.trussPositions[0].offset;
  const midOffset = l.trussPositions[1].offset;

  const grid = {
    ...model.grid,
    xAxes: [...model.grid.xAxes,
      { id: 900001, label: 'E', position: edgeOffset },
      { id: 900002, label: 'M', position: midOffset }]
  };
  const m = { ...model, grid, roofSystems: [{ ...model.roofSystems.find(s => s.id === BRAZO_CORTO), ...l }] };

  const onEdge = computeRoofElevationSegments(m, 'elevation-x-900001');
  const onMid = computeRoofElevationSegments(m, 'elevation-x-900002');
  assert.ok(onEdge.length > 0 && onMid.length > onEdge.length,
    'el corte sobre la cuerda de borde tiene menos geometría que sobre una cercha real');
});

test('DXF de cerchas: el rótulo cuenta cerchas reales y anota las cuerdas de borde aparte', () => {
  const l = layoutOf(BRAZO_CORTO);
  const sys = { ...model.roofSystems.find(s => s.id === BRAZO_CORTO), ...l };
  assert.equal(countFullTrusses(sys), l.trussPositions.filter(p => p.kind === 'full').length);

  const dxf = generateTrussDxf({ ...model, roofSystems: [sys] });
  assert.ok(dxf, 'genera el DXF');
  assert.ok(dxf.includes('cuerda(s) sup. de borde'), 'el rótulo declara las cuerdas de borde');
  assert.ok(!dxf.includes(`x${l.trussPositions.length} EN OBRA`), 'el despiece no manda a fabricar cerchas de más');
  assert.ok(dxf.includes(`x${countFullTrusses(sys)} EN OBRA`));
});

test('CalculiX: las cuerdas de borde no entran al análisis y la cercha típica se elige entre las reales', () => {
  const l = layoutOf(BRAZO_CORTO);
  const sys = { ...model.roofSystems.find(s => s.id === BRAZO_CORTO), ...l };
  const reg = makeNodeRegistry();
  const r = collectTypicalTruss(sys, model.library, reg);

  assert.equal(r.resolved, true);
  assert.ok(r.warnings.some(w => /cuerda\(s\) de borde .*excluidas/.test(w)));

  // la cercha analizada está en una posición `full`, nunca contra la cara del frontón
  const fullOffsets = l.trussPositions.filter(p => p.kind === 'full').map(p => p.offset);
  assert.ok(fullOffsets.some(o => Math.abs(o - r.meta.offset) < 0.5), 'la cercha analizada no es una cuerda de borde');
  assert.equal(r.meta.trussCount, countFullTrusses(sys), 'el conteo del .inp no incluye las cuerdas de borde');
});
