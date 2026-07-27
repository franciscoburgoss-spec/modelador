// components/Sidebar.jsx
import { useModelStore } from '../store/useModelStore.js';

function SideButton({ onClick, title, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg bg-[#f2f2ee] hover:bg-[#e4e4e0] text-[#3d3d38] text-xs font-bold transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export default function Sidebar({ canvasSize, onOpenModal }) {
  const addXAxis = useModelStore((s) => s.addXAxis);
  const addYAxis = useModelStore((s) => s.addYAxis);
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zoomIn = useModelStore((s) => s.zoomIn);
  const zoomOut = useModelStore((s) => s.zoomOut);
  const fitToContent = useModelStore((s) => s.fitToContent);
  const zoomToElement = useModelStore((s) => s.zoomToElement);
  const selectedElementId = useModelStore((s) => s.model.selectedElementId);
  const goToNextZLevel = useModelStore((s) => s.goToNextZLevel);
  const goToPreviousZLevel = useModelStore((s) => s.goToPreviousZLevel);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);

  return (
    <div className="flex flex-col gap-1.5 p-2 border-r border-[#e4e4e0] bg-white">
      <SideButton title="+ Eje X" onClick={() => addXAxis(xAxes.length * 3000, `X${xAxes.length + 1}`)}>X</SideButton>
      <SideButton title="+ Eje Y" onClick={() => addYAxis(yAxes.length * 3000, `Y${yAxes.length + 1}`)}>Y</SideButton>
      <SideButton title="+ Muro" onClick={() => onOpenModal('wall')} className="text-[#3d3d38]">M</SideButton>
      <SideButton title="+ Pilar" onClick={() => onOpenModal('column')} className="text-amber-700">P</SideButton>
      <SideButton title="+ Viga" onClick={() => onOpenModal('beam')} className="text-emerald-700">V</SideButton>
      <div className="border-t border-[#e4e4e0] my-1" />
      <SideButton title="Zoom +" onClick={zoomIn}>+</SideButton>
      <SideButton title="Zoom −" onClick={zoomOut}>−</SideButton>
      <SideButton title="Ajustar vista" onClick={() => fitToContent(canvasSize.width, canvasSize.height)}>⌂</SideButton>
      <SideButton
        title={selectedElementId == null ? 'Zoom a selección (selecciona un elemento primero)' : 'Zoom a selección'}
        onClick={() => selectedElementId != null && zoomToElement(selectedElementId, canvasSize.width, canvasSize.height)}
        className={selectedElementId == null ? 'text-[#c8c8c2] cursor-not-allowed' : 'text-blue-700'}
      >
        ⊡
      </SideButton>
      {zLevels.length > 0 && (
        <>
          <div className="border-t border-[#e4e4e0] my-1" />
          <SideButton title="Nivel superior" onClick={goToNextZLevel} className="text-purple-700">↑</SideButton>
          <SideButton title="Nivel inferior" onClick={goToPreviousZLevel} className="text-purple-700">↓</SideButton>
        </>
      )}
    </div>
  );
}
