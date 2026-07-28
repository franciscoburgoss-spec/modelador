import { NativeProjectError } from '../core/nativeProjectFile.js';

function report(actions, code, message, error) {
  actions.reportProjectOperationError(new NativeProjectError(code, message, error));
  return false;
}

export async function hydrateProjectRuntimeRecents(runtime, actions) {
  if (
    typeof runtime?.loadRecentPaths !== 'function'
    || typeof actions?.hydrateProjectRecentPaths !== 'function'
  ) {
    return false;
  }
  try {
    const recentPaths = await runtime.loadRecentPaths();
    actions.hydrateProjectRecentPaths(recentPaths);
    return true;
  } catch (error) {
    return report(
      actions,
      'RECENT_PROJECTS_READ_FAILED',
      'No se pudo cargar la lista de proyectos recientes.',
      error
    );
  }
}

export async function persistProjectRuntimeRecents(runtime, recentPaths, actions) {
  if (typeof runtime?.saveRecentPaths !== 'function') return true;
  try {
    await runtime.saveRecentPaths(recentPaths);
    return true;
  } catch (error) {
    return report(
      actions,
      'RECENT_PROJECTS_WRITE_FAILED',
      'La operación del proyecto terminó, pero no se pudo actualizar la lista de recientes.',
      error
    );
  }
}
