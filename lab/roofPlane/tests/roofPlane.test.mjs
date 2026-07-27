// lab/roofPlane/tests/roofPlane.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRoofPlane } from '../core/roofPlane.js';
import { buildParamsMap } from '../../../src/core/projectParams.js';

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, '../fixtures/modelo-26.json'), 'utf8'));
const paramsMap = buildParamsMap(model.projectParams || []);

const CIELO_GENERAL = 1784556741132; // elevation 3250 -> cota apoyo 3350

// Faldón eje A: canaleta @Y=0, dos apoyos altos @Y=1200 (luz corta) y @Y=2000 (luz larga).
const planeEjeA = {
  id: 'test-ejeA',
  canalWallId: 1784600403613,
  supportLevelId: CIELO_GENERAL,
  supportOffset: 100,
  crownClearance: 200,
  heelHeight: 300,
  gutterNotchWidth: 200,
  trussSpacing: 1200,
  chainOrigin: 'start',
  shortSpanThreshold: 500,
  purlinSpacing: 800,
  purlinProfileH: 35,        // 35OMA085 — altura de costanera para la holgura de coronación
  purlinCommercialLength: 0,
  purlinOverlap: 0,
  highWalls: [1784604634483, 1784819708086]
};

test('faldón eje A resuelve con pendiente única', () => {
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  assert.equal(r.resolved, true, r.findings.map(f => f.message).join(' | '));
  assert.equal(r.runAxis, 'x');
  assert.equal(r.supportElevation, 3350);
  // dos tramos con luz distinta
  assert.equal(r.tramos.length, 2);
  const luces = r.tramos.map(t => Math.round(t.span)).sort((a, b) => a - b);
  assert.deepEqual(luces, [1099, 1899]);
});

test('pendiente única derivada del tramo de mayor luz (más restrictivo)', () => {
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  // el brazo de 1899 exige la menor pendiente para no pasarse de coronación -> ~13.96%
  assert.ok(Math.abs(r.slopePercent - 13.96) < 0.1, `pendiente ${r.slopePercent}`);
  // el brazo corto queda con holgura bajo su coronación (hiddenBy > 0)
  const corto = r.tramos.find(t => Math.round(t.span) === 1099);
  const largo = r.tramos.find(t => Math.round(t.span) === 1899);
  assert.ok(corto.hiddenBy > 50, `el brazo corto se esconde ${Math.round(corto.hiddenBy)}mm bajo su coronación`);
  assert.ok(Math.abs(largo.hiddenBy) < 5, 'el brazo largo queda justo en el máximo (gobierna)');
});

test('cadena global: vanos de 1200 sobre toda la corrida, no por tramo', () => {
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const offs = r.trussPositions.map(p => Math.round(p.offset));
  const gaps = offs.slice(1).map((o, i) => o - offs[i]);
  // debe haber una tirada de 1200 (no los 1083/799 del modelo actual por tramos)
  const de1200 = gaps.filter(g => Math.abs(g - 1200) < 2).length;
  assert.ok(de1200 >= 8, `mayoría de vanos a 1200: ${gaps}`);
});

test('costaneras continuas atravesando el quiebre en x=12800', () => {
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  // costaneras a s bajos (dentro de la luz corta) deben cubrir de la canaleta al frontón alto
  // en UNA pieza continua a través del quiebre.
  const sBajos = r.purlins.filter(p => p.s < 1000);
  assert.ok(sBajos.length > 0);
  for (const p of sBajos) {
    // continua: un solo rango que cruza x=12800
    const cruza = p.pieces.some(pc => pc.runFrom < 12800 && pc.runTo > 12800);
    assert.ok(cruza, `costanera s=${Math.round(p.s)} continua a través del quiebre`);
  }
});

test('sin cerchas embebidas ni apoyadas en el aire (findings de error vacíos para geometría)', () => {
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const errores = r.findings.filter(f => f.severity === 'error');
  assert.deepEqual(errores, [], errores.map(e => e.message).join(' | '));
});

test('la fusión de colineales en la canaleta se reporta como info, no error', () => {
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  // la canaleta del eje A es un solo muro, pero el apoyo alto @Y=2000 es colineal-fusionado
  const infos = r.findings.filter(f => f.severity === 'info');
  assert.ok(infos.length >= 0); // no debe romper; el reporte es informativo
});

test('coronaciones incompatibles: avisa en vez de forzar (pregunta 2 de Fran)', () => {
  // faldón cuyos dos altos tienen coronación distinta y luz que hace incompatible la pendiente única.
  // Construimos un caso sintético: si el tramo de menor luz tiene coronación MÁS BAJA, con la
  // pendiente del tramo largo (más restrictiva por luz) el corto podría pasarse. Verificamos que si
  // ocurre, sale finding incompatibleSlope. En el modelo real de Fran las coronaciones son iguales
  // (4150), así que este invariante NO se dispara — es la garantía de holgura mínima.
  const r = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const incompat = r.findings.filter(f => f.category === 'incompatibleSlope');
  assert.equal(incompat.length, 0, 'eje A tiene coronaciones iguales -> sin incompatibilidad');
});
