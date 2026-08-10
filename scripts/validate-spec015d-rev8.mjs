import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const full = process.argv.includes('--full');
const noGitTag = 'spec015d-rev8-no-git';

function run(command, args = [], options = {}) {
  const rendered = [command, ...args].join(' ');
  console.log(`\n==> ${rendered}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${rendered} terminó con código ${result.status}.`);
}

function assertToolchain() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major !== 22) throw new Error(`REV8 requiere Node 22; activo: ${process.version}.`);
  const npm = execFileSync('npm', ['--version'], { cwd: root, encoding: 'utf8' }).trim();
  const npmMajor = Number(npm.split('.')[0]);
  if (npmMajor !== 10) throw new Error(`REV8 requiere npm 10; activo: ${npm}.`);
  console.log(`PASS - toolchain Node ${process.version} / npm ${npm}`);
}

async function walkFiles(dir, relative = '') {
  const excludedNames = new Set(['.git', 'node_modules', 'dist', 'coverage', 'artifacts', '__pycache__', 'playwright-report', 'test-results']);
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    if (entry.isDirectory() && (excludedNames.has(entry.name) || entry.name === 'target' || entry.name.startsWith('.venv'))) continue;
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(absolute, rel));
    else if (entry.isFile()) output.push(rel);
  }
  return output;
}

async function verifyNoGitInventory() {
  const files = await walkFiles(root);
  const forbidden = [
    /(^|\/)\.vite(\/|$)/, /\.log$/, /\.tmp$/, /vite\.config\.js\.timestamp-/,
    /(^|\/)lab\/roofPlane\/ejeA-planta\.svg$/
  ];
  const violations = files.filter((file) => forbidden.some((pattern) => pattern.test(file)));
  if (violations.length) throw new Error(`Inventario sin Git contiene artefactos prohibidos:\n${violations.join('\n')}`);
  console.log(`PASS - inventario sin Git: ${files.length} archivos fuente/documentales inspeccionados.`);
}

async function assertRev8StaticContracts() {
  const interfaceSource = await readFile(path.join(root, 'src/core/structuralInterfaces.js'), 'utf8');
  const intentSource = await readFile(path.join(root, 'src/core/structuralIntent.js'), 'utf8');
  const pathsSource = await readFile(path.join(root, 'src/core/candidateLoadPaths.js'), 'utf8');
  const evidence = JSON.parse(await readFile(path.join(root, 'evidence/spec-015-d-rev8/FX-008-SPEC-015-D-REV8.json'), 'utf8'));
  for (const required of ["'positiveN'", "'negativeN'", "'lowS'", "'highS'", 'carrierRegions']) {
    if (!`${interfaceSource}\n${intentSource}`.includes(required)) throw new Error(`Falta contrato REV8: ${required}.`);
  }
  for (const required of ['SI-EXPLICIT-RELATION-STALE', 'SI-EXPLICIT-END-SUPPORT-UNRESOLVED', 'SI-GRAVITY-PATH-CYCLE']) {
    if (!pathsSource.includes(required)) throw new Error(`Falta guard de candidateLoadPaths: ${required}.`);
  }
  if (evidence.short?.structuralAssemblyPresent !== false || evidence.continuous?.structuralAssemblyPresent !== false) {
    throw new Error('La evidencia REV8 materializó structuralAssembly fuera de alcance.');
  }
  if (evidence.invariants?.structuralAssembly !== 'not-used') throw new Error('La evidencia REV8 no registra la decisión de omitir structuralAssembly.');
  if (evidence.invariants?.geometryMutation !== false) throw new Error('La evidencia REV8 no demuestra geometría agnóstica inmutable.');
  console.log('PASS - contratos estáticos REV8: interfaces/regiones/paths sin structuralAssembly.');
}

function patchAuditDxf(source) {
  return source
    .replace("import { execFileSync, spawnSync } from 'node:child_process';", "import { spawnSync } from 'node:child_process';")
    .replace(/const commit = execFileSync\([\s\S]*?\)\.trim\(\);/, `const commit = '${noGitTag}';`);
}

function patchSmokeCcx(source) {
  return source
    .replace("import { execFileSync } from 'node:child_process';\n", '')
    .replace(/const commit = execFileSync\([\s\S]*?\)\.trim\(\);/, `const commit = '${noGitTag}';`);
}

async function runNoGitArtifactGates() {
  const dxfOriginal = path.join(root, 'scripts/audit-dxf.mjs');
  const ccxOriginal = path.join(root, 'scripts/smoke-ccx.mjs');
  const dxfTemp = path.join(root, `scripts/.audit-dxf-${noGitTag}.mjs`);
  const ccxTemp = path.join(root, `scripts/.smoke-ccx-${noGitTag}.mjs`);
  const artifactRoot = path.join(root, 'artifacts', noGitTag);
  try {
    await writeFile(dxfTemp, patchAuditDxf(await readFile(dxfOriginal, 'utf8')));
    await writeFile(ccxTemp, patchSmokeCcx(await readFile(ccxOriginal, 'utf8')));
    run('node', [path.relative(root, dxfTemp)]);
    run('node', [path.relative(root, ccxTemp)]);
  } finally {
    await rm(dxfTemp, { force: true });
    await rm(ccxTemp, { force: true });
    await rm(artifactRoot, { recursive: true, force: true });
  }
}

async function main() {
  assertToolchain();
  run('node', ['scripts/generate-spec015d-rev8-evidence.mjs']);
  run('node', ['scripts/check-format.mjs']);
  run('node', ['scripts/check-spec015d-independence.mjs']);
  run('node', ['--test',
    'tests/structuralInterfaces.test.mjs',
    'tests/candidateLoadPathsInterfaces.test.mjs',
    'tests/structuralProposalLocator.test.mjs',
    'tests/structuralProposalVisualPresentation.test.mjs',
    'tests/spec015dRev8Evidence.test.mjs',
    'tests/spec015dEvidence.test.mjs',
    'tests/spec015dIndependence.test.mjs',
    'tests/structuralIntent.test.mjs',
    'tests/structuralIntentTrace.test.mjs',
    'tests/candidateLoadPaths.test.mjs',
    'tests/structuralProposals.test.mjs',
    'tests/structuralProposalWorkspace.test.mjs',
    'tests/structuralProposalDecision.test.mjs',
    'tests/structuralProposalBatchDecision.test.mjs',
    'tests/structuralProposalPersistence.test.mjs',
    'tests/structuralProposalReviews.test.mjs',
    'tests/structuralConceptGlossary.test.mjs',
    'tests/modelSchema.test.mjs',
    'tests/nativeProjectFile.test.mjs'
  ]);
  await assertRev8StaticContracts();
  await verifyNoGitInventory();

  if (!full) {
    console.log('\nPASS - SPEC-015-D REV8 validación focal sin Git.');
    console.log('Use --full en el entorno local con dependencias instaladas para ejecutar todos los gates.');
    return;
  }

  const nodeModules = path.join(root, 'node_modules');
  try { await stat(nodeModules); } catch { throw new Error('Falta node_modules para --full. Ejecute npm ci con el entorno habitual del proyecto.'); }

  run('npm', ['run', 'format:rust']);
  run('npm', ['run', 'lint']);
  run('npm', ['test']);
  run('npm', ['run', 'test:rust']);
  run('npm', ['run', 'tauri:check']);
  run('npm', ['run', 'test:lab']);
  run('npm', ['run', 'test:coverage']);
  run('npm', ['run', 'verify:goldens']);
  await runNoGitArtifactGates();
  run('npm', ['run', 'build']);
  run('npm', ['run', 'verify:migration']);
  run('npm', ['run', 'verify:derived']);
  run('npm', ['run', 'codex:audit']);
  run('make', ['governance']);
  await verifyNoGitInventory();

  console.log('\nPASS - SPEC-015-D REV8 validación completa sin Git.');
  console.log('No se ejecutó Git. Siguiente barrera: validación visual real en localhost antes del cierre documental.');
}

main().catch((error) => {
  console.error(`\nFAIL - SPEC-015-D REV8: ${error.message}`);
  process.exitCode = 1;
});
