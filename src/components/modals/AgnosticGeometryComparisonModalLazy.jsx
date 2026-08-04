import { lazy, Suspense } from 'react';

const AgnosticGeometryComparisonModal = lazy(
  () => import('./AgnosticGeometryComparisonModal.jsx')
);

export default function AgnosticGeometryComparisonModalLazy(props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <AgnosticGeometryComparisonModal {...props} />
    </Suspense>
  );
}
