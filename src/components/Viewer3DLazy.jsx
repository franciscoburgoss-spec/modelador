// components/Viewer3DLazy.jsx
// three.js + three-bvh-csg pesan ~600 kB del bundle y solo se usan en la vista 3D.
// Cargarlos con import() dinámico saca ese peso del chunk inicial de la app.
import { lazy, Suspense } from 'react';

const Viewer3D = lazy(() => import('./Viewer3D.jsx'));

export default function Viewer3DLazy(props) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center text-sm text-[#8a8a85]">
          Cargando vista 3D…
        </div>
      }
    >
      <Viewer3D {...props} />
    </Suspense>
  );
}
