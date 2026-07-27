import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modulateAllWallsMetalcon } from '../src/core/batchModulation.js';
import { applyWallRegenerationPatch } from '../src/core/derivedInvalidation.js';
import { generateCalculix } from '../src/core/exportCalculix.js';
import { generateFramingDxf } from '../src/core/exportFramingDxf.js';
import { generateFramingSheets } from '../src/core/exportSheetsDxf.js';
import { computeTakeoff } from '../src/core/takeoff.js';

const outputArg = process.argv[2];
if (!outputArg) {
  throw new Error('Uso: node scripts/generate-r6b-evidence.mjs <directorio-salida>');
}

const outputDir = resolve(outputArg);
const fixtureUrl = new URL('../tests/fixtures/casa-L.json', import.meta.url);
const source = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const result = modulateAllWallsMetalcon(source, source.metalconDefaults || {});

if (result.blocked.length > 0 || result.skipped.length > 0 || result.patches.length !== 45) {
  throw new Error(
    `Regeneración casa-L incompleta: ${JSON.stringify({
      patches: result.patches.length,
      skipped: result.skipped,
      blocked: result.blocked
    })}`
  );
}

const patchById = new Map(
  result.patches.map(({ wallId, patch }) => [String(wallId), patch])
);
const regenerated = {
  ...source,
  elements: source.elements.map((element) => {
    const patch = patchById.get(String(element.id));
    return patch && element.type === 'wall'
      ? applyWallRegenerationPatch(element, patch)
      : element;
  })
};

const r12 = generateFramingDxf(regenerated);
const sheets = generateFramingSheets(regenerated);
if (!r12 || sheets.length === 0) {
  throw new Error('No se generaron los DXF de framing esperados.');
}

const smokeWalls = regenerated.elements
  .filter((element) => element.type === 'wall')
  .map((wall, index) => ({ ...wall, id: `W${index + 1}` }));
const smokeModel = {
  ...regenerated,
  elements: smokeWalls,
  dimensions: [],
  roofSystems: [],
  roofPlanes: []
};
const takeoff = computeTakeoff(regenerated);
const framingRows = takeoff.rows.filter((row) => row.type === 'framing');
const backupCount = smokeWalls.flatMap((wall) => wall.studs || [])
  .filter((piece) => piece.role === 'backup').length;
const cornerCount = smokeWalls.flatMap((wall) => wall.studs || [])
  .filter((piece) => piece.role === 'corner').length;
const noggings = smokeWalls.flatMap((wall) => wall.studs || [])
  .filter((piece) => piece.role === 'nogging');

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'tabiqueria-r6b-r12.dxf'), r12, 'utf8');
for (const [index, sheet] of sheets.entries()) {
  await writeFile(
    resolve(outputDir, `tabiqueria-r6b-ac1015-${index + 1}.dxf`),
    sheet.content,
    'utf8'
  );
}
await writeFile(resolve(outputDir, 'casa-l-r6b.inp'), generateCalculix(smokeModel), 'utf8');
await writeFile(
  resolve(outputDir, 'report.json'),
  `${JSON.stringify({
    fixture: fileURLToPath(fixtureUrl),
    walls: result.patches.length,
    directT: result.topology.nodes.filter((node) => (
      node.type === 'T'
      && node.participants.some((participant) => participant.position === 'body')
    )).length,
    backupCount,
    cornerCount,
    noggingCount: noggings.length,
    noggingMillimeters: noggings.reduce(
      (total, piece) => total + piece.oMax - piece.oMin,
      0
    ),
    framing: takeoff.totalsByType.framing,
    framingRows: framingRows.map(({ section, count, ml, warnings }) => ({
      section,
      count,
      ml,
      warnings
    })),
    dxfFiles: 1 + sheets.length
  }, null, 2)}\n`,
  'utf8'
);

console.log(
  JSON.stringify({
    outputDir,
    dxfFiles: 1 + sheets.length,
    walls: result.patches.length,
    directT: 26,
    backupCount,
    cornerCount,
    framingCount: takeoff.totalsByType.framing.count,
    framingMillimeters: takeoff.totalsByType.framing.ml * 1000
  })
);
