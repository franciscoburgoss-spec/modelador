export const UNTITLED_PROJECT = 'Sin título';
export const RECENT_PROJECT_LIMIT = 10;

function assertProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || projectPath.length === 0) {
    throw new TypeError('La ruta del proyecto debe ser texto no vacío.');
  }
}

function normalizeRecentPaths(recentPaths) {
  if (!Array.isArray(recentPaths)) return [];
  const unique = [];
  for (const projectPath of recentPaths) {
    if (
      typeof projectPath !== 'string'
      || projectPath.length === 0
      || unique.includes(projectPath)
    ) {
      continue;
    }
    unique.push(projectPath);
    if (unique.length === RECENT_PROJECT_LIMIT) break;
  }
  return unique;
}

function recordRecentPath(recentPaths, projectPath) {
  return normalizeRecentPaths([
    projectPath,
    ...normalizeRecentPaths(recentPaths).filter((candidate) => candidate !== projectPath)
  ]);
}

export function titleFromProjectPath(projectPath) {
  assertProjectPath(projectPath);
  const segments = projectPath.replaceAll('\\', '/').split('/');
  return segments.at(-1) || projectPath;
}

export function createProjectDocument({
  path = null,
  dirty = false,
  recentPaths = []
} = {}) {
  if (path !== null) assertProjectPath(path);
  return {
    path,
    title: path === null ? UNTITLED_PROJECT : titleFromProjectPath(path),
    dirty: Boolean(dirty),
    recentPaths: normalizeRecentPaths(recentPaths)
  };
}

export function markProjectDocumentDirty(document) {
  if (document.dirty) return document;
  return { ...document, dirty: true };
}

export function openProjectDocument(document, projectPath) {
  assertProjectPath(projectPath);
  return {
    path: projectPath,
    title: titleFromProjectPath(projectPath),
    dirty: false,
    recentPaths: recordRecentPath(document.recentPaths, projectPath)
  };
}

export function saveProjectDocument(document, projectPath) {
  return openProjectDocument(document, projectPath);
}

export function resetProjectDocument(document) {
  return createProjectDocument({ recentPaths: document.recentPaths });
}
