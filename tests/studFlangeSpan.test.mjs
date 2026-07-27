// R2 — convención de fase de las piezas de muro.
// Criterios de aceptación de `spec-R2.md` §4, medidos sobre el fixture real `casa-L`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { studFlangeSpan, memberOffsetMode } from '../src/core/trussLayout.js';
import { wallFramingEntities } from '../src/core/exportFramingDxf.js';
import { drawWallStudsElevation } from '../src/render/wall.js';
import { resolveWallGeometry, isWallXRun } from '../src/core/elementGeometry.js';
import { screenToPlane } from '../src/core/projection.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures/casa-L.json'), 'utf8'));

const elementsById = Object.fromEntries(model.elements.map(e => [e.id, e]));
const paramsMap = Object.fromEntries((model.projectParams || []).map(p => [p.id, p]));
const profiles = model.library?.metalconProfiles || [];
const walls = model.elements.filter(e => e.type === 'wall' && e.studs?.length);

/** Ancho de ala real del perfil del muro — el mismo fallback que usan los dos emisores. */
function flangeWidthOf(wall) {
  return profiles.find(p => p.id === wall.framingStudProfileId)?.B ?? 90;
}

function wallLength(wall) {
  const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
  const span = isWallXRun(wall) ? geo.p2.x - geo.p1.x : geo.p2.y - geo.p1.y;
  return Math.abs(span);
}

function ctxOf(wall) {
  return {
    length: wallLength(wall),
    jambMins: (wall.headers || []).map(h => h.oMin),
    jambMaxs: (wall.headers || []).map(h => h.oMax)
  };
}

/** Cómo se dibujaba ANTES de R2: eje para todo salvo jamba. Sirve de baseline para verificar que
 * las jambas puras no se movieron y que los montantes de extremo sí. */
function legacySpan(stud, ctx, w) {
  const near = (v, arr) => arr.some(a => Math.abs(a - v) < 1);
  if (near(stud.offset, ctx.jambMins)) return { xMin: stud.offset - w, xMax: stud.offset };
  if (near(stud.offset, ctx.jambMaxs)) return { xMin: stud.offset, xMax: stud.offset + w };
  return { xMin: stud.offset - w / 2, xMax: stud.offset + w / 2 };
}

const isEnd = (o, L) => Math.abs(o) < 1 || Math.abs(o - L) < 1;
const isJamb = (o, ctx) =>
  [...ctx.jambMins, ...ctx.jambMaxs].some(a => Math.abs(a - o) < 1);

// ---------------------------------------------------------------------------
// Parte A — la función
// ---------------------------------------------------------------------------

test('memberOffsetMode: sin ctx conserva el comportamiento histórico (cerchas intactas)', () => {
  assert.equal(memberOffsetMode('topChord'), 'minus');
  assert.equal(memberOffsetMode('bottomChord'), 'plus');
  assert.equal(memberOffsetMode('post'), 'center');
  assert.equal(memberOffsetMode('stud'), 'center');
  // el rol de cuerda gana sobre cualquier ctx: una cuerda no es pieza de muro
  assert.equal(memberOffsetMode('topChord', { offset: 0, length: 4200 }), 'minus');
});

test('studFlangeSpan: extremo de muro a ras hacia adentro, ambos extremos', () => {
  const ctx = { length: 4200, jambMins: [], jambMaxs: [] };
  assert.deepEqual(studFlangeSpan({ offset: 0, role: 'corner' }, ctx, 38), { xMin: 0, xMax: 38 });
  assert.deepEqual(studFlangeSpan({ offset: 4200, role: 'corner' }, ctx, 38), { xMin: 4162, xMax: 4200 });
});

test('studFlangeSpan: jamba a ras hacia afuera del vano', () => {
  const ctx = { length: 4200, jambMins: [1005], jambMaxs: [1755] };
  assert.deepEqual(studFlangeSpan({ offset: 1005, role: 'king' }, ctx, 38), { xMin: 967, xMax: 1005 });
  assert.deepEqual(studFlangeSpan({ offset: 1755, role: 'king' }, ctx, 38), { xMin: 1755, xMax: 1793 });
});

test('studFlangeSpan: montante de campo al eje', () => {
  const ctx = { length: 4200, jambMins: [1005], jambMaxs: [1755] };
  assert.deepEqual(studFlangeSpan({ offset: 400, role: 'stud' }, ctx, 38), { xMin: 381, xMax: 419 });
});

test('studFlangeSpan: el extremo de muro GANA sobre el borde de vano (D-019)', () => {
  // muro 1784752639636: en offset 4200 conviven corner, jack y crippleTop; ese offset es a la vez
  // fin de muro y oMax de un vano. Antes ganaba la jamba y salían 38 mm fuera del muro.
  const ctx = { length: 4200, jambMins: [3450], jambMaxs: [4200] };
  for (const role of ['corner', 'jack', 'crippleTop']) {
    assert.deepEqual(studFlangeSpan({ offset: 4200, role }, ctx, 38), { xMin: 4162, xMax: 4200 });
  }
});

// ---------------------------------------------------------------------------
// Criterios 1, 2, 3, 5 — medidos sobre casa-L
// ---------------------------------------------------------------------------

test('C1 — cero piezas fuera del contorno del muro en casa-L (baseline: 45 de 45 muros)', () => {
  let over = 0, baselineOver = 0, baselineWalls = new Set();
  for (const wall of walls) {
    const ctx = ctxOf(wall), w = flangeWidthOf(wall);
    for (const s of wall.studs) {
      const sp = studFlangeSpan(s, ctx, w);
      if (sp.xMin < -1e-9 || sp.xMax > ctx.length + 1e-9) over++;
      const lg = legacySpan(s, ctx, w);
      if (lg.xMin < -1e-9 || lg.xMax > ctx.length + 1e-9) { baselineOver++; baselineWalls.add(wall.id); }
    }
  }
  assert.equal(baselineOver, 92, 'baseline medido en la spec: 89 de 19 mm + 3 de 38 mm');
  assert.equal(baselineWalls.size, 45);
  assert.equal(over, 0);
});

test('C2 — los 89 montantes de extremo pasan de [-19,+19] a [0,38] y de [L-19,L+19] a [L-38,L]', () => {
  let atStart = 0, atEnd = 0;
  for (const wall of walls) {
    const ctx = ctxOf(wall), w = flangeWidthOf(wall), L = ctx.length;
    for (const s of wall.studs) {
      if (!isEnd(s.offset, L) || isJamb(s.offset, ctx)) continue; // los 3 en colisión → C5
      const sp = studFlangeSpan(s, ctx, w);
      if (Math.abs(s.offset) < 1) { assert.deepEqual(sp, { xMin: 0, xMax: w }); atStart++; }
      else { assert.deepEqual(sp, { xMin: L - w, xMax: L }); atEnd++; }
    }
  }
  assert.equal(atStart + atEnd, 89);
});

test('C3 — las 273 jambas puras no se mueven (deepEqual contra el baseline)', () => {
  let n = 0;
  for (const wall of walls) {
    const ctx = ctxOf(wall), w = flangeWidthOf(wall);
    for (const s of wall.studs) {
      if (!isJamb(s.offset, ctx) || isEnd(s.offset, ctx.length)) continue;
      assert.deepEqual(studFlangeSpan(s, ctx, w), legacySpan(s, ctx, w),
        `jamba movida en muro ${wall.id} offset ${s.offset}`);
      n++;
    }
  }
  assert.equal(n, 273);
});

test('C5 — precedencia: las 3 piezas de offset 4200 del muro 1784752639636 quedan dentro', () => {
  const wall = walls.find(x => String(x.id) === '1784752639636');
  const ctx = ctxOf(wall), w = flangeWidthOf(wall);
  const hits = wall.studs.filter(s => Math.abs(s.offset - 4200) < 1);
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map(s => s.role).sort(), ['corner', 'crippleTop', 'jack']);
  for (const s of hits) {
    const sp = studFlangeSpan(s, ctx, w);
    assert.ok(sp.xMax <= 4200, `${s.role} sale a ${sp.xMax}`);
    assert.deepEqual(sp, { xMin: 4162, xMax: 4200 });
  }
});

// ---------------------------------------------------------------------------
// Criterio 4 — los dos emisores coinciden, pieza a pieza, en los 45 muros
// ---------------------------------------------------------------------------

/** Spans locales de MONTANTES tal como los emite el DXF (xOffset = 0 → ya son locales). */
function spansFromDxf(wall) {
  const layout = {
    studs: wall.studs, headers: wall.headers || [],
    length: wallLength(wall), wallHeight: 2800, wallBottomElevation: 0
  };
  const studProfile = profiles.find(p => p.id === wall.framingStudProfileId);
  const trackProfile = profiles.find(p => p.id === wall.framingTrackProfileId);
  const ents = wallFramingEntities(wall, model.grid, layout, studProfile, trackProfile, 0,
    { axes: [] }, { includeAxes: false, includeLevels: false, includeCotas: false });
  const out = [];
  for (const e of ents) {
    const t = String(e).split('\n');
    if (t[0] !== '0' || t[1] !== 'POLYLINE' || t[3] !== 'MONTANTES') continue;
    const xs = [];
    for (let i = 0; i < t.length - 1; i++) if (t[i] === '10') xs.push(Number(t[i + 1]));
    out.push({ xMin: Math.min(...xs), xMax: Math.max(...xs) });
  }
  return out.sort((a, b) => a.xMin - b.xMin || a.xMax - b.xMax);
}

/** Spans locales de montantes tal como los dibuja el canvas de elevación. Se captura `fillRect`
 * y se invierte la proyección con `screenToPlane` (la inversa declarada de `projectPlane`). */
function spansFromCanvas(wall) {
  const runX = isWallXRun(wall);
  const mode = { axis: runX ? 'y' : 'x' }; // el muro debe verse de frente, no de canto
  const view = { offsetX: 0, offsetY: 0, scale: 1 };
  const canvasH = 0;
  const rects = [];
  const ctx2d = {
    set fillStyle(_v) {}, get fillStyle() { return '#000'; },
    fillRect: (x, y, w, h) => rects.push({ x, y, w, h })
  };
  const studProfile = profiles.find(p => p.id === wall.framingStudProfileId);
  drawWallStudsElevation(ctx2d, wall, model.grid, mode, view, canvasH, studProfile, paramsMap, elementsById);

  const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
  const worldMin = runX ? Math.min(geo.p1.x, geo.p2.x) : Math.min(geo.p1.y, geo.p2.y);
  return rects.map(r => {
    const a = screenToPlane(r.x, r.y, view, canvasH, true).h;
    const b = screenToPlane(r.x + r.w, r.y, view, canvasH, true).h;
    return { xMin: Math.min(a, b) - worldMin, xMax: Math.max(a, b) - worldMin };
  }).sort((a, b) => a.xMin - b.xMin || a.xMax - b.xMax);
}

test('C4 — exportFramingDxf y render/wall producen el mismo span para cada pieza de los 45 muros', () => {
  let piezas = 0;
  for (const wall of walls) {
    const dxf = spansFromDxf(wall);
    const canvas = spansFromCanvas(wall);
    assert.equal(canvas.length, dxf.length, `conteo distinto en muro ${wall.id}`);
    assert.equal(dxf.length, wall.studs.length, `faltan montantes en muro ${wall.id}`);
    for (let i = 0; i < dxf.length; i++) {
      assert.ok(Math.abs(dxf[i].xMin - canvas[i].xMin) < 0.01 &&
                Math.abs(dxf[i].xMax - canvas[i].xMax) < 0.01,
        `muro ${wall.id} pieza ${i}: DXF ${JSON.stringify(dxf[i])} vs canvas ${JSON.stringify(canvas[i])}`);
      piezas++;
    }
  }
  assert.equal(piezas, 926, 'las 926 piezas de tabiquería de casa-L');
});

test('C4b — el DXF no emite ningún montante fuera del contorno del muro', () => {
  for (const wall of walls) {
    const L = wallLength(wall);
    for (const sp of spansFromDxf(wall)) {
      assert.ok(sp.xMin >= -0.01 && sp.xMax <= L + 0.01,
        `muro ${wall.id}: montante en [${sp.xMin}, ${sp.xMax}] con L=${L}`);
    }
  }
});
