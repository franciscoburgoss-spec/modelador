// lab/roofPlane/tests/roofPurlins.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoofPurlins } from '../core/roofPurlins.js';

// Faldón del eje A: dos tramos con distinta luz que descargan a la misma canaleta.
// tramo corto: run 3050->12800, inclSpan 1098.9 ; tramo largo: run 12800->14449, inclSpan 1898.9
const ejeA = [
  { runFrom: 3050.6, runTo: 12800, inclSpan: 1098.9 },
  { runFrom: 12800, runTo: 14449.5, inclSpan: 1898.9 }
];

test('costaneras continuas a través del quiebre en las s que ambos tramos alcanzan', () => {
  const r = buildRoofPurlins({ segments: ejeA, spacing: 800, startOffset: 200 });
  // stations: 200, 1000, 1099(remate del corto NO — el remate es del maxIncl=1898.9)
  // maxIncl=1898.9 -> stations 200,1000,1800,1898.9
  const sVals = [...new Set(r.purlins.map(p => Math.round(p.s)))];
  assert.deepEqual(sVals, [200, 1000, 1800, 1899]);

  // s=200 y s=1000 (<1098.9): ambos tramos llegan -> UNA costanera continua 3050->14449
  const at200 = r.purlins.filter(p => Math.round(p.s) === 200);
  assert.equal(at200.length, 1, 's=200 es una sola costanera continua');
  assert.equal(Math.round(at200[0].pieces[0].runFrom), 3051);
  assert.equal(Math.round(at200[0].pieces[0].runTo), 14450);
});

test('costanera alta solo cubre el tramo largo (el corto no llega)', () => {
  const r = buildRoofPurlins({ segments: ejeA, spacing: 800, startOffset: 200 });
  // s=1800 (>1098.9): solo el tramo largo llega -> costanera 12800->14449
  const at1800 = r.purlins.filter(p => Math.round(p.s) === 1800);
  assert.equal(at1800.length, 1);
  assert.equal(Math.round(at1800[0].pieces[0].runFrom), 12800);
  assert.equal(Math.round(at1800[0].pieces[0].runTo), 14450);
});

test('troceo por largo comercial empalma sobre cercha con traslapo', () => {
  // costanera larga de 3050->14449 (~11399mm) troceada a 6000mm comerciales, overlap 100.
  const trusses = [3050.6, 4250.6, 5450.6, 6650.6, 7850.6, 9050.6, 10250.6, 11450.6, 12650.6, 13850.6, 14449.5];
  const r = buildRoofPurlins({
    segments: [{ runFrom: 3050.6, runTo: 14449.5, inclSpan: 1099 }],
    spacing: 800, startOffset: 200, commercialLength: 6000, overlap: 100, trussOffsets: trusses
  });
  const p = r.purlins.find(x => Math.round(x.s) === 200);
  assert.ok(p.pieces.length >= 2, 'se troceó en varias piezas');
  // todos los empalmes intermedios caen sobre una cercha
  for (let i = 0; i < p.pieces.length - 1; i++) {
    assert.equal(p.pieces[i].spliceAtTruss, true);
    const spliceEnd = p.pieces[i].runTo - 100; // quitar overlap
    assert.ok(trusses.some(t => Math.abs(t - spliceEnd) < 1), `empalme en ${spliceEnd} sobre cercha`);
  }
  // ninguna pieza excede el largo comercial + traslapo (la pieza física incluye el solape)
  for (const pc of p.pieces) assert.ok(pc.runTo - pc.runFrom <= 6000 + 100 + 1, 'pieza <= comercial+overlap');
});

test('faldón rectangular simple: costaneras cubren toda la corrida sin partir', () => {
  const r = buildRoofPurlins({
    segments: [{ runFrom: 0, runTo: 8000, inclSpan: 3000 }],
    spacing: 1000, startOffset: 200
  });
  for (const p of r.purlins) {
    assert.equal(p.pieces.length, 1);
    assert.equal(p.pieces[0].runFrom, 0);
    assert.equal(p.pieces[0].runTo, 8000);
  }
});
