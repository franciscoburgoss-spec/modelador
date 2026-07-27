import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = path.join(root, 'governance', 'MIGRATION_MANIFEST.json');
const rootFiles = [
  'index.html',
  'postcss.config.js',
  'tailwind.config.js',
  'vite.config.js',
];
const roots = ['src', 'tests', 'lab/roofPlane/core', 'lab/roofPlane/fixtures', 'lab/roofPlane/tests'];
const labHarnesses = ['lab/roofPlane/harness.mjs', 'lab/roofPlane/harness-batch.mjs'];

async function walk(base, relative) {
  const absolute = path.join(base, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.replaceAll(path.sep, '/'), entry.name);
    if (entry.isDirectory()) files.push(...await walk(base, child));
    if (entry.isFile()) files.push(child);
  }
  return files;
}

async function inventoryPaths(base) {
  const files = [...rootFiles, ...labHarnesses];
  for (const directory of roots) files.push(...await walk(base, directory));
  return [...new Set(files)].sort();
}

async function digest(base, relative) {
  const absolute = path.join(base, relative);
  const content = await readFile(absolute);
  const metadata = await stat(absolute);
  return {
    path: relative,
    bytes: metadata.size,
    sha256: createHash('sha256').update(content).digest('hex'),
    kind: relative.includes('/fixtures/') ? 'fixture'
      : relative.startsWith('tests/') || relative.includes('/tests/') ? 'test'
        : relative.startsWith('src/') || relative.includes('/core/') ? 'source'
          : 'config',
  };
}

async function createManifest(sourceRoot) {
  if (!sourceRoot) {
    throw new Error('Uso: node scripts/migration-manifest.mjs --create <directorio-origen>');
  }
  const files = [];
  for (const relative of await inventoryPaths(sourceRoot)) {
    files.push(await digest(sourceRoot, relative));
  }
  const manifest = {
    schemaVersion: 1,
    baseline: 'modelador-v49-R2',
    policy: 'Sólo fuentes, pruebas, fixtures y configuración reproducible; sin outputs generados.',
    excluded: [
      '.DS_Store',
      '.vite/',
      'dist/',
      'lab/roofPlane/ejeA-planta.svg',
      'node_modules/',
      'test-results/',
    ],
    files,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Manifiesto creado: ${files.length} archivos.`);
}

async function loadManifest() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('Manifiesto de migración inválido');
  }
  const paths = manifest.files.map((entry) => entry.path);
  if (paths.length !== new Set(paths).size) throw new Error('El manifiesto contiene rutas duplicadas');
  return manifest;
}

async function verifyCurrent({ compareSource = null } = {}) {
  const manifest = await loadManifest();
  const errors = [];
  let fixtures = 0;
  let sourceIdentical = 0;
  let registeredChanges = 0;

  for (const expected of manifest.files) {
    try {
      const current = await digest(root, expected.path);
      const expectedBytes = expected.workspaceBytes ?? expected.bytes;
      const expectedSha256 = expected.workspaceSha256 ?? expected.sha256;
      if (current.bytes !== expectedBytes || current.sha256 !== expectedSha256) {
        errors.push(`${expected.path}: el archivo difiere del hash registrado`);
      }
      if (expected.workspaceSha256) registeredChanges += 1;
      else sourceIdentical += 1;
      if (expected.kind === 'fixture') fixtures += 1;
      if (compareSource) {
        const source = await digest(compareSource, expected.path);
        if (source.bytes !== expected.bytes || source.sha256 !== expected.sha256) {
          errors.push(`${expected.path}: el origen ya no coincide con el manifiesto`);
        }
      }
    } catch (error) {
      errors.push(`${expected.path}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Migración inválida (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const suffix = compareSource ? ' y origen comparados byte a byte' : '';
  console.log(
    `Migración válida: ${manifest.files.length} archivos `
    + `(${sourceIdentical} idénticos al origen, ${registeredChanges} cambios posteriores registrados), `
    + `${fixtures} fixtures${suffix}.`
  );
}

async function recordWorkspaceChanges(specId, paths) {
  if (!specId || !/^SPEC-(?:\d{3}|R\d+)$/.test(specId) || paths.length === 0) {
    throw new Error(
      'Uso: node scripts/migration-manifest.mjs --record SPEC-xxx|SPEC-Rn <ruta> [ruta...]'
    );
  }
  const manifest = await loadManifest();
  const entries = new Map(manifest.files.map((entry) => [entry.path, entry]));

  for (const relative of paths) {
    const expected = entries.get(relative);
    if (!expected) {
      throw new Error(`${relative}: no pertenece al baseline migrado`);
    }
    const current = await digest(root, relative);
    if (current.bytes === expected.bytes && current.sha256 === expected.sha256) {
      delete expected.workspaceBytes;
      delete expected.workspaceSha256;
      delete expected.changedBy;
    } else {
      expected.workspaceBytes = current.bytes;
      expected.workspaceSha256 = current.sha256;
      expected.changedBy = specId;
    }
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`${paths.length} cambio(s) de ${specId} registrados sin alterar los hashes de origen.`);
}

const [command, argument, ...rest] = process.argv.slice(2);

try {
  if (command === '--create') await createManifest(argument);
  else if (command === '--compare') await verifyCurrent({ compareSource: argument });
  else if (command === '--record') await recordWorkspaceChanges(argument, rest);
  else if (!command) await verifyCurrent();
  else throw new Error(`Opción desconocida: ${command}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
