import { lazy, Suspense } from 'react';

const AgnosticGeometryComparisonViewer = lazy(
  () => import('./AgnosticGeometryComparisonViewer.jsx')
);

export default function AgnosticGeometryComparisonViewerLazy(props) {
  return (
    <Suspense
      fallback={(
        <div className="w-full h-full flex items-center justify-center text-sm text-[#8a8a85]">
          Cargando comparación geométrica…
        </div>
      )}
    >
      <AgnosticGeometryComparisonViewer {...props} />
    </Suspense>
  );
}
