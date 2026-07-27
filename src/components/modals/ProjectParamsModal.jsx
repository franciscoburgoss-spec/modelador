// components/modals/ProjectParamsModal.jsx
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { isValidParamName } from '../../core/projectParams.js';
import Modal from '../ui/Modal.jsx';
import { Field, TextInput, NumberInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const emptyForm = { name: '', value: 0, unit: '', description: '' };

export default function ProjectParamsModal({ open, onClose }) {
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const addProjectParam = useModelStore((s) => s.addProjectParam);
  const updateProjectParam = useModelStore((s) => s.updateProjectParam);
  const removeProjectParam = useModelStore((s) => s.removeProjectParam);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }, [open]);

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name, value: p.value, unit: p.unit || '', description: p.description || '' });
    setError('');
  };

  const handleSubmit = () => {
    const name = form.name.trim();
    if (!name) return setError('El nombre es obligatorio.');
    if (!isValidParamName(name)) return setError('Nombre inválido: solo letras, números y "_", sin empezar con número.');
    const dup = projectParams.some(p => p.name === name && p.id !== editingId);
    if (dup) return setError(`Ya existe un parámetro llamado "${name}".`);
    if (form.value === '' || isNaN(Number(form.value))) return setError('El valor debe ser numérico.');

    const payload = { name, value: Number(form.value), unit: form.unit.trim(), description: form.description.trim() };
    if (editingId) updateProjectParam(editingId, payload);
    else addProjectParam(payload);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Parámetros de proyecto" width="max-w-xl">
      <div className="mb-4 max-h-64 overflow-y-auto border border-[#e4e4e0] rounded-md">
        {projectParams.length === 0 && (
          <p className="text-sm text-[#8a8a85] px-3 py-3">Sin parámetros definidos aún.</p>
        )}
        {projectParams.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#e4e4e0] last:border-b-0 text-sm">
            <div className="min-w-0">
              <div className="font-mono font-medium text-[#1a1a18]">
                {p.name} = {p.value}{p.unit ? ` ${p.unit}` : ''}
              </div>
              {p.description && <div className="text-xs text-[#8a8a85] truncate">{p.description}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="secondary" onClick={() => startEdit(p)}>Editar</Button>
              <Button variant="danger" onClick={() => removeProjectParam(p.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" hint="ej. espesor_tabique">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="espesor_tabique" />
        </Field>
        <Field label="Valor">
          <NumberInput value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </Field>
        <Field label="Unidad" hint="opcional">
          <TextInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="mm" />
        </Field>
        <Field label="Descripción" hint="opcional">
          <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        {editingId && (
          <Button variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); setError(''); }}>Cancelar edición</Button>
        )}
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : '+ Agregar parámetro'}</Button>
      </div>
    </Modal>
  );
}
