import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FX008_FRONTON_ID,
  FX008_GRAVITY_WALL_ID,
  FX008_LATERAL_WALL_ID,
  buildFx008Spec015dContext
} from './helpers/spec015d.mjs';

test('FX-008 separa los grafos gravitacional y lateral', async () => {
  const { paths } = await buildFx008Spec015dContext();
  assert.equal(paths.schema, 'candidate-load-paths-v1.0');
  assert.equal(paths.gravity.graphType, 'gravity');
  assert.equal(paths.lateral.graphType, 'lateral');
  assert.ok(paths.gravity.nodes.every((node) => node.graph === 'gravity'));
  assert.ok(paths.lateral.nodes.every((node) => node.graph === 'lateral'));
  assert.ok(paths.gravity.nodes.every((node) => !paths.lateral.nodes.some((other) => other.nodeId === node.nodeId)));
});

test('FX-008 produce una ruta gravitacional completa y una incompleta', async () => {
  const { paths } = await buildFx008Spec015dContext();
  const complete = paths.gravity.paths.find((path) => path.sourceRefs.targetElementId === FX008_GRAVITY_WALL_ID);
  const incomplete = paths.gravity.paths.find((path) => path.sourceRefs.targetElementId === FX008_FRONTON_ID);
  assert.equal(complete.candidateState, 'completeCandidate');
  assert.deepEqual(complete.findings, []);
  assert.equal(incomplete.candidateState, 'incompleteCandidate');
  assert.deepEqual(incomplete.findings, ['SI-VERTICAL-SUPPORT-UNRESOLVED']);
});

test('muro interior lateral conserva intención y explicita gap de 571,429 mm', async () => {
  const { paths } = await buildFx008Spec015dContext();
  const lateral = paths.lateral.paths.find((path) => path.sourceRefs.targetElementId === FX008_LATERAL_WALL_ID);
  assert.equal(lateral.candidateState, 'incompleteCandidate');
  assert.ok(lateral.findings.includes('SI-LATERAL-TRANSFER-REQUIRED'));
  const finding = paths.lateral.findings.find((item) => item.code === 'SI-LATERAL-TRANSFER-REQUIRED');
  assert.equal(finding.evidence.gapMm, 571.429);
  assert.ok(!JSON.stringify(paths).toLowerCase().includes('cielo falso'));
  assert.ok(!JSON.stringify(paths).includes('verified'));
});
