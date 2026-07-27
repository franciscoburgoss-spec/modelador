import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFramingDxf, wallFramingEntities, sanitizeDxfText } from '../src/core/exportFramingDxf.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { METALCON_PROFILES } from '../src/core/metalconCatalog.js';
import { getWallDisplayName } from '../src/core/naming.js';

function baseGrid() {
  return {
    xAxes: [{ id: 'x0', position: 0, label: 'X1' }, { id: 'xm', position: 2000, label: 'X2' }, { id: 'x1', position: 4000, label: 'X3' }],
    yAxes: [{ id: 'y0', position: 0, label: 'A' }, { id: 'y1', position: 6000, label: 'B' }],
    zLevels: [
      { id: 'z0', elevation: 0, label: 'NPT (0 mm)' },
      { id: 'zmid', elevation: 1200, label: 'NPT (1200 mm)' },
      { id: 'z1', elevation: 2400, label: 'NPT (2400 mm)' }
    ]
  };
}

function loadedMetalconProfiles() {
  return METALCON_PROFILES.map((p, i) => ({ ...p, id: 9000 + i }));
}

function makeWall(profiles, overrides = {}) {
  const stud = profiles.find(p => p.code === '90CA085');
  const track = profiles.find(p => p.code === '92C085');
  return {
    id: 'w1', type: 'wall', direction: 'x',
    xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0',
    bottomZ: 'z0', topZ: 'z1', thickness: 90,
    openings: [], studs: [],
    framingStudProfileId: stud?.id, framingTrackProfileId: track?.id,
    ...overrides
  };
}

test('exportFramingDxf: muro sin studs generados → devuelve null (nada que exportar)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const wall = makeWall(profiles, { studs: [] });
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };
  assert.equal(generateFramingDxf(model), null);
});

test('exportFramingDxf: muro con studs+headers generados exporta MONTANTES, SOLERAS, DINTELES y ANTEPECHOS', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90,
      openings: [{ id: 'op1', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 1200, sillHeight: 900 }] },
    grid, {}, {}, { spacing: 400 }
  );
  const wall = makeWall(profiles, { studs: layout.studs, headers: layout.headers });
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };

  const dxf = generateFramingDxf(model);
  assert.ok(dxf);
  assert.match(dxf, /MONTANTES/);
  assert.match(dxf, /SOLERAS/);
  assert.match(dxf, /DINTELES/);
  assert.match(dxf, /ANTEPECHOS/);
  assert.match(dxf, /ETIQUETAS/);
  assert.match(dxf, /EJES/);
  assert.match(dxf, /COTAS/);
  assert.match(dxf, /NIVELES/);
  // tabla de capas y tipos de línea
  assert.match(dxf, /SECTION\n2\nTABLES/);
  assert.match(dxf, /LTYPE\n2\nCENTER/);
  assert.match(dxf, /LAYER\n2\nEJES/);
  // burbuja de eje: círculo en la capa EJES
  assert.match(dxf, /CIRCLE/);
  // el eje intermedio X2 (dentro del tramo del muro) debe aparecer como texto de eje
  assert.match(dxf, /X2/);
  // los 3 niveles del proyecto (0, 1200 intermedio, 2400) deben aparecer
  assert.match(dxf, /NPT \(0 mm\)/);
  assert.match(dxf, /NPT \(1200 mm\)/);
  assert.match(dxf, /NPT \(2400 mm\)/);
  // etiquetas de pieza: king(K), jack(J), cripple(C) deben estar, y el relleno agrupado en un solo texto
  assert.match(dxf, /\nK\n/);
  assert.match(dxf, /\nJ\n/);
  assert.match(dxf, /\nC\n/);
  assert.match(dxf, /MONTANTE RELLENO/);
  const rellenoMatches = (dxf.match(/MONTANTE RELLENO/g) || []).length;
  assert.equal(rellenoMatches, 1); // agrupado en un solo texto, no uno por montante
  // el texto no debe contener la flecha unicode ni tildes sin sanear (se pierden en algunos lectores CAD)
  assert.doesNotMatch(dxf, /→/);
  assert.doesNotMatch(dxf, /[áéíóúñÁÉÍÓÚÑ]/);
  // un POLYLINE por cada stud + 2 soleras + 1 dintel + 1 antepecho
  const polylineCount = (dxf.match(/POLYLINE/g) || []).length;
  assert.equal(polylineCount, layout.studs.length + 2 + layout.headers.length);
});

test('exportFramingDxf: R1 — dintel y alfeizar se rotulan (D, A) sin perder las etiquetas de stud existentes', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90,
      openings: [{ id: 'op1', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 1200, sillHeight: 900 }] },
    grid, {}, {}, { spacing: 400 }
  );
  const wall = makeWall(profiles, { studs: layout.studs, headers: layout.headers });
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };

  const dxf = generateFramingDxf(model);
  assert.ok(dxf);
  // antes de R1: cero rótulos para dintel/alfeizar (headers no llegaba a pieceLabelEntities)
  assert.match(dxf, /\nD\n/);
  assert.match(dxf, /\nA\n/);
  // las siete etiquetas existentes de stud no se tocan (mismo criterio de aceptación #2 del spec)
  assert.match(dxf, /\nK\n/);
  assert.match(dxf, /\nJ\n/);
  assert.match(dxf, /\nC\n/);
});

test('exportFramingDxf: R1 — muro sin vanos no rotula D/A (headers vacío)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90, openings: [] },
    grid, {}, {}, { spacing: 400 }
  );
  const wall = makeWall(profiles, { studs: layout.studs, headers: layout.headers || [] });
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };

  const dxf = generateFramingDxf(model);
  assert.ok(dxf);
  assert.doesNotMatch(dxf, /\nD\n/);
  assert.doesNotMatch(dxf, /\nA\n/);
});

test('exportFramingDxf: cotas horizontales usan las jambas (king) y cotas verticales usan antepecho/dintel', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90,
      openings: [{ id: 'op1', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 1200, sillHeight: 900 }] },
    grid, {}, {}, { spacing: 400 }
  );
  const wall = makeWall(profiles, { studs: layout.studs, headers: layout.headers });
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };
  const dxf = generateFramingDxf(model);

  // cota horizontal: 0 → king(1400) → king(2600) → 4000 → tramos 1400, 1200, 1400
  assert.match(dxf, /\n1400\n/);
  assert.match(dxf, /\n1200\n/);
  // cota vertical: 0 → antepecho(900) → dintel(2100) → 2400 → tramos 900, 1200, 300
  assert.match(dxf, /\n900\n/);
  assert.match(dxf, /\n300\n/);
});


test('exportFramingDxf: jambas y antepecho/dintel quedan AFUERA del vano (vano libre dibujado == cota real)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const stud = profiles.find(p => p.code === '90CA085'); // B=38
  const track = profiles.find(p => p.code === '92C085'); // H=92
  const wallDef = { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90,
    openings: [{ id: 'op1', axisType: 'x', type: 'window', position: 2000, width: 1200, height: 500, sillHeight: 900 }] };
  const layout = computeStudLayout(wallDef, grid, {}, {}, { spacing: 400 });
  const entities = wallFramingEntities(wallDef, grid, { ...layout, wallBottomElevation: 0 }, stud, track, 0, []);
  const dxf = entities.join('\n');

  const oMin = 1400, oMax = 2600; // 2000 ± 1200/2
  const sillRel = 900, topRel = 1400; // 900 + 500

  // jambas: cara interior exacta en oMin/oMax, cuerpo hacia afuera (studWidth = 38)
  assert.match(dxf, new RegExp(`10\\n${(oMin - 38).toFixed(2)}\\n`)); // king izq arranca en oMin-38
  assert.match(dxf, new RegExp(`10\\n${oMax.toFixed(2)}\\n`)); // king der arranca en oMax
  // antepecho: cara superior exacta en sillRel, cuerpo hacia abajo (trackHeight = 92)
  assert.match(dxf, new RegExp(`20\\n${(sillRel - 92).toFixed(2)}\\n`));
  assert.match(dxf, new RegExp(`20\\n${sillRel.toFixed(2)}\\n`));
  // dintel: cara inferior exacta en topRel, cuerpo hacia arriba
  assert.match(dxf, new RegExp(`20\\n${topRel.toFixed(2)}\\n`));
  assert.match(dxf, new RegExp(`20\\n${(topRel + 92).toFixed(2)}\\n`));
});


test('exportFramingDxf: soleras comparten tramo con el montante (montante se inserta en la solera, no queda afuera)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const stud = profiles.find(p => p.code === '90CA085');
  const track = profiles.find(p => p.code === '92C085'); // H=92
  const wallDef = { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90, openings: [] };
  const layout = computeStudLayout(wallDef, grid, {}, {}, { spacing: 400 });
  const entities = wallFramingEntities(wallDef, grid, { ...layout, wallBottomElevation: 0 }, stud, track, 0, []);
  const dxf = entities.join('\n');

  // solera inferior: parte más baja exacta en 0 (igual que el montante), sube 92mm
  assert.match(dxf, /20\n0\.00\n/);
  assert.match(dxf, /20\n92\.00\n/);
  // solera superior: parte más alta exacta en 2400 (igual que el montante), baja 92mm
  assert.match(dxf, /20\n2308\.00\n/);
  assert.match(dxf, /20\n2400\.00\n/);
});


test('exportFramingDxf: dos muros con studs se ubican uno junto al otro (offsets X distintos, sin superponerse)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90, openings: [] },
    grid, {}, {}, { spacing: 400 }
  );
  const wallA = makeWall(profiles, { id: 'wA', studs: layout.studs, headers: [] });
  // en otro eje: desde la sesión 18 dos muros del MISMO eje van a una sola elevación
  const wallB = makeWall(profiles, { id: 'wB', yStart: 'y1', yEnd: 'y1', studs: layout.studs, headers: [] });
  const model = { grid, elements: [wallA, wallB], library: { metalconProfiles: profiles }, projectParams: [] };

  const dxf = generateFramingDxf(model);
  // ambos muros deben aparecer (nombre de muro sanitizado, una vez cada uno)
  const sanitize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/→/g, '-');
  for (const wall of [wallA, wallB]) {
    const label = sanitize(getWallDisplayName(wall, grid));
    assert.equal(dxf.split(label).length - 1, 1, `esperaba una etiqueta para ${label}`);
  }
});

test('exportFramingDxf: el texto de burbuja de eje y de niveles usa la capa ETIQUETAS (no EJES/NIVELES)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90, openings: [] },
    grid, {}, {}, { spacing: 400 }
  );
  const wall = makeWall(profiles, { studs: layout.studs, headers: [] });
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };
  const dxf = generateFramingDxf(model);

  // el texto "X2" (burbuja de eje intermedio) debe estar precedido por "8\nETIQUETAS", no "8\nEJES"
  const x2Block = dxf.slice(0, dxf.indexOf('\n1\nX2'));
  const lastLayerBeforeX2 = x2Block.match(/8\n(\w+)/g).pop();
  assert.equal(lastLayerBeforeX2, '8\nETIQUETAS');

  // el texto "NPT (1200 mm)" (nivel intermedio) debe estar precedido por "8\nETIQUETAS", no "8\nNIVELES"
  const nivelBlock = dxf.slice(0, dxf.indexOf('\n1\nNPT (1200 mm)'));
  const lastLayerBeforeNivel = nivelBlock.match(/8\n(\w+)/g).pop();
  assert.equal(lastLayerBeforeNivel, '8\nETIQUETAS');
});

test('exportFramingDxf: la separación entre muros crece si el nombre del nivel es largo (no se superpone con el siguiente muro)', () => {
  const grid = baseGrid();
  grid.zLevels = [
    { id: 'z0', elevation: 0, label: 'NIVEL DE PISO TERMINADO GENERAL MUY LARGO' },
    { id: 'z1', elevation: 2400, label: 'CIELO GENERAL' }
  ];
  const profiles = loadedMetalconProfiles();
  const layout = computeStudLayout(
    { id: 'w1', type: 'wall', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', direction: 'x', bottomZ: 'z0', topZ: 'z1', thickness: 90, openings: [] },
    grid, {}, {}, { spacing: 400 }
  );
  const wallA = makeWall(profiles, { id: 'wA', studs: layout.studs, headers: [] });
  // en otro eje: desde la sesión 18 dos muros del MISMO eje van a una sola elevación
  const wallB = makeWall(profiles, { id: 'wB', yStart: 'y1', yEnd: 'y1', studs: layout.studs, headers: [] });
  const model = { grid, elements: [wallA, wallB], library: { metalconProfiles: profiles }, projectParams: [] };

  const dxf = generateFramingDxf(model);
  // el segundo muro (wB) debe partir después de que termine el texto largo del nivel del primero
  const firstLevelTextX = 4000 + 200; // xOffset(0) + length(4000) + NIVEL_LABEL_MARGIN
  const estimatedTextWidth = 'NIVEL DE PISO TERMINADO GENERAL MUY LARGO'.length * 180 * 0.65;
  const secondWallSoleraMatch = dxf.match(/POLYLINE\n8\nSOLERAS\n66\n1\n70\n1\n0\nVERTEX\n8\nSOLERAS\n10\n(\d+\.\d+)/g);
  const secondWallX = parseFloat(secondWallSoleraMatch[2].split('\n').pop());
  assert.ok(secondWallX >= firstLevelTextX + estimatedTextWidth - 50, `esperaba que el 2do muro empezara después de ${firstLevelTextX + estimatedTextWidth}, partió en ${secondWallX}`);
});

// --- Sesión 3 / Tarea A: transliteración a ASCII en textos DXF ---
test('sanitizeDxfText: transliteración de símbolos tipográficos (sin fallback "?")', () => {
  const casos = [
    ['A — B', 'A - B'], ['A – B', 'A - B'], ['A → B', 'A - B'],
    ['1 · 2', '1 . 2'], ['a • b', 'a . b'],
    ['90 × 40', '90 x 40'],
    ['≥ 3', '>= 3'], ['≤ 3', '<= 3'],
    ['45°', '45%%D'], ['±2', '%%P2'], ['Ø12', '%%C12'], ['ø12', '%%C12'],
    ['«x»', '"x"'], ['“x”', '"x"'], ['‘x’', "'x'"],
    ['etc…', 'etc...']
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(sanitizeDxfText(entrada), esperado, `falló: ${entrada}`);
    assert.ok(!sanitizeDxfText(entrada).includes('?'), `quedó "?" en: ${entrada}`);
  }
});

test('sanitizeDxfText: texto ya-ASCII pasa intacto y los acentos/ñ siguen normalizándose', () => {
  const ascii = 'MURO M-01 / NIVEL 2 (C90x38x12x0.85) [OSB 11.1mm] #1 @400';
  assert.equal(sanitizeDxfText(ascii), ascii);
  assert.equal(sanitizeDxfText('Tabiquería Ñuñoa'), 'Tabiqueria Nunoa');
  assert.equal(sanitizeDxfText('π'), '?'); // sin mapeo → fallback
});
