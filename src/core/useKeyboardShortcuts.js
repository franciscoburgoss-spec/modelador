// core/useKeyboardShortcuts.js
import { useEffect } from 'react';
import { useModelStore } from '../store/useModelStore.js';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return; // no interferir con edición de campos

      const { selectElement, deleteSelectedElement, zoomIn, zoomOut, goToNextZLevel, goToPreviousZLevel, undo, redo } = useModelStore.getState();
      const { selectedElementId, selectedRoofSystemId } = useModelStore.getState().model;
      const selectedId = selectedElementId ?? selectedRoofSystemId;

      const isUndoKey = (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey);
      if (isUndoKey) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToNextZLevel();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToPreviousZLevel();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        selectElement(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId != null) {
        e.preventDefault();
        deleteSelectedElement();
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
