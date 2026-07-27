// components/modals/Viewer3DModal.jsx
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import Viewer3D from '../Viewer3DLazy.jsx';

export default function Viewer3DModal({ open, onClose }) {
  const model = useModelStore((s) => s.model);
  const attributeFilter = useModelStore((s) => s.attributeFilter);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vista 3D"
      width="max-w-4xl"
      bodyClassName="p-0"
    >
      <div style={{ height: '70vh' }}>
        {open && <Viewer3D model={model} attributeFilter={attributeFilter} />}
      </div>
      <p className="text-xs text-[#8a8a85] px-4 py-2 border-t border-[#e4e4e0]">
        Arrastra para rotar, scroll para zoom, clic derecho para desplazar. Colores iguales a planta/elevación; el elemento seleccionado se resalta en amarillo.
      </p>
    </Modal>
  );
}
