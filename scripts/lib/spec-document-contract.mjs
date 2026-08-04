export const REQUIRED_SPEC_HEADINGS = [
  '## Diagnóstico',
  '## Decisión',
  '## Alcance',
  '## Fuera de alcance',
  '## Criterios de aceptación',
  '## Evidencia',
];

export function validateSpecDocumentContract(filename, content) {
  const lines = new Set(content.split(/\r?\n/));
  return REQUIRED_SPEC_HEADINGS
    .filter((heading) => !lines.has(heading))
    .map((heading) => `${filename}: falta "${heading}"`);
}
