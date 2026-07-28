import { useEffect, useRef, useState } from 'react';

const VIEWPORT_MARGIN = 8;

export function clampFloatingPanelPosition(position, size, viewport) {
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - size.width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - size.height - VIEWPORT_MARGIN);
  return {
    left: Math.min(Math.max(VIEWPORT_MARGIN, position.left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_MARGIN, position.top), maxTop)
  };
}

export default function FloatingPanel({
  title,
  onClose,
  children,
  footer,
  width = 'w-80'
}) {
  const panelRef = useRef(null);
  const stopDraggingRef = useRef(() => {});
  const [position, setPosition] = useState(null);

  useEffect(() => () => stopDraggingRef.current(), []);

  useEffect(() => {
    if (!position) return undefined;
    const keepVisible = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition((current) => clampFloatingPanelPosition(
        current,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight }
      ));
    };
    window.addEventListener('resize', keepVisible);
    return () => window.removeEventListener('resize', keepVisible);
  }, [position]);

  const startDrag = (event) => {
    if (event.target.closest('button, input, select, a')) return;
    event.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    const origin = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    const stopDragging = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stopDragging);
      stopDraggingRef.current = () => {};
    };
    const move = (moveEvent) => {
      setPosition(clampFloatingPanelPosition(
        {
          left: origin.left + moveEvent.clientX - origin.pointerX,
          top: origin.top + moveEvent.clientY - origin.pointerY
        },
        { width: origin.width, height: origin.height },
        { width: window.innerWidth, height: window.innerHeight }
      ));
    };

    stopDraggingRef.current();
    stopDraggingRef.current = stopDragging;
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stopDragging);
  };

  const style = position
    ? { left: position.left, top: position.top, zIndex: 110 }
    : { top: 80, right: 24, zIndex: 110 };

  return (
    <section
      ref={panelRef}
      data-testid="properties-floating-panel"
      className={`fixed bg-white rounded-lg shadow-xl ${width} pointer-events-auto`}
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        data-testid="properties-floating-handle"
        className="px-4 py-2 bg-[#f2f2ee] border-b border-[#e4e4e0] rounded-t-lg flex items-center justify-between cursor-move select-none"
        onMouseDown={startDrag}
      >
        <span className="font-semibold text-sm text-[#3d3d38]">{title}</span>
        <button
          type="button"
          aria-label={`Cerrar ${title}`}
          className="text-[#8a8a85] hover:text-[#5a5a55] text-lg leading-none"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="p-4 text-sm max-h-[60vh] overflow-y-auto">{children}</div>
      {footer && (
        <div className="p-4 border-t border-[#e4e4e0] space-y-2">{footer}</div>
      )}
    </section>
  );
}
