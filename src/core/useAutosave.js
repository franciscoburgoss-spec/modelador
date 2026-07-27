// core/useAutosave.js
// Efecto React que conecta la lógica pura de core/autosave.js con el store y localStorage.
import { useEffect, useRef, useState } from 'react';
import { useModelStore } from '../store/useModelStore.js';
import {
  AUTOSAVE_DEBOUNCE_MS, writeAutosave, readAutosave, clearAutosave, shouldOfferRestore
} from './autosave.js';

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export function useAutosave() {
  const [pending, setPending] = useState(null); // {timestamp, model} pendiente de decisión
  const enabledRef = useRef(true);

  // Al montar: ¿hay un snapshot más nuevo que lo que quedó cargado?
  useEffect(() => {
    const saved = readAutosave(storage());
    if (shouldOfferRestore(saved, useModelStore.getState().model)) setPending(saved);
  }, []);

  // Autoguardado con debounce en cada cambio de modelo.
  useEffect(() => {
    let timer = null;
    const unsub = useModelStore.subscribe((state, prev) => {
      if (!enabledRef.current || state.model === prev.model) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { ok, error } = writeAutosave(storage(), useModelStore.getState().model);
        if (!ok) {
          // Cuota llena o storage bloqueado: desactivar en vez de reintentar y romper la app.
          enabledRef.current = false;
          console.warn('Autoguardado desactivado:', error);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  const restore = () => {
    if (pending) useModelStore.getState().loadModel(pending.model);
    setPending(null);
  };
  // Se mantiene el snapshot al descartar: es más seguro que borrarlo por un clic accidental.
  const dismiss = () => setPending(null);

  return { pending, restore, dismiss };
}

export { clearAutosave };
