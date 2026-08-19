import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseAuditLog, validateAuditEvents } from './lib/codex-spec-launcher.mjs';
import { validateReasoningEffortGovernance } from './lib/reasoning-effort-governance.mjs';
import { validateScopeLockGovernance } from './lib/scope-lock-governance.mjs';
import { validateSpecDocumentContract } from './lib/spec-document-contract.mjs';

const root = process.cwd();
const required = [
  'README.md',
  'AGENTS.md',
  'docs/FOUNDATION.md',
  'docs/SECURITY_AND_DATA.md',
  'governance/STATUS.md',
  'governance/PROTOCOL.md',
  'governance/DECISIONS.md',
  'governance/CODEX_EXECUTIONS.jsonl',
  'governance/RISKS.md',
  'governance/REASONING_EFFORT.md',
  'governance/TRACEABILITY.md',
  'governance/QUALITY_GATES.md',
  'governance/ROADMAP.md',
  'harness/README.md',
  'harness/FIXTURES.md',
  'harness/MANUAL_SMOKE.md',
  'specs/SPEC-000-bootstrap-reproducible.md',
  'specs/SPEC-001-model-security-integrity.md',
  'specs/SPEC-002-derived-state-and-exports.md',
  'specs/SPEC-003-verification-harness.md',
  'specs/SPEC-004-native-runtime-persistence.md',
  'specs/SPEC-005-release-readiness.md',
];

const errors = [];

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const relativePath of required) {
  if (!(await exists(relativePath))) errors.push(`Falta ${relativePath}`);
}

async function markdownFiles(directory = root) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(absolute));
    if (entry.isFile() && entry.name.endsWith('.md')) result.push(absolute);
  }
  return result;
}

for (const absolute of await markdownFiles()) {
  const content = await readFile(absolute, 'utf8');
  const relative = path.relative(root, absolute);
  const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1].split('#')[0];
    if (!target || /^(https?:|mailto:|\/)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(absolute), target);
    if (!(await exists(path.relative(root, resolved)))) {
      errors.push(`${relative}: enlace roto a ${target}`);
    }
  }
}

const traceability = await readFile(path.join(root, 'governance/TRACEABILITY.md'), 'utf8');
const requirementIds = [...traceability.matchAll(/\|\s*(REQ-[A-Z]+-\d{3})\s*\|/g)].map(m => m[1]);
const uniqueRequirements = new Set(requirementIds);
if (requirementIds.length !== uniqueRequirements.size) {
  errors.push('TRACEABILITY.md contiene requisitos duplicados');
}
if (requirementIds.length < 20) {
  errors.push(`TRACEABILITY.md sólo contiene ${requirementIds.length} requisitos`);
}

const decisions = await readFile(path.join(root, 'governance/DECISIONS.md'), 'utf8');
const decisionIds = [...decisions.matchAll(/\|\s*(D-\d{3})\s*\|/g)].map(m => m[1]);
if (decisionIds.length !== new Set(decisionIds).size) {
  errors.push('DECISIONS.md contiene ids duplicados');
}

const effortPolicy = await readFile(
  path.join(root, 'governance/REASONING_EFFORT.md'),
  'utf8'
);
const status = await readFile(path.join(root, 'governance/STATUS.md'), 'utf8');
const specTemplate = await readFile(path.join(root, 'templates/SPEC.md'), 'utf8');
const closeTemplate = await readFile(path.join(root, 'templates/SESSION_CLOSE.md'), 'utf8');
const specEntries = Object.fromEntries(await Promise.all(
  (await readdir(path.join(root, 'specs')))
    .filter((filename) => filename.endsWith('.md'))
    .map(async (filename) => [
      filename,
      await readFile(path.join(root, 'specs', filename), 'utf8'),
    ])
));
errors.push(...validateReasoningEffortGovernance({
  effortPolicy,
  status,
  specs: specEntries,
  specTemplate,
  closeTemplate,
}));

errors.push(...validateScopeLockGovernance({
  status,
  decisions,
  specs: specEntries,
}));

try {
  const codexAudit = await readFile(path.join(root, 'governance/CODEX_EXECUTIONS.jsonl'), 'utf8');
  errors.push(...validateAuditEvents(parseAuditLog(codexAudit)).map((error) => (
    `CODEX_EXECUTIONS.jsonl: ${error}`
  )));
} catch (error) {
  errors.push(`CODEX_EXECUTIONS.jsonl: ${error.message}`);
}

for (const filename of await readdir(path.join(root, 'specs'))) {
  if (!filename.startsWith('SPEC-') || !filename.endsWith('.md')) continue;
  const content = await readFile(path.join(root, 'specs', filename), 'utf8');
  errors.push(...validateSpecDocumentContract(filename, content));
}

try {
  const manifest = JSON.parse(await readFile(path.join(root, 'specs/MANIFEST.json'), 'utf8'));
  if (!Array.isArray(manifest.files)) {
    errors.push('specs/MANIFEST.json: files debe ser un arreglo');
  } else {
    const names = new Set();
    for (const [index, entry] of manifest.files.entries()) {
      const prefix = `specs/MANIFEST.json files[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`${prefix}: la entrada debe ser un objeto`);
        continue;
      }
      if (typeof entry.name !== 'string' || entry.name.length === 0) {
        errors.push(`${prefix}: falta name`);
        continue;
      }
      if (names.has(entry.name)) errors.push(`${prefix}: name duplicado ${entry.name}`);
      names.add(entry.name);
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) errors.push(`${prefix}: bytes inválido`);
      if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) errors.push(`${prefix}: sha256 inválido`);
      if (!(await exists(path.posix.join('specs', entry.name)))) errors.push(`${prefix}: archivo inexistente ${entry.name}`);
    }
  }
} catch (error) {
  errors.push(`specs/MANIFEST.json: ${error.message}`);
}

if (errors.length > 0) {
  console.error(`Gobernanza inválida (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Gobernanza válida: ${required.length} archivos requeridos, ` +
  `${requirementIds.length} requisitos y ${decisionIds.length} decisiones.`,
);
