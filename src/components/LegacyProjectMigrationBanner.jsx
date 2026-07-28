import { formatAutosaveTimestamp } from '../core/autosave.js';

export default function LegacyProjectMigrationBanner({
  candidates,
  pendingId,
  onMigrate,
  onDismiss
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-950"
      role="status"
    >
      <span>Hay datos del navegador que aún no tienen un archivo de proyecto.</span>
      <div className="flex items-center gap-2">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            className="px-2.5 py-1 rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
            disabled={pendingId !== null}
            onClick={() => onMigrate(candidate)}
            title={candidate.timestamp
              ? formatAutosaveTimestamp(candidate.timestamp)
              : candidate.label}
          >
            {pendingId === candidate.id ? 'Migrando…' : `Guardar ${candidate.label}…`}
          </button>
        ))}
        <button
          className="px-2.5 py-1 rounded-md border border-blue-300 hover:bg-blue-100"
          disabled={pendingId !== null}
          onClick={onDismiss}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
