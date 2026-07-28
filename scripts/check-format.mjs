import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.venv-verification',
  '.vite',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const ignoredGeneratedDirectories = new Set([
  'src-tauri/gen',
  'src-tauri/target',
]);
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.rc',
  '.sh',
  '.yml',
]);
const textNames = new Set([
  '.editorconfig',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  'Makefile',
]);

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (
      entry.isDirectory()
      && (
        ignoredDirectories.has(entry.name)
        || ignoredGeneratedDirectories.has(relative)
      )
    ) continue;
    if (entry.isDirectory()) files.push(...await collect(absolute));
    if (entry.isFile()) {
      const extension = path.extname(entry.name);
      if (textExtensions.has(extension) || textNames.has(entry.name)) files.push(absolute);
    }
  }
  return files;
}

const errors = [];
const files = await collect(root);

for (const absolute of files) {
  const relative = path.relative(root, absolute);
  const content = await readFile(absolute, 'utf8');
  const immutableFixture = relative.includes(`${path.sep}fixtures${path.sep}`);

  if (content.includes('\r')) errors.push(`${relative}: contiene CR/CRLF`);
  if (content.includes('\0')) errors.push(`${relative}: contiene bytes NUL`);
  if (!immutableFixture && content.length > 0 && !content.endsWith('\n')) {
    errors.push(`${relative}: falta salto de línea final`);
  }

  if (!relative.endsWith('.md')) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) {
        errors.push(`${relative}:${index + 1}: whitespace al final`);
      }
    });
  }

  if (relative.endsWith('.json')) {
    try {
      JSON.parse(content);
    } catch (error) {
      errors.push(`${relative}: JSON inválido (${error.message})`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Formato inválido (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Formato válido: ${files.length} archivos de texto.`);
