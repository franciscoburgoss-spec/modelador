import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { recognizeStructuralTopology } from '../src/core/recognizedStructuralTopology.js';
import { renderSpec14VisualEvidence } from './lib/spec14-visual-evidence.mjs';

const fixtureUrl = new URL('../tests/fixtures/casa-L.json', import.meta.url);
const evidenceDirectoryUrl = new URL('../evidence/SPEC-014-B/', import.meta.url);
const evidenceUrl = new URL('casa-L-r0-r5.svg', evidenceDirectoryUrl);
const manifestUrl = new URL('manifest.json', evidenceDirectoryUrl);
const source = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const result = recognizeStructuralTopology(projectAgnosticGeometry(source));
const svg = renderSpec14VisualEvidence(result);

await mkdir(evidenceDirectoryUrl, { recursive: true });
await writeFile(evidenceUrl, svg, 'utf8');
const manifest = {
  schema: 'spec14-visual-evidence/v1',
  specId: 'SPEC-014-B',
  sourceFixture: 'tests/fixtures/casa-L.json',
  generator: 'npm run evidence:spec14',
  topologySchema: result.schema,
  phasesExecuted: result.phasesExecuted,
  eligibleForSpec08: result.eligibleForSpec08,
  canonicalSha256: result.canonicalSha256,
  counts: {
    walls: result.walls.length,
    openings: result.openings.length,
    supportLines: result.supportLines.length,
    relations: result.relations.length,
    stackedRelations: result.relations.filter(({ phase }) => phase === 'R3').length,
    intersections: result.relations.filter(({ phase }) => phase === 'R4').length,
    chains: result.chains.length,
    nodes: result.nodes.length,
    findings: result.findings.length
  },
  targetWall: {
    wallId: 1784670218571,
    nodeIds: result.walls.find(({ id }) => id === 1784670218571).nodeIds
  },
  partialZExample: result.relations.find(({ verticalContactType }) => (
    verticalContactType && verticalContactType !== 'FULL_BOTH'
  )).id,
  files: [{
    path: 'casa-L-r0-r5.svg',
    sha256: createHash('sha256').update(svg).digest('hex')
  }]
};
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Evidencia SPEC-014-B: ${result.walls.length} muros, ${result.openings.length} vanos, `
  + `${result.nodes.length} nodos, SHA-256 ${result.canonicalSha256}`
);
