import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  buildDxfQualityArtifacts,
  buildReferenceArtifacts,
  buildReferenceModels
} from './lib/reference-artifacts.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const python = resolve(repositoryRoot, '.venv-verification/bin/python');
const auditorScript = resolve(repositoryRoot, 'scripts/audit-dxf.py');
const commit = execFileSync(
  'git',
  ['rev-parse', '--short=12', 'HEAD'],
  { cwd: repositoryRoot, encoding: 'utf8' }
).trim();
const artifactRoot = resolve(repositoryRoot, 'artifacts', commit);
const dxfDirectory = resolve(artifactRoot, 'dxf');
const referenceModels = buildReferenceModels();
const baselineDxfArtifacts = buildReferenceArtifacts(referenceModels).filter(
  (artifact) => artifact.format === 'dxf'
);
const dxfArtifacts = [
  ...baselineDxfArtifacts,
  ...buildDxfQualityArtifacts(referenceModels)
];

function qualityMetadata(artifact) {
  if (artifact.qualityFamily) {
    return {
      qualityFamily: artifact.qualityFamily,
      sheetFormat: artifact.sheetFormat
    };
  }
  const familyByArtifactFamily = {
    foundations: 'foundations',
    'framing-a3': 'framing',
    'osb-a3': 'osb',
    'truss-a3': 'truss'
  };
  const qualityFamily = familyByArtifactFamily[artifact.family];
  return qualityFamily
    ? { qualityFamily, sheetFormat: artifact.variant }
    : { qualityFamily: null, sheetFormat: null };
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function relativeArtifactPath(filename) {
  return `artifacts/${commit}/dxf/${filename}`;
}

await mkdir(dxfDirectory, { recursive: true });
const manifest = [];
const paths = [];
for (const artifact of dxfArtifacts) {
  const path = resolve(dxfDirectory, artifact.filename);
  await writeFile(path, artifact.content, 'utf8');
  paths.push(path);
  manifest.push({
    id: artifact.id,
    family: artifact.family,
    variant: artifact.variant,
    sourceFixture: artifact.sourceFixture,
    referenceKind: artifact.qualityFamily ? 'quality-matrix' : 'baseline',
    ...qualityMetadata(artifact),
    path: relativeArtifactPath(artifact.filename),
    sha256: sha256(artifact.content)
  });
}
await writeFile(
  resolve(dxfDirectory, 'manifest.json'),
  `${JSON.stringify({ schemaVersion: 1, commit, files: manifest }, null, 2)}\n`,
  'utf8'
);

const started = performance.now();
const result = spawnSync(
  python,
  [auditorScript, ...paths],
  { cwd: repositoryRoot, encoding: 'utf8' }
);
if (result.error) {
  if (result.error.code === 'ENOENT') {
    throw new Error(
      'Falta .venv-verification/bin/python. Ejecute npm run setup:verification-python.'
    );
  }
  throw result.error;
}
if (result.status !== 0) {
  throw new Error(
    `La auditoría DXF terminó con código ${result.status}: ${result.stderr || result.stdout}`
  );
}

const pythonReport = JSON.parse(result.stdout);
const metadataByFilename = new Map(
  manifest.map((entry) => [entry.path.split('/').at(-1), entry])
);
const files = pythonReport.files.map((file) => ({
  ...metadataByFilename.get(file.filename),
  dxfVersion: file.dxfVersion,
  layouts: file.layouts,
  errors: file.errors,
  repairs: file.repairs,
  quality: file.quality
}));
const families = [...new Set(files.map((file) => file.family))].sort();
const baselineFiles = files.filter((file) => file.referenceKind === 'baseline');
const sheetFiles = files.filter((file) => file.quality);
const qualityCombinations = [...new Set(
  sheetFiles.map((file) => `${file.qualityFamily}:${file.sheetFormat}`)
)].sort();
const qualityFailures = sheetFiles.reduce((total, file) => {
  const quality = file.quality;
  return total
    + quality.clippedEntities
    + quality.unlockedViewports.length
    + quality.paperOverflowViewports.length
    + Object.keys(quality.headerMismatches).length
    + Number(!quality.headerExtentsContainModel)
    + Number(quality.viewportLayerPlots)
    + quality.blankSubclassMarkers;
}, 0);
const report = {
  schemaVersion: 1,
  commit,
  generatedAt: new Date().toISOString(),
  toolchain: {
    node: process.version,
    pythonExecutable: '.venv-verification/bin/python',
    ezdxf: pythonReport.ezdxfVersion
  },
  summary: {
    familyCount: new Set(baselineFiles.map((file) => file.family)).size,
    baselineFileCount: baselineFiles.length,
    fileCount: files.length,
    errors: files.reduce((total, file) => total + file.errors, 0),
    repairs: files.reduce((total, file) => total + file.repairs, 0),
    sheetFileCount: sheetFiles.length,
    qualityCombinationCount: qualityCombinations.length,
    qualityFailures,
    durationMs: Number((performance.now() - started).toFixed(1))
  },
  families,
  qualityCombinations,
  files
};
const reportPath = resolve(artifactRoot, 'audit-dxf.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (
  report.summary.familyCount !== 8
  || report.summary.baselineFileCount !== 9
  || report.summary.fileCount !== 14
  || report.summary.errors !== 0
  || report.summary.repairs !== 0
  || report.summary.sheetFileCount !== 10
  || report.summary.qualityCombinationCount !== 8
  || report.summary.qualityFailures !== 0
) {
  throw new Error(
    `Auditoría DXF fallida: ${JSON.stringify(report.summary)}. Reporte: ${reportPath}`
  );
}

console.log(JSON.stringify({
  report: `artifacts/${commit}/audit-dxf.json`,
  ezdxf: report.toolchain.ezdxf,
  ...report.summary
}));
