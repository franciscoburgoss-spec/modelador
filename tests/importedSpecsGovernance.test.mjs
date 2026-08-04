import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  extractImportedNormativeBody,
  sha256,
} from '../scripts/lib/imported-spec-bodies.mjs';
import { validateSpecDocumentContract } from '../scripts/lib/spec-document-contract.mjs';

const root = process.cwd();
const specsDirectory = path.join(root, 'specs');
const manifest = JSON.parse(await readFile(
  path.join(root, 'governance/IMPORTED_SPEC_BODIES.json'),
  'utf8'
));

async function exists(absolutePath) {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

test('los ocho cuerpos importados conservan longitud y SHA-256 después de normalizar', async () => {
  assert.equal(manifest.schema, 'imported-spec-bodies/v1');
  assert.equal(manifest.entries.length, 8);
  assert.equal(new Set(manifest.entries.map((entry) => entry.normalizedName)).size, 8);

  for (const entry of manifest.entries) {
    const normalizedPath = path.join(specsDirectory, entry.normalizedName);
    const documentBytes = await readFile(normalizedPath);
    const body = extractImportedNormativeBody(documentBytes);

    assert.equal(body.byteLength, entry.bytes, entry.normalizedName);
    assert.equal(sha256(body), entry.sha256, entry.normalizedName);
    assert.equal(await exists(path.join(specsDirectory, entry.originalName)), false);
  }
});

test('las envolventes declaran contrato G0 y esfuerzo futuro high', async () => {
  for (const entry of manifest.entries) {
    const content = await readFile(path.join(specsDirectory, entry.normalizedName), 'utf8');
    assert.deepEqual(validateSpecDocumentContract(entry.normalizedName, content), []);
    assert.match(content, /^## Ejecución Codex$/m);
    assert.match(content, /^- Esfuerzo planificado: `high`$/m);
  }
});

test('reversión: retirar Diagnóstico falla G0 y restaurarlo recupera el contrato', async () => {
  const entry = manifest.entries[0];
  const original = await readFile(path.join(specsDirectory, entry.normalizedName), 'utf8');
  const reverted = original.replace('## Diagnóstico', '## Sección retirada');

  assert.deepEqual(validateSpecDocumentContract(entry.normalizedName, original), []);
  assert.ok(validateSpecDocumentContract(entry.normalizedName, reverted).some((error) => (
    error.includes('falta "## Diagnóstico"')
  )));
  assert.deepEqual(validateSpecDocumentContract(entry.normalizedName, original), []);
});
