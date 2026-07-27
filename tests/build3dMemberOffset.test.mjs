// tests/build3dMemberOffset.test.mjs
// ★ B4.7.8-s4 (C-01) — El 3D centraba las barras en su eje; el 2D las apoya en una CARA.
//
// Lo que cubre:
//   A.1  cuerda inferior: cara inferior EXACTAMENTE en supportElevation (no 45 mm más abajo).
//   A.2  no solapa con la caja de la solera de apoyo (A-01, sesión 3).
//   A.3  cuerda superior: cara superior sobre la línea del plano de techo (offset perpendicular).
//   A.4  costanera: apoya sobre la cara superior de la cuerda y no queda embebida en ella.
//   A.5  entramado (post/diagonal) sin cambio: sigue centrado en su eje.
//   A.6  equivalencia 2D/3D: el eje de la caja == centro del rectángulo de memberRectCorners.
//   A.7  la corrección llega a las dos rutas (faldón y roofSystems legacy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildRoofTrussMembers, buildSupportLedgerBoxes, buildRoofPurlinBoxes } from '../src/core/build3d.js';
import { getRoofSystems } from '../src/core/roofPlaneOutputs.js';
import { memberRectCorners, memberOffsetMode, resolveTrussProfileDims } from '../src/core/trussLayout.js';
import { edgeChordMembers } from '../src/core/roofObstructions.js';

const TOL = 0.01;
const here = dirname(fileURLToPath(import.meta.url));
const modelReal = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));
const casaL = JSON.parse(readFileSync(join(here, 'fixtures/casa-L.json'), 'utf8'));

const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800,
  purlinProfile: '35OMA085',
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 },
    { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};
const modelFaldon = { ...modelReal, roofSystems: [], roofPlanes: [planeEjeA] };

/** coordenada perpendicular (world) del x_local = 0 de un sistema. */
function perp0Of(system) {
  const w = system.trussPositions[0].world;
  return system.runAxis === 'x' ? w.y : w.x;
}
/** perp world -> x_local de la cercha. */
function toLocalX(system, perpWorld) {
  return (perpWorld - perp0Of(system)) * (system.spanDir ?? 1);
}
/** perp world de una caja/punto three, según el runAxis del sistema. */
function perpOf(system, p) { return system.runAxis === 'x' ? p.z : p.x; }

/** Un miembro tal como lo devuelve build3d, en coordenadas locales de la cercha. */
function axisLocal(system, m3d) {
  return {
    x1: toLocalX(system, perpOf(system, m3d.p1)), y1: m3d.p1.y - system.supportElevation,
    x2: toLocalX(system, perpOf(system, m3d.p2)), y2: m3d.p2.y - system.supportElevation
  };
}

// ---------------------------------------------------------------------------------------------
// A.1 / A.2 — cuerda inferior y solera
// ---------------------------------------------------------------------------------------------
test('A.1 — cuerda inferior: la caja va de supportElevation hacia ARRIBA (3350…3440), no hundida', () => {
  const bc = buildRoofTrussMembers(modelFaldon).filter(m => m.role === 'bottomChord');
  assert.ok(bc.length > 0, 'debe haber cuerdas inferiores');
  for (const m of bc) {
    assert.equal(m.h, 90);
    assert.ok(Math.abs((m.p1.y - m.h / 2) - 3350) < TOL, `cara inferior ${m.p1.y - m.h / 2} != 3350`);
    assert.ok(Math.abs((m.p1.y + m.h / 2) - 3440) < TOL, `cara superior ${m.p1.y + m.h / 2} != 3440`);
    assert.ok(Math.abs(m.p1.y - m.p2.y) < TOL, 'la cuerda inferior es horizontal');
  }
});

test('A.2 — la cuerda inferior no invade la solera de apoyo (3260…3350)', () => {
  const bc = buildRoofTrussMembers(modelFaldon).filter(m => m.role === 'bottomChord');
  const ledgers = buildSupportLedgerBoxes(modelFaldon);
  assert.ok(ledgers.length > 0, 'debe haber soleras');
  for (const led of ledgers) {
    const ledTop = led.center.y + led.size.y / 2;
    for (const m of bc) {
      const chordBase = m.p1.y - m.h / 2;
      assert.ok(chordBase >= ledTop - TOL, `cuerda base ${chordBase} < tope de solera ${ledTop}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// A.3 — cuerda superior: la línea del plano de techo es su CARA superior
// ---------------------------------------------------------------------------------------------
test('A.3 — cuerda superior: el eje baja h/2 PERPENDICULAR a la barra; la cara superior queda sobre la línea del plano de techo', () => {
  const systems = getRoofSystems(modelFaldon);
  const mem = buildRoofTrussMembers(modelFaldon);
  let checked = 0;
  for (const sys of systems) {
    const line = (sys.trussGeometry?.members || []).find(m => m.role === 'topChord');
    if (!line) continue;
    const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const dims = resolveTrussProfileDims(modelReal.library, line.profile);
    for (const m3d of mem.filter(m => m.systemId === sys.id && m.role === 'topChord')) {
      const a = axisLocal(sys, m3d);
      // el eje es la línea desplazada −n·h/2 (modo 'minus'): la cara +n vuelve justo a la línea
      assert.ok(Math.abs((a.x1 + nx * dims.h / 2) - line.x1) < TOL, 'cara superior fuera de la línea (x)');
      assert.ok(Math.abs((a.y1 + ny * dims.h / 2) - line.y1) < TOL, 'cara superior fuera de la línea (y)');
      assert.ok(a.y1 < line.y1 - TOL, 'el perfil debe colgar BAJO la línea, no sobre ella');
      checked++;
    }
  }
  assert.ok(checked > 0, 'no se verificó ninguna cuerda superior');
});

test('A.3b — en x_local=200 la caja de la cuerda superior tiene su cara alta en 3677.91 (spec: ~3587.9…3677.9)', () => {
  const sys = getRoofSystems(modelFaldon)[0];
  const line = sys.trussGeometry.members.find(m => m.role === 'topChord');
  assert.ok(Math.abs(line.x1 - 200) < TOL, 'la cuerda superior arranca en el ancho del rebaje');
  const lineY = sys.supportElevation + line.y1;
  assert.ok(Math.abs(lineY - 3677.91) < 0.1, `línea del plano de techo ${lineY}`);
  // caja real del 3D, evaluada en x_local = 200
  const m3d = buildRoofTrussMembers(modelFaldon).find(m => m.systemId === sys.id && m.role === 'topChord');
  const a = axisLocal(sys, m3d);
  const slope = (a.y2 - a.y1) / (a.x2 - a.x1);
  const halfV = (m3d.h / 2) / Math.cos(Math.atan(slope));  // media altura VERTICAL del perfil inclinado
  const axisY = sys.supportElevation + a.y1 + (200 - a.x1) * slope;
  assert.ok(Math.abs((axisY + halfV) - lineY) < TOL, `cara superior ${axisY + halfV} != línea ${lineY}`);
  assert.ok(Math.abs((axisY - halfV) - 3587.5) < 1, `cara inferior ${axisY - halfV}`);
});

// ---------------------------------------------------------------------------------------------
// A.4 — costanera apoyada, no embebida
// ---------------------------------------------------------------------------------------------
test('A.4 — la costanera apoya sobre la cara superior de la cuerda y NO queda contenida en ella', () => {
  const purlins = buildRoofPurlinBoxes(modelFaldon);
  assert.ok(purlins.length > 0, 'debe haber costaneras');
  const systems = getRoofSystems(modelFaldon);
  const mem = buildRoofTrussMembers(modelFaldon);
  let checked = 0;
  for (const box of purlins) {
    const base = box.center.y - box.size.y / 2;
    const top = box.center.y + box.size.y / 2;
    for (const sys of systems) {
      const m3d = mem.find(m => m.systemId === sys.id && m.role === 'topChord');
      if (!m3d) continue;
      const a = axisLocal(sys, m3d);
      const slope = (a.y2 - a.y1) / (a.x2 - a.x1);
      const halfV = (m3d.h / 2) / Math.cos(Math.atan(slope));
      const xl = toLocalX(sys, perpOf(sys, box.center));
      const axisY = sys.supportElevation + a.y1 + (xl - a.x1) * slope;
      // apoyada SOBRE la cara superior de la caja de la cuerda, nunca embebida dentro
      assert.ok(base >= axisY + halfV - TOL, `costanera base ${base} dentro de la cuerda (tope ${axisY + halfV})`);
      assert.ok(!(base > axisY - halfV && top < axisY + halfV), 'costanera contenida en la cuerda');
      checked++;
    }
  }
  assert.ok(checked > 0, 'no se verificó ninguna costanera');
});

// ---------------------------------------------------------------------------------------------
// A.5 / A.6 — entramado intacto y equivalencia con el 2D
// ---------------------------------------------------------------------------------------------
function assertMatches2D(model, systems) {
  const mem = buildRoofTrussMembers(model);
  let i = 0, checked = 0;
  // mismo recorrido que buildRoofTrussMembers: sistemas × posiciones × miembros
  for (const sys of systems) {
    const geo = sys.trussGeometry;
    if (!geo?.resolved || !sys.trussPositions?.length) continue;
    for (const tp of sys.trussPositions) {
      const lines = tp.kind === 'edgeChord' ? edgeChordMembers(geo) : geo.members;
      for (const line of lines) {
        const m3d = mem[i++];
        assert.equal(m3d.role, line.role, 'desincronizado con buildRoofTrussMembers');
        const dims = resolveTrussProfileDims(model.library, line.profile);
        const c = memberRectCorners(line.x1, line.y1, line.x2, line.y2, dims.h, memberOffsetMode(line.role));
        // eje = punto medio del lado del rectángulo en el extremo p1
        const ex = (c[0].x + c[3].x) / 2, ey = (c[0].y + c[3].y) / 2;
        const a = axisLocal(sys, m3d);
        assert.ok(Math.abs(a.x1 - ex) < TOL, `${line.role}: eje x 3D ${a.x1} != 2D ${ex}`);
        assert.ok(Math.abs(a.y1 - ey) < TOL, `${line.role}: eje y 3D ${a.y1} != 2D ${ey}`);
        checked++;
      }
    }
  }
  assert.equal(i, mem.length, 'quedaron miembros 3D sin comparar');
  assert.ok(checked > 0, 'no se comparó ningún miembro');
}

test('A.5 — post y diagonal siguen centrados en su eje (modo center, sin desplazamiento)', () => {
  const systems = getRoofSystems(modelFaldon);
  const mem = buildRoofTrussMembers(modelFaldon);
  let checked = 0;
  for (const sys of systems) {
    for (const m3d of mem.filter(m => m.systemId === sys.id && (m.role === 'post' || m.role === 'diagonal'))) {
      const a = axisLocal(sys, m3d);
      const line = sys.trussGeometry.members.find(
        m => m.role === m3d.role && Math.abs(m.x1 - a.x1) < TOL && Math.abs(m.y1 - a.y1) < TOL);
      assert.ok(line, `${m3d.role} desplazado: no coincide con ninguna línea del 2D`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no se verificó entramado');
});

test('A.6 — faldón: cada eje 3D coincide con el centro del rectángulo que dibuja el 2D', () => {
  assertMatches2D(modelFaldon, getRoofSystems(modelFaldon));
});

// ---------------------------------------------------------------------------------------------
// A.7 — ruta legacy (roofSystems)
// ---------------------------------------------------------------------------------------------
test('A.7 — legacy casa-L: cuerda inferior apoyada en supportElevation y equivalencia 2D/3D', () => {
  const systems = getRoofSystems(casaL);
  assert.ok(systems.length > 0 && !(casaL.roofPlanes || []).length, 'casa-L debe ser ruta legacy');
  const mem = buildRoofTrussMembers(casaL);
  const bc = mem.filter(m => m.role === 'bottomChord');
  assert.ok(bc.length > 0);
  for (const m of bc) {
    const sys = systems.find(s => s.id === m.systemId);
    assert.ok(Math.abs((m.p1.y - m.h / 2) - sys.supportElevation) < TOL,
      `cara inferior ${m.p1.y - m.h / 2} != supportElevation ${sys.supportElevation}`);
  }
  assertMatches2D(casaL, systems);
});

// ---------------------------------------------------------------------------------------------
// Parte B — la solera va CONTRA la cara interior, del lado del recinto (confirmado en obra)
// ---------------------------------------------------------------------------------------------
test('B.1 — la solera baja ocupa [perpInner, perpInner + spanDir·B]: no cruza hacia dentro del muro', () => {
  const systems = getRoofSystems(modelFaldon);
  const boxes = buildSupportLedgerBoxes(modelFaldon);
  const low = boxes.filter(b => b.side === 'low');
  assert.ok(low.length > 0, 'debe haber soleras bajas');
  for (const b of low) {
    const sys = systems.find(s => s.id === b.systemId);
    const led = sys.supportLedgers.find(l => l.side === 'low');
    const face = sys.runAxis === 'x' ? led.p1.y : led.p1.x;
    const c = perpOf(sys, b.center);
    const bWidth = sys.runAxis === 'x' ? b.size.z : b.size.x;
    const near = c - (sys.spanDir ?? 1) * bWidth / 2;   // borde del lado del muro
    const far = c + (sys.spanDir ?? 1) * bWidth / 2;    // borde del lado del recinto
    assert.ok(Math.abs(near - face) < TOL, `la solera no arranca en la cara interior (${near} vs ${face})`);
    assert.ok(Math.abs(far - (face + (sys.spanDir ?? 1) * bWidth)) < TOL, 'ancho mal orientado');
  }
});

test('B.2 — la solera alta queda del lado del recinto respecto de perpHighInner', () => {
  const systems = getRoofSystems(modelFaldon);
  const boxes = buildSupportLedgerBoxes(modelFaldon);
  const high = boxes.filter(b => b.side === 'high');
  assert.ok(high.length > 0, 'debe haber soleras altas');
  for (const b of high) {
    const sys = systems.find(s => s.id === b.systemId);
    const led = sys.supportLedgers.find(l => l.side === 'high');
    const face = sys.runAxis === 'x' ? led.p1.y : led.p1.x;
    const c = perpOf(sys, b.center);
    const bWidth = sys.runAxis === 'x' ? b.size.z : b.size.x;
    const sd = sys.spanDir ?? 1;
    assert.ok(Math.abs((c + sd * bWidth / 2) - face) < TOL, 'la solera alta no toca la cara interior');
    assert.ok(sd * (c - face) < 0, 'la solera alta debe quedar del lado del recinto (hacia −spanDir)');
  }
});

test('B.3 — la cota vertical de la solera no cambia (sigue colgando de supportElevation)', () => {
  for (const b of buildSupportLedgerBoxes(modelFaldon)) {
    assert.ok(Math.abs((b.center.y + b.size.y / 2) - 3350) < TOL, 'cara superior != supportElevation');
    assert.ok(Math.abs((b.center.y - b.size.y / 2) - 3260) < TOL, 'base != supportElevation − hSolera');
  }
});
