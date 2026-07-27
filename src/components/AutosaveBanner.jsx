// components/AutosaveBanner.jsx
import { formatAutosaveTimestamp } from '../core/autosave.js';

export default function AutosaveBanner({ pending, onRestore, onDismiss }) {
  if (!pending) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-[#3d3d38]">
      <span>
        Hay una sesión sin guardar del {formatAutosaveTimestamp(pending.timestamp)}.
      </span>
      <button
        className="px-2.5 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
        onClick={onRestore}
      >
        Recuperar
      </button>
      <button
        className="px-2.5 py-1 rounded-md border border-amber-300 hover:bg-amber-100 transition-colors"
        onClick={onDismiss}
      >
        Descartar
      </button>
    </div>
  );
}
