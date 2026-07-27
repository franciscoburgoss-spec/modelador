import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useModelStore } from '../src/store/useModelStore.js';

const grid = {
  xAxes: [
    { id: 'x0', position: 0 },
    { id: 'x2', position: 2000 },
    { id: 'x4', position: 4000 },
    { id: 'x6', position: 6000 }
  ],
  yAxes: [{ id: 'y0', position: 0 }, { id: 'y2', position: 2000 }],
  zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 2400 }]
};

function wall(id, xStart = 'x0', xEnd = 'x4', y = 'y0', overrides = {}) {
  return {
    id,
    type: 'wall',
    direction: 'x',
    xStart,
    xEnd,
    yStart: y,
    yEnd: y,
    bottomZ: 'z0',
    topZ: 'z1',
    thickness: 90,
    openings: [],
    studs: [{ offset: 0, zMin: 0, zMax: 2400, role: 'edge' }],
    headers: [],
    osbCourses: [{ panels: [] }],
    osbNoggings: [],
    studsStale: false,
    osbStale: false,
    ...overrides
  };
}

function baseModel(elements = [
  wall('w1'),
  wall('w2', 'x0', 'x4', 'y2'),
  wall('w3', 'x2', 'x6', 'y2')
]) {
  return {
    modelVersion: 2,
    grid,
    elements,
    projectParams: [],
    dimensions: [],
    wallTypes: [],
    library: {
      wallSections: [],
      columnSections: [],
      beamSections: [],
      openingTemplates: [],
      foundationSections: [],
      materials: [],
      trussTemplates: [],
      metalconProfiles: []
    },
    roofSystems: [
      {
        id: 'r1',
        wallLowId: 'w1',
        wallHighId: 'w2',
        trussGeometry: { resolved: true },
        trussPositions: [],
        stale: false
      },
      {
        id: 'r2',
        wallLowId: 'w3',
        wallHighId: 'other',
        trussGeometry: { resolved: true },
        trussPositions: [],
        stale: false
      }
    ],
    roofPlanes: [],
    osbDefaults: {},
    metalconDefaults: null,
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    currentZLevelId: 'z0',
    viewMode: 'plan'
  };
}

function reset(model = baseModel()) {
  useModelStore.setState((state) => ({
    ...state,
    model,
    past: [],
    future: []
  }));
}

function walls() {
  return useModelStore.getState().model.elements.filter((element) => element.type === 'wall');
}

beforeEach(() => reset());

test('R6-B: agregar uno o varios muros invalida framing+OSB de todos, pero no cerchas ajenas', () => {
  useModelStore.getState().addElement({
    type: 'wall',
    direction: 'y',
    xStart: 'x2',
    xEnd: 'x2',
    yStart: 'y0',
    yEnd: 'y2',
    bottomZ: 'z0',
    topZ: 'z1',
    thickness: 90,
    openings: []
  });
  assert.ok(walls().filter((item) => item.studs).every((item) => item.studsStale && item.osbStale));
  assert.ok(useModelStore.getState().model.roofSystems.every((system) => system.stale === false));

  reset();
  useModelStore.getState().addElements([
    {
      type: 'wall',
      direction: 'y',
      xStart: 'x2',
      xEnd: 'x2',
      yStart: 'y0',
      yEnd: 'y2',
      bottomZ: 'z0',
      topZ: 'z1',
      thickness: 90,
      openings: []
    },
    { type: 'column', axisXId: 'x0', axisYId: 'y0' }
  ]);
  assert.ok(walls().filter((item) => item.studs).every((item) => item.studsStale && item.osbStale));
});

test('R6-B: agregar un elemento no muro no amplía invalidación', () => {
  useModelStore.getState().addElement({ type: 'column', axisXId: 'x0', axisYId: 'y0' });
  assert.ok(walls().every((item) => !item.studsStale && !item.osbStale));
});

test('R6-B: editar geometría invalida todos los muros y sólo las cerchas dependientes', () => {
  useModelStore.getState().updateElement('w1', { xEnd: 'x2' });
  const current = useModelStore.getState().model;

  assert.ok(walls().every((item) => item.studsStale && item.osbStale));
  assert.equal(current.roofSystems.find((system) => system.id === 'r1').stale, true);
  assert.equal(current.roofSystems.find((system) => system.id === 'r2').stale, false);
});

test('R6-B: vanos y configuración permanecen locales, sin invalidar vecinos', () => {
  useModelStore.getState().updateElement('w1', {
    openings: [{ id: 'door', type: 'door', width: 900, height: 2100 }]
  });
  assert.equal(walls().find((item) => item.id === 'w1').studsStale, true);
  assert.equal(walls().find((item) => item.id === 'w2').studsStale, false);

  reset();
  useModelStore.getState().updateElement('w1', { studSpacing: 600 });
  assert.equal(walls().find((item) => item.id === 'w1').studsStale, true);
  assert.equal(walls().find((item) => item.id === 'w2').studsStale, false);
});

test('R6-B: eliminar un muro invalida todos los vecinos y conserva alcance de cerchas', () => {
  useModelStore.setState((state) => ({
    model: { ...state.model, selectedElementId: 'w1' }
  }));
  useModelStore.getState().deleteSelectedElement();
  const current = useModelStore.getState().model;

  assert.equal(current.elements.some((element) => element.id === 'w1'), false);
  assert.ok(walls().every((item) => item.studsStale && item.osbStale));
  assert.equal(current.roofSystems.find((system) => system.id === 'r1').stale, true);
  assert.equal(current.roofSystems.find((system) => system.id === 'r2').stale, false);
});

test('R6-B: dividir y unir invalidan derivados de todos los demás muros', () => {
  reset(baseModel([
    wall('w1', 'x0', 'x4', 'y0'),
    wall('neighbor', 'x0', 'x4', 'y2')
  ]));
  const split = useModelStore.getState().splitWall('w1', { atAxisId: 'x2' });
  assert.equal(split.ok, true);
  assert.equal(walls().find((item) => item.id === 'neighbor').studsStale, true);

  reset(baseModel([
    wall('a', 'x0', 'x2', 'y0'),
    wall('b', 'x2', 'x4', 'y0'),
    wall('neighbor', 'x0', 'x4', 'y2')
  ]));
  const merged = useModelStore.getState().mergeWalls(['a', 'b']);
  assert.equal(merged.ok, true);
  assert.equal(walls().find((item) => item.id === 'neighbor').studsStale, true);
});
