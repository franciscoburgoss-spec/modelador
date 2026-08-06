import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { auditSpec015cIndependence } from '../scripts/lib/spec015c-independence.mjs';

test('SPEC-015-C independencia: grafo productivo no importa fuentes constructivas', async () => {
  const result = await auditSpec015cIndependence(process.cwd());
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.graph.files.some((file) => file.endsWith('structuralIntentWorkspace.js')));
});

test('SPEC-015-C independencia: reversión con importación prohibida hace fallar auditoría', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spec015c-independence-'));
  await mkdir(path.join(root, 'src/components/modals'), { recursive: true });
  await mkdir(path.join(root, 'src/core'), { recursive: true });
  await writeFile(path.join(root, 'src/components/modals/StructuralIntentWorkspaceDialog.jsx'), "import '../../../core/wallTypes.js';\nexport default null;\n");
  await writeFile(path.join(root, 'src/core/structuralIntentWorkspace.js'), 'export const ok = true;\n');
  const result = await auditSpec015cIndependence(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('wallTypes')));
});
