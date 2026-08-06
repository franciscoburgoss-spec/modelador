import process from 'node:process';
import { auditSpec015cIndependence } from './lib/spec015c-independence.mjs';

const result = await auditSpec015cIndependence(process.cwd());
if (!result.ok) {
  console.error(`Independencia SPEC-015-C inválida (${result.errors.length}):`);
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Independencia SPEC-015-C válida: ${result.graph.files.length} módulos inspeccionados.`);
