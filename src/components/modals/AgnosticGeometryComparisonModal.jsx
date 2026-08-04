import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import {
  AGNOSTIC_COMPARISON_MODES,
  prepareAgnosticGeometryComparison
} from '../../core/agnosticGeometryComparison.js';
import Modal from '../ui/Modal.jsx';
import DefaultViewer from '../AgnosticGeometryComparisonViewerLazy.jsx';

const COUNT_LABELS = {
  elements: 'Elementos',
  walls: 'Muros',
  openings: 'Vanos',
  columns: 'Pilares',
  beams: 'Vigas',
  foundations: 'Fundaciones',
  foundationLayers: 'Capas fundación',
  roofs: 'Cubiertas'
};

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('es-CL', { maximumFractionDigits: 6 }) : '—';
}

export default function AgnosticGeometryComparisonModal({
  open,
  onClose,
  projectGeometry,
  ViewerComponent = DefaultViewer
}) {
  const model = useModelStore((state) => state.model);
  const [mode, setMode] = useState(AGNOSTIC_COMPARISON_MODES.OVERLAY);
  const [renderError, setRenderError] = useState(null);
  const preparation = useMemo(() => {
    if (!open) return { comparison: null, error: null };
    try {
      return {
        comparison: prepareAgnosticGeometryComparison(model, { projectGeometry }),
        error: null
      };
    } catch (error) {
      return { comparison: null, error };
    }
  }, [model, open, projectGeometry]);
  const handleRenderError = useCallback((error) => setRenderError(error), []);

  useEffect(() => {
    if (open) {
      setMode(AGNOSTIC_COMPARISON_MODES.OVERLAY);
      setRenderError(null);
    }
  }, [open, model]);

  const comparison = preparation.comparison;
  const error = preparation.error ?? renderError;
  const report = comparison?.report;
  const first = comparison?.firstDifference;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Comparar geometría agnóstica"
      width="max-w-6xl"
      bodyClassName="p-0"
    >
      {error ? (
        <div className="m-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p className="font-semibold">No se pudo preparar la comparación geométrica.</p>
          <p className="mt-1">{error.message}</p>
          <p className="mt-2 text-xs">No se creó una escena parcial.</p>
        </div>
      ) : comparison && (
        <div className="flex min-h-0" style={{ height: '72vh' }}>
          <section className="min-w-0 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e4e0] px-4 py-2">
              {[
                [AGNOSTIC_COMPARISON_MODES.SOURCE, 'Fuente'],
                [AGNOSTIC_COMPARISON_MODES.EXPORTED, 'Exportada'],
                [AGNOSTIC_COMPARISON_MODES.OVERLAY, 'Superposición']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  className={mode === value ? 'bg-[#3d3d38] text-white' : ''}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3 text-xs">
                {comparison.legend.map((entry) => (
                  <span key={entry.label} className="inline-flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: entry.color, opacity: entry.opacity }}
                    />
                    {entry.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1" data-testid="agnostic-comparison-scene">
              <ViewerComponent comparison={comparison} mode={mode} onError={handleRenderError} />
            </div>
            <p className="border-t border-[#e4e4e0] px-4 py-2 text-xs text-[#6b6b65]">
              Arrastra para orbitar, scroll para zoom y clic derecho para desplazar. La vista es diagnóstica; la precisión corresponde al informe numérico.
            </p>
          </section>
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#e4e4e0] p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Informe numérico</span>
              <span
                className={`rounded px-2 py-1 text-xs font-bold ${report.status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                {report.status.toUpperCase()}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt>Tolerancia</dt><dd className="text-right">{formatNumber(report.toleranceMm)} mm</dd>
              <dt>Desviación máxima</dt><dd className="text-right">{formatNumber(report.summary.maximumDeviationMm)} mm</dd>
              <dt>Checks</dt><dd className="text-right">{report.summary.passedChecks}/{report.summary.checks}</dd>
              <dt>IDs fallidos</dt><dd className="text-right">{comparison.failedEntityIds.length}</dd>
            </dl>
            <table className="mt-4 w-full text-xs">
              <thead>
                <tr className="border-b border-[#e4e4e0] text-left">
                  <th className="py-1">Cantidad</th>
                  <th className="py-1 text-right">Fuente</th>
                  <th className="py-1 text-right">Exportada</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(COUNT_LABELS).map(([key, label]) => (
                  <tr key={key} className="border-b border-[#f0f0ed]">
                    <td className="py-1">{label}</td>
                    <td className="py-1 text-right">{report.summary.source[key]}</td>
                    <td className="py-1 text-right">{report.summary.exported[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 rounded bg-[#f7f7f4] p-3 text-xs">
              <p className="font-semibold">Primera diferencia</p>
              {first ? (
                <>
                  <p className="mt-1 break-all">{first.path}</p>
                  <p className="mt-1">ID: {first.id === null ? '—' : String(first.id)}</p>
                  <p>Código: {first.code}</p>
                </>
              ) : <p className="mt-1">Sin diferencias.</p>}
            </div>
          </aside>
        </div>
      )}
    </Modal>
  );
}
