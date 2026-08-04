#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import {
  AUDIT_RELATIVE_PATH,
  auditRegistry,
  buildCodexInvocation,
  describeDryRun,
  launchCodex,
  resolveLaunchContext,
} from './lib/codex-spec-launcher.mjs';

function usage() {
  return [
    'Uso:',
    '  npm run codex:spec -- "instrucción para la spec activa"',
    '  npm run codex:dry-run -- "instrucción para la spec activa"',
    '  npm run codex:audit',
  ].join('\n');
}

const root = process.cwd();
const args = process.argv.slice(2);
const audit = args[0] === '--audit';
const dryRun = args[0] === '--dry-run';
const promptArgs = dryRun ? args.slice(1) : args;

try {
  if (audit) {
    if (args.length !== 1) throw new Error('--audit no acepta argumentos adicionales');
    const report = await auditRegistry(path.join(root, AUDIT_RELATIVE_PATH));
    const summary = `${report.summary.completedExecutions} ejecuciones completas, `
      + `${report.summary.recoveredFailures} fallidas recuperadas, `
      + `${report.summary.unrecoveredFailures} fallidas no recuperadas.`;
    if (report.errors.length > 0) {
      throw new Error(`Registro Codex inválido: ${summary}\n- ${report.errors.join('\n- ')}`);
    }
    console.log(`Registro Codex válido: ${summary}`);
  } else {
    if (promptArgs.length !== 1) throw new Error(usage());
    const [prompt] = promptArgs;
    const context = await resolveLaunchContext(root);
    if (dryRun) {
      const invocation = buildCodexInvocation({
        root,
        plannedEffort: context.plannedEffort,
        prompt,
      });
      console.log(JSON.stringify(describeDryRun(context, invocation, prompt), null, 2));
    } else {
      const result = await launchCodex({ root, context, prompt });
      if (result.result !== 'pass') process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
