export default function ModelImportBanner({ feedback, onDismiss }) {
  if (!feedback) return null;
  const isError = feedback.severity === 'error';
  const colors = isError
    ? 'bg-red-50 border-red-200 text-red-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';
  const button = isError
    ? 'border-red-300 hover:bg-red-100'
    : 'border-amber-300 hover:bg-amber-100';

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 border-b text-sm ${colors}`}
      role={isError ? 'alert' : 'status'}
    >
      <span>{feedback.message}</span>
      <button
        className={`shrink-0 px-2.5 py-1 rounded-md border transition-colors ${button}`}
        onClick={onDismiss}
      >
        Cerrar
      </button>
    </div>
  );
}
