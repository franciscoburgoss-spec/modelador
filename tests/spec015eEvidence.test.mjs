import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { buildSpec015eEvidence } from '../scripts/generate-spec015e-evidence.mjs';

test('SPEC-015-E B3: evidencia FX-008 conserva conteos y checkpoint gravitacional/lateral', async () => {
  const built = await buildSpec015eEvidence();
  assert.deepEqual(built.evidence.sourceCounts, {
    walls: 45,
    openings: 43,
    foundations: 32,
    roofs: 7,
    interfaceIntents: 8,
    relationIntents: 5
  });
  assert.equal(built.evidence.reproducibleCheckpoint.relationGravityPathCount, 4);
  assert.ok(built.evidence.reproducibleCheckpoint.gravityStates.every((state) => state === 'completeCandidate'));
  assert.equal(built.evidence.reproducibleCheckpoint.lateralPathCount, 0);
  assert.equal(built.evidence.reproducibleCheckpoint.lateralStatus, 'notDeclared');
  assert.equal(built.evidence.reproducibleCheckpoint.verificationState, 'notVerified');
  assert.equal(built.evidence.reproducibleCheckpoint.allRelationGravityPathsNotVerified, true);
  assert.deepEqual(built.evidence.reproducibleCheckpoint.supportedByFoundation.certainty, ['candidate']);
  assert.deepEqual(built.evidence.reproducibleCheckpoint.supportedByFoundation.supportEvidence, ['candidateSupportEvidence']);
});

test('SPEC-015-E B3/B3.2: B1, C/6 range y C/7 end conservan localizaciones exactas', async () => {
  const { evidence } = await buildSpec015eEvidence();
  assert.deepEqual(evidence.b1.physicalSRange, [12800, 23200]);
  assert.equal(evidence.b1.physicalLengthMm, 10400);
  assert.deepEqual(evidence.b1.interactionSRange, [12800, 14500]);
  assert.equal(evidence.b1.interactionLengthMm, 1700);
  assert.deepEqual(evidence.b1.topologyProjection.physicalBoundary.physicalSRange, [12800, 23200]);
  assert.deepEqual(evidence.b1.topologyProjection.interactionLocator.sRange, [12800, 14500]);
  assert.deepEqual(evidence.regions.fronton.longitudinalLocation, { kind: 'range', sRange: [12800, 14500] });
  assert.deepEqual(evidence.regions.fronton.zRange, [3250, 4150]);
  assert.deepEqual(evidence.regions.c6.longitudinalLocation, { kind: 'range', sRange: [1949.45, 2050.55] });
  assert.deepEqual(evidence.regions.c6.zRange, [3250, 4150]);
  assert.deepEqual(evidence.regions.c7.longitudinalLocation, { kind: 'end', end: 'highS', anchorS: 2000, localizationEnvelope: [1999.9, 2000] });
  assert.deepEqual(evidence.regions.c7.zRange, [3250, 4150]);
});

test('SPEC-015-E B3: lateral explícito conserva gap y requisito sin verificación ni solución constructiva', async () => {
  const { evidence, svg, html } = await buildSpec015eEvidence();
  assert.equal(evidence.lateralScenario.candidateState, 'incompleteCandidate');
  assert.ok(Math.abs(evidence.lateralScenario.gapMm - 571.429) <= 0.001);
  assert.ok(Math.abs(evidence.lateralScenario.roofZ - 3821.429) <= 0.001);
  assert.equal(evidence.lateralScenario.wallTopZ, 3250);
  assert.equal(evidence.lateralScenario.requirementCode, 'SR-LOAD-TRANSFER-REQUIRED');
  assert.equal(evidence.lateralScenario.verificationState, 'notVerified');
  assert.equal(evidence.prohibitions.constructiveMemberSelected, false);
  assert.equal(evidence.prohibitions.profileSelected, false);
  assert.equal(evidence.prohibitions.materialSelected, false);
  assert.equal(evidence.prohibitions.connectionSelected, false);
  assert.equal(evidence.prohibitions.verifiedStateCreated, false);
  assert.match(svg, /gap 571,429 mm/);
  assert.match(svg, /B1 interacción 1\.700 mm/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /notVerified/);
  assert.match(evidence.eligibilityExplanation.text, /cobertura de intención de techumbre incompleta/);
});

test('SPEC-015-E B3: evidencia es determinista, localizador no muta y artefacto versionado coincide', async () => {
  const first = await buildSpec015eEvidence();
  const second = await buildSpec015eEvidence();
  assert.deepEqual(second.evidence, first.evidence);
  assert.equal(second.svg, first.svg);
  assert.equal(second.html, first.html);
  assert.equal(first.evidence.locator.historyChanges, 0);
  assert.equal(first.evidence.locator.traceChanges, 0);
  assert.equal(first.evidence.locator.structuralIntentChanges, 0);
  assert.equal(first.evidence.locator.globalSelectionPreserved, true);
  assert.equal(first.evidence.locator.viewRestored, true);
  assert.equal(first.evidence.traceability.requirementRefsResolve, true);
  const stored = JSON.parse(await readFile(new URL('../evidence/spec-015-e/FX-008-SPEC-015-E.json', import.meta.url), 'utf8'));
  assert.deepEqual(stored, first.evidence);
});
