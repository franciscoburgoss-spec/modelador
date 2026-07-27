// tests/levelTypes.test.mjs — ★ pendiente sesión 18: levelType de los 6 zLevels (datums NTN/NPT)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LEVEL_TYPES, LEVEL_TYPE_OPTIONS } from '../src/core/levelTypes.js';
import { levelEntities } from '../src/core/exportFramingDxf.js';

const here = dirname(fileURLToPath(import.meta.url));

test('taxonomía: niveles de referencia NTN/NPT con datum:true y siglas estándar', () => {
  assert.equal(LEVEL_TYPES.terreno.sigla, 'NTN');
  assert.equal(LEVEL_TYPES.pisoTerminado.sigla, 'NPT');
  assert.ok(LEVEL_TYPES.terreno.datum && LEVEL_TYPES.pisoTerminado.datum);
});

test('LEVEL_TYPE_OPTIONS ofrece los 6 tipos + opción vacía', () => {
  const vals = LEVEL_TYPE_OPTIONS.map(o => o.value);
  for (const k of ['', 'terreno', 'pisoTerminado', 'cieloGeneral', 'cieloAlto', 'frontonGeneral', 'frontonAlto'])
    assert.ok(vals.includes(k), `falta opción ${k}`);
});

test('levelEntities: datum dibuja símbolo pero NO repite la sigla cuando el label ya es la sigla', () => {
  const grid = { xAxes: [], yAxes: [], zLevels: [
    { id: 'z0', elevation: 0, label: 'NPT', levelType: 'pisoTerminado' },        // label == sigla
    { id: 'z1', elevation: 2400, label: 'CIELO GENERAL', levelType: 'cieloGeneral' } // label != sigla
  ] };
  const dxf = levelEntities(0, 4000, 2400, 0, grid).join('\n');
  assert.equal((dxf.match(/\nSOLID\n/g) || []).length, 2, 'un símbolo por nivel tipado');
  assert.equal((dxf.match(/\nNPT\n/g) || []).length, 1, 'NPT sale una sola vez (label), sin sigla duplicada');
  assert.ok(/\nCG\n/.test(dxf) && /\nCIELO GENERAL/.test(dxf), 'sigla distinta sí se dibuja además del label');
});

test('fixtures: los 6 zLevels de casa-L y modelo-26 quedan tipados', () => {
  for (const rel of ['fixtures/casa-L.json', '../lab/roofPlane/fixtures/modelo-26.json']) {
    const d = JSON.parse(readFileSync(join(here, rel), 'utf8'));
    const zl = d.grid.zLevels;
    assert.equal(zl.length, 6);
    assert.ok(zl.every(l => l.levelType && LEVEL_TYPES[l.levelType]), `${rel} tiene niveles sin tipo`);
  }
});
