import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStructuralIntentVisualPresentation, buildStructuralIntentVisualPreview } from '../src/core/structuralIntentVisualPresentation.js';
import { hitTestStructuralIntentVisualPreview } from '../src/core/structuralIntentVisualHitTest.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url)));

test('SPEC-015-C-1 hit-test selecciona sólo targets del preview y no vecinos', () => {
  const preview = buildStructuralIntentVisualPreview(
    buildStructuralIntentVisualPresentation(fixture), [1784605101040]
  );
  assert.equal(hitTestStructuralIntentVisualPreview(preview, { x: 18000, y: 2000 }, 10), 1784605101040);
  assert.equal(hitTestStructuralIntentVisualPreview(preview, { x: 17800, y: 4000 }, 10), null);
});

test('SPEC-015-C-1 hit-test de lote devuelve el integrante exacto', () => {
  const preview = buildStructuralIntentVisualPreview(
    buildStructuralIntentVisualPresentation(fixture),
    [1784751397992, 1784752583321, 1784752639636]
  );
  assert.equal(hitTestStructuralIntentVisualPreview(preview, { x: 6400, y: 3500 }, 10), 1784752583321);
});
