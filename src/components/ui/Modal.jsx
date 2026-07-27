// components/ui/Modal.jsx
import { useRef, useState, useEffect } from 'react';

export default function Modal({ open, onClose, title, width = 'max-w-md', children, footer, headerAction, bodyClassName = 'px-5 py-4' }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);   // {left, top} una vez que se arrastra
  const [size, setSize] = useState(null); // {width, height} una vez que se redimensiona
  const [downOnBackdrop, setDownOnBackdrop] = useState(false);

  // Cada vez que se abre, vuelve a la posición/tamaño por defecto (centrado, tamaño natural).
  useEffect(() => {
    if (open) { setPos(null); setSize(null); }
  }, [open]);

  if (!open) return null;

  const startDrag = (e) => {
    if (e.target.closest('button')) return; // no arrastrar al hacer clic en el botón de cerrar
    e.preventDefault(); // evita selección de texto nativa al arrastrar sobre el contenido
    const rect = cardRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = rect.left, startTop = rect.top;

    const onMove = (ev) => {
      setPos({ left: startLeft + (ev.clientX - startX), top: startTop + (ev.clientY - startY) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e) => {
    e.stopPropagation();
    e.preventDefault(); // ★ evita que arrastrar el handle dispare selección nativa de texto
    const rect = cardRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startW = rect.width, startH = rect.height;
    if (!pos) setPos({ left: rect.left, top: rect.top });

    const onMove = (ev) => {
      setSize({
        width: Math.max(320, startW + (ev.clientX - startX)),
        height: Math.max(220, startH + (ev.clientY - startY))
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const cardStyle = { position: pos ? 'fixed' : 'relative' };
  if (pos) { cardStyle.left = pos.left; cardStyle.top = pos.top; cardStyle.margin = 0; }
  if (size) { cardStyle.width = size.width; cardStyle.height = size.height; cardStyle.maxWidth = 'none'; cardStyle.maxHeight = 'none'; }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => setDownOnBackdrop(e.target === e.currentTarget)}
      onMouseUp={(e) => { if (downOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={cardRef}
        style={cardStyle}
        className={`bg-white rounded-lg shadow-xl w-full ${width} max-h-[85vh] flex flex-col overflow-hidden`}
      >
        <div
          className="flex justify-between items-center px-5 py-3.5 border-b border-[#e4e4e0] shrink-0 cursor-move select-none"
          onMouseDown={startDrag}
        >
          <h2 className="font-semibold text-[#1a1a18]">{title}</h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              className="text-[#8a8a85] hover:text-[#1a1a18] text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-[#f2f2ee]"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>
        <div className={`${bodyClassName} overflow-y-auto flex-1 min-h-0`}>{children}</div>
        {footer && <div className="px-5 py-3 border-t border-[#e4e4e0] flex justify-end gap-2 shrink-0">{footer}</div>}

        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={startResize}
          title="Redimensionar"
          style={{ backgroundImage: 'linear-gradient(135deg, transparent 50%, #d8d8d3 50%, #d8d8d3 58%, transparent 58%, transparent 75%, #d8d8d3 75%, #d8d8d3 83%, transparent 83%)' }}
        />
      </div>
    </div>
  );
}
