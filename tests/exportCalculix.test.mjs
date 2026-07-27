import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCalculix } from '../src/core/exportCalculix.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { METALCON_PROFILES } from '../src/core/metalconCatalog.js';

function baseGrid() {
  return {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 4000 }],
    yAxes: [{ id: 'y0', position: 0 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 2400 }]
  };
}

/** Simula library.metalconProfiles como lo deja loadMetalconCatalog: copia del catálogo
 * estático + un `id` generado por proyecto (distinto del `code`). Los elementos referencian
 * este `id`, nunca el `code` directamente — igual que MetalconModulationModal. */
function loadedMetalconProfiles() {
  return METALCON_PROFILES.map((p, i) => ({ ...p, id: 9000 + i }));
}

function findLoadedByCode(profiles, code) {
  return profiles.find(p => p.code === code);
}

function makeWall(profiles, overrides = {}) {
  const stud = findLoadedByCode(profiles, '90CA085');
  const track = findLoadedByCode(profiles, '92C085');
  return {
    id: 'w1', type: 'wall', direction: 'x',
    xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0',
    bottomZ: 'z0', topZ: 'z1', thickness: 90,
    openings: [], studs: [],
    framingStudProfileId: stud?.id, framingTrackProfileId: track?.id,
    ...overrides
  };
}

test('exportCalculix: muro con studs generados exporta ELSET de montantes y soleras (perfil por id de librería)', () => {
  const grid = baseGrid();
  const metalconProfiles = loadedMetalconProfiles();
  const wall = makeWall(metalconProfiles);
  const layout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  assert.equal(layout.resolved, true);
  wall.studs = layout.studs;

  const library = { metalconProfiles, materials: [], columnSections: [], beamSections: [] };
  const inp = generateCalculix({ grid, elements: [wall], projectParams: [], library });
  assert.match(inp, /ELSET=MONTANTES_MW1/);
  assert.match(inp, /ELSET=SOLERAS_MW1/);
  assert.match(inp, /BEAM SECTION, ELSET=MONTANTES_MW1/);
  assert.match(inp, /MATERIAL=ACERO_GALVANIZADO/);
  assert.doesNotMatch(inp, /ADVERTENCIA/);
});

test('exportCalculix: muro con perfiles asignados pero sin studs → advertencia, no exporta', () => {
  const grid = baseGrid();
  const metalconProfiles = loadedMetalconProfiles();
  const wall = makeWall(metalconProfiles, { studs: [] });

  const library = { metalconProfiles, materials: [], columnSections: [], beamSections: [] };
  const inp = generateCalculix({ grid, elements: [wall], projectParams: [], library });
  assert.match(inp, /ADVERTENCIA/);
  assert.match(inp, /studs vacío/);
  assert.doesNotMatch(inp, /ELSET=MONTANTES/);
});

test('exportCalculix: muro sin perfiles asignados y sin studs se omite en silencio', () => {
  const grid = baseGrid();
  const wall = makeWall([], { studs: [], framingStudProfileId: undefined, framingTrackProfileId: undefined });

  const library = { metalconProfiles: [], materials: [], columnSections: [], beamSections: [] };
  const inp = generateCalculix({ grid, elements: [wall], projectParams: [], library });
  assert.doesNotMatch(inp, /ADVERTENCIA/);
});

test('exportCalculix: muro cuyo id de perfil no está en la librería del proyecto → advertencia (no confunde id con code)', () => {
  const grid = baseGrid();
  // framingStudProfileId con un valor que NO existe en library.metalconProfiles del proyecto
  // (p.ej. quedó un `code` de una versión anterior, o el catálogo no se cargó en este proyecto).
  const wall = makeWall([], { framingStudProfileId: '90CA085', framingTrackProfileId: undefined, studs: [{ offset: 500, zMin: 0, zMax: 2400 }] });

  const library = { metalconProfiles: [], materials: [], columnSections: [], beamSections: [] };
  const inp = generateCalculix({ grid, elements: [wall], projectParams: [], library });
  assert.match(inp, /ADVERTENCIA/);
  assert.match(inp, /no encontrado en la librería del proyecto/);
});

test('exportCalculix: sigue exportando columnas/vigas/fundaciones como antes cuando no tienen material asignado (sin regresión)', () => {
  const grid = baseGrid();
  const column = {
    id: 'c1', type: 'column', axisXId: 'x0', axisYId: 'y0',
    bottomZ: 'z0', topZ: 'z1', widthX: 300, widthY: 300
  };
  const inp = generateCalculix({ grid, elements: [column], projectParams: [] });
  assert.match(inp, /ELSET=PILARES/);
  assert.match(inp, /MATERIAL=HORMIGON_GENERICO/);
});

test('exportCalculix: pilar con sección de librería + material hormigón → material real, SECTION=RECT', () => {
  const grid = baseGrid();
  const materials = [{ id: 1, name: 'Hormigón H30', category: 'hormigon', elasticModulus: 25000, strength: 30, density: 2500 }];
  const columnSections = [{ id: 10, widthX: 350, widthY: 350, materialId: 1 }];
  const column = { id: 'c1', type: 'column', axisXId: 'x0', axisYId: 'y0', bottomZ: 'z0', topZ: 'z1', widthX: 350, widthY: 350, libraryId: 10 };

  const library = { materials, columnSections, beamSections: [], metalconProfiles: [] };
  const inp = generateCalculix({ grid, elements: [column], projectParams: [], library });
  assert.match(inp, /ELSET=PILARES_L10/);
  assert.match(inp, /MATERIAL=MAT_HORMIGNH30_1/);
  assert.match(inp, /25000, 0\.3/);
  assert.match(inp, /BEAM SECTION, ELSET=PILARES_L10.*SECTION=RECT/);
  assert.doesNotMatch(inp, /ELSET=PILARES\b/); // no debe caer en el pool genérico
});

test('exportCalculix: pilar con sección de librería + material metalcon + perfil real → BEAM SECTION SECTION=GENERAL', () => {
  const grid = baseGrid();
  const metalconProfiles = loadedMetalconProfiles();
  const profile = findLoadedByCode(metalconProfiles, '90CA085');
  const materials = [{ id: 2, name: 'Acero Metalcon', category: 'metalcon', elasticModulus: 200000, strength: 275, density: 7850 }];
  const columnSections = [{ id: 11, widthX: 90, widthY: 38, materialId: 2, metalconProfileId: profile.id }];
  const column = { id: 'c2', type: 'column', axisXId: 'x0', axisYId: 'y0', bottomZ: 'z0', topZ: 'z1', widthX: 90, widthY: 38, libraryId: 11 };

  const library = { materials, columnSections, beamSections: [], metalconProfiles };
  const inp = generateCalculix({ grid, elements: [column], projectParams: [], library });
  assert.match(inp, /BEAM SECTION, ELSET=PILARES_L11, MATERIAL=MAT_ACEROMETALCON_2/);
  assert.match(inp, /200000, 0\.3/);
});

test('exportCalculix: muro con framingMaterialId real → usa ese material en vez del genérico', () => {
  const grid = baseGrid();
  const metalconProfiles = loadedMetalconProfiles();
  const materials = [{ id: 3, name: 'Metalcon ZAR', category: 'metalcon', elasticModulus: 203000, strength: 280, density: 7850 }];
  const wall = makeWall(metalconProfiles, { framingMaterialId: 3 });
  const layout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  wall.studs = layout.studs;

  const library = { metalconProfiles, materials, columnSections: [], beamSections: [] };
  const inp = generateCalculix({ grid, elements: [wall], projectParams: [], library });
  assert.match(inp, /BEAM SECTION, ELSET=MONTANTES_MW1, MATERIAL=MAT_METALCONZAR_3/);
  assert.match(inp, /203000, 0\.3/);
  assert.doesNotMatch(inp, /MATERIAL=ACERO_GALVANIZADO/);
});

test('exportCalculix: muro sin framingMaterialId sigue usando el genérico ACERO_GALVANIZADO (sin regresión)', () => {
  const grid = baseGrid();
  const metalconProfiles = loadedMetalconProfiles();
  const wall = makeWall(metalconProfiles);
  const layout = computeStudLayout(wall, grid, {}, {}, { spacing: 400 });
  wall.studs = layout.studs;

  const library = { metalconProfiles, materials: [], columnSections: [], beamSections: [] };
  const inp = generateCalculix({ grid, elements: [wall], projectParams: [], library });
  assert.match(inp, /MATERIAL=ACERO_GALVANIZADO/);
});
