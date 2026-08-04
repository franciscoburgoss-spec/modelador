import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { recognizeStructuralTopology } from '../src/core/recognizedStructuralTopology.js';
import { renderSpec14VisualEvidence } from '../scripts/lib/spec14-visual-evidence.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expectedHash = 'ba783496503c0f9d1da5ebb0cf18a603169e239eba1b07306f02502630cb09e6';

test('SPEC-014-B: el SVG R0–R5 reproduce encuentros, cobertura Z y nodos de casa-L', async () => {
  const source = JSON.parse(await readFile(new URL('fixtures/casa-L.json', import.meta.url), 'utf8'));
  const result = recognizeStructuralTopology(projectAgnosticGeometry(source));
  const expected = await readFile(
    new URL('../evidence/SPEC-014-B/casa-L-r0-r5.svg', import.meta.url),
    'utf8'
  );
  const manifest = JSON.parse(await readFile(
    new URL('../evidence/SPEC-014-B/manifest.json', import.meta.url),
    'utf8'
  ));

  assert.equal(renderSpec14VisualEvidence(result), expected);
  assert.equal(result.canonicalSha256, expectedHash);
  assert.match(expected, new RegExp(expectedHash));
  assert.match(expected, /Muros canónicos<\/text><text[^>]*>45<\/text>/);
  assert.match(expected, /Vanos canónicos<\/text><text[^>]*>43<\/text>/);
  assert.match(expected, /Apilamientos R3<\/text><text[^>]*>0<\/text>/);
  assert.match(expected, /Encuentros R4<\/text><text[^>]*>60<\/text>/);
  assert.match(expected, /Nodos R5<\/text><text[^>]*>201<\/text>/);
  assert.match(expected, /data-wall-id="1784670218571"/);
  assert.equal([...expected.matchAll(/data-node-id="node\|wall:n:1784670218571/g)].length, 13);
  assert.match(expected, /data-band-state="intersectionActive"/);
  assert.match(expected, /data-band-state="wallAOnly"/);
  assert.match(expected, /PARTIAL_A_FULL_B/);
  assert.match(expected, /eligibleForSpec08 = false/);
  assert.match(expected, /No es un plano de ejecución/);
  assert.deepEqual(manifest, {
    schema: 'spec14-visual-evidence/v1',
    specId: 'SPEC-014-B',
    sourceFixture: 'tests/fixtures/casa-L.json',
    generator: 'npm run evidence:spec14',
    topologySchema: 'recognized-structural-topology-v1.0',
    phasesExecuted: ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'],
    eligibleForSpec08: false,
    canonicalSha256: expectedHash,
    counts: {
      walls: 45,
      openings: 43,
      supportLines: 32,
      relations: 79,
      stackedRelations: 0,
      intersections: 60,
      chains: 8,
      nodes: 201,
      findings: 26
    },
    targetWall: {
      wallId: 1784670218571,
      nodeIds: [
        'node|wall:n:1784670218571|localS:0.000',
        'node|wall:n:1784670218571|localS:800.000',
        'node|wall:n:1784670218571|localS:2800.000',
        'node|wall:n:1784670218571|localS:4200.000',
        'node|wall:n:1784670218571|localS:5100.000',
        'node|wall:n:1784670218571|localS:5700.000',
        'node|wall:n:1784670218571|localS:6400.000',
        'node|wall:n:1784670218571|localS:7400.000',
        'node|wall:n:1784670218571|localS:8000.000',
        'node|wall:n:1784670218571|localS:8600.000',
        'node|wall:n:1784670218571|localS:10050.000',
        'node|wall:n:1784670218571|localS:12050.000',
        'node|wall:n:1784670218571|localS:12800.000'
      ]
    },
    partialZExample: 'relation|CORNER_END_END|wall:n:1784669652371|wall:n:1784833573292',
    files: [{
      path: 'casa-L-r0-r5.svg',
      sha256: createHash('sha256').update(expected).digest('hex')
    }]
  });
});

async function moduleGraph(entry, visited = new Set()) {
  if (visited.has(entry)) return visited;
  visited.add(entry);
  const source = await readFile(entry, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const dependency = resolve(dirname(entry), match[1]);
    await moduleGraph(dependency, visited);
  }
  return visited;
}

test('SPEC-014-B: el grafo productivo R0–R5 permanece agnóstico y puro', async () => {
  const entry = resolve(repositoryRoot, 'src/core/recognizedStructuralTopology.js');
  const graph = await moduleGraph(entry);
  const forbidden = /(?:wallJunctions|build3d|three|react|zustand|store|metalcon|framing|osb|MP1|MP2|MP3|tabique)/i;

  assert.deepEqual(
    [...graph].map((path) => path.slice(repositoryRoot.length + 1)).sort(),
    ['src/core/recognizedStructuralTopology.js', 'src/core/spec14Input.js']
  );
  for (const path of graph) {
    assert.doesNotMatch(path, forbidden);
    assert.doesNotMatch(await readFile(path, 'utf8'), forbidden);
  }
});
