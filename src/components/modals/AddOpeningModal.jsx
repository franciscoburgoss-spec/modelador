// components/modals/AddOpeningModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { resolveWallGeometry, isWallXRun } from '../../core/elementGeometry.js';
import { buildElementsById, isElementRef, resolveAxisRef } from '../../core/elementReferences.js';
import { getWallDisplayName } from '../../core/naming.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, NumberInput, FormulaInput, AxisRefSelect, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { resolveValue, buildParamsMap, isFormula } from '../../core/projectParams.js';

const DEFAULTS = {
  wallId: '', type: 'window', libraryId: '', width: 900, height: 1200, sillHeight: 900,
  positionMode: 'edge', position: '', referenceAxisId: '', referenceEdge: 'left', edgeOffset: 0
};

/** Centro del vano a partir de un eje de referencia + borde + offset (misma fórmula que el original). */
function centerFromEdge(axisPosition, edgeOffset, width, referenceEdge) {
  if (referenceEdge === 'right') return axisPosition - edgeOffset - width / 2;
  return axisPosition + edgeOffset + width / 2;
}

// referenceAxisId puede ser un ID de eje de grilla (Number-ificar al guardar) o una
// referencia a otro elemento ({refElementId, edge}, dejar tal cual) — mismo patrón que
// normalizeAxisField en los demás modales de creación.
function normalizeAxisField(raw) {
  return isElementRef(raw) ? raw : Number(raw);
}

export default function AddOpeningModal({ open, editingId = null, wallId: editingWallId = null, onClose }) {
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const openingTemplates = useModelStore((s) => s.model.library.openingTemplates);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const paramsMap = buildParamsMap(projectParams);
  const addOpeningToWall = useModelStore((s) => s.addOpeningToWall);
  const updateOpening = useModelStore((s) => s.updateOpening);
  const walls = useMemo(() => elements.filter(el => el.type === 'wall'), [elements]);
  const elementsById = useMemo(() => buildElementsById(elements), [elements]);

  const [wallId, setWallId] = useState(DEFAULTS.wallId);
  const [type, setType] = useState(DEFAULTS.type);
  const [libraryId, setLibraryId] = useState(DEFAULTS.libraryId);
  const [width, setWidth] = useState(DEFAULTS.width);
  const [height, setHeight] = useState(DEFAULTS.height);
  const [sillHeight, setSillHeight] = useState(DEFAULTS.sillHeight);
  const [positionMode, setPositionMode] = useState(DEFAULTS.positionMode);
  const [position, setPosition] = useState(DEFAULTS.position);
  const [referenceAxisId, setReferenceAxisId] = useState(DEFAULTS.referenceAxisId);
  const [referenceEdge, setReferenceEdge] = useState(DEFAULTS.referenceEdge);
  const [edgeOffset, setEdgeOffset] = useState(DEFAULTS.edgeOffset);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingId && editingWallId) {
      const wall = elements.find(e => e.id === editingWallId);
      const opening = wall?.openings?.find(o => o.id === editingId);
      if (!opening) return;
      setWallId(editingWallId);
      setType(opening.type);
      setLibraryId(opening.libraryId ?? '');
      setWidth(opening.width);
      setHeight(opening.height);
      setSillHeight(opening.sillHeight ?? 900);
      // Si se creó con eje de referencia, vuelve a abrir en ese modo; si no, en modo absoluto.
      if (opening.referenceAxisId != null) {
        setPositionMode('edge');
        setReferenceAxisId(opening.referenceAxisId);
        setReferenceEdge(opening.referenceEdge ?? 'left');
        setEdgeOffset(opening.edgeOffset ?? 0);
      } else {
        setPositionMode('absolute');
      }
      setPosition(opening.position);
    } else {
      setWallId(DEFAULTS.wallId); setType(DEFAULTS.type); setLibraryId(DEFAULTS.libraryId);
      setWidth(DEFAULTS.width); setHeight(DEFAULTS.height); setSillHeight(DEFAULTS.sillHeight);
      setPositionMode(DEFAULTS.positionMode); setPosition(DEFAULTS.position);
      setReferenceAxisId(DEFAULTS.referenceAxisId); setReferenceEdge(DEFAULTS.referenceEdge); setEdgeOffset(DEFAULTS.edgeOffset);
    }
  }, [open, editingId, editingWallId]);

  const templatesForType = openingTemplates.filter(t => t.itemType === type);
  const selectedWall = walls.find(w => w.id === Number(wallId));
  const wallInfo = useMemo(() => {
    if (!selectedWall) return null;
    const geo = resolveWallGeometry(selectedWall, grid, {}, elementsById);
    if (!geo) return null;
    const isXRun = isWallXRun(selectedWall);
    const axisType = isXRun ? 'x' : 'y';
    const min = isXRun ? Math.min(geo.p1.x, geo.p2.x) : Math.min(geo.p1.y, geo.p2.y);
    const max = isXRun ? Math.max(geo.p1.x, geo.p2.x) : Math.max(geo.p1.y, geo.p2.y);
    return { axisType, min, max };
  }, [selectedWall, grid, elementsById]);

  // Solo los ejes del mismo tipo que la dirección del muro Y que caen dentro de su rango real —
  // no todos los del proyecto, solo los que efectivamente cruzan este muro.
  const referenceAxes = wallInfo
    ? (wallInfo.axisType === 'x' ? grid.xAxes : grid.yAxes).filter(a => a.position >= wallInfo.min - 0.5 && a.position <= wallInfo.max + 0.5)
    : [];
  const resolvedRefPosition = wallInfo && referenceAxisId !== ''
    ? resolveAxisRef(normalizeAxisField(referenceAxisId), wallInfo.axisType, grid, elementsById, paramsMap)
    : null;

  const resolvedWidth = resolveValue(width, paramsMap, elementsById);
  const computedPosition = positionMode === 'edge' && resolvedRefPosition != null
    ? centerFromEdge(resolvedRefPosition, Number(edgeOffset) || 0, isFinite(resolvedWidth) ? resolvedWidth : 0, referenceEdge)
    : Number(position);

  const handleSectionChange = (id) => {
    setLibraryId(id);
    const tpl = templatesForType.find(t => t.id === Number(id));
    if (tpl) { setWidth(tpl.width); setHeight(tpl.height); if (type === 'window') setSillHeight(tpl.sillHeight ?? 900); }
  };

  const handleSubmit = () => {
    if (!selectedWall || !wallInfo) return setError('Selecciona un muro.');
    if (positionMode === 'edge' && resolvedRefPosition == null) return setError('Selecciona un eje o elemento de referencia válido.');
    const pos = computedPosition;
    if (Number.isNaN(pos)) return setError('Ingresa la posición a lo largo del muro.');
    if (pos < wallInfo.min || pos > wallInfo.max) return setError(`El vano queda fuera de los límites del muro (rango ${wallInfo.min.toFixed(0)} a ${wallInfo.max.toFixed(0)}).`);

    const rHeight = resolveValue(height, paramsMap, elementsById);
    const rSill = resolveValue(sillHeight, paramsMap, elementsById);
    if (!isFinite(resolvedWidth) || !isFinite(rHeight) || (type === 'window' && !isFinite(rSill))) {
      return setError('Ancho, alto o altura de antepecho referencian un parámetro inexistente o tienen una fórmula inválida.');
    }
    if (resolvedWidth <= 0 || rHeight <= 0) return setError('Ancho y alto deben ser mayores a 0.');

    const patch = {
      type,
      axisType: wallInfo.axisType,
      position: pos,
      width: isFormula(width) ? width : Number(width),
      height: isFormula(height) ? height : Number(height),
      sillHeight: type === 'door' ? 0 : (isFormula(sillHeight) ? sillHeight : Number(sillHeight)),
      libraryId: libraryId ? Number(libraryId) : null,
      referenceAxisId: positionMode === 'edge' ? normalizeAxisField(referenceAxisId) : null,
      referenceEdge: positionMode === 'edge' ? referenceEdge : null,
      edgeOffset: positionMode === 'edge' ? Number(edgeOffset) || 0 : null
    };

    if (editingId && editingWallId) updateOpening(editingWallId, editingId, patch);
    else addOpeningToWall(selectedWall.id, patch);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Editar vano' : 'Nuevo vano'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : 'Crear'}</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>

      <Field label="Muro">
        <SelectInput value={wallId} onChange={(e) => { setWallId(e.target.value); setPosition(''); setReferenceAxisId(''); }} disabled={!!editingId}>
          <option value="">--</option>
          {walls.map(w => <option key={w.id} value={w.id}>{getWallDisplayName(w, grid)}</option>)}
        </SelectInput>
      </Field>

      <Field label="Tipo">
        <SelectInput value={type} onChange={(e) => { setType(e.target.value); setLibraryId(''); }}>
          <option value="window">Ventana</option>
          <option value="door">Puerta</option>
        </SelectInput>
      </Field>

      <Field label="Plantilla de librería">
        <SelectInput value={libraryId} onChange={(e) => handleSectionChange(e.target.value)}>
          <option value="">-- Personalizado --</option>
          {templatesForType.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </SelectInput>
      </Field>

      <Field label="Cómo ubicarlo">
        <SelectInput value={positionMode} onChange={(e) => setPositionMode(e.target.value)}>
          <option value="edge">Por eje de referencia (borde izq./der. + offset)</option>
          <option value="absolute">Posición absoluta en el muro</option>
        </SelectInput>
      </Field>

      {positionMode === 'edge' ? (
        <>
          <Field label="Eje o elemento de referencia">
            <AxisRefSelect
              value={referenceAxisId}
              onChange={setReferenceAxisId}
              axes={referenceAxes}
              elements={elements}
              excludeElementId={selectedWall?.id}
              grid={grid}
            />
          </Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Borde del vano hacia el eje">
              <SelectInput value={referenceEdge} onChange={(e) => setReferenceEdge(e.target.value)}>
                <option value="left">Izquierdo</option>
                <option value="right">Derecho</option>
              </SelectInput>
            </Field>
            <Field label="Offset desde el eje" hint="mm">
              <NumberInput value={edgeOffset} onChange={(e) => setEdgeOffset(e.target.value)} />
            </Field>
          </div>
          {resolvedRefPosition != null && !Number.isNaN(computedPosition) && (
            <p className="text-xs text-[#8a8a85] -mt-2 mb-3">Posición resultante: {computedPosition.toFixed(0)} mm</p>
          )}
        </>
      ) : (
        <Field label="Posición a lo largo del muro" hint={wallInfo ? `${wallInfo.min.toFixed(0)} a ${wallInfo.max.toFixed(0)} mm` : 'mm'}>
          <NumberInput value={position} onChange={(e) => setPosition(e.target.value)} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Ancho" hint="mm, o =parametro">
          <FormulaInput value={width} onChange={setWidth} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
        <Field label="Alto" hint="mm, o =parametro">
          <FormulaInput value={height} onChange={setHeight} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
      </div>

      {type === 'window' && (
        <Field label="Altura de antepecho" hint="mm, o =parametro">
          <FormulaInput value={sillHeight} onChange={setSillHeight} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
      )}
    </Modal>
  );
}
