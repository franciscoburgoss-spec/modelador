import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  findCalculixExecutable,
  GLOBAL_PROBE_WARNING,
  readCalculixVersion,
  runCalculixJob
} from './lib/calculix-smoke.mjs';
import { buildReferenceArtifacts } from './lib/reference-artifacts.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const commit = execFileSync(
  'git',
  ['rev-parse', '--short=12', 'HEAD'],
  { cwd: repositoryRoot, encoding: 'utf8' }
).trim();
const artifactRoot = resolve(repositoryRoot, 'artifacts', commit);
const executable = findCalculixExecutable();
const version = readCalculixVersion(executable);
const artifacts = new Map(
  buildReferenceArtifacts()
    .filter((artifact) => artifact.format === 'inp')
    .map((artifact) => [artifact.id, artifact])
);
const definitions = [
  {
    id: 'global',
    artifactId: 'inp-global',
    resultFormat: 'frd',
    probe: true,
    expectedNodeSet: 'SMOKE_GLOBAL',
    allowedWarnings: [GLOBAL_PROBE_WARNING]
  },
  {
    id: 'truss',
    artifactId: 'inp-truss',
    resultFormat: 'frd'
  },
  {
    id: 'foundations',
    artifactId: 'inp-foundations',
    resultFormat: 'dat',
    expectedNodeSet: 'NFUND'
  }
];

await mkdir(artifactRoot, { recursive: true });
const started = performance.now();
const jobs = [];
for (const definition of definitions) {
  const artifact = artifacts.get(definition.artifactId);
  if (!artifact) throw new Error(`Falta artefacto INP ${definition.artifactId}.`);
  jobs.push(await runCalculixJob({
    artifactRoot,
    executable,
    source: artifact.content,
    ...definition
  }));
}

const report = {
  schemaVersion: 1,
  commit,
  generatedAt: new Date().toISOString(),
  toolchain: {
    node: process.version,
    calculixExecutable: executable,
    calculixVersion: version
  },
  summary: {
    jobCount: jobs.length,
    passed: jobs.filter((job) => job.status === 0).length,
    warningCount: jobs.reduce((total, job) => total + job.warnings.length, 0),
    sourceBytes: jobs.reduce((total, job) => total + job.sourceBytes, 0),
    resultNodes: jobs.reduce((total, job) => total + job.result.nodeCount, 0),
    resultValues: jobs.reduce((total, job) => total + job.result.valueCount, 0),
    durationMs: Number((performance.now() - started).toFixed(1))
  },
  jobs
};
const reportPath = resolve(artifactRoot, 'smoke-ccx.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (
  report.summary.jobCount !== 3
  || report.summary.passed !== 3
  || report.summary.warningCount !== 1
) {
  throw new Error(`Smoke CalculiX incompleto: ${JSON.stringify(report.summary)}.`);
}

console.log(JSON.stringify({
  report: `artifacts/${commit}/smoke-ccx.json`,
  calculix: version,
  ...report.summary
}));
