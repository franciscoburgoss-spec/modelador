import { useEffect, useState } from 'react';
import { useModelStore } from '../store/useModelStore.js';
import {
  AUTOSAVE_DEBOUNCE_MS,
  clearAutosave,
  parseAutosave,
  readAutosave,
  serializeAutosave,
  shouldOfferRestore,
  writeAutosave
} from './autosave.js';
import { NativeProjectError } from './nativeProjectFile.js';

const storage = () => (
  typeof globalThis.localStorage === 'object'
    ? globalThis.localStorage
    : typeof window !== 'undefined'
      ? window.localStorage
      : null
);

function hasNativeRecovery(runtime) {
  return !!(
    runtime
    && typeof runtime.loadRecoverySnapshot === 'function'
    && typeof runtime.saveRecoverySnapshot === 'function'
    && typeof runtime.clearRecoverySnapshot === 'function'
  );
}

function reportAutosaveError(error, operation) {
  const typed = error instanceof Error && typeof error.code === 'string'
    ? error
    : new NativeProjectError(
        'RECOVERY_OPERATION_FAILED',
        `No se pudo ${operation} el snapshot de recuperación.`,
        error
      );
  useModelStore.getState().reportProjectOperationError(typed);
}

export function useAutosave(
  projectRuntime = null,
  { debounceMs = AUTOSAVE_DEBOUNCE_MS } = {}
) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let disposed = false;
    let enabled = true;
    let timer = null;
    let unsubscribe = null;
    const native = hasNativeRecovery(projectRuntime);

    const scheduleNativeSnapshot = (state) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const current = useModelStore.getState();
        if (disposed || !enabled || !current.projectDocument.dirty) return;
        const content = serializeAutosave(
          current.model,
          Date.now(),
          current.projectDocument.path
        );
        void projectRuntime.saveRecoverySnapshot(content).catch((error) => {
          enabled = false;
          reportAutosaveError(error, 'guardar');
        });
      }, debounceMs);
    };

    const start = async () => {
      const stateBeforeRecoveryRead = useModelStore.getState();
      if (native) {
        try {
          const raw = await projectRuntime.loadRecoverySnapshot();
          if (disposed) return;
          const saved = parseAutosave(raw);
          const current = useModelStore.getState();
          const activeProjectChangedWhileReading = (
            current.model !== stateBeforeRecoveryRead.model
            || current.projectDocument.path !== stateBeforeRecoveryRead.projectDocument.path
            || current.projectDocument.dirty !== stateBeforeRecoveryRead.projectDocument.dirty
          );
          if (
            !activeProjectChangedWhileReading
            && shouldOfferRestore(saved, current.model)
          ) {
            setPending(saved);
          } else if (activeProjectChangedWhileReading && !current.projectDocument.dirty) {
            await projectRuntime.clearRecoverySnapshot();
          }
        } catch (error) {
          if (!disposed) reportAutosaveError(error, 'leer');
        }
      } else {
        const saved = readAutosave(storage());
        if (shouldOfferRestore(saved, useModelStore.getState().model)) {
          setPending(saved);
        }
      }
      if (disposed) return;

      unsubscribe = useModelStore.subscribe((state, previous) => {
        if (!enabled) return;
        const modelChanged = state.model !== previous.model;
        const pathChanged = state.projectDocument.path !== previous.projectDocument.path;
        const becameDirty = (
          state.projectDocument.dirty
          && !previous.projectDocument.dirty
        );
        if (state.projectDocument.dirty && (modelChanged || pathChanged || becameDirty)) {
          if (native) {
            scheduleNativeSnapshot(state);
          } else {
            clearTimeout(timer);
            timer = setTimeout(() => {
              const current = useModelStore.getState();
              const { ok, error } = writeAutosave(
                storage(),
                current.model,
                Date.now(),
                current.projectDocument.path
              );
              if (!ok) {
                enabled = false;
                console.warn('Autoguardado desactivado:', error);
              }
            }, debounceMs);
          }
          return;
        }
        const becameClean = (
          previous.projectDocument.dirty
          && !state.projectDocument.dirty
        );
        const replacedByCleanModel = modelChanged && !state.projectDocument.dirty;
        if (native && (becameClean || replacedByCleanModel)) {
          clearTimeout(timer);
          void projectRuntime.clearRecoverySnapshot().catch((error) => {
            reportAutosaveError(error, 'limpiar');
          });
        }
      });

      const current = useModelStore.getState();
      if (current.projectDocument.dirty) {
        if (native) scheduleNativeSnapshot(current);
      }
    };

    void start();
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [debounceMs, projectRuntime]);

  const restore = () => {
    if (!pending) return;
    const result = useModelStore.getState().restoreRecoveryCandidate(pending);
    if (result.ok) setPending(null);
  };

  const dismiss = () => setPending(null);

  return { pending, restore, dismiss };
}

export { clearAutosave };
