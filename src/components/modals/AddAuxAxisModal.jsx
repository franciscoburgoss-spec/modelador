// components/modals/AddAuxAxisModal.jsx
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, NumberInput, TextInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

export default function AddAuxAxisModal({ open, initialDirection = 'x', onClose }) {
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const addAuxXAxis = useModelStore((s) => s.addAuxXAxis);
  const addAuxYAxis = useModelStore((s) => s.addAuxYAxis);

  const [direction, setDirection] = useState(initialDirection);
  const [refAxisId, setRefAxisId] = useState('');
  const [offset, setOffset] = useState(1000);
  const [label, setLabel] = useState('aux');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDirection(initialDirection);
    setRefAxisId('');
    setOffset(1000);
    setLabel('aux');
    setError('');
  }, [open, initialDirection]);

  const axes = direction === 'x' ? xAxes : yAxes;

  const handleSubmit = () => {
    if (axes.length === 0) return setError(`Necesitas al menos 1 eje ${direction.toUpperCase()} para crear un eje auxiliar.`);
    if (!refAxisId) return setError('Selecciona un eje de referencia.');
    const fn = direction === 'x' ? addAuxXAxis : addAuxYAxis;
    fn(Number(refAxisId), Number(offset), label || 'aux');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear eje auxiliar"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit}>Crear eje auxiliar</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>

      <Field label="Dirección">
        <SelectInput value={direction} onChange={(e) => { setDirection(e.target.value); setRefAxisId(''); }}>
          <option value="x">Eje auxiliar X (vertical)</option>
          <option value="y">Eje auxiliar Y (horizontal)</option>
        </SelectInput>
      </Field>

      <Field label="Eje de referencia">
        <SelectInput value={refAxisId} onChange={(e) => setRefAxisId(e.target.value)}>
          <option value="">--</option>
          {axes.map(a => <option key={a.id} value={a.id}>{a.label} ({a.position} mm)</option>)}
        </SelectInput>
      </Field>

      <Field label="Distancia de offset" hint="mm">
        <NumberInput value={offset} onChange={(e) => setOffset(e.target.value)} />
      </Field>

      <Field label="Etiqueta">
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
    </Modal>
  );
}
