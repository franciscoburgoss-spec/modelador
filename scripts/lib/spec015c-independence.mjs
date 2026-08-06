import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const SPEC015C_ENTRYPOINTS = Object.freeze([
  'src/components/modals/StructuralIntentWorkspaceDialog.jsx',
  'src/core/structuralIntentWorkspace.js'
]);

export const SPEC015C_FORBIDDEN_IMPORT_FRAGMENTS = Object.freeze([
  'wallTypes',
  'WallTypesModal',
  'batchModulation',
  'MetalconModulationModal',
  'OsbModulationModal',
  'OsbNestingModal',
  'build3d',
  'exportFramingDxf',
  'exportOsbDxf',
  'metalconProfiles',
  'materials',
  'studs',
  'headers',
  'osbCourses'
]);

export const SPEC015C_FORBIDDEN_WORKSPACE_TEXT = Object.freeze([
  'Metalcon', 'OSB', 'MP1', 'MP2', 'MP3', 'perfil', 'montante', 'solera'
]);

export const SPEC015C_GRAPH_BOUNDARIES = Object.freeze([
  'src/store/useModelStore.js'
]);

const IMPORT_PATTERN = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+|import\s*\()(['"])([^'"]+)\1/g;

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

function resolveRelative(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(from), specifier);
}

async function resolveModule(from, specifier) {
  const base = resolveRelative(from, specifier);
  if (!base) return null;
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js')]) {
    if (await exists(candidate)) return candidate;
  }
  return base;
}

export async function collectSpec015cImportGraph(root, entrypoints = SPEC015C_ENTRYPOINTS) {
  const absoluteRoot = path.resolve(root);
  const graphBoundaries = new Set(
    SPEC015C_GRAPH_BOUNDARIES.map((entry) => path.resolve(absoluteRoot, entry))
  );
  const queue = entrypoints.map((entry) => path.resolve(absoluteRoot, entry));
  const visited = new Set();
  const edges = [];
  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    if (graphBoundaries.has(file)) continue;
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[2];
      edges.push({ from: file, specifier });
      const resolved = await resolveModule(file, specifier);
      if (resolved && resolved.startsWith(path.resolve(absoluteRoot, 'src')) && await exists(resolved)) queue.push(resolved);
    }
  }
  return { files: [...visited].sort(), edges };
}

export async function auditSpec015cIndependence(root, options = {}) {
  const entrypoints = options.entrypoints || SPEC015C_ENTRYPOINTS;
  const graph = await collectSpec015cImportGraph(root, entrypoints);
  const errors = [];
  for (const edge of graph.edges) {
    for (const forbidden of SPEC015C_FORBIDDEN_IMPORT_FRAGMENTS) {
      if (edge.specifier.includes(forbidden)) {
        errors.push(`Importación prohibida ${edge.specifier} desde ${path.relative(root, edge.from)}`);
      }
    }
  }
  const workspaceFile = path.resolve(root, 'src/components/modals/StructuralIntentWorkspaceDialog.jsx');
  const workspaceSource = await readFile(workspaceFile, 'utf8');
  for (const forbidden of SPEC015C_FORBIDDEN_WORKSPACE_TEXT) {
    if (workspaceSource.includes(forbidden)) errors.push(`Texto constructivo prohibido en workspace: ${forbidden}`);
  }
  return { ok: errors.length === 0, errors, graph };
}
