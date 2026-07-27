import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DERIVED_REGISTRY,
  MUTATION_DEPENDENCIES,
  applyWallRegeneration,
  invalidateForMutation
} from '../src/core/derivedInvalidation.js';
import { useModelStore } from '../src/store/useModelStore.js';

const grid = {
  xAxes: [{ id: 'x0', position: 0, label: '0' }, { id: 'x1', position: 4000, label: '1' }],
  yAxes: [{ id: 'y0', position: 0, label: 'A' }],
  zLevels: [{ id: 'z0', elevation: 0, label: 'N0' }, { id: 'z1', elevation: 2400, label: 'N1' }]
};

function wall(id, extra = {}) {
  return {
    id,
    type: 'wall',
    xStart: 'x0',
    xEnd: 'x1',
    yStart: 'y0',
    yEnd: 'y0',
    bottomZ: 'z0',
    topZ: 'z1',
    thickness: 'espesor_placa',
    openings: [{ id: `o-${id}`, type: 'window', width: 900, height: 1200 }],
    studs: [{ offset: 0 }],
    headers: [],
    osbCourses: [{ panels: [] }],
    osbNoggings: [],
    studsStale: false,
    osbStale: false,
    ...extra
  };
}

function modelWithWalls(count = 2) {
  const elements = [
    ...Array.from({ length: count }, (_, index) => wall(`w${index + 1}`)),
    { id: 'f1', type: 'foundation', width: 400 }
  ];
  return {
    modelVersion: 1,
    grid,
    elements,
    projectParams: [{ id: 'param-thickness', name: 'espesor_placa', value: 90 }],
    library: {
      wallSections: [],
      columnSections: [],
      beamSections: [],
      openingTemplates: [],
      foundationSections: [],
      materials: [],
      trussTemplates: [],
      metalconProfiles: [{ id: 'profile-90', code: '90CA085', h: 90, b: 38 }]
    },
    roofSystems: [{
      id: 'roof-1',
      wallLowId: 'w1',
      wallHighId: 'w2',
      trussGeometry: { resolved: true, members: [] },
      trussPositions: [{ offset: 0 }],
      stale: false
    }],
    roofPlanes: [],
    dimensions: [],
    osbDefaults: {},
    metalconDefaults: null,
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    currentZLevelId: 'z0',
    viewMode: 'plan'
  };
}

function resetStore(model = modelWithWalls()) {
  useModelStore.setState((state) => ({
    ...state,
    model,
    past: [],
    future: []
  }));
}

beforeEach(() => resetStore());

test('la matriz central registra derivados y cubre todos los dominios mutables de SPEC-002', () => {
  assert.deepEqual(Object.keys(DERIVED_REGISTRY).sort(), ['roofTruss', 'wallFraming', 'wallOsb']);
  for (const domain of [
    'projectParams',
    'library',
    'gridGeometry',
    'wallGeometry',
    'wallOpenings',
    'wallRemoval',
    'wallTypeAssignment',
    'wallTypeConfig',
    'foundationGeometry',
    'roofSystemConfig',
    'roofPlaneConfig'
  ]) {
    assert.ok(MUTATION_DEPENDENCIES[domain], `falta ${domain} en la matriz`);
  }
});

test('cambiar espesor_placa invalida framing y OSB de los 45 muros dependientes', () => {
  resetStore(modelWithWalls(45));
  useModelStore.getState().updateProjectParam('param-thickness', { value: 140 });
  const walls = useModelStore.getState().model.elements.filter((element) => element.type === 'wall');
  assert.equal(walls.length, 45);
  assert.ok(walls.every((item) => item.studsStale === true));
  assert.ok(walls.every((item) => item.osbStale === true));
});

test('cambiar un perfil de 90 a 140 mm invalida todas las salidas persistidas afectadas', () => {
  useModelStore.getState().updateLibraryItem('metalconProfiles', 'profile-90', { h: 140 });
  const model = useModelStore.getState().model;
  assert.ok(model.elements.filter((element) => element.type === 'wall')
    .every((item) => item.studsStale && item.osbStale));
  assert.equal(model.roofSystems[0].stale, true);
});

test('eliminar un vano por acción directa o por selección invalida framing, headers y OSB', () => {
  useModelStore.getState().removeOpening('w1', 'o-w1');
  let changed = useModelStore.getState().model.elements.find((element) => element.id === 'w1');
  assert.equal(changed.openings.length, 0);
  assert.equal(changed.studsStale, true);
  assert.equal(changed.osbStale, true);

  resetStore();
  useModelStore.setState((state) => ({
    model: { ...state.model, selectedElementId: 'o-w1' }
  }));
  useModelStore.getState().deleteSelectedElement();
  changed = useModelStore.getState().model.elements.find((element) => element.id === 'w1');
  assert.equal(changed.openings.length, 0);
  assert.equal(changed.studsStale, true);
  assert.equal(changed.osbStale, true);
});

test('un comando genérico no puede escribir resultados derivados persistidos', () => {
  assert.throws(
    () => useModelStore.getState().updateElement('w1', { studs: [] }),
    /comando de regeneración/
  );
  assert.throws(
    () => useModelStore.getState().updateElement('w1', { studsStale: false }),
    /comando de regeneración/
  );
  assert.throws(
    () => useModelStore.getState().updateRoofSystem('roof-1', { stale: false }),
    /comando de regeneración/
  );
  assert.equal(useModelStore.getState().model.elements[0].studs.length, 1);
});

test('niveles y configuración de techumbre invalidan; fundaciones se resuelven en vivo', () => {
  useModelStore.getState().updateZLevel('z1', { elevation: 2600 });
  let model = useModelStore.getState().model;
  assert.ok(model.elements.filter((element) => element.type === 'wall')
    .every((item) => item.studsStale && item.osbStale));
  assert.equal(model.roofSystems[0].stale, true);

  resetStore();
  useModelStore.getState().updateElement('f1', { width: 500 });
  model = useModelStore.getState().model;
  assert.ok(model.elements.filter((element) => element.type === 'wall')
    .every((item) => !item.studsStale && !item.osbStale));
  assert.equal(model.roofSystems[0].stale, false);

  useModelStore.getState().updateRoofSystem('roof-1', { slopePercent: 35 });
  assert.equal(useModelStore.getState().model.roofSystems[0].stale, true);
});

test('cambiar el alto de placa invalida framing porque mueve las cadenetas, además del OSB', () => {
  useModelStore.getState().setOsbDefaults({ panelHeight: 3000 });
  const walls = useModelStore.getState().model.elements
    .filter((element) => element.type === 'wall');
  assert.ok(walls.every((wall) => wall.studsStale === true));
  assert.ok(walls.every((wall) => wall.osbStale === true));
});

test('la regeneración de techumbre sólo limpia stale con resultado completo', () => {
  useModelStore.getState().updateRoofSystem('roof-1', { slopePercent: 35 });
  const before = useModelStore.getState().model;
  assert.throws(
    () => useModelStore.getState().commitRoofSystemRegeneration('roof-1', {
      trussGeometry: { resolved: true }
    }),
    /incompleta/
  );
  assert.equal(useModelStore.getState().model, before);
  useModelStore.getState().commitRoofSystemRegeneration('roof-1', {
    trussGeometry: { resolved: true, members: [] },
    trussPositions: []
  });
  assert.equal(useModelStore.getState().model.roofSystems[0].stale, false);
});

test('una regeneración completa limpia sólo los flags que terminó correctamente', () => {
  const stale = invalidateForMutation(modelWithWalls(), 'projectParams');
  const current = stale.elements[0];
  assert.throws(
    () => applyWallRegeneration(current, 'wallOsb', { osbCourses: [], osbNoggings: [] }),
    /wallFraming sigue desactualizado/
  );
  const framing = applyWallRegeneration(current, 'wallFraming', { studs: [], headers: [] });
  assert.equal(framing.studsStale, false);
  assert.equal(framing.osbStale, true, 'OSB sigue stale hasta regenerarse');
  const osb = applyWallRegeneration(framing, 'wallOsb', { osbCourses: [], osbNoggings: [] });
  assert.equal(osb.studsStale, false);
  assert.equal(osb.osbStale, false);
});

test('una regeneración incompleta falla de forma atómica y conserva el modelo stale', () => {
  const stale = invalidateForMutation(modelWithWalls(), 'projectParams');
  const before = stale.elements[0];
  assert.throws(
    () => applyWallRegeneration(before, 'wallFraming', { studs: [] }),
    /incompleta/
  );
  assert.equal(before.studsStale, true);
  assert.equal(before.osbStale, true);
  assert.equal(before.headers.length, 0);
});
