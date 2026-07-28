import { useEffect, useRef, useState } from 'react';
import { useModelStore } from '../store/useModelStore.js';
import { saveNativeProject, NativeProjectError } from './nativeProjectFile.js';
import {
  inspectLegacyProjectCandidates,
  removeLegacyProjectCandidate
} from './legacyProjectMigration.js';
import { persistProjectRuntimeRecents } from '../adapters/projectRecentPersistence.js';

const storage = () => (
  typeof globalThis.localStorage === 'object'
    ? globalThis.localStorage
    : typeof window !== 'undefined'
      ? window.localStorage
      : null
);

export function useLegacyProjectMigration(projectRuntime) {
  const [candidates, setCandidates] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const inspectedRef = useRef(false);

  useEffect(() => {
    if (!projectRuntime || inspectedRef.current) return;
    inspectedRef.current = true;
    const result = inspectLegacyProjectCandidates(storage());
    setCandidates(result.candidates);
    if (result.errors.length > 0) {
      const first = result.errors[0];
      useModelStore.getState().reportProjectOperationError(
        new NativeProjectError(first.code, first.message)
      );
    }
  }, [projectRuntime]);

  const migrate = async (candidate) => {
    if (pendingId || !projectRuntime) return { ok: false };
    setPendingId(candidate.id);
    try {
      const projectPath = await projectRuntime.chooseSavePath({ currentPath: null });
      if (!projectPath) return { ok: false, cancelled: true };

      await saveNativeProject(projectRuntime.fileSystem, projectPath, candidate.model);
      const actions = useModelStore.getState();
      const opened = await actions.openProjectFromPath(
        projectRuntime.fileSystem,
        projectPath
      );
      if (!opened.ok) return opened;

      removeLegacyProjectCandidate(storage(), candidate);
      setCandidates((current) => current.filter((entry) => entry.id !== candidate.id));
      await persistProjectRuntimeRecents(
        projectRuntime,
        useModelStore.getState().projectDocument.recentPaths,
        { reportProjectOperationError: useModelStore.getState().reportProjectOperationError }
      );
      return { ok: true, path: projectPath };
    } catch (error) {
      return useModelStore.getState().reportProjectOperationError(
        error instanceof Error && typeof error.code === 'string'
          ? error
          : new NativeProjectError(
              'LEGACY_MIGRATION_FAILED',
              'No se pudo migrar la copia del navegador.',
              error
            )
      );
    } finally {
      setPendingId(null);
    }
  };

  return {
    candidates: dismissed ? [] : candidates,
    pendingId,
    migrate,
    dismiss: () => setDismissed(true)
  };
}
