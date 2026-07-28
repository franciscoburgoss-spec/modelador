import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

import {
  appendCalculixKinematicProbe,
  assertCalculixDisplacements,
  assertCalculixInpContract,
  assertCalculixSolverCompletion,
  parseCalculixDatDisplacements,
  parseCalculixFrdDisplacements
} from '../../src/core/calculixResults.js';

export const GLOBAL_PROBE_WARNING = '*WARNING: no degrees of freedom in the model';

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resuelve CCX sin shell: override explícito, PATH y ubicaciones estándar del Mac objetivo. */
export function findCalculixExecutable(environment = process.env) {
  const candidates = [];
  if (environment.CCX_BIN) candidates.push(environment.CCX_BIN);
  for (const directory of String(environment.PATH || '').split(delimiter).filter(Boolean)) {
    candidates.push(join(directory, 'ccx'));
  }
  candidates.push('/usr/local/bin/ccx', '/opt/homebrew/bin/ccx');

  for (const candidate of candidates) {
    const absolute = isAbsolute(candidate) ? candidate : resolve(candidate);
    if (isExecutable(absolute)) return absolute;
  }
  throw new Error(
    'No se encontró CalculiX. Configure CCX_BIN o instale ccx en PATH.'
  );
}

export function readCalculixVersion(executable, spawn = spawnSync) {
  const result = spawn(executable, ['-v'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/\bVersion\s+([0-9][^\s]*)/i);
  if (!match) throw new Error(`No se pudo leer la versión de CalculiX: ${output.trim()}.`);
  return match[1];
}

function assertExpectedNodeSet(contract, expectedNodeSet) {
  if (!expectedNodeSet) return;
  const actual = contract.nodeSets.get(expectedNodeSet);
  if (!actual) throw new Error(`El INP no declara NSET=${expectedNodeSet}.`);
  const missing = [...contract.nodeIds].filter((id) => !actual.has(id));
  const alien = [...actual].filter((id) => !contract.nodeIds.has(id));
  if (missing.length > 0 || alien.length > 0) {
    throw new Error(
      `NSET=${expectedNodeSet} no coincide con los nodos del job; `
      + `faltan=[${missing.join(',')}], ajenos=[${alien.join(',')}].`
    );
  }
}

function parseResult(format, content) {
  return format === 'dat'
    ? parseCalculixDatDisplacements(content)
    : parseCalculixFrdDisplacements(content);
}

/**
 * Ejecuta un job aislado. `spawn` es inyectable sólo para probar el adaptador; siempre recibe
 * el ejecutable y `['job']` como argumentos directos.
 */
export async function runCalculixJob({
  artifactRoot,
  executable,
  id,
  source,
  resultFormat,
  probe = false,
  expectedNodeSet = null,
  allowedWarnings = [],
  spawn = spawnSync
}) {
  const sourceContract = assertCalculixInpContract(source);
  const executed = probe ? appendCalculixKinematicProbe(source) : source;
  const executedContract = assertCalculixInpContract(executed);
  assertExpectedNodeSet(executedContract, expectedNodeSet);

  const jobDirectory = resolve(artifactRoot, 'ccx', id);
  rmSync(jobDirectory, { recursive: true, force: true });
  await mkdir(jobDirectory, { recursive: true });
  writeFileSync(resolve(jobDirectory, 'source.inp'), source, 'utf8');
  writeFileSync(resolve(jobDirectory, 'job.inp'), executed, 'utf8');

  const started = performance.now();
  const result = spawn(executable, ['job'], {
    cwd: jobDirectory,
    encoding: 'utf8'
  });
  const durationMs = Number((performance.now() - started).toFixed(1));
  if (result.error) throw result.error;
  const completion = assertCalculixSolverCompletion(result, { allowedWarnings });

  const resultPath = resolve(jobDirectory, `job.${resultFormat}`);
  if (!existsSync(resultPath) || statSync(resultPath).size === 0) {
    throw new Error(`${id}: CalculiX no produjo job.${resultFormat} no vacío.`);
  }
  const resultContent = readFileSync(resultPath, 'utf8');
  const displacements = parseResult(resultFormat, resultContent);
  const resultSummary = assertCalculixDisplacements(
    displacements,
    executedContract.nodeIds
  );

  return {
    id,
    status: result.status,
    probeApplied: probe,
    expectedNodeSet,
    warnings: completion.warnings,
    sourceSha256: sha256(source),
    executedSha256: sha256(executed),
    sourceBytes: Buffer.byteLength(source),
    executedBytes: Buffer.byteLength(executed),
    input: {
      nodeCount: sourceContract.nodeIds.size,
      elementSetCount: sourceContract.elementSets.size,
      sectionReferenceCount: sourceContract.sectionReferences.length,
      maxSetNameLength: sourceContract.maxSetNameLength
    },
    result: {
      format: resultFormat,
      bytes: statSync(resultPath).size,
      ...resultSummary
    },
    durationMs
  };
}
