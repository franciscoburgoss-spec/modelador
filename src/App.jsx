import { useState, useRef, useEffect } from 'react';
import Canvas from './components/Canvas.jsx';
import MenuBar from './components/MenuBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';
import AddColumnModal from './components/modals/AddColumnModal.jsx';
import AddBeamModal from './components/modals/AddBeamModal.jsx';
import AddWallModal from './components/modals/AddWallModal.jsx';
import AddOpeningModal from './components/modals/AddOpeningModal.jsx';
import AddFoundationModal from './components/modals/AddFoundationModal.jsx';
import GridDefinitionModal from './components/modals/GridDefinitionModal.jsx';
import AuditModal from './components/modals/AuditModal.jsx';
import TakeoffModal from './components/modals/TakeoffModal.jsx';
import ValidationModal from './components/modals/ValidationModal.jsx';
import AnalysisReadinessModal from './components/modals/AnalysisReadinessModal.jsx';
import Viewer3DModal from './components/modals/Viewer3DModal.jsx';
import LibraryModal from './components/modals/LibraryModal.jsx';
import AddAuxAxisModal from './components/modals/AddAuxAxisModal.jsx';
import ProjectParamsModal from './components/modals/ProjectParamsModal.jsx';
import ProjectInfoModal from './components/modals/ProjectInfoModal.jsx';
import GenerativePlacementModal from './components/modals/GenerativePlacementModal.jsx';
import GenerateFoundationsModal from './components/modals/GenerateFoundationsModal.jsx';
import FoundationAnalysisModal from './components/modals/FoundationAnalysisModal.jsx';
import WallSplitMergeModal from './components/modals/WallSplitMergeModal.jsx';
import AddDimensionModal from './components/modals/AddDimensionModal.jsx';
import MetalconModulationModal from './components/modals/MetalconModulationModal.jsx';
import OsbModulationModal from './components/modals/OsbModulationModal.jsx';
import OsbNestingModal from './components/modals/OsbNestingModal.jsx';
import WallTypesModal from './components/modals/WallTypesModal.jsx';
import ElementInventoryModal from './components/modals/ElementInventoryModal.jsx';
import RoofTrussModal from './components/modals/RoofTrussModal.jsx';
import RoofPlaneModal from './components/modals/RoofPlaneModal.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import { useModelStore } from './store/useModelStore.js';
import { useKeyboardShortcuts } from './core/useKeyboardShortcuts.js';
import { useAutosave } from './core/useAutosave.js';
import AutosaveBanner from './components/AutosaveBanner.jsx';
import ModelImportBanner from './components/ModelImportBanner.jsx';
import { hydrateProjectRuntimeRecents } from './adapters/projectRecentPersistence.js';

export default function App({ projectRuntime = null }) {
  const [activeModal, setActiveModal] = useState(null); // 'wall' | 'column' | 'beam' | 'opening' | 'foundation' | 'grid' | 'audit' | 'validate' | 'viewer3d' | { name, ... } | null
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [quickAddValues, setQuickAddValues] = useState(null);
  const canvasWrapRef = useRef(null);
  const projectRecentsHydratedRef = useRef(false);

  const setViewMode = useModelStore((s) => s.setViewMode);
  const viewMode = useModelStore((s) => s.model.viewMode);
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);
  const currentZLevelId = useModelStore((s) => s.model.currentZLevelId);
  const goToPreviousZLevel = useModelStore((s) => s.goToPreviousZLevel);
  const goToNextZLevel = useModelStore((s) => s.goToNextZLevel);
  const currentLevel = zLevels.find(z => z.id === currentZLevelId);
  const layout = useModelStore((s) => s.layout);
  const loadModel = useModelStore((s) => s.loadModel);
  const modelImportFeedback = useModelStore((s) => s.modelImportFeedback);
  const dismissModelImportFeedback = useModelStore((s) => s.dismissModelImportFeedback);
  const projectDocument = useModelStore((s) => s.projectDocument);
  const hydrateProjectRecentPaths = useModelStore((s) => s.hydrateProjectRecentPaths);
  const reportProjectOperationError = useModelStore((s) => s.reportProjectOperationError);

  useKeyboardShortcuts();

  // ★ Fix: autocarga el último modelo guardado al abrir la app. Antes, recargar la página
  // (F5) perdía todo el trabajo porque solo se cargaba manualmente vía "Archivo > Cargar".
  // Debe correr ANTES del efecto de useAutosave para que la comparación del snapshot sea
  // contra el modelo ya cargado y no contra el modelo vacío inicial.
  useEffect(() => {
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `${projectDocument.dirty ? '* ' : ''}${projectDocument.title} — Modelador`;
  }, [projectDocument.dirty, projectDocument.title]);

  useEffect(() => {
    if (
      projectRecentsHydratedRef.current
      || typeof projectRuntime?.loadRecentPaths !== 'function'
    ) {
      return;
    }
    projectRecentsHydratedRef.current = true;
    void hydrateProjectRuntimeRecents(projectRuntime, {
      hydrateProjectRecentPaths,
      reportProjectOperationError
    });
  }, [hydrateProjectRecentPaths, projectRuntime, reportProjectOperationError]);

  const autosave = useAutosave();

  const isModal = (name) => typeof activeModal === 'object' && activeModal?.name === name;
  const editIdFor = (name) => (isModal(name) ? activeModal.editId : null);
  const handleEditRequest = (type, id, wallId) => setActiveModal({ name: type, editId: id, wallId });
  const handleQuickAddColumn = (values) => {
    setQuickAddValues(values);
    setActiveModal('column');
  };

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AutosaveBanner pending={autosave.pending} onRestore={autosave.restore} onDismiss={autosave.dismiss} />
      <ModelImportBanner feedback={modelImportFeedback} onDismiss={dismissModelImportFeedback} />
      <div className="flex items-center justify-between border-b border-[#e4e4e0]">
        <MenuBar
          onOpenModal={setActiveModal}
          canvasSize={canvasSize}
          projectRuntime={projectRuntime}
        />
        <div className="flex items-center gap-2 px-3">
          <label className="text-xs text-[#5a5a55]">Vista</label>
          <select
            className="text-sm border border-[#d8d8d3] rounded-md px-2 py-1.5 bg-white text-[#3d3d38] focus:outline-none focus:ring-2 focus:ring-[#3d3d3855] focus:border-[#3d3d38]"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="plan">Planta</option>
            {xAxes.map(a => <option key={`ex${a.id}`} value={`elevation-x-${a.id}`}>Elevación X: {a.label}</option>)}
            {yAxes.map(a => <option key={`ey${a.id}`} value={`elevation-y-${a.id}`}>Elevación Y: {a.label}</option>)}
            <option value="3d">Vista 3D</option>
          </select>
        </div>
        {zLevels.length > 0 && (
          <div className="flex items-center gap-1.5 px-3">
            <button className="px-2.5 py-1.5 border border-[#d8d8d3] hover:bg-[#f2f2ee] rounded-md text-sm text-[#3d3d38] transition-colors" onClick={goToPreviousZLevel}>←</button>
            <div className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-sm font-semibold min-w-[130px] text-center">
              {currentLevel ? `${currentLevel.label} (${currentLevel.elevation} mm)` : 'Sin nivel'}
            </div>
            <button className="px-2.5 py-1.5 border border-[#d8d8d3] hover:bg-[#f2f2ee] rounded-md text-sm text-[#3d3d38] transition-colors" onClick={goToNextZLevel}>→</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar canvasSize={canvasSize} onOpenModal={setActiveModal} />
        <div ref={canvasWrapRef} style={{ flex: 1, position: 'relative', display: 'flex', gap: 12, padding: 12, minHeight: 0 }}>
          {layout === 'split' ? (
            <>
              <div style={{ flex: 1, position: 'relative', border: '1px solid #d8d8d3', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <Canvas panelId="a" showLocalToolbar onQuickAddColumn={handleQuickAddColumn} />
              </div>
              <div style={{ flex: 1, position: 'relative', border: '1px solid #d8d8d3', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <Canvas panelId="b" showLocalToolbar onQuickAddColumn={handleQuickAddColumn} />
              </div>
              <PropertiesPanel onEdit={handleEditRequest} />
            </>
          ) : (
            <>
              <div style={{ flex: 1, position: 'relative', border: '1px solid #d8d8d3', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <Canvas panelId="a" onQuickAddColumn={handleQuickAddColumn} />
              </div>
              <PropertiesPanel onEdit={handleEditRequest} />
            </>
          )}
        </div>
      </div>

      <AddColumnModal
        open={activeModal === 'column' || isModal('column')}
        editingId={editIdFor('column')}
        initialValues={quickAddValues}
        onClose={() => { setActiveModal(null); setQuickAddValues(null); }}
      />
      <AddBeamModal open={activeModal === 'beam' || isModal('beam')} editingId={editIdFor('beam')} onClose={() => setActiveModal(null)} />
      <AddWallModal open={activeModal === 'wall' || isModal('wall')} editingId={editIdFor('wall')} onClose={() => setActiveModal(null)} />
      <AddOpeningModal
        open={activeModal === 'opening' || isModal('opening')}
        editingId={editIdFor('opening')}
        wallId={isModal('opening') ? activeModal.wallId : null}
        onClose={() => setActiveModal(null)}
      />
      <AddFoundationModal open={activeModal === 'foundation' || isModal('foundation')} editingId={editIdFor('foundation')} onClose={() => setActiveModal(null)} />
      <GridDefinitionModal open={activeModal === 'grid'} onClose={() => setActiveModal(null)} />
      <AuditModal open={activeModal === 'audit'} onClose={() => setActiveModal(null)} canvasSize={canvasSize} />
      <ValidationModal open={activeModal === 'validate'} onClose={() => setActiveModal(null)} canvasSize={canvasSize} />
      <AnalysisReadinessModal open={activeModal === 'analysis-readiness'} onClose={() => setActiveModal(null)} canvasSize={canvasSize} />
      <Viewer3DModal open={activeModal === 'viewer3d'} onClose={() => setActiveModal(null)} />
      <LibraryModal
        open={isModal('library')}
        initialType={isModal('library') ? activeModal.type : 'wall'}
        onClose={() => setActiveModal(null)}
      />
      <AddAuxAxisModal
        open={isModal('auxAxis')}
        initialDirection={isModal('auxAxis') ? activeModal.direction : 'x'}
        onClose={() => setActiveModal(null)}
      />
      <ProjectParamsModal open={activeModal === 'projectParams'} onClose={() => setActiveModal(null)} />
      <ProjectInfoModal open={activeModal === 'projectInfo'} onClose={() => setActiveModal(null)} />
      <GenerativePlacementModal open={activeModal === 'generativePlacement'} onClose={() => setActiveModal(null)} />
      <GenerateFoundationsModal open={activeModal === 'generateFoundations'} onClose={() => setActiveModal(null)} />
      <FoundationAnalysisModal open={activeModal === 'foundationAnalysis'} onClose={() => setActiveModal(null)} />
      <WallSplitMergeModal open={activeModal === 'wallSplit' || isModal('wallSplit')} editId={editIdFor('wallSplit')} onClose={() => setActiveModal(null)} />
      <TakeoffModal open={activeModal === 'takeoff'} onClose={() => setActiveModal(null)} />
      <AddDimensionModal open={activeModal === 'dimensions'} onClose={() => setActiveModal(null)} />
      <MetalconModulationModal open={activeModal === 'metalconModulation'} onClose={() => setActiveModal(null)} />
      <OsbModulationModal open={activeModal === 'osbModulation'} onClose={() => setActiveModal(null)} />
      <OsbNestingModal open={activeModal === 'osbNesting'} onClose={() => setActiveModal(null)} />
      <WallTypesModal open={activeModal === 'wallTypes'} onClose={() => setActiveModal(null)} />
      <ElementInventoryModal
        open={activeModal === 'elementInventory'}
        onClose={() => setActiveModal(null)}
        onEdit={handleEditRequest}
        canvasSize={canvasSize}
      />
      <RoofTrussModal
        open={activeModal === 'roofTruss' || isModal('roofTruss')}
        initialSystemId={editIdFor('roofTruss')}
        onClose={() => setActiveModal(null)}
      />
      {/* ★ B4.7.4b — se auto-abre cuando el contorno del faldón se cierra (roofPlaneDraft.closed) */}
      <RoofPlaneModal />
      <FilterPanel />
    </div>
  );
}
