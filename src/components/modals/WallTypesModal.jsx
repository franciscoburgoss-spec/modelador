import { useEffect, useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { WALL_ROLES } from '../../core/wallTypes.js';
import Modal from '../ui/Modal.jsx';
import { ErrorText, Field, NumberInput, SelectInput, TextInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

function emptyForm(studProfiles, trackProfiles) {
  return {
    name: '',
    role: 'MP1',
    spacing: 400,
    studProfileId: studProfiles[0]?.id ?? '',
    trackProfileId: trackProfiles[0]?.id ?? '',
    materialId: '',
    panelWidth: 1220,
    panelHeight: 2440,
    minPanelWidth: 200,
    gap: 5
  };
}

function formFromType(type) {
  return {
    name: type.name,
    role: type.role,
    ...type.metalconDefaults,
    ...type.osbDefaults,
    materialId: type.metalconDefaults.materialId ?? ''
  };
}

export default function WallTypesModal({ open, onClose }) {
  const wallTypes = useModelStore((state) => state.model.wallTypes || []);
  const profiles = useModelStore((state) => state.model.library.metalconProfiles || []);
  const materials = useModelStore((state) => state.model.library.materials || []);
  const addWallType = useModelStore((state) => state.addWallType);
  const updateWallType = useModelStore((state) => state.updateWallType);
  const removeWallType = useModelStore((state) => state.removeWallType);
  const studProfiles = useMemo(() => profiles.filter((profile) => profile.shape === 'C'), [profiles]);
  const trackProfiles = useMemo(() => profiles.filter((profile) => profile.shape === 'U'), [profiles]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm(studProfiles, trackProfiles));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const first = wallTypes[0];
    setEditingId(first?.id ?? null);
    setForm(first ? formFromType(first) : emptyForm(studProfiles, trackProfiles));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const resolveId = (items, raw) => items.find((item) => String(item.id) === String(raw))?.id ?? raw;
  const payload = () => ({
    name: form.name.trim(),
    role: form.role,
    metalconDefaults: {
      spacing: Number(form.spacing),
      studProfileId: resolveId(studProfiles, form.studProfileId),
      trackProfileId: resolveId(trackProfiles, form.trackProfileId),
      materialId: form.materialId === ''
        ? null
        : resolveId(materials, form.materialId)
    },
    osbDefaults: {
      panelWidth: Number(form.panelWidth),
      panelHeight: Number(form.panelHeight),
      minPanelWidth: Number(form.minPanelWidth),
      gap: Number(form.gap)
    }
  });

  const selectType = (id) => {
    const type = wallTypes.find((item) => String(item.id) === String(id));
    setEditingId(type?.id ?? null);
    setForm(type ? formFromType(type) : emptyForm(studProfiles, trackProfiles));
    setError('');
  };

  const save = () => {
    try {
      if (editingId == null) {
        const result = addWallType(payload());
        const created = useModelStore.getState().model.wallTypes
          .find((type) => type.id === result.wallTypeId);
        setEditingId(created.id);
        setForm(formFromType(created));
      } else {
        updateWallType(editingId, payload());
      }
      setError('');
    } catch (reason) {
      setError(reason.message);
    }
  };

  const remove = () => {
    if (editingId == null || !confirm('¿Eliminar este tipo de muro?')) return;
    const result = removeWallType(editingId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const remaining = useModelStore.getState().model.wallTypes || [];
    selectType(remaining[0]?.id ?? '');
  };

  const numeric = (field) => (
    <NumberInput value={form[field]} onChange={(event) => set(field, event.target.value)} />
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tipos y roles de muro"
      width="max-w-3xl"
      footer={(
        <>
          {editingId != null && <Button variant="danger" onClick={remove}>Eliminar tipo</Button>}
          <Button variant="primary" onClick={save}>
            {editingId == null ? 'Crear tipo' : 'Guardar tipo'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </>
      )}
    >
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2 mb-4">
        <SelectInput value={editingId ?? ''} onChange={(event) => selectType(event.target.value)}>
          <option value="">Nuevo tipo…</option>
          {wallTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.name} · {type.role}</option>
          ))}
        </SelectInput>
        <Button variant="secondary" onClick={() => selectType('')}>Nuevo</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre">
          <TextInput value={form.name} onChange={(event) => set('name', event.target.value)} />
        </Field>
        <Field label="Rol estructural">
          <SelectInput value={form.role} onChange={(event) => set('role', event.target.value)}>
            {WALL_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </SelectInput>
        </Field>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5a5a55] mb-2">Metalcon</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Perfil montante (C)">
          <SelectInput value={form.studProfileId} onChange={(event) => set('studProfileId', event.target.value)}>
            <option value="">Seleccionar…</option>
            {studProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.catalogDesignation ?? profile.name ?? profile.id}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Perfil solera (U)">
          <SelectInput value={form.trackProfileId} onChange={(event) => set('trackProfileId', event.target.value)}>
            <option value="">Seleccionar…</option>
            {trackProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.catalogDesignation ?? profile.name ?? profile.id}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Espaciamiento (mm)">{numeric('spacing')}</Field>
        <Field label="Material">
          <SelectInput value={form.materialId} onChange={(event) => set('materialId', event.target.value)}>
            <option value="">Sin material asignado</option>
            {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
          </SelectInput>
        </Field>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5a5a55] mb-2">OSB</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ancho de placa (mm)">{numeric('panelWidth')}</Field>
        <Field label="Alto de placa (mm)">{numeric('panelHeight')}</Field>
        <Field label="Ancho mínimo (mm)">{numeric('minPanelWidth')}</Field>
        <Field label="Dilatación (mm)">{numeric('gap')}</Field>
      </div>
    </Modal>
  );
}
