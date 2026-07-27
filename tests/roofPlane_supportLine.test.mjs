// lab/roofPlane/tests/supportLine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveSupportLine, coverageAt } from '../src/core/supportLine.js';
import { buildParamsMap } from '../src/core/projectParams.js';

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));
const paramsMap = buildParamsMap(model.projectParams || []);

// Cota de apoyo real de los faldones del modelo: CIELO GENERAL (3250) + offset 100 = 3350.
const COTA = 3350;

test('eje C: fusiona el frontón sobre dintel (3250-4150) con el muro normal (450-4150)', () => {
  // seed = muro 12800->14500 @Y=2000 (arranca en 3250, sobre dintel)
  const line = resolveSupportLine({ model, seedWallId: 1784819708086, supportElevation: COTA, paramsMap });
  assert.equal(line.resolved, true);
  assert.equal(line.runAxis, 'x');
  assert.equal(line.perp, 2000);
  // los dos fragmentos colineales (12800->14500 y 14500->23200) deben quedar en UN segmento
  assert.equal(line.segments.length, 1, 'debe ser una sola línea continua');
  assert.equal(Math.round(line.segments[0].from), 12800);
  assert.equal(Math.round(line.segments[0].to), 23200);
  assert.equal(line.segments[0].wallIds.length, 2);
  assert.ok(line.warnings.some(w => /compuesta por 2 muros/.test(w)));
});

test('canaleta eje C completa: seed 14500->23200 se fusiona con el frontón 12800->14500', () => {
  // seed 1784605101040 = canaleta @Y=2000 tramo 14500->23200 (450-4150). Colineal con ella:
  // 1784819708086 (12800->14500, 3250-4150, sobre dintel). Ambos vivos a 3350 -> UN segmento
  // 12800->23200. Es la canaleta larga del brazo derecho, hoy partida en dos sistemas falsos.
  const line = resolveSupportLine({ model, seedWallId: 1784605101040, supportElevation: COTA, paramsMap });
  assert.equal(line.resolved, true);
  assert.equal(line.perp, 2000);
  assert.equal(line.segments.length, 1);
  assert.equal(Math.round(line.segments[0].from), 12800);
  assert.equal(Math.round(line.segments[0].to), 23200);
  assert.ok(line.segments[0].wallIds.length >= 2);
});

test('cobertura por posición: coverageAt devuelve el segmento que cubre o null', () => {
  const line = resolveSupportLine({ model, seedWallId: 1784819708086, supportElevation: COTA, paramsMap });
  assert.ok(coverageAt(line, 15000), 'x=15000 está cubierto');
  assert.equal(coverageAt(line, 12000), null, 'x=12000 está fuera (antes de 12800)');
});

test('caso Y=19000: el tramo apoyo alto que arranca en 3850 NO cubre a la cota 3350', () => {
  // El sistema 1784909969968 apoya alto en Y=19000 tramo 10250->14000, que arranca en 3850.
  // A la cota 3350 ese tramo NO está vivo -> no debe aparecer en la línea. Los otros tramos de
  // Y=19000 (6600->10250 y 14000->18750, ambos 450-4750) sí. Debe quedar un HUECO en 10250->14000.
  const line = resolveSupportLine({ model, seedWallId: 1784818076062, supportElevation: COTA, paramsMap });
  // seed 1784818076062 es Y=19000 tramo 10250->14000 (3850-4750): a 3350 NO está vivo,
  // así que el seed mismo no cubre. Pero la línea se arma con TODOS los colineales vivos.
  // Resultado esperado: dos segmentos (6600->10250 y 14000->18750) con hueco en medio.
  assert.equal(line.runAxis, 'y');
  assert.equal(line.perp, 19000);
  assert.equal(line.segments.length, 2, 'hueco a la cota 3350 donde el muro arranca en 3850');
  assert.ok(line.warnings.some(w => /se interrumpe/.test(w)));
  assert.equal(coverageAt(line, 12000), null, 'y=12000 no tiene apoyo vivo a 3350');
});

test('línea inexistente a una cota sin muros vivos', () => {
  const line = resolveSupportLine({ model, seedWallId: 1784819708086, supportElevation: 9999, paramsMap });
  assert.equal(line.resolved, false);
});
