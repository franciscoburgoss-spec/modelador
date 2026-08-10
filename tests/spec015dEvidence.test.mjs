import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EVIDENCE = resolve(ROOT, 'evidence/spec-015-d');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readJson(name) {
  return JSON.parse(await readFile(resolve(EVIDENCE, name), 'utf8'));
}

test('evidencia FX-008 conserva conteos, decisiones e invariantes de SPEC-015-D', async () => {
  const manifest = await readJson('MANIFEST.json');
  const evidence = await readJson('FX-008-SPEC-015-D.json');
  assert.equal(manifest.schema, 'spec-015-d-evidence-manifest-v1.0');
  assert.deepEqual(evidence.counts, {
    foundations: 32,
    openings: 43,
    roofs: 7,
    walls: 45
  });
  assert.deepEqual(
    evidence.reviewScenarios.map((scenario) => scenario.disposition),
    ['accepted', 'modifiedAndAccepted', 'rejected', 'deferred']
  );
  assert.deepEqual(
    evidence.reviewScenarios.map((scenario) => scenario.changedIntent),
    [true, true, false, false]
  );
  assert.equal(evidence.staleScenario.blocked, true);
  assert.equal(evidence.staleScenario.code, 'SI-PROPOSAL-STALE');
  assert.deepEqual(evidence.invariants, {
    constructiveTerms: [],
    falseCeilingNodes: 0,
    gravityAndLateralSeparated: true,
    noVerifiedState: true,
    structuralIntentUnchangedByGeneration: true
  });
  for (const entry of manifest.files) {
    const content = await readFile(resolve(EVIDENCE, entry.path));
    assert.equal(content.byteLength, entry.bytes, entry.path);
    assert.equal(sha256(content), entry.sha256, entry.path);
  }
});

test('regenerar la evidencia mantiene exactamente el manifiesto', async () => {
  const before = await readFile(resolve(EVIDENCE, 'MANIFEST.json'), 'utf8');
  execFileSync(process.execPath, ['scripts/generate-spec015d-evidence.mjs'], {
    cwd: ROOT,
    stdio: 'pipe'
  });
  const after = await readFile(resolve(EVIDENCE, 'MANIFEST.json'), 'utf8');
  assert.equal(after, before);
});
