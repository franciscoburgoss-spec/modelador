import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');

const PURE_FILES = [
  'src/core/structuralProposals.js',
  'src/core/candidateLoadPaths.js'
];
const CONSTRUCTIVE_TERMS = [
  'metalcon', 'osb', 'wallTypes', 'wallTypeId', 'profile', 'material',
  'stud', 'screw', 'fastener', 'constructiveSolution'
];

async function source(root, path) {
  return readFile(resolve(root, path), 'utf8');
}

function forbid(errors, path, text, patterns, message) {
  for (const pattern of patterns) {
    if (pattern.test(text)) errors.push(`${path}: ${message} (${pattern})`);
  }
}

export async function checkSpec015dIndependence(root = DEFAULT_ROOT) {
  const errors = [];
  for (const path of PURE_FILES) {
    const text = await source(root, path);
    forbid(errors, path, text, [
      /from\s+['"][^'"]*(?:store|react|three)[^'"]*['"]/,
      /\b(?:setElementIntent|setElementIntentsBatch|setRoofIntent|appendStructuralProposalReview)\s*\(/
    ], 'el motor puro cruza una frontera prohibida');
    const lower = text.toLowerCase();
    for (const term of CONSTRUCTIVE_TERMS) {
      if (lower.includes(term.toLowerCase())) errors.push(`${path}: vocabulario constructivo prohibido: ${term}`);
    }
  }

  const reviewsPath = 'src/core/structuralProposalReviews.js';
  const reviews = await source(root, reviewsPath);
  forbid(errors, reviewsPath, reviews, [
    /from\s+['"][^'"]*structuralIntent\.js['"]/,
    /\b(?:setElementIntent|setRoofIntent)\s*\(/
  ], 'el review log no puede mutar intención');

  const visualPath = 'src/core/structuralProposalVisualPresentation.js';
  const visual = await source(root, visualPath);
  forbid(errors, visualPath, visual, [
    /from\s+['"][^'"]*(?:store|react|three)[^'"]*['"]/,
    /\b(?:setElementIntent|setRoofIntent|appendStructuralProposalReview)\s*\(/
  ], 'la presentación visual debe permanecer efímera');
  if (!visual.includes('assertHumanReadableStructuralProposalPresentation')) {
    errors.push(`${visualPath}: falta el guard de identidad visual humana`);
  }

  const applyPath = 'src/core/applyStructuralProposalDecision.js';
  const apply = await source(root, applyPath);
  if ((apply.match(/if \(!confirmed\)/g) || []).length < 2) {
    errors.push(`${applyPath}: faltan guards de confirmación individual/lote if (!confirmed)`);
  }
  for (const required of [
    'sameFingerprintSet(',
    "'SI-PROPOSAL-STALE'",
    'previousIntentFingerprint',
    'currentVisualFingerprint',
    'applyStructuralProposalDecisionBatch',
    'setElementIntentsBatch'
  ]) {
    if (!apply.includes(required)) errors.push(`${applyPath}: falta guard obligatorio ${required}`);
  }

  const uiPath = 'src/components/modals/StructuralProposalWorkspaceDialog.jsx';
  const ui = await source(root, uiPath);
  forbid(errors, uiPath, ui, [
    /import\s*\{[^}]*\b(?:setElementIntent|setRoofIntent)\b[^}]*\}\s*from\s*['"][^'"]*structuralIntent\.js['"]/,
    /\b(?:setElementIntent|setRoofIntent)\s*\(/
  ], 'la UI no puede llamar mutadores de intención directamente');
  for (const required of [
    'Localizar', 'Referencia técnica', 'prepareStructuralProposalDecision',
    'applyPreparedStructuralProposalDecision', 'applyPreparedStructuralProposalDecisionBatch',
    'selectedBatchIds'
  ]) {
    if (!ui.includes(required)) errors.push(`${uiPath}: falta integración visible ${required}`);
  }

  const stateSources = await Promise.all([
    source(root, 'src/core/structuralProposals.js'),
    source(root, 'src/core/candidateLoadPaths.js')
  ]);
  if (stateSources.some((text) => /['"]verified['"]/.test(text))) {
    errors.push('SPEC-015-D: un candidato no puede usar el estado verified');
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_ROOT;
  const errors = await checkSpec015dIndependence(root);
  if (errors.length > 0) {
    console.error(`FAIL - independencia SPEC-015-D (${errors.length})`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('PASS - independencia SPEC-015-D');
  }
}
