import { readFile, writeFile } from 'node:fs/promises';

import {
  buildGoldenDocuments,
  NORMALIZATION_CONTRACT
} from './lib/artifact-normalizers.mjs';
import { buildReferenceArtifacts } from './lib/reference-artifacts.mjs';

const goldenDirectory = new URL('../harness/goldens/', import.meta.url);
const writeMode = process.argv.includes('--write');
const documents = buildGoldenDocuments(buildReferenceArtifacts());
const expectedFiles = {
  'normalization-contract.json': NORMALIZATION_CONTRACT,
  ...Object.fromEntries(
    Object.entries(documents).map(([format, document]) => [
      `${format}.golden.json`,
      document
    ])
  )
};

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

if (writeMode) {
  for (const [filename, value] of Object.entries(expectedFiles)) {
    await writeFile(new URL(filename, goldenDirectory), serialized(value), 'utf8');
  }
  console.log(`Goldens actualizados explícitamente: ${Object.keys(expectedFiles).length} archivos.`);
} else {
  const differences = [];
  for (const [filename, value] of Object.entries(expectedFiles)) {
    const actual = await readFile(new URL(filename, goldenDirectory), 'utf8');
    if (actual !== serialized(value)) differences.push(filename);
  }
  if (differences.length > 0) {
    throw new Error(
      `Goldens semánticos desactualizados: ${differences.join(', ')}. `
      + 'Revise la diferencia y use npm run update:goldens sólo si el cambio es intencional.'
    );
  }
  console.log(
    `Goldens semánticos verificados: ${Object.values(documents).reduce(
      (total, document) => total + document.artifacts.length,
      0
    )} artefactos.`
  );
}
