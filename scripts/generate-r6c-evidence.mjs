import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modulateAllWallsFull } from '../src/core/batchModulation.js';
import { applyWallRegenerationPatch } from '../src/core/derivedInvalidation.js';
import { generateOsbFramingDxf } from '../src/core/exportOsbDxf.js';
import { generateOsbFramingSheets } from '../src/core/exportSheetsDxf.js';
import { computeTakeoff } from '../src/core/takeoff.js';

const outputArg = process.argv[2];
if (!outputArg) {
  throw new Error('Uso: node scripts/generate-r6c-evidence.mjs <directorio-salida>');
}

const outputDir = resolve(outputArg);
const fixtureUrl = new URL('../tests/fixtures/casa-L.json', import.meta.url);
const source = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const result = modulateAllWallsFull(source, {
  metalcon: source.metalconDefaults || {},
  osb: source.osbDefaults || {}
});

if (
  result.blocked.length > 0
  || result.skippedMetalcon.length > 0
  || result.skippedOsb.length > 0
  || result.patches.length !== 45
) {
  throw new Error(
    `Regeneración casa-L incompleta: ${JSON.stringify({
      patches: result.patches.length,
      skippedMetalcon: result.skippedMetalcon,
      skippedOsb: result.skippedOsb,
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
const r12 = generateOsbFramingDxf(regenerated);
const sheets = generateOsbFramingSheets(regenerated);
if (!r12 || sheets.length === 0) {
  throw new Error('No se generaron los DXF OSB esperados.');
}

const walls = regenerated.elements.filter((element) => element.type === 'wall');
const wallStats = walls.map((wall) => {
  const panels = (wall.osbCourses || []).flatMap((course) => course.panels);
  const nominalLength = Math.max(
    ...(wall.studs || [])
      .filter((piece) => Number.isFinite(piece.offset))
      .map((piece) => piece.offset)
  );
  return {
    wallId: wall.id,
    panelCount: panels.length,
    panelWidth: panels.reduce((total, panel) => total + panel.width, 0),
    nominalLength,
    osbStart: Math.min(...panels.map((panel) => panel.start)),
    osbEnd: Math.max(...panels.map((panel) => panel.end))
  };
});
const takeoff = computeTakeoff(regenerated);

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'osb-r6c-r12.dxf'), r12, 'utf8');
for (const [index, sheet] of sheets.entries()) {
  await writeFile(
    resolve(outputDir, `osb-r6c-ac1015-${index + 1}.dxf`),
    sheet.content,
    'utf8'
  );
}
await writeFile(
  resolve(outputDir, 'report.json'),
  `${JSON.stringify({
    fixture: fileURLToPath(fixtureUrl),
    walls: walls.length,
    courses: walls.reduce(
      (total, wall) => total + (wall.osbCourses?.length || 0),
      0
    ),
    panels: wallStats.reduce((total, wall) => total + wall.panelCount, 0),
    panelWidth: wallStats.reduce((total, wall) => total + wall.panelWidth, 0),
    extendedWalls: wallStats.filter((wall) => (
      wall.osbStart < -0.01 || wall.osbEnd > wall.nominalLength + 0.01
    )).length,
    retractedWalls: wallStats.filter((wall) => (
      wall.osbStart > 0.01 || wall.osbEnd < wall.nominalLength - 0.01
    )).length,
    minStart: Math.min(...wallStats.map((wall) => wall.osbStart)),
    maxExtension: Math.max(
      ...wallStats.map((wall) => wall.osbEnd - wall.nominalLength)
    ),
    osbTakeoff: takeoff.totalsByType.osb,
    framingTakeoff: takeoff.totalsByType.framing,
    dxfFiles: 1 + sheets.length,
    wallStats
  }, null, 2)}\n`,
  'utf8'
);

console.log(JSON.stringify({
  outputDir,
  dxfFiles: 1 + sheets.length,
  walls: walls.length,
  panels: wallStats.reduce((total, wall) => total + wall.panelCount, 0),
  osbBoards: takeoff.totalsByType.osb.count,
  osbArea: takeoff.totalsByType.osb.m2
}));
