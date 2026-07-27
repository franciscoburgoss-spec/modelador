// tests/libraryTrussTemplates.test.mjs
// ★ Tarea C (sesión 2): trussTemplates editable en LibraryModal — CRUD genérico del store
// (addLibraryItem/updateLibraryItem/removeLibraryItem), clonado de semillas y compatibilidad
// con el shape {id,name,postSpacing,diagonalPattern,profiles} que consume RoofTrussModal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useModelStore } from '../src/store/useModelStore.js';

// Reset del store a un modelo limpio antes de cada test (mismo patrón usado por la app al
// iniciar: library.trussTemplates arranca vacío hasta loadSeedTrussTemplates()).
function resetStore() {
  useModelStore.setState((s) => ({
    ...s,
    model: { ...s.model, library: { ...s.model.library, trussTemplates: [] } },
    history: [], future: []
  }));
}

test('trussTemplates: loadSeedTrussTemplates siembra las 2 semillas Cintac una sola vez', () => {
  resetStore();
  useModelStore.getState().loadSeedTrussTemplates();
  const first = useModelStore.getState().model.library.trussTemplates;
  assert.equal(first.length, 2);
  assert.deepEqual(first.map((t) => t.id).sort(), ['seed-estandar-130', 'seed-liviana-70']);

  useModelStore.getState().loadSeedTrussTemplates();
  const again = useModelStore.getState().model.library.trussTemplates;
  assert.equal(again.length, 2, 'segunda carga no duplica');
});

test('trussTemplates: addLibraryItem crea una plantilla propia con id numérico generado', () => {
  resetStore();
  useModelStore.getState().addLibraryItem('trussTemplates', {
    name: 'Mi plantilla', postSpacing: 400, diagonalPattern: 'none',
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '' }
  });
  const list = useModelStore.getState().model.library.trussTemplates;
  assert.equal(list.length, 1);
  assert.equal(typeof list[0].id, 'number');
  assert.equal(list[0].name, 'Mi plantilla');
  assert.equal(list[0].diagonalPattern, 'none');
  assert.equal(list[0].profiles.topChord, '90CA085');
});

test('trussTemplates: updateLibraryItem edita una plantilla existente (semilla o propia) in situ', () => {
  resetStore();
  useModelStore.getState().loadSeedTrussTemplates();
  const seed = useModelStore.getState().model.library.trussTemplates.find((t) => t.id === 'seed-liviana-70');
  useModelStore.getState().updateLibraryItem('trussTemplates', seed.id, {
    name: 'Liviana (editada)', postSpacing: 500, diagonalPattern: 'none', profiles: { ...seed.profiles, diagonal: '' }
  });
  const updated = useModelStore.getState().model.library.trussTemplates.find((t) => t.id === 'seed-liviana-70');
  assert.equal(updated.name, 'Liviana (editada)');
  assert.equal(updated.postSpacing, 500);
  assert.equal(updated.diagonalPattern, 'none');
  assert.equal(updated.source, 'cintac', 'editar in situ conserva el origen de la semilla');
});

test('trussTemplates: clonar una semilla (patrón "Duplicar") crea una copia editable sin afectar el original', () => {
  resetStore();
  useModelStore.getState().loadSeedTrussTemplates();
  const seed = useModelStore.getState().model.library.trussTemplates.find((t) => t.id === 'seed-estandar-130');

  // mismo patrón que el botón "Duplicar" del modal: addLibraryItem con el item completo,
  // nombre sufijado y source limpiado (la copia deja de ser semilla, id se regenera).
  useModelStore.getState().addLibraryItem('trussTemplates', { ...seed, name: `${seed.name} (copia)`, source: undefined });

  const list = useModelStore.getState().model.library.trussTemplates;
  assert.equal(list.length, 3);
  const clone = list.find((t) => t.name === `${seed.name} (copia)`);
  assert.ok(clone);
  assert.notEqual(clone.id, seed.id);
  assert.equal(clone.source, undefined);
  assert.equal(clone.profiles.topChord, seed.profiles.topChord);

  // el original queda intacto
  const originalStillThere = list.find((t) => t.id === seed.id);
  assert.equal(originalStillThere.name, seed.name);
  assert.equal(originalStillThere.source, 'cintac');
});

test('trussTemplates: removeLibraryItem borra cualquier plantilla (semilla o propia)', () => {
  resetStore();
  useModelStore.getState().loadSeedTrussTemplates();
  const seed = useModelStore.getState().model.library.trussTemplates.find((t) => t.id === 'seed-liviana-70');
  useModelStore.getState().removeLibraryItem('trussTemplates', seed.id);
  const list = useModelStore.getState().model.library.trussTemplates;
  assert.equal(list.length, 1);
  assert.equal(list.find((t) => t.id === 'seed-liviana-70'), undefined);
});
