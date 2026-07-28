// tests/roofPlaneValidation.test.mjs (B4.7.5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRoofPlanes } from '../src/core/roofPlaneValidation.js';

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));

test('modelo sin roofPlanes devuelve lista vacía', () => {
  assert.deepEqual(validateRoofPlanes({ ...model, roofPlanes: [] }), []);
  assert.deepEqual(validateRoofPlanes({ ...model, roofPlanes: undefined }), []);
});

test('mapea findings del faldón al shape del reporte con roofPlaneIds', () => {
  const resolveFn = () => ({ findings: [
    { severity: 'info', category: 'edge', message: 'corrida recortada' },
    { severity: 'error', category: 'incompatibleSlope', message: 'coronación excedida' }
  ] });
  const planes = [{ id: 'F1', name: 'Eje A' }];
  const out = validateRoofPlanes({ ...model, roofPlanes: planes }, resolveFn);

  assert.equal(out.length, 2);
  assert.deepEqual(out.map(f => f.severity), ['info', 'error']);
  assert.deepEqual(out.map(f => f.category), ['edge', 'incompatibleSlope']);
  assert.ok(out.every(f => f.roofPlaneIds[0] === 'F1'));
  assert.ok(out[0].message.includes('faldón "Eje A"'));  // etiqueta con nombre
  assert.ok(out[1].message.includes('coronación excedida')); // conserva el mensaje original
});

test('preserva campos extendidos, etapa e ids tipados al agregar el faldón', () => {
  const resolveFn = () => ({
    findings: [{
      severity: 'error',
      category: 'trussJambAlignment',
      message: 'llegada fuera de jamba',
      rule: 'muro.dintel.llegadaCercha',
      measured: { value: 200, unit: 'mm' },
      limit: { max: 19, unit: 'mm' },
      stage: 'support-overlap',
      wallIds: ['W1']
    }]
  });
  const [finding] = validateRoofPlanes(
    { ...model, roofPlanes: [{ id: 'F1', name: 'Eje A' }] },
    resolveFn
  );

  assert.deepEqual(finding, {
    severity: 'error',
    category: 'trussJambAlignment',
    message: 'faldón "Eje A": llegada fuera de jamba',
    rule: 'muro.dintel.llegadaCercha',
    measured: { value: 200, unit: 'mm' },
    limit: { max: 19, unit: 'mm' },
    stage: 'support-overlap',
    wallIds: ['W1'],
    roofPlaneIds: ['F1']
  });
});

test('faldón sin nombre usa su id en la etiqueta', () => {
  const resolveFn = () => ({ findings: [{ severity: 'info', category: 'x', message: 'm' }] });
  const out = validateRoofPlanes({ ...model, roofPlanes: [{ id: 42 }] }, resolveFn);
  assert.ok(out[0].message.includes('faldón 42'));
});

test('un faldón que revienta al resolver no rompe el reporte', () => {
  const resolveFn = () => { throw new Error('boom'); };
  const out = validateRoofPlanes({ ...model, roofPlanes: [{ id: 'F1' }] }, resolveFn);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'error');
  assert.ok(out[0].message.includes('boom'));
  assert.deepEqual(out[0].roofPlaneIds, ['F1']);
});

test('faldón real resuelto: findings (si los hay) traen roofPlaneIds del faldón', () => {
  const planeEjeA = {
    id: 'ejeA', canalWallId: 1784600403613, supportLevelId: 1784556741132, supportOffset: 100,
    crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
    chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfileH: 35,
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
    polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 }, { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
  };
  const out = validateRoofPlanes({ ...model, roofPlanes: [planeEjeA] });
  assert.ok(Array.isArray(out));
  assert.ok(out.every(f => f.roofPlaneIds[0] === 'ejeA' && typeof f.severity === 'string'));
});
