// components/modals/ProjectInfoModal.jsx
// ★ Sesión 22 — Datos de proyecto del cajetín ISO 7200 (model.projectInfo) y tabla de revisiones.
// Todo lo que llene el usuario acá aparece en TODAS las láminas DXF; lo que quede vacío se dibuja
// como "-" (no se inventa nada). El formato y la escala elegidos son los defaults al exportar.
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { normalizeProjectInfo } from '../../core/projectInfo.js';
import { FORMAT_KEYS, PAPER_FORMATS } from '../../core/sheetFormats.js';
import Modal from '../ui/Modal.jsx';
import { Field, TextInput, SelectInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const TEXT_FIELDS = [
  ['mandante', 'Mandante', 'propietario / inmobiliaria'],
  ['obra', 'Obra', 'nombre del proyecto'],
  ['ubicacion', 'Ubicación', 'dirección, comuna, región'],
  ['proyectoNumero', 'N° de proyecto', 'ej: 2026-014'],
  ['laminaPrefijo', 'Prefijo de lámina', 'ej: E → E-TAB-01'],
  ['fecha', 'Fecha', 'vacío = fecha de exportación'],
  ['dibujo', 'Dibujó', ''],
  ['reviso', 'Revisó', ''],
  ['aprobo', 'Aprobó', '']
];

export default function ProjectInfoModal({ open, onClose }) {
  const stored = useModelStore((s) => s.model.projectInfo);
  const setProjectInfo = useModelStore((s) => s.setProjectInfo);
  const addRevision = useModelStore((s) => s.addRevision);
  const updateRevision = useModelStore((s) => s.updateRevision);
  const removeRevision = useModelStore((s) => s.removeRevision);

  const [form, setForm] = useState(() => normalizeProjectInfo(stored));

  // Al abrir se recarga desde el modelo: el modal es un borrador local hasta presionar Guardar,
  // pero las revisiones sí se aplican al instante (viven en su propia tabla, con su propio undo).
  useEffect(() => {
    if (open) setForm(normalizeProjectInfo(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const revisiones = normalizeProjectInfo(stored).revisiones;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = () => {
    const { revisiones: _ignored, ...rest } = form; // las revisiones se editan aparte
    setProjectInfo({ ...rest, escala: form.escala ? Number(form.escala) : null });
    onClose();
  };

  const formatInfo = PAPER_FORMATS[form.formato] || PAPER_FORMATS.A1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Datos de proyecto (cajetín)"
      width="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Guardar</Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4">
        {TEXT_FIELDS.map(([key, label, hint]) => (
          <Field key={key} label={label} hint={hint}>
            <TextInput value={form[key] ?? ''} onChange={set(key)} />
          </Field>
        ))}
        <Field label="Formato de lámina" hint="default al exportar">
          <SelectInput value={form.formato} onChange={set('formato')}>
            {FORMAT_KEYS.map((k) => (
              <option key={k} value={k}>{k} ({PAPER_FORMATS[k].w} × {PAPER_FORMATS[k].h} mm)</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Escala 1:" hint={`vacío = ${formatInfo.defaultScale} (default del formato)`}>
          <TextInput
            value={form.escala ?? ''}
            inputMode="numeric"
            onChange={(e) => setForm((f) => ({ ...f, escala: e.target.value.replace(/\D/g, '') }))}
          />
        </Field>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#1a1a18]">Revisiones</span>
          <Button onClick={() => addRevision({ autor: form.dibujo })}>+ Nueva revisión</Button>
        </div>
        <div className="border border-[#e4e4e0] rounded-md max-h-52 overflow-y-auto">
          {revisiones.length === 0 && (
            <p className="text-sm text-[#8a8a85] px-3 py-3">
              Sin revisiones. La lámina saldrá con “REV. -”.
            </p>
          )}
          {revisiones.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-b border-[#e4e4e0] last:border-b-0">
              <TextInput className="w-12" value={r.rev || ''} onChange={(e) => updateRevision(i, { rev: e.target.value.toUpperCase().slice(0, 2) })} />
              <TextInput className="w-28" value={r.fecha || ''} onChange={(e) => updateRevision(i, { fecha: e.target.value })} />
              <TextInput value={r.descripcion || ''} placeholder="descripción" onChange={(e) => updateRevision(i, { descripcion: e.target.value })} />
              <TextInput className="w-20" value={r.autor || ''} placeholder="autor" onChange={(e) => updateRevision(i, { autor: e.target.value })} />
              <Button variant="danger" onClick={() => removeRevision(i)}>×</Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#8a8a85] mt-2">
          La revisión más reciente (la última de la lista) es la que aparece en el campo “REV.” del cajetín.
        </p>
      </div>
    </Modal>
  );
}
