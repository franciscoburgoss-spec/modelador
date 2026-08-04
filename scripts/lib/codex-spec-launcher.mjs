import { createHash, randomUUID } from 'node:crypto';
import { open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const AUDIT_SCHEMA = 'codex-effort-audit/v1';
export const AUDIT_RELATIVE_PATH = 'governance/CODEX_EXECUTIONS.jsonl';

const ORDINARY_EFFORTS = new Set(['low', 'medium', 'high']);

function tableValue(markdown, field) {
  return markdown.match(new RegExp(`^\\| ${field} \\|(.+)\\|$`, 'm'))?.[1].trim();
}

export function parseActiveSpec(status) {
  const value = tableValue(status, 'Spec activa');
  if (!value || /Ninguna/i.test(value)) {
    throw new Error('STATUS.md no declara una spec activa');
  }
  const specId = value.match(/`(SPEC-[A-Za-z0-9-]+)`/)?.[1];
  if (!specId) throw new Error('La spec activa no tiene un identificador válido');
  return specId;
}

export function parsePlannedEffort(spec) {
  if (!spec.includes('## Ejecución Codex')) {
    throw new Error('La spec activa no declara Ejecución Codex');
  }
  const effort = spec.match(/^- Esfuerzo planificado: `([^`]+)`$/m)?.[1];
  if (!ORDINARY_EFFORTS.has(effort)) {
    throw new Error('El esfuerzo planificado debe ser low, medium o high');
  }
  return effort;
}

export function parseCloseEfforts(close) {
  const plannedEffort = tableValue(close, 'Esfuerzo planificado');
  const effectiveEffort = tableValue(close, 'Esfuerzo efectivo');
  const escalation = tableValue(close, 'Escalamiento');
  if (!ORDINARY_EFFORTS.has(plannedEffort)) {
    throw new Error('El cierre no confirma un esfuerzo planificado ordinario');
  }
  if (![...ORDINARY_EFFORTS, 'xhigh'].includes(effectiveEffort)) {
    throw new Error('El cierre no confirma un esfuerzo efectivo válido');
  }
  if (!escalation) throw new Error('El cierre no declara escalamiento');
  return { plannedEffort, effectiveEffort, escalation };
}

async function findUniqueFile(directory, predicate, label) {
  const matches = (await readdir(directory)).filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`${label}: se esperaba un archivo único y se encontraron ${matches.length}`);
  }
  return matches[0];
}

export async function resolveLaunchContext(root) {
  const status = await readFile(path.join(root, 'governance/STATUS.md'), 'utf8');
  const specId = parseActiveSpec(status);
  const specsDirectory = path.join(root, 'specs');
  const specFile = await findUniqueFile(
    specsDirectory,
    (filename) => filename.endsWith('.md')
      && (filename === `${specId}.md` || filename.startsWith(`${specId}-`)),
    `Spec activa ${specId}`,
  );
  const spec = await readFile(path.join(specsDirectory, specFile), 'utf8');
  return { specId, specFile, plannedEffort: parsePlannedEffort(spec) };
}

export function promptFingerprint(prompt) {
  return {
    promptSha256: createHash('sha256').update(prompt, 'utf8').digest('hex'),
    promptLength: Buffer.byteLength(prompt, 'utf8'),
  };
}

export function buildCodexInvocation({ root, plannedEffort, prompt }) {
  if (!ORDINARY_EFFORTS.has(plannedEffort)) throw new Error('Esfuerzo no permitido');
  if (typeof prompt !== 'string' || prompt.trim() === '') throw new Error('El prompt no puede estar vacío');
  return {
    command: 'codex',
    args: [
      'exec',
      '--config',
      `model_reasoning_effort="${plannedEffort}"`,
      '--cd',
      root,
      prompt,
    ],
    options: { cwd: root, stdio: 'inherit', shell: false },
  };
}

export function describeDryRun(context, invocation, prompt) {
  const fingerprint = promptFingerprint(prompt);
  return {
    dryRun: true,
    specId: context.specId,
    specFile: context.specFile,
    plannedEffort: context.plannedEffort,
    sentEffort: context.plannedEffort,
    command: invocation.command,
    args: invocation.args.map((argument, index) => (
      index === invocation.args.length - 1
        ? `<prompt sha256:${fingerprint.promptSha256} bytes:${fingerprint.promptLength}>`
        : argument
    )),
    shell: invocation.options.shell,
    cwd: invocation.options.cwd,
    registryMutated: false,
  };
}

export async function appendAuditEvent(registryPath, event) {
  const handle = await open(registryPath, 'a');
  try {
    await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function waitForChild(child) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    child.once('error', (error) => finish({ exitCode: null, signal: null, error: error.message }));
    child.once('close', (exitCode, signal) => finish({ exitCode, signal, error: null }));
  });
}

export async function readCanonicalClose(root, specId) {
  const sessionsDirectory = path.join(root, 'sessions');
  const closeFile = await findUniqueFile(
    sessionsDirectory,
    (filename) => filename === `close-${specId}.md`,
    `Cierre ${specId}`,
  );
  const close = await readFile(path.join(sessionsDirectory, closeFile), 'utf8');
  return { closeFile, ...parseCloseEfforts(close) };
}

export async function launchCodex({
  root,
  context,
  prompt,
  registryPath = path.join(root, AUDIT_RELATIVE_PATH),
  spawnProcess = spawn,
  closeReader = readCanonicalClose,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}) {
  const invocation = buildCodexInvocation({ root, plannedEffort: context.plannedEffort, prompt });
  const executionId = createId();
  const sentEffort = context.plannedEffort;
  const common = {
    schema: AUDIT_SCHEMA,
    executionId,
    specId: context.specId,
    specFile: context.specFile,
    plannedEffort: context.plannedEffort,
    sentEffort,
  };
  await appendAuditEvent(registryPath, {
    ...common,
    type: 'launch_started',
    timestamp: now(),
    ...promptFingerprint(prompt),
  });

  let processResult;
  try {
    processResult = await waitForChild(spawnProcess(
      invocation.command,
      invocation.args,
      invocation.options,
    ));
  } catch (error) {
    processResult = { exitCode: null, signal: null, error: error.message };
  }

  let closure = null;
  let closeError = null;
  try {
    closure = await closeReader(root, context.specId);
  } catch (error) {
    closeError = error.message;
  }
  const comparison = {
    plannedEqualsSent: context.plannedEffort === sentEffort,
    plannedEqualsClose: closure?.plannedEffort === context.plannedEffort,
    sentEqualsEffective: closure?.effectiveEffort === sentEffort,
  };
  const passed = processResult.exitCode === 0
    && !processResult.signal
    && !processResult.error
    && !closeError
    && Object.values(comparison).every(Boolean);
  const completed = {
    ...common,
    type: 'launch_completed',
    timestamp: now(),
    process: processResult,
    closure,
    closeError,
    comparison,
    result: passed ? 'pass' : 'fail',
  };
  await appendAuditEvent(registryPath, completed);
  return completed;
}

export function parseAuditLog(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '').map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Registro JSONL inválido en línea ${index + 1}`);
    }
  });
}

const RETRY_IDENTITY_FIELDS = [
  'specId',
  'specFile',
  'promptSha256',
  'promptLength',
  'plannedEffort',
  'sentEffort',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function retryIdentity(event) {
  return JSON.stringify(RETRY_IDENTITY_FIELDS.map((field) => event[field]));
}

function evaluateCompletedExecution(executionId, start, completion) {
  const errors = [];
  if (!completion.closure) {
    errors.push(`${executionId}: falta cierre confirmado`);
  } else {
    if (completion.closure.plannedEffort !== start.plannedEffort) {
      errors.push(`${executionId}: cierre planificado difiere del inicio`);
    }
    if (completion.closure.effectiveEffort !== start.sentEffort) {
      errors.push(`${executionId}: cierre efectivo difiere del valor enviado`);
    }
  }
  if (completion.process?.exitCode !== 0
    || completion.process?.signal
    || completion.process?.error) {
    errors.push(`${executionId}: proceso Codex no terminó correctamente`);
  }
  if (completion.result !== 'pass') errors.push(`${executionId}: resultado no aprobado`);
  if (!completion.comparison
    || completion.comparison.plannedEqualsSent !== true
    || completion.comparison.plannedEqualsClose !== true
    || completion.comparison.sentEqualsEffective !== true) {
    errors.push(`${executionId}: comparación de esfuerzos fallida`);
  }
  return { approved: errors.length === 0, errors };
}

export function analyzeAuditEvents(events) {
  const structuralErrors = [];
  const executions = new Map();
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      structuralErrors.push(`línea ${index + 1}: evento inválido`);
      continue;
    }
    if (event.schema !== AUDIT_SCHEMA) {
      structuralErrors.push(`línea ${index + 1}: schema inválido`);
      continue;
    }
    if (!isNonEmptyString(event.executionId)) {
      structuralErrors.push(`línea ${index + 1}: falta executionId`);
      continue;
    }
    const execution = executions.get(event.executionId) ?? { starts: [], completions: [] };
    if (event.type === 'launch_started') execution.starts.push({ event, index });
    else if (event.type === 'launch_completed') execution.completions.push({ event, index });
    else structuralErrors.push(`línea ${index + 1}: tipo de evento inválido`);
    executions.set(event.executionId, execution);
  }

  const complete = [];
  for (const [executionId, execution] of executions) {
    const executionErrors = [];
    if (execution.starts.length !== 1) executionErrors.push(`${executionId}: se esperaba un inicio`);
    if (execution.completions.length !== 1) executionErrors.push(`${executionId}: se esperaba un cierre`);
    if (execution.starts.length !== 1 || execution.completions.length !== 1) {
      structuralErrors.push(...executionErrors);
      continue;
    }
    const start = execution.starts[0];
    const completion = execution.completions[0];
    if (start.index > completion.index) executionErrors.push(`${executionId}: eventos fuera de orden`);
    if (typeof start.event.timestamp !== 'string' || typeof completion.event.timestamp !== 'string') {
      executionErrors.push(`${executionId}: falta timestamp`);
    }
    if (!/^[a-f0-9]{64}$/.test(start.event.promptSha256)
      || !Number.isInteger(start.event.promptLength)
      || start.event.promptLength < 1) {
      executionErrors.push(`${executionId}: fingerprint de prompt inválido`);
    }
    for (const field of ['specId', 'specFile', 'plannedEffort', 'sentEffort']) {
      if (!isNonEmptyString(start.event[field])) {
        executionErrors.push(`${executionId}: ${field} inválido`);
      }
      if (start.event[field] !== completion.event[field]) {
        executionErrors.push(`${executionId}: ${field} cambia entre inicio y cierre`);
      }
    }
    if (!ORDINARY_EFFORTS.has(start.event.plannedEffort)) {
      executionErrors.push(`${executionId}: esfuerzo planificado inválido`);
    }
    if (start.event.sentEffort !== start.event.plannedEffort) {
      executionErrors.push(`${executionId}: enviado difiere de planificado`);
    }
    if (executionErrors.length > 0) {
      structuralErrors.push(...executionErrors);
      continue;
    }
    complete.push({
      executionId,
      start: start.event,
      completion: completion.event,
      startIndex: start.index,
      completionIndex: completion.index,
      ...evaluateCompletedExecution(executionId, start.event, completion.event),
    });
  }

  const approvedByIdentity = new Map();
  for (const execution of complete) {
    if (!execution.approved) continue;
    const identity = retryIdentity(execution.start);
    const approvals = approvedByIdentity.get(identity) ?? [];
    approvals.push(execution);
    approvedByIdentity.set(identity, approvals);
  }

  const recovered = [];
  const unrecovered = [];
  for (const execution of complete) {
    if (execution.approved) continue;
    const recovery = approvedByIdentity.get(retryIdentity(execution.start))?.find((candidate) => (
      candidate.startIndex > execution.completionIndex
    ));
    if (recovery) recovered.push({ execution, recovery });
    else unrecovered.push(execution);
  }

  return {
    errors: [
      ...structuralErrors,
      ...unrecovered.flatMap((execution) => execution.errors),
    ],
    executions: complete,
    recoveries: recovered.map(({ execution, recovery }) => ({
      failedExecutionId: execution.executionId,
      recoveryExecutionId: recovery.executionId,
    })),
    summary: {
      completedExecutions: complete.length,
      approvedExecutions: complete.filter((execution) => execution.approved).length,
      recoveredFailures: recovered.length,
      unrecoveredFailures: unrecovered.length,
    },
  };
}

export function validateAuditEvents(events) {
  return analyzeAuditEvents(events).errors;
}

export async function auditRegistry(registryPath) {
  const events = parseAuditLog(await readFile(registryPath, 'utf8'));
  return { events, ...analyzeAuditEvents(events) };
}
