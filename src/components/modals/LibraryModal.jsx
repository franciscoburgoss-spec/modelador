// components/modals/LibraryModal.jsx
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { TextInput, NumberInput, SelectInput, FormulaInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { resolveValue, buildParamsMap, isFormula } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';

const SHAPE_OPTIONS = [
  { value: 'rect', label: 'Rectangular (sólido)' },
  { value: 'C', label: 'Perfil C (canal)' },
  { value: 'C-doble', label: 'Perfil C doble' },
  { value: 'cajon', label: 'Perfil cajón' },
  { value: 'I', label: 'Perfil I / H' }
];

const MATERIAL_CATEGORY_OPTIONS = [
  { value: 'madera', label: 'Madera' },
  { value: 'metalcon', label: 'Metalcon (acero liviano)' },
  { value: 'acero', label: 'Acero estructural' },
  { value: 'hormigon', label: 'Hormigón' },
  { value: 'otro', label: 'Otro' }
];

const DIAGONAL_PATTERN_OPTIONS = [
  { value: 'W', label: 'W (diagonales alternadas entre montantes)' },
  { value: 'none', label: 'Sin diagonales' }
];

const TRUSS_ROLE_FIELDS = [
  { name: 'topChord', label: 'Perfil cuerda superior' },
  { name: 'bottomChord', label: 'Perfil cuerda inferior' },
  { name: 'post', label: 'Perfil montante' },
  { name: 'diagonal', label: 'Perfil diagonal' }
];

const TYPE_CONFIG = {
  material: {
    key: 'materials', label: 'Material', group: 'Materiales', hasMaterialCategory: true,
    fields: [
      { name: 'elasticModulus', label: 'Módulo de elasticidad E (MPa)', default: 200000 },
      { name: 'strength', label: "Resistencia (MPa) — fy (acero) o f'c (hormigón)", default: 250 },
      { name: 'density', label: 'Densidad (kg/m³)', default: 7850 }
    ]
  },
  wall: { key: 'wallSections', label: 'Sección de muro', group: 'Estructura', hasComposition: true, fields: [{ name: 'thickness', label: 'Espesor total (mm)', default: 200 }] },
  column: { key: 'columnSections', label: 'Sección de pilar', group: 'Estructura', hasShape: true, hasMaterial: true, fields: [{ name: 'widthX', label: 'Ancho X — envolvente (mm)', default: 300 }, { name: 'widthY', label: 'Ancho Y — envolvente (mm)', default: 300 }] },
  beam: { key: 'beamSections', label: 'Sección de viga', group: 'Estructura', hasShape: true, hasMaterial: true, fields: [{ name: 'width', label: 'Ancho — envolvente (mm)', default: 300 }, { name: 'height', label: 'Alto — envolvente (mm)', default: 500 }] },
  cimiento: { key: 'foundationSections', label: 'Cimiento', group: 'Fundaciones', itemType: 'cimiento', fields: [{ name: 'width', label: 'Ancho (mm)', default: 400 }, { name: 'depth', label: 'Profundidad (mm)', default: 600 }, { name: 'subgradeModulus', label: 'Balasto (kgf/cm3)', default: 5 }] },
  sobrecimiento: { key: 'foundationSections', label: 'Sobrecimiento', group: 'Fundaciones', itemType: 'sobrecimiento', fields: [{ name: 'width', label: 'Ancho (mm)', default: 200 }, { name: 'height', label: 'Altura (mm)', default: 400 }] },
  aislada: { key: 'foundationSections', label: 'Zapata aislada', group: 'Fundaciones', itemType: 'aislada', fields: [{ name: 'lengthX', label: 'Largo X (mm)', default: 1000 }, { name: 'lengthY', label: 'Largo Y (mm)', default: 1000 }, { name: 'depth', label: 'Altura (mm)', default: 400 }, { name: 'subgradeModulus', label: 'Balasto (kgf/cm3)', default: 5 }] },
  door: { key: 'openingTemplates', label: 'Puerta tipo', group: 'Vanos', itemType: 'door', fields: [{ name: 'width', label: 'Ancho (mm)', default: 900 }, { name: 'height', label: 'Alto (mm)', default: 2100 }] },
  window: { key: 'openingTemplates', label: 'Ventana tipo', group: 'Vanos', itemType: 'window', fields: [{ name: 'width', label: 'Ancho (mm)', default: 1200 }, { name: 'height', label: 'Alto (mm)', default: 1200 }, { name: 'sillHeight', label: 'Altura de alféizar (mm)', default: 900 }] },
  trussTemplate: { key: 'trussTemplates', label: 'Plantilla de cercha', group: 'Techumbre', hasTrussFields: true, fields: [{ name: 'postSpacing', label: 'Espaciamiento de montantes (mm)', default: 600 }] }
};

const GROUPS = ['Materiales', 'Estructura', 'Fundaciones', 'Vanos', 'Techumbre'];

let _layerIdCounter = 1;
function newLayer() {
  return { id: `l${_layerIdCounter++}`, material: '', thickness: 10 };
}

export default function LibraryModal({ open, initialType = 'wall', onClose }) {
  const [type, setType] = useState(initialType);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [values, setValues] = useState(() => Object.fromEntries(TYPE_CONFIG[initialType].fields.map(f => [f.name, f.default])));
  const [shape, setShape] = useState('rect');
  const [catalogDesignation, setCatalogDesignation] = useState('');
  const [composition, setComposition] = useState('solido');
  const [layers, setLayers] = useState([]);
  const [materialCategory, setMaterialCategory] = useState('hormigon');
  const [materialDescription, setMaterialDescription] = useState('');
  const [sectionMaterialId, setSectionMaterialId] = useState('');
  const [sectionProfileId, setSectionProfileId] = useState('');
  const [diagonalPattern, setDiagonalPattern] = useState('W');
  const [trussProfiles, setTrussProfiles] = useState({ topChord: '', bottomChord: '', post: '', diagonal: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setEditingId(null);
    setName('');
    setValues(Object.fromEntries(TYPE_CONFIG[initialType].fields.map(f => [f.name, f.default])));
    setShape('rect');
    setCatalogDesignation('');
    setComposition('solido');
    setLayers([]);
    setMaterialCategory('hormigon');
    setMaterialDescription('');
    setSectionMaterialId('');
    setSectionProfileId('');
    setDiagonalPattern('W');
    setTrussProfiles({ topChord: '', bottomChord: '', post: '', diagonal: '' });
    setError('');
  }, [open, initialType]);

  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const elements = useModelStore((s) => s.model.elements);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);
  const library = useModelStore((s) => s.model.library);
  const addLibraryItem = useModelStore((s) => s.addLibraryItem);
  const updateLibraryItem = useModelStore((s) => s.updateLibraryItem);
  const removeLibraryItem = useModelStore((s) => s.removeLibraryItem);

  const cfg = TYPE_CONFIG[type];
  const allItems = library[cfg.key] || [];
  const items = cfg.itemType ? allItems.filter(i => i.itemType === cfg.itemType) : allItems;
  const materialsCatalog = library.materials || [];
  const metalconProfilesCatalog = library.metalconProfiles || [];
  const selectedMaterial = materialsCatalog.find(m => m.id === Number(sectionMaterialId));
  // Columnas/vigas de metalcon se arman con perfiles C (montantes armados) — mismo criterio
  // de filtro que usa MetalconModulationModal para los montantes de muro.
  const availableProfiles = metalconProfilesCatalog.filter(p => p.shape === 'C');
  const loadMetalconCatalog = useModelStore((s) => s.loadMetalconCatalog);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setValues(Object.fromEntries(cfg.fields.map(f => [f.name, f.default])));
    setShape('rect');
    setCatalogDesignation('');
    setComposition('solido');
    setLayers([]);
    setMaterialCategory('hormigon');
    setMaterialDescription('');
    setSectionMaterialId('');
    setSectionProfileId('');
    setDiagonalPattern('W');
    setTrussProfiles({ topChord: '', bottomChord: '', post: '', diagonal: '' });
  };

  const selectType = (t) => {
    setType(t);
    setEditingId(null);
    setName('');
    setValues(Object.fromEntries(TYPE_CONFIG[t].fields.map(f => [f.name, f.default])));
    setShape('rect');
    setCatalogDesignation('');
    setComposition('solido');
    setLayers([]);
    setMaterialCategory('hormigon');
    setMaterialDescription('');
    setSectionMaterialId('');
    setSectionProfileId('');
    setDiagonalPattern('W');
    setTrussProfiles({ topChord: '', bottomChord: '', post: '', diagonal: '' });
    setError('');
  };

  const loadItem = (item) => {
    setEditingId(item.id);
    setName(item.name);
    setValues(Object.fromEntries(cfg.fields.map(f => [f.name, item[f.name]])));
    setShape(item.shape || 'rect');
    setCatalogDesignation(item.catalogDesignation || '');
    setComposition(item.composition || 'solido');
    setLayers(item.layers || []);
    setMaterialCategory(item.category || 'hormigon');
    setMaterialDescription(item.description || '');
    setSectionMaterialId(item.materialId != null ? String(item.materialId) : '');
    setSectionProfileId(item.metalconProfileId != null ? String(item.metalconProfileId) : '');
    setDiagonalPattern(item.diagonalPattern || 'W');
    setTrussProfiles({
      topChord: item.profiles?.topChord || '', bottomChord: item.profiles?.bottomChord || '',
      post: item.profiles?.post || '', diagonal: item.profiles?.diagonal || ''
    });
  };

  const updateLayerTotal = (nextLayers) => {
    setLayers(nextLayers);
    if (composition !== 'solido' && nextLayers.length > 0) {
      const total = nextLayers.reduce((sum, l) => sum + (Number(l.thickness) || 0), 0);
      setValues(v => ({ ...v, thickness: total }));
    }
  };

  const handleSave = () => {
    if (!name.trim()) return setError('Ingresa un nombre.');
    for (const f of cfg.fields) {
      const resolved = resolveValue(values[f.name], paramsMap, elementsById);
      if (!isFinite(resolved)) return setError(`${f.label}: referencia un parámetro inexistente o tiene una fórmula inválida.`);
      if (resolved <= 0) return setError(`${f.label} debe ser mayor a 0.`);
    }
    const normalizedValues = Object.fromEntries(
      cfg.fields.map(f => [f.name, isFormula(values[f.name]) ? values[f.name] : Number(values[f.name])])
    );
    const extra = {};
    const usingRealProfile = selectedMaterial?.category === 'metalcon' && sectionProfileId;
    const realProfile = usingRealProfile ? availableProfiles.find(p => p.id === Number(sectionProfileId)) : null;
    if (cfg.hasShape) {
      if (realProfile) { extra.shape = 'C'; extra.catalogDesignation = realProfile.catalogDesignation; }
      else { extra.shape = shape; if (shape !== 'rect') extra.catalogDesignation = catalogDesignation; }
    }
    if (cfg.hasComposition) { extra.composition = composition; if (composition !== 'solido') extra.layers = layers; }
    if (cfg.hasMaterialCategory) { extra.category = materialCategory; if (materialDescription.trim()) extra.description = materialDescription.trim(); }
    if (cfg.hasMaterial) {
      extra.materialId = sectionMaterialId ? Number(sectionMaterialId) : null;
      extra.metalconProfileId = (selectedMaterial?.category === 'metalcon' && sectionProfileId) ? Number(sectionProfileId) : null;
    }
    if (cfg.hasTrussFields) {
      extra.diagonalPattern = diagonalPattern;
      extra.profiles = { ...trussProfiles };
    }
    const item = { name: name.trim(), ...(cfg.itemType ? { itemType: cfg.itemType } : {}), ...normalizedValues, ...extra };
    if (editingId) updateLibraryItem(cfg.key, editingId, item);
    else addLibraryItem(cfg.key, item);
    setError('');
    resetForm();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Librería de elementos"
      width="max-w-3xl"
      bodyClassName="p-0 flex"
      headerAction={<>
        {editingId && <Button variant="secondary" className="!py-1 !text-xs" onClick={resetForm}>Cancelar edición</Button>}
        <Button variant="primary" className="!py-1 !text-xs" onClick={handleSave}>{editingId ? 'Guardar cambios' : 'Agregar'}</Button>
      </>}
    >
      <nav className="w-44 border-r border-[#e4e4e0] bg-[#f2f2ee] overflow-y-auto shrink-0 py-2">
        {GROUPS.map(group => (
          <div key={group} className="mb-2">
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a8a85]">{group}</div>
            {Object.entries(TYPE_CONFIG).filter(([, c]) => c.group === group).map(([t, c]) => (
              <button
                key={t}
                className={`w-full text-left px-3 py-1.5 text-sm ${type === t ? 'bg-[#e4e4e0] text-[#26251f] font-medium' : 'text-[#5a5a55] hover:bg-[#f2f2ee]'}`}
                onClick={() => selectType(t)}
              >
                {c.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-[#e4e4e0] flex flex-col min-h-0">
          <div className="px-4 py-2 text-xs font-medium text-[#5a5a55] border-b border-[#e4e4e0] shrink-0">{cfg.label} guardados</div>
          <ul className="overflow-y-auto flex-1">
            {items.length === 0 && <li className="px-4 py-3 text-[#8a8a85] text-xs">No hay elementos guardados todavía.</li>}
            {items.map(item => (
              <li key={item.id} className={`px-4 py-2 flex justify-between items-center hover:bg-[#f2f2ee] ${editingId === item.id ? 'bg-[#e4e4e0]' : ''}`}>
                <button className="text-left text-[#3d3d38] text-sm truncate pr-2" onClick={() => loadItem(item)}>
                  {item.name}
                  {item.category && <span className="text-[#8a8a85] text-xs ml-1.5">({MATERIAL_CATEGORY_OPTIONS.find(c => c.value === item.category)?.label})</span>}
                  {item.shape && item.shape !== 'rect' && <span className="text-[#8a8a85] text-xs ml-1.5">({SHAPE_OPTIONS.find(s => s.value === item.shape)?.label})</span>}
                  {item.composition && item.composition !== 'solido' && <span className="text-[#8a8a85] text-xs ml-1.5">(compuesto)</span>}
                  {item.materialId != null && <span className="text-[#8a8a85] text-xs ml-1.5">— {materialsCatalog.find(m => m.id === item.materialId)?.name || 'material eliminado'}</span>}
                  {item.source === 'cintac' && <span className="text-[#8a8a85] text-xs ml-1.5">(semilla Cintac)</span>}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {cfg.hasTrussFields && (
                    <button
                      className="text-[#8a8a85] hover:text-[#3d3d38] text-xs shrink-0"
                      title="Duplicar plantilla"
                      onClick={() => addLibraryItem(cfg.key, { ...item, name: `${item.name} (copia)`, source: undefined })}
                    >
                      Duplicar
                    </button>
                  )}
                  <button
                    className="text-[#8a8a85] hover:text-red-600 text-lg leading-none shrink-0"
                    title="Eliminar"
                    onClick={() => { if (confirm('¿Eliminar este elemento de la librería?')) removeLibraryItem(cfg.key, item.id); }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-1/2 p-4 overflow-y-auto">
          <p className="text-xs font-medium text-[#5a5a55] mb-3">{editingId ? 'Editar' : 'Nuevo'} — {cfg.label}</p>
          <ErrorText>{error}</ErrorText>

          <label className="block text-sm mb-3">
            <span className="block font-medium text-[#3d3d38] mb-1">Nombre</span>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={cfg.hasMaterialCategory ? 'Ej: Hormigón H30' : 'Ej: Poste Metalcon doble 100x40'} />
          </label>

          {cfg.hasShape && !(selectedMaterial?.category === 'metalcon' && sectionProfileId) && (
            <>
              <label className="block text-sm mb-3">
                <span className="block font-medium text-[#3d3d38] mb-1">Forma</span>
                <SelectInput value={shape} onChange={(e) => setShape(e.target.value)}>
                  {SHAPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </label>
              {shape !== 'rect' && (
                <label className="block text-sm mb-3">
                  <span className="block font-medium text-[#3d3d38] mb-1">Designación de catálogo</span>
                  <TextInput value={catalogDesignation} onChange={(e) => setCatalogDesignation(e.target.value)} placeholder="Ej: PGC 100x40x15x2.0" />
                </label>
              )}
            </>
          )}

          {cfg.hasMaterial && (
            <>
              <label className="block text-sm mb-3">
                <span className="block font-medium text-[#3d3d38] mb-1">Material</span>
                <SelectInput value={sectionMaterialId} onChange={(e) => { setSectionMaterialId(e.target.value); setSectionProfileId(''); }}>
                  <option value="">Sin material asignado (genérico al exportar)</option>
                  {materialsCatalog.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({MATERIAL_CATEGORY_OPTIONS.find(c => c.value === m.category)?.label})</option>
                  ))}
                </SelectInput>
                {materialsCatalog.length === 0 && (
                  <p className="text-xs text-[#8a8a85] mt-1">No hay materiales guardados — créalos primero en "Materiales".</p>
                )}
              </label>

              {selectedMaterial?.category === 'metalcon' && (
                <label className="block text-sm mb-3">
                  <span className="block font-medium text-[#3d3d38] mb-1">Perfil del catálogo Metalcon</span>
                  <SelectInput
                    value={sectionProfileId}
                    onChange={(e) => {
                      setSectionProfileId(e.target.value);
                      const profile = availableProfiles.find(p => p.id === Number(e.target.value));
                      if (profile) {
                        const widthField = cfg.fields[0].name; // widthX (pilar) o width (viga)
                        const heightField = cfg.fields[1].name; // widthY (pilar) o height (viga)
                        setValues(v => ({ ...v, [widthField]: profile.B, [heightField]: profile.H }));
                      }
                    }}
                  >
                    <option value="">Sin perfil (solo material, sección rectangular manual)</option>
                    {availableProfiles.map(p => <option key={p.id} value={p.id}>{p.catalogDesignation}</option>)}
                  </SelectInput>
                  {metalconProfilesCatalog.length === 0 && (
                    <div className="mt-1.5">
                      <p className="text-xs text-[#8a8a85] mb-1">El catálogo de perfiles metalcon aún no está cargado en este proyecto.</p>
                      <Button variant="secondary" className="!py-1 !text-xs" onClick={loadMetalconCatalog}>Cargar catálogo Metalcon</Button>
                    </div>
                  )}
                  {sectionProfileId && (
                    <p className="text-xs text-[#8a8a85] mt-1">El ancho/alto de arriba se autocompletó desde el perfil — puedes ajustarlo a mano si arma una sección compuesta (C doble, cajón, etc).</p>
                  )}
                </label>
              )}
            </>
          )}

          {cfg.hasMaterialCategory && (
            <label className="block text-sm mb-3">
              <span className="block font-medium text-[#3d3d38] mb-1">Categoría</span>
              <SelectInput value={materialCategory} onChange={(e) => setMaterialCategory(e.target.value)}>
                {MATERIAL_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            </label>
          )}

          {cfg.hasMaterialCategory && materialCategory === 'metalcon' && (
            <div className="mb-3 -mt-1.5 text-xs text-[#8a8a85]">
              {metalconProfilesCatalog.length === 0 ? (
                <>
                  <p className="mb-1.5">Este material define E/resistencia/densidad. El perfil real (C 2x4x0,85, etc.) se elige después, en "Sección de pilar/viga" o en "Modulación de metalcon" — para eso necesitas cargar el catálogo de perfiles primero.</p>
                  <Button variant="secondary" className="!py-1 !text-xs" onClick={loadMetalconCatalog}>Cargar catálogo Metalcon (Cintac)</Button>
                </>
              ) : (
                <p>El perfil real (C 2x4x0,85, etc.) se elige después, en "Sección de pilar/viga" o en "Modulación de metalcon" — el catálogo de perfiles ya está cargado en este proyecto.</p>
              )}
            </div>
          )}

          {cfg.fields.map(f => (
            <label key={f.name} className="block text-sm mb-3">
              <span className="block font-medium text-[#3d3d38] mb-1">{f.label}</span>
              <FormulaInput value={values[f.name] ?? f.default} onChange={(val) => setValues(v => ({ ...v, [f.name]: val }))} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
            </label>
          ))}

          {cfg.hasTrussFields && (
            <>
              <label className="block text-sm mb-3">
                <span className="block font-medium text-[#3d3d38] mb-1">Patrón de diagonales</span>
                <SelectInput value={diagonalPattern} onChange={(e) => setDiagonalPattern(e.target.value)}>
                  {DIAGONAL_PATTERN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </label>
              {TRUSS_ROLE_FIELDS.map((r) => (
                <label key={r.name} className="block text-sm mb-3">
                  <span className="block font-medium text-[#3d3d38] mb-1">{r.label}</span>
                  <SelectInput value={trussProfiles[r.name]} onChange={(e) => setTrussProfiles(p => ({ ...p, [r.name]: e.target.value }))}>
                    <option value="">Sin perfil asignado</option>
                    {availableProfiles.map(p => <option key={p.code} value={p.code}>{p.catalogDesignation || p.code}</option>)}
                  </SelectInput>
                </label>
              ))}
              {metalconProfilesCatalog.length === 0 && (
                <div className="mb-3 -mt-1.5 text-xs text-[#8a8a85]">
                  <p className="mb-1.5">El catálogo de perfiles metalcon aún no está cargado en este proyecto.</p>
                  <Button variant="secondary" className="!py-1 !text-xs" onClick={loadMetalconCatalog}>Cargar catálogo Metalcon</Button>
                </div>
              )}
            </>
          )}

          {cfg.hasMaterialCategory && (
            <label className="block text-sm mb-3">
              <span className="block font-medium text-[#3d3d38] mb-1">Descripción <span className="font-normal text-xs text-[#8a8a85]">(opcional)</span></span>
              <TextInput value={materialDescription} onChange={(e) => setMaterialDescription(e.target.value)} placeholder="Ej: Hormigón H30, árido máximo 20mm" />
            </label>
          )}
          {cfg.hasShape && shape !== 'rect' && !(selectedMaterial?.category === 'metalcon' && sectionProfileId) && (
            <p className="text-xs text-[#8a8a85] -mt-2 mb-3">La forma y designación son solo información técnica — el ancho/alto de arriba (envolvente) es lo que se usa para dibujar.</p>
          )}

          {cfg.hasComposition && (
            <>
              <label className="block text-sm mb-3">
                <span className="block font-medium text-[#3d3d38] mb-1">Composición</span>
                <SelectInput value={composition} onChange={(e) => { setComposition(e.target.value); if (e.target.value !== 'solido' && layers.length === 0) updateLayerTotal([newLayer(), newLayer()]); }}>
                  <option value="solido">Sólido (hormigón, albañilería, etc.)</option>
                  <option value="SIP">Panel SIP</option>
                  <option value="compuesto">Otro compuesto</option>
                </SelectInput>
              </label>

              {composition !== 'solido' && (
                <div className="mb-3 border border-[#e4e4e0] rounded-md p-3">
                  <p className="text-xs font-medium text-[#5a5a55] mb-2">Capas (de un borde al otro)</p>
                  {layers.map((layer, i) => (
                    <div key={layer.id} className="border border-[#e4e4e0] rounded-md p-2 mb-2 last:mb-0">
                      <div className="flex gap-2 items-center mb-1.5">
                        <TextInput
                          className="flex-1"
                          value={layer.material}
                          placeholder={i === 0 || i === layers.length - 1 ? 'Ej: OSB (borde)' : 'Ej: EPS (núcleo)'}
                          onChange={(e) => updateLayerTotal(layers.map(l => l.id === layer.id ? { ...l, material: e.target.value } : l))}
                        />
                        <button className="text-[#8a8a85] hover:text-red-600 text-lg leading-none shrink-0" onClick={() => updateLayerTotal(layers.filter(l => l.id !== layer.id))}>×</button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="w-24 shrink-0">
                          <NumberInput
                            value={layer.thickness}
                            onChange={(e) => updateLayerTotal(layers.map(l => l.id === layer.id ? { ...l, thickness: Number(e.target.value) } : l))}
                          />
                        </div>
                        <span className="text-xs text-[#8a8a85]">mm</span>
                      </div>
                    </div>
                  ))}
                  <Button variant="secondary" className="!py-1 !text-xs" onClick={() => updateLayerTotal([...layers, newLayer()])}>+ Agregar capa</Button>
                  <p className="text-xs text-[#8a8a85] mt-2">El espesor total (arriba) se recalcula solo al sumar las capas — puedes ajustarlo a mano después si hace falta.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
