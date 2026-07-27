import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('R5-C: UI coordina CRUD y asignación de tipos mediante acciones trazables del store', () => {
  const app = source('../src/App.jsx');
  const menu = source('../src/components/MenuBar.jsx');
  const types = source('../src/components/modals/WallTypesModal.jsx');
  const wall = source('../src/components/modals/AddWallModal.jsx');

  assert.match(app, /WallTypesModal/);
  assert.match(menu, /Tipos y roles de muro/);
  for (const action of ['addWallType', 'updateWallType', 'removeWallType']) {
    assert.match(types, new RegExp(action));
  }
  assert.match(types, /WALL_ROLES/);
  assert.match(wall, /assignWallType/);
  assert.match(wall, /Sin tipo \/ rol \(legacy\)/);
});

test('R5-C: modales muestran configuración efectiva y bloquean overrides en muros tipados', () => {
  for (const relative of [
    '../src/components/modals/MetalconModulationModal.jsx',
    '../src/components/modals/OsbModulationModal.jsx'
  ]) {
    const modal = source(relative);
    assert.match(modal, /resolveWallTypeConfig/);
    assert.match(modal, /Tipo efectivo/);
    assert.match(modal, /compatibilidad legacy/);
    assert.match(modal, /disabled=\{typed\}/);
    assert.match(modal, /osbGap/);
  }
});

test('R5-C: Generate All se habilita por configuración efectiva, no sólo por default global', () => {
  const menu = source('../src/components/MenuBar.jsx');
  assert.match(menu, /resolveWallTypeConfig/);
  assert.match(menu, /canGenerateAllModulation/);
  assert.doesNotMatch(
    menu,
    /const canGenerateAllModulation = !!\(metalconDefaults/,
    'no debe depender exclusivamente del default global legacy'
  );
});
