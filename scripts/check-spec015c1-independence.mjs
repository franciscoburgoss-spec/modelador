import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = {
  presenter: 'src/core/structuralIntentVisualPresentation.js',
  locator: 'src/core/structuralIntentLocator.js',
  workspace: 'src/core/structuralIntentWorkspace.js',
  dialog: 'src/components/modals/StructuralIntentWorkspaceDialog.jsx',
  preview: 'src/components/StructuralIntentVisualPreview.jsx',
  canvas: 'src/components/Canvas.jsx',
  menu: 'src/components/MenuBar.jsx',
  store: 'src/store/useModelStore.js'
};

const source = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, relative]) => (
  [key, await readFile(path.join(root, relative), 'utf8')]
))));
const errors = [];

function requireText(key, text, message = `${files[key]} no contiene ${text}`) {
  if (!source[key].includes(text)) errors.push(message);
}

function forbidText(key, pattern, message) {
  if (pattern.test(source[key])) errors.push(message || `${files[key]} contiene ${pattern}`);
}

forbidText('presenter', /^import .*?(wallTypes|metalcon|recognizedStructuralTopology|spec14|three|useModelStore|react)/mi,
  'El presentador visual importa una autoridad constructiva, topológica, UI o store.');
requireText('presenter', "import { projectAgnosticGeometry } from './agnosticGeometry.js';");
requireText('presenter', "STRUCTURAL_INTENT_VISUAL_CONTRACT = 'structural-intent-visual-presentation-v1.0'");

forbidText('locator', /withHistory|appendStructuralIntentTrace|setElementIntent|setRoofIntent/,
  'El localizador transitorio toca historial o mutadores de intención.');
requireText('locator', 'selectedElementId: snapshot.selectedElementId');
requireText('locator', "model: { ...state.model, viewMode: 'plan' }");

requireText('workspace', 'previousGeometryFingerprint');
requireText('workspace', 'validatePreparedElementIntentBatch');
requireText('dialog', 'SI-DRAFT-TARGET-CHANGE-BLOCKED');
requireText('dialog', 'Recargue la geometría antes de guardar o localizar.');
requireText('preview', "event.key === 'Enter' || event.key === ' '");
requireText('preview', 'strokeDasharray');
requireText('store', 'structuralIntentLocator:');

const locatorBranch = source.canvas.indexOf('if (panelId === \'a\' && mode === \'plan\' && locatorState.active)');
const globalSelection = source.canvas.indexOf('if (dimHit != null) return selectElement(dimHit);');
if (locatorBranch < 0 || globalSelection < 0 || locatorBranch > globalSelection) {
  errors.push('Canvas no intercepta el localizador antes de la selección global ordinaria.');
}
requireText('canvas', 'requestStructuralIntentLocatorTarget(targetId)');

for (const item of [
  ['Propuestas estructurales…', 'Disponible en SPEC-015-D'],
  ['Caminos de carga…', 'Disponible en SPEC-015-D'],
  ['Topología estructural…', 'Disponible en SPEC-015-E']
]) {
  const [label, title] = item;
  const expression = new RegExp(`<Item disabled title="${title.replaceAll('-', '\\-')}">${label.replace('…', '…')}<\\/Item>`);
  if (!expression.test(source.menu)) errors.push(`${label} dejó de permanecer deshabilitado.`);
}

const result = {
  ok: errors.length === 0,
  inspectedFiles: Object.values(files),
  invariants: {
    purePresenter: errors.every((item) => !item.includes('presentador')),
    locatorOutsideHistory: errors.every((item) => !item.includes('localizador transitorio')),
    canvasInterceptionBeforeGlobalSelection: locatorBranch >= 0 && locatorBranch < globalSelection,
    forbiddenFeaturesDisabled: errors.every((item) => !item.includes('dejó de permanecer'))
  },
  errors
};

if (!result.ok) {
  console.error(`Independencia SPEC-015-C-1 inválida (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Independencia SPEC-015-C-1 válida: ${result.inspectedFiles.length} archivos inspeccionados.`);
