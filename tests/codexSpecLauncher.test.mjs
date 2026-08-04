import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  AUDIT_SCHEMA,
  analyzeAuditEvents,
  auditRegistry,
  buildCodexInvocation,
  describeDryRun,
  launchCodex,
  parseActiveSpec,
  parseCloseEfforts,
  parsePlannedEffort,
  resolveLaunchContext,
  validateAuditEvents,
} from '../scripts/lib/codex-spec-launcher.mjs';

const context = {
  specId: 'SPEC-X',
  specFile: 'SPEC-X-test.md',
  plannedEffort: 'medium',
};

const retryIdentity = {
  specId: 'SPEC-X',
  specFile: 'SPEC-X-test.md',
  plannedEffort: 'medium',
  sentEffort: 'medium',
  promptSha256: 'a'.repeat(64),
  promptLength: 10,
};

function executionEvents(executionId, { approved, identity = {}, completion = {} }) {
  const fields = { ...retryIdentity, ...identity };
  const common = {
    schema: AUDIT_SCHEMA,
    executionId,
    specId: fields.specId,
    specFile: fields.specFile,
    plannedEffort: fields.plannedEffort,
    sentEffort: fields.sentEffort,
    timestamp: '2026-08-03T00:00:00.000Z',
  };
  return [
    {
      ...common,
      type: 'launch_started',
      promptSha256: fields.promptSha256,
      promptLength: fields.promptLength,
    },
    {
      ...common,
      type: 'launch_completed',
      process: { exitCode: approved ? 0 : 1, signal: null, error: null },
      closure: {
        plannedEffort: fields.plannedEffort,
        effectiveEffort: fields.sentEffort,
      },
      comparison: {
        plannedEqualsSent: true,
        plannedEqualsClose: true,
        sentEqualsEffective: true,
      },
      result: approved ? 'pass' : 'fail',
      ...completion,
    },
  ];
}

test('lee la spec activa, el esfuerzo ordinario y la confirmación del cierre', () => {
  assert.equal(parseActiveSpec('| Spec activa | `SPEC-X` — prueba |'), 'SPEC-X');
  assert.equal(parsePlannedEffort(`
## Ejecución Codex

- Esfuerzo planificado: \`medium\`
`), 'medium');
  assert.deepEqual(parseCloseEfforts(`
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |
`), { plannedEffort: 'medium', effectiveEffort: 'medium', escalation: 'No' });
  assert.throws(() => parsePlannedEffort(`
## Ejecución Codex
- Esfuerzo planificado: \`xhigh\`
`), /low, medium o high/);
});

test('resuelve un único archivo para la spec activa y rechaza ambigüedad', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codex-context-'));
  await mkdir(path.join(temporary, 'governance'));
  await mkdir(path.join(temporary, 'specs'));
  await writeFile(
    path.join(temporary, 'governance/STATUS.md'),
    '| Spec activa | `SPEC-X` — prueba |\n',
    'utf8',
  );
  const spec = '## Ejecución Codex\n\n- Esfuerzo planificado: `medium`\n';
  await writeFile(path.join(temporary, 'specs/SPEC-X-one.md'), spec, 'utf8');
  assert.deepEqual(await resolveLaunchContext(temporary), {
    specId: 'SPEC-X',
    specFile: 'SPEC-X-one.md',
    plannedEffort: 'medium',
  });
  await writeFile(path.join(temporary, 'specs/SPEC-X-two.md'), spec, 'utf8');
  await assert.rejects(() => resolveLaunchContext(temporary), /se encontraron 2/);
});

test('construye argumentos separados y desactiva el shell para un prompt adversario', () => {
  const prompt = 'continúa; touch /tmp/no-debe-existir && $(id) `whoami`';
  const invocation = buildCodexInvocation({ root: '/repo con espacio', plannedEffort: 'medium', prompt });
  assert.deepEqual(invocation.args, [
    'exec',
    '--config',
    'model_reasoning_effort="medium"',
    '--cd',
    '/repo con espacio',
    prompt,
  ]);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.cwd, '/repo con espacio');
});

test('dry-run no expone el prompt y declara que no mutó el registro', () => {
  const prompt = 'dato sensible; $(touch /tmp/no)';
  const invocation = buildCodexInvocation({ root: '/repo', plannedEffort: 'medium', prompt });
  const report = describeDryRun(context, invocation, prompt);
  assert.equal(report.registryMutated, false);
  assert.equal(report.shell, false);
  assert.equal(JSON.stringify(report).includes(prompt), false);
  assert.match(report.args.at(-1), /^<prompt sha256:[a-f0-9]{64} bytes:/);
});

test('registra inicio y cierre sin prompt, e inyecta spawn sin shell', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codex-launcher-'));
  const registryPath = path.join(temporary, 'audit.jsonl');
  const prompt = 'secreto && touch /tmp/no';
  let observed;
  const spawnProcess = (command, args, options) => {
    observed = { command, args, options };
    const child = new EventEmitter();
    Promise.resolve().then(() => child.emit('close', 0, null));
    return child;
  };
  const result = await launchCodex({
    root: temporary,
    context,
    prompt,
    registryPath,
    spawnProcess,
    closeReader: async () => ({
      closeFile: 'close-SPEC-X.md',
      plannedEffort: 'medium',
      effectiveEffort: 'medium',
      escalation: 'No',
    }),
    createId: () => 'execution-1',
    now: () => '2026-08-03T00:00:00.000Z',
  });
  assert.equal(observed.options.shell, false);
  assert.equal(observed.args.at(-1), prompt);
  assert.equal(result.result, 'pass');
  const text = await readFile(registryPath, 'utf8');
  assert.equal(text.includes(prompt), false);
  const report = await auditRegistry(registryPath);
  assert.deepEqual(report.errors, []);
  assert.equal(report.events.length, 2);
});

test('auditor rechaza ejecución incompleta y discrepancia con el cierre', () => {
  const common = {
    schema: AUDIT_SCHEMA,
    executionId: 'execution-2',
    specId: 'SPEC-X',
    specFile: 'SPEC-X-test.md',
    plannedEffort: 'medium',
    sentEffort: 'medium',
    timestamp: '2026-08-03T00:00:00.000Z',
    promptSha256: 'a'.repeat(64),
    promptLength: 10,
  };
  assert.ok(validateAuditEvents([{ ...common, type: 'launch_started' }]).some((error) => (
    error.includes('se esperaba un cierre')
  )));
  const errors = validateAuditEvents([
    { ...common, type: 'launch_started' },
    {
      ...common,
      type: 'launch_completed',
      closure: { plannedEffort: 'medium', effectiveEffort: 'high' },
      comparison: {
        plannedEqualsSent: true,
        plannedEqualsClose: true,
        sentEqualsEffective: false,
      },
      process: { exitCode: 0, signal: null, error: null },
      result: 'fail',
    },
  ]);
  assert.ok(errors.some((error) => error.includes('resultado no aprobado')));
  assert.ok(errors.some((error) => error.includes('comparación de esfuerzos fallida')));
  assert.ok(errors.some((error) => error.includes('cierre efectivo difiere')));
  assert.ok(validateAuditEvents([
    { ...common, type: 'launch_completed' },
    { ...common, type: 'launch_started' },
  ]).some((error) => error.includes('fuera de orden')));
  assert.ok(validateAuditEvents([
    { ...common, type: 'launch_started' },
    { ...common, type: 'launch_started' },
  ]).some((error) => error.includes('se esperaba un inicio')));
});

test('un fallo al crear el proceso conserva eventos de inicio y fallo', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codex-spawn-fail-'));
  const registryPath = path.join(temporary, 'audit.jsonl');
  const result = await launchCodex({
    root: temporary,
    context,
    prompt: 'prueba',
    registryPath,
    spawnProcess: () => { throw new Error('codex ausente'); },
    closeReader: async () => { throw new Error('cierre ausente'); },
    createId: () => 'execution-fail',
    now: () => '2026-08-03T00:00:00.000Z',
  });
  assert.equal(result.result, 'fail');
  const report = await auditRegistry(registryPath);
  assert.equal(report.events.length, 2);
  assert.ok(report.errors.some((error) => error.includes('proceso Codex')));
  assert.ok(report.errors.some((error) => error.includes('falta cierre')));
});

test('auditor informa JSONL corrupto con número de línea', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codex-audit-'));
  const registryPath = path.join(temporary, 'audit.jsonl');
  await writeFile(registryPath, '{no-json}\n', 'utf8');
  await assert.rejects(() => auditRegistry(registryPath), /línea 1/);
});

test('un fallo completo queda recuperado sólo por una aprobación posterior de identidad exacta', () => {
  const report = analyzeAuditEvents([
    ...executionEvents('failed', { approved: false }),
    ...executionEvents('recovery', { approved: true }),
  ]);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.recoveries, [{
    failedExecutionId: 'failed',
    recoveryExecutionId: 'recovery',
  }]);
  assert.deepEqual(report.summary, {
    completedExecutions: 2,
    approvedExecutions: 1,
    recoveredFailures: 1,
    unrecoveredFailures: 0,
  });
});

test('cada campo de la identidad impide recuperar un fallo cuando cambia', () => {
  const variants = [
    { specId: 'SPEC-Y' },
    { specFile: 'SPEC-X-other.md' },
    { promptSha256: 'b'.repeat(64) },
    { promptLength: 11 },
    { plannedEffort: 'high', sentEffort: 'high' },
    { sentEffort: 'high' },
  ];
  for (const [index, identity] of variants.entries()) {
    const report = analyzeAuditEvents([
      ...executionEvents(`failed-${index}`, { approved: false }),
      ...executionEvents(`different-${index}`, { approved: true, identity }),
    ]);
    assert.equal(report.summary.recoveredFailures, 0, JSON.stringify(identity));
    assert.equal(report.summary.unrecoveredFailures, 1, JSON.stringify(identity));
    assert.ok(report.errors.length > 0, JSON.stringify(identity));
  }
});

test('una aprobación anterior no recupera un fallo posterior', () => {
  const report = analyzeAuditEvents([
    ...executionEvents('previous-pass', { approved: true }),
    ...executionEvents('later-failure', { approved: false }),
  ]);
  assert.equal(report.summary.recoveredFailures, 0);
  assert.equal(report.summary.unrecoveredFailures, 1);
  assert.ok(report.errors.some((error) => error.includes('later-failure')));
});

test('pendientes, duplicados, desordenados y campos inválidos no sirven como recuperación', () => {
  const [pending] = executionEvents('pending', { approved: true });
  const duplicate = executionEvents('duplicate', { approved: true });
  const outOfOrder = executionEvents('out-of-order', { approved: true }).reverse();
  const invalid = executionEvents('invalid', {
    approved: true,
    identity: { promptSha256: 'no-es-un-hash' },
  });
  const report = analyzeAuditEvents([
    pending,
    ...duplicate,
    duplicate[0],
    ...outOfOrder,
    ...invalid,
  ]);
  assert.ok(report.errors.some((error) => error.includes('pending: se esperaba un cierre')));
  assert.ok(report.errors.some((error) => error.includes('duplicate: se esperaba un inicio')));
  assert.ok(report.errors.some((error) => error.includes('out-of-order: eventos fuera de orden')));
  assert.ok(report.errors.some((error) => error.includes('invalid: fingerprint de prompt inválido')));
  assert.equal(report.summary.completedExecutions, 0);
});

test('el registro real conserva y reconoce el reintento exacto de SPEC-006-D', async () => {
  const report = await auditRegistry(path.join(process.cwd(), 'governance/CODEX_EXECUTIONS.jsonl'));
  assert.ok(report.events.some((event) => (
    event.executionId === '805966c7-465f-4549-8195-6ed8ec784425'
  )));
  assert.ok(report.events.some((event) => (
    event.executionId === '85ed2fcd-c5b8-4ce3-9c59-b6793ddfd03b'
  )));
  assert.ok(report.recoveries.some((recovery) => (
    recovery.failedExecutionId === '805966c7-465f-4549-8195-6ed8ec784425'
      && recovery.recoveryExecutionId === '85ed2fcd-c5b8-4ce3-9c59-b6793ddfd03b'
  )));
});
