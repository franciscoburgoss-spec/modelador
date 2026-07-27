// tests/supportLedgerDxfS5.test.mjs
// ★ B4.7.8-s5 (D-01) — La solera de apoyo llega al 2D, y muere el alias `elevation`.
//
// Lo que cubre:
//   C.1  los dos emisores publican topElevation/baseElevation y ninguno el alias `elevation`.
//   C.2  consumidores (.inp, metrado) sin cambio de cota ni de cantidades.
//   C.3  guardia de shape sobre `getRoofSystems` de las DOS rutas, incluida la persistida.
//   A.1  sección de solera en la elevación de cercha, en [0,B]×[−h,0] y [span−B,span]×[−h,0].
//   A.2  sin modo lateral / con perfil no resoluble: cero entidades, sin fallback inventado.
//   A.3  la cara superior de la solera coincide con la cara inferior de la cuerda inferior.
//   A.4  el extent absorbe la sección sin recortarla.
//   B.1  banda en la elevación de tabiquería, a la cota real y del largo del runRange.
//   B.2  un muro que no es apoyo no dibuja ninguna.
//   B.3  el despiece del muro queda byte a byte igual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getRoofSystems } from '../src/core/roofPlaneOutputs.js';
import { computeRoofSystemLayout, resolveTrussProfileDims, memberRectCorners, memberOffsetMode } from '../src/core/trussLayout.js';
import { trussElevationEntities, computeTrussViewExtent } from '../src/core/exportTrussDxf.js';
import { resolveWallEntries, resolveAxisGroups, axisGroupEntities, LAYERS } from '../src/core/exportFramingDxf.js';
import { generateCalculixTruss } from '../src/core/exportCalculixTruss.js';
import { generateFramingSheets, generateTrussSheets } from '../src/core/exportSheetsDxf.js';
import { computeTakeoff } from '../src/core/takeoff.js';
import { buildPrefix } from '../src/core/dxfTemplateAC1015.js';
import { buildSupportLedgerBoxes } from '../src/core/build3d.js';
import { buildParamsMap } from '../src/core/projectParams.js';
import { buildElementsById } from '../src/core/elementReferences.js';

const TOL = 0.01;
const here = dirname(fileURLToPath(import.meta.url));
const modelReal = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));
const casaL = JSON.parse(readFileSync(join(here, 'fixtures/casa-L.json'), 'utf8'));

const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfile: '35OMA085',
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 },
    { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};
const modelFaldon = { ...modelReal, roofSystems: [], roofPlanes: [planeEjeA] };

/** `computeRoofSystemLayout` con el contexto real del modelo (parámetros + referencias). */
function relayout(model, system, library = model.library) {
  return computeRoofSystemLayout(
    system, model.grid, buildParamsMap(model.projectParams), buildElementsById(model.elements),
    model.elements, library
  );
}

/** Vértices (x,y) de una POLYLINE DXF ya serializada. */
function verts(entity) {
  return [...entity.matchAll(/\n10\n(-?[\d.]+)\n20\n(-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] }));
}
function onLayer(entities, layer) {
  return entities.filter(e => e.includes(`\n8\n${layer}\n`));
}
function bbox(entity) {
  const v = verts(entity);
  return {
    xMin: Math.min(...v.map(p => p.x)), xMax: Math.max(...v.map(p => p.x)),
    yMin: Math.min(...v.map(p => p.y)), yMax: Math.max(...v.map(p => p.y))
  };
}

// =============================================================================================
// Parte C — el alias `elevation` deja de existir
// =============================================================================================

test('C.3 — ningún supportLedger de ninguna ruta expone `elevation`', () => {
  for (const [nombre, model] of [['faldón', modelFaldon], ['legacy persistido', casaL]]) {
    const leds = getRoofSystems(model).flatMap(s => s.supportLedgers || []);
    assert.ok(leds.length > 0, `${nombre}: premisa — hay soleras`);
    for (const led of leds) {
      assert.ok(!('elevation' in led), `${nombre}: el alias sobrevivió en ${led.side}`);
      assert.equal(typeof led.topElevation, 'number', `${nombre}: topElevation`);
      assert.equal(typeof led.baseElevation, 'number', `${nombre}: baseElevation`);
      const { h } = resolveTrussProfileDims(model.library, led.profile);
      assert.ok(Math.abs((led.topElevation - led.baseElevation) - h) < TOL,
        `${nombre}: top−base debe ser el h real del perfil (${h})`);
    }
  }
});

test('C.1 — el legacy emite el shape completo, con el h real de la librería', () => {
  const system = (casaL.roofSystems || [])[1];
  assert.ok(system, 'premisa: el fixture trae sistemas legacy');
  const layout = relayout(casaL, system);
  assert.ok(layout.resolved, `premisa: el sistema se re-resuelve (${layout.warnings})`);
  assert.equal(layout.supportLedgers.length, 2);
  const { h } = resolveTrussProfileDims(casaL.library, '90CA085');
  for (const led of layout.supportLedgers) {
    assert.equal(led.elevation, undefined, 'el alias ya no se emite');
    assert.equal(led.topElevation, layout.supportElevation, 'cara superior = cota de apoyo');
    assert.equal(led.topElevation - led.baseElevation, h);
  }
});

test('C.1 — sin librería el legacy no inventa un alto de perfil', () => {
  const system = (casaL.roofSystems || [])[1];
  const layout = relayout(casaL, system, null);
  for (const led of layout.supportLedgers) {
    assert.equal(led.topElevation, led.baseElevation, 'perfil no resoluble → sin alto, no un fallback de 40');
  }
});

test('C.2 — el .inp imprime la misma cota en ** APOYO LATERAL', () => {
  const inp = generateCalculixTruss(casaL);
  const texto = typeof inp === 'string' ? inp : (inp?.content ?? String(inp));
  const lineas = texto.split('\n').filter(l => l.includes('APOYO LATERAL'));
  assert.ok(lineas.length > 0, 'premisa: hay soleras registradas en el .inp');
  for (const l of lineas) assert.ok(l.includes('@z=3350mm'), `cota inesperada: ${l}`);
});

test('C.2 — el metrado de casa-L no se mueve ni un mm', () => {
  const roof = computeTakeoff(casaL).rows.filter(g => g.type === 'roof');
  const g = roof.find(r => r.section === '90CA085');
  assert.equal(g.count, 30);                                  // 26 barras de cercha + 4 soleras
  assert.ok(Math.abs(g.ml - 54.07846831134833) < 1e-9);
});

// =============================================================================================
// Parte A — la solera en la elevación de la cercha tipo
// =============================================================================================

test('A.1 — dos secciones de solera por sistema, en [0,B]×[−h,0] y [span−B,span]×[−h,0]', () => {
  const systems = getRoofSystems(modelFaldon);
  assert.ok(systems.length > 0);
  for (const [i, s] of systems.entries()) {
    const ents = onLayer(trussElevationEntities(s, 0, i, modelFaldon.library, modelFaldon), 'SOLERAS-APOYO');
    assert.equal(ents.length, 2, `sistema ${s.id}: una sección por apoyo`);
    const span = s.trussGeometry.span;
    const low = s.supportLedgers.find(l => l.side === 'low');
    const { h, b } = resolveTrussProfileDims(modelFaldon.library, low.profile);
    // el perfil sale de la librería, no del fallback de resolveTrussProfileDims
    const entry = modelFaldon.library.metalconProfiles.find(p => p.code === low.profile);
    assert.ok(entry && entry.H === h && entry.B === b, 'B y h del perfil real');

    const [bajo, alto] = ents.map(bbox).sort((p, q) => p.xMin - q.xMin);
    assert.ok(Math.abs(bajo.xMin - 0) < TOL && Math.abs(bajo.xMax - b) < TOL, 'apoyo bajo en [0,B]');
    assert.ok(Math.abs(alto.xMin - (span - b)) < TOL && Math.abs(alto.xMax - span) < TOL, 'apoyo alto en [span−B,span]');
    for (const r of [bajo, alto]) {
      assert.ok(Math.abs(r.yMin + h) < TOL, 'cara inferior en −h');
      assert.ok(Math.abs(r.yMax) < TOL, 'cara superior en y_local 0');
    }
  }
});

test('A.3 — la solera no solapa la cuerda inferior: comparten exactamente la cara', () => {
  const systems = getRoofSystems(modelFaldon);
  for (const [i, s] of systems.entries()) {
    const ci = s.trussGeometry.members.find(m => m.role === 'bottomChord');
    const { h: hCi } = resolveTrussProfileDims(modelFaldon.library, ci.profile, 90);
    const caraInferiorCuerda = Math.min(
      ...memberRectCorners(ci.x1, ci.y1, ci.x2, ci.y2, hCi, memberOffsetMode(ci.role)).map(c => c.y)
    );
    const secciones = onLayer(trussElevationEntities(s, 0, i, modelFaldon.library, modelFaldon), 'SOLERAS-APOYO');
    assert.equal(secciones.length, 2, 'premisa: las dos secciones existen');
    for (const e of secciones) {
      assert.ok(Math.abs(bbox(e).yMax - caraInferiorCuerda) < TOL,
        'la cara superior de la solera es la cara inferior de la cuerda — sin solape ni hueco');
    }
  }
});

test('A.2 — sin supportLedgers (modo coronación) no se dibuja ninguna sección', () => {
  const s = getRoofSystems(modelFaldon)[0];
  const sinLateral = { ...s, supportLedgers: [] };
  assert.deepEqual(onLayer(trussElevationEntities(sinLateral, 0, 0, modelFaldon.library, modelFaldon), 'SOLERAS-APOYO'), []);
});

test('A.2 — perfil no resoluble: cero entidades, sin excepción y sin fallback', () => {
  const s = getRoofSystems(modelFaldon)[0];
  const conPerfilFantasma = { ...s, supportLedgers: s.supportLedgers.map(l => ({ ...l, profile: '999XX999' })) };
  let ents;
  assert.doesNotThrow(() => {
    ents = trussElevationEntities(conPerfilFantasma, 0, 0, modelFaldon.library, modelFaldon);
  });
  assert.deepEqual(onLayer(ents, 'SOLERAS-APOYO'), []);
});

test('A.4 — el extent encuadra la sección sin recortarla', () => {
  // NOTA (desvío de la spec): el criterio original pedía que `yMin` bajara exactamente `h`. No
  // ocurre ni puede ocurrir: la tabla de despiece ya cuelga a −3760/−4100 mm, muy por debajo de
  // los −90 de la solera. Lo que sí debe cumplirse es que el extent la contenga.
  const systems = getRoofSystems(modelFaldon);
  for (const [i, s] of systems.entries()) {
    const ext = computeTrussViewExtent(s, i, modelFaldon.library, modelFaldon);
    const secciones = onLayer(trussElevationEntities(s, 0, i, modelFaldon.library, modelFaldon), 'SOLERAS-APOYO');
    assert.ok(secciones.length > 0);
    for (const e of secciones) {
      const r = bbox(e);
      assert.ok(r.yMin >= ext.yMin && r.yMax <= ext.yMax, 'la sección cae dentro del extent');
      assert.ok(r.xMin >= ext.xMin && r.xMax <= ext.xMax);
    }
  }
});

test('A.2 — la capa SOLERAS-APOYO existe, es propia y pesa como estructura', () => {
  assert.ok(LAYERS['SOLERAS-APOYO'], 'capa declarada');
  assert.notEqual(LAYERS['SOLERAS-APOYO'], LAYERS.SOLERAS, 'no es la misma entrada que SOLERAS');
  assert.equal(LAYERS['SOLERAS-APOYO'].lineweight, LAYERS.SOLERAS.lineweight);
  assert.equal(LAYERS['SOLERAS-APOYO'].ltype, 'CONTINUOUS');
});

test('A.2 — la plantilla AC1015 declara SOLERAS-APOYO (la jerarquía de lineweight vive sólo ahí)', () => {
  // Sin este registro la lámina auto-crea la capa con color/peso por defecto y se pierde la
  // jerarquía visual que el R12 plano no puede expresar.
  const prefix = buildPrefix();
  const reg = prefix.split('  0\nLAYER\n').find(b => b.includes('\n  2\nSOLERAS-APOYO\n'));
  assert.ok(reg, 'la capa está en la tabla LAYER de la plantilla');
  assert.match(reg, /\n 62\n5\n/, 'color 5, igual que SOLERAS');
  assert.match(reg, /\n370\n35\n/, 'lineweight 35 = estructura');
  assert.match(reg, /\n  6\nCONTINUOUS\n/);
});

// =============================================================================================
// Parte B — la solera en la elevación de tabiquería
// =============================================================================================

/** Bandas SOLERAS-APOYO de la elevación por eje completa de un modelo. */
function bandasDeEje(model) {
  return resolveAxisGroups(model)
    .flatMap(g => onLayer(axisGroupEntities(g, model.grid, 0), 'SOLERAS-APOYO'))
    .map(bbox);
}

test('B.1 — el muro de apoyo bajo dibuja la banda a la cota real y del largo del runRange', () => {
  const entry = resolveWallEntries(modelFaldon).find(e => e.wall.id === planeEjeA.canalWallId);
  assert.ok(entry.ledgers.length > 0, 'el muro de la canaleta recibe las soleras de sus tramos');
  const L = entry.layout;
  for (const led of entry.ledgers) {
    // la banda NO cubre el muro entero: arranca donde arranca el tramo
    const largoBanda = Math.abs((led.runAxis === 'x' ? led.p2.x - led.p1.x : led.p2.y - led.p1.y));
    assert.ok(largoBanda < L.length, 'el runRange del tramo es más corto que el muro');
    assert.ok(led.baseElevation - L.wallBottomElevation >= 0, 'la banda cae dentro de la altura del muro');
    assert.ok(led.topElevation - L.wallBottomElevation <= L.wallHeight);
  }
  // cota local esperada: [3260, 3350] world sobre un muro que arranca en 450
  const bandas = bandasDeEje(modelFaldon).filter(b => Math.abs(b.yMax - b.yMin - 90) < TOL);
  assert.ok(bandas.some(b => Math.abs(b.yMin - 2810) < TOL && Math.abs(b.yMax - 2900) < TOL));
});

test('B.2 — un muro que no es apoyo de ninguna techumbre no dibuja ninguna banda', () => {
  const conApoyo = new Set(getRoofSystems(modelFaldon).flatMap(s => (s.supportLedgers || []).map(l => l.wallId)));
  const sinApoyo = resolveWallEntries(modelFaldon).filter(e => !conApoyo.has(e.wall.id));
  assert.ok(sinApoyo.length > 0, 'premisa: hay muros sin techumbre encima');
  for (const e of sinApoyo) assert.deepEqual(e.ledgers, []);
});

test('B.3 — casa-L: los dos sistemas comparten el muro de apoyo bajo, y el clamp no saca nada del muro', () => {
  const entry = resolveWallEntries(casaL).find(e => e.wall.id === 1784600403613);
  assert.equal(entry.ledgers.length, 2, 'los dos sistemas legacy apoyan en el mismo muro');
  const L = entry.layout;
  const bandas = bandasDeEje(casaL);
  const propias = bandas.filter(b => Math.abs(b.yMax - b.yMin - 90) < TOL);
  assert.ok(propias.length >= 2);
  for (const b of propias) {
    assert.ok(b.xMin >= -TOL, 'clamp: nada a la izquierda del muro');
    assert.ok(b.xMax - b.xMin > 0, 'largo positivo');
  }
  // el sistema que va de x=12800 a 14500 se recorta al fin del muro (worldMax = 14500 → local 11500)
  const larga = propias.find(b => Math.abs(b.xMax - L.length) < TOL);
  assert.ok(larga, 'la banda del tramo del extremo llega exactamente al fin del muro, no más allá');
});

test('B.3 — la banda se recorta a los límites del muro aunque el runRange lo desborde', () => {
  const entry = resolveWallEntries(casaL).find(e => e.wall.id === 1784600403613);
  const desbordado = {
    ...entry.ledgers[0],
    p1: { ...entry.ledgers[0].p1, x: entry.layout.worldMin - 5000 },
    p2: { ...entry.ledgers[0].p2, x: entry.layout.worldMax + 5000 }
  };
  const grupo = resolveAxisGroups(casaL).find(g => g.members.some(m => m.wall.id === 1784600403613));
  const miembro = grupo.members.find(m => m.wall.id === 1784600403613);
  miembro.ledgers = [desbordado];
  const b = onLayer(axisGroupEntities(grupo, casaL.grid, 0), 'SOLERAS-APOYO').map(bbox)
    .find(r => Math.abs(r.xMax - r.xMin - entry.layout.length) < TOL);
  assert.ok(b, 'el desborde se recorta al largo del muro, ni un mm más');
});

test('B.3 — el despiece del muro queda byte a byte igual', () => {
  // Mismo modelo sin techumbre: todo lo que no sea SOLERAS-APOYO debe ser idéntico, entidad a
  // entidad y en el mismo orden — montantes, soleras, dinteles, etiquetas y cota parcial.
  const sinTechumbre = { ...casaL, roofSystems: [], roofPlanes: [] };
  for (const [g1, g2] of resolveAxisGroups(casaL).map((g, i) => [g, resolveAxisGroups(sinTechumbre)[i]])) {
    assert.equal(g1.key, g2.key);
    assert.deepEqual(JSON.stringify(g1.extent), JSON.stringify(g2.extent), 'el extent del eje no cambia');
    const con = axisGroupEntities(g1, casaL.grid, 0).filter(e => !e.includes('\n8\nSOLERAS-APOYO\n'));
    const sin = axisGroupEntities(g2, sinTechumbre.grid, 0);
    assert.deepEqual(con, sin, `eje ${g1.key}: el despiece cambió`);
  }
});

// =============================================================================================
// Auditoría post-implementación — huecos que no cubría la spec
// =============================================================================================

test('AUDIT — la leyenda de la lámina real declara SOLERAS-APOYO, y ninguna fila se cae', () => {
  // Sin esto el revisor ve una banda nueva sin entrada en el cuadro de simbología. Se comprueba
  // sobre la lámina GENERADA, no sobre la tabla: `legendEntities` recorta por `maxRows`, así que
  // añadir una fila puede empujar otra fuera de la caja.
  for (const [tipo, sheets] of [['tabiquería', generateFramingSheets(modelFaldon)], ['cerchas', generateTrussSheets(modelFaldon)]]) {
    const texto = sheets.map(sh => sh.content ?? sh).join('\n');
    assert.ok(texto.includes('SOLERAS-APOYO ='), `la leyenda de ${tipo} no lista la capa`);
    assert.ok(texto.includes('EJES ='), `${tipo}: se cayó una fila preexistente de la leyenda`);
    assert.ok(texto.includes('NIVELES ='), `${tipo}: se cayó una fila preexistente de la leyenda`);
  }
});

test('AUDIT — perfil de solera no resoluble: la ruta legacy avisa en vez de perder la pieza', () => {
  const system = { ...(casaL.roofSystems || [])[1], supportProfile: 'NO-EXISTE', profiles: {} };
  const layout = relayout(casaL, system);
  assert.ok(layout.warnings.some(w => w.includes('solera de apoyo') && w.includes('no resoluble')),
    'debe advertir: con h = 0 la solera desaparece del 3D y de los dos DXF');
});

test('AUDIT — h no resuelto ⇒ la solera se omite igual en los TRES consumidores', () => {
  // El criterio "no inventar geometría" tiene que ser el mismo en 3D, cercha y tabiquería:
  // que una salida la dibuje y otra no sería peor que no dibujarla en ninguna.
  const m = JSON.parse(JSON.stringify(casaL));
  for (const s of m.roofSystems) s.supportLedgers = (s.supportLedgers || []).map(l => ({ ...l, profile: 'NO-EXISTE' }));
  assert.deepEqual(buildSupportLedgerBoxes(m), [], '3D');
  const bandas = resolveAxisGroups(m).flatMap(g => onLayer(axisGroupEntities(g, m.grid, 0), 'SOLERAS-APOYO'));
  assert.deepEqual(bandas, [], 'elevación de tabiquería');
  for (const [i, s] of getRoofSystems(m).entries()) {
    assert.deepEqual(onLayer(trussElevationEntities(s, 0, i, m.library, m), 'SOLERAS-APOYO'), [], 'elevación de cercha');
  }
});

test('AUDIT — un modelo sin techumbre exporta las MISMAS entidades que antes de s5', () => {
  // La capa nueva se declara siempre (tabla LAYER), pero no debe aparecer ni una entidad.
  const sinTechumbre = { ...casaL, roofSystems: [], roofPlanes: [] };
  const ents = resolveAxisGroups(sinTechumbre).flatMap(g => axisGroupEntities(g, sinTechumbre.grid, 0));
  assert.deepEqual(onLayer(ents, 'SOLERAS-APOYO'), []);
});

test('AUDIT — getRoofSystems no muta el modelo y memoiza por identidad', () => {
  const antes = JSON.stringify(casaL.roofSystems);
  const a = getRoofSystems(casaL), b = getRoofSystems(casaL);
  assert.equal(a, b, 'misma referencia: los consumidores del mismo render no re-normalizan');
  assert.equal(JSON.stringify(casaL.roofSystems), antes, 'el modelo persistido queda intacto');
});
