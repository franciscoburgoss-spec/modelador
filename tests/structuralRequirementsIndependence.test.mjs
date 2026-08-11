import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('SPEC-015-E B2 independencia: núcleo R6–R12 no importa solución constructiva ni UI', async () => {
  const source = await readFile(new URL('../src/core/structuralRequirements.js', import.meta.url), 'utf8');
  const forbiddenImports = /from\s+['"][^'"]*(?:store|components|three|build3d|wallJunctions|framing|osb|metalcon)[^'"]*['"]/i;
  const forbiddenAuthority = /wallType\.role|\bMP1\b|\bMP2\b|\bMP3\b|\btabique\b/i;
  assert.equal(forbiddenImports.test(source), false);
  assert.equal(forbiddenAuthority.test(source), false);
});
