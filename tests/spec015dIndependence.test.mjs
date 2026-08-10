import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSpec015dIndependence } from '../scripts/check-spec015d-independence.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function tempCopy() {
  const root = await mkdtemp(join(tmpdir(), 'spec015d-independence-'));
  for (const path of ['src/core', 'src/components/modals']) {
    await cp(resolve(ROOT, path), resolve(root, path), { recursive: true });
  }
  return root;
}

test('fronteras estáticas de SPEC-015-D permanecen cerradas', async () => {
  assert.deepEqual(await checkSpec015dIndependence(ROOT), []);
});

test('reversión: una escritura silenciosa dentro del motor puro hace fallar el guard', async () => {
  const root = await tempCopy();
  try {
    const path = resolve(root, 'src/core/structuralProposals.js');
    const text = await readFile(path, 'utf8');
    await writeFile(path, `${text}\nsetElementIntent({}, 1, {});\n`);
    const errors = await checkSpec015dIndependence(root);
    assert.ok(errors.some((error) => error.includes('motor puro')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reversión: retirar el guard de confirmación stale hace fallar el verificador', async () => {
  const root = await tempCopy();
  try {
    const path = resolve(root, 'src/core/applyStructuralProposalDecision.js');
    const text = await readFile(path, 'utf8');
    await writeFile(path, text.replaceAll('if (!confirmed)', 'if (false && !confirmed)'));
    const errors = await checkSpec015dIndependence(root);
    assert.ok(errors.some((error) => error.includes('if (!confirmed)')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
