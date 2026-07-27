// tests/foundationBaseLevel.test.mjs
// ★ BUGFIX — "generar fundaciones no genera nada". Causa: el nivel base se buscaba por
// `elevation === 0`, que en la práctica chilena es el NTN (terreno natural). La tabiquería
// arranca en el NPT (+450), así que el filtro `wall.bottomZ === baseLevelId` no encontraba un
// solo muro y la función devolvía cero de todo SIN un mensaje de error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateFoundationsFromWalls } from '../src/core/foundationGeneration.js';

const here = dirname(fileURLToPath(import.meta.url));
const casaL = JSON.parse(readFileSync(join(here, 'fixtures/casa-L.json'), 'utf8'));
const nivel = (m, elev) => m.grid.zLevels.find(l => l.elevation === elev);

test('regresión — con NPT en +450 se generan fundaciones (antes: 0 y sin explicación)', () => {
  const r = generateFoundationsFromWalls(casaL, {});
  assert.ok(r.created.length > 0, 'debe generar fundaciones bajo los muros de NPT');
  assert.equal(r.baseLevel.elevation, 450, 'el nivel base es el NPT, no el NTN');
  assert.equal(r.baseLevel.id, nivel(casaL, 450).id);
  assert.deepEqual(r.errors, []);
});

test('el nivel base se resuelve por levelType `pisoTerminado`, no por elevación 0', () => {
  // NTN (0) y NPT (450) coexisten: la regla vieja habría elegido el NTN.
  assert.ok(nivel(casaL, 0), 'premisa: existe un nivel en elevación 0');
  assert.equal(generateFoundationsFromWalls(casaL, {}).baseLevel.motivo, 'nivel de piso terminado (NPT)');
});

test('sin niveles tipados cae al nivel más bajo CON muros, y lo avisa', () => {
  const sinTipo = { ...casaL, grid: { ...casaL.grid, zLevels: casaL.grid.zLevels.map(l => ({ ...l, levelType: undefined })) } };
  const r = generateFoundationsFromWalls(sinTipo, {});
  assert.equal(r.baseLevel.elevation, 450);
  assert.equal(r.baseLevel.motivo, 'nivel más bajo con muros');
  assert.ok(r.warnings.some(w => w.includes('NPT')), 'sugiere tipar los niveles');
  assert.equal(r.created.length, generateFoundationsFromWalls(casaL, {}).created.length, 'mismo resultado por otra vía');
});

test('la elección del usuario manda sobre la automática', () => {
  const r = generateFoundationsFromWalls(casaL, { baseLevelId: nivel(casaL, 3250).id });
  assert.equal(r.baseLevel.elevation, 3250);
  assert.equal(r.baseLevel.motivo, 'seleccionado por el usuario');
});

test('NUNCA falla en silencio: nivel sin muros devuelve un error que dice dónde SÍ hay', () => {
  const r = generateFoundationsFromWalls(casaL, { baseLevelId: nivel(casaL, 0).id });
  assert.equal(r.created.length, 0);
  assert.equal(r.errors.length, 1, 'el fallo silencioso era el bug de fondo');
  assert.match(r.errors[0], /Ningún muro arranca en el nivel base "NTN"/);
  assert.match(r.errors[0], /NPT \(450mm\)/, 'dice dónde sí hay muros');
});

test('modelo sin muros: error explícito, no silencio', () => {
  const r = generateFoundationsFromWalls({ ...casaL, elements: casaL.elements.filter(e => e.type !== 'wall') }, {});
  assert.equal(r.created.length, 0);
  assert.match(r.errors[0], /no tiene muros/);
});

test('subterráneo: si hay muros bajo el NPT, se avisa para que el usuario decida', () => {
  const sub = { id: 999, name: 'SUBTERRANEO', elevation: -2400, levelType: 'terreno' };
  const muroSub = { ...casaL.elements.find(e => e.type === 'wall'), id: 99999, bottomZ: 999 };
  const m = { ...casaL, grid: { ...casaL.grid, zLevels: [sub, ...casaL.grid.zLevels] }, elements: [...casaL.elements, muroSub] };
  const r = generateFoundationsFromWalls(m, {});
  assert.equal(r.baseLevel.elevation, 450, 'sigue mandando el NPT por defecto');
  assert.ok(r.warnings.some(w => w.includes('SUBTERRANEO')), 'pero avisa que hay muros más abajo');
});

test('la cota generada respeta la convención de foundationGeometry (levelZ = NPT)', () => {
  const r = generateFoundationsFromWalls(casaL, {});
  for (const f of r.created) assert.equal(f.levelZ, nivel(casaL, 450).id);
});
