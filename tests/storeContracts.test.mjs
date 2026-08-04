import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useModelStore } from '../src/store/useModelStore.js';

const LIBRARY = {
  wallSections: [{ id: 'WS', name: 'Muro 90', thickness: 90 }],
  columnSections: [{ id: 'CS', name: 'Pilar', widthX: 200, widthY: 300 }],
  beamSections: [{ id: 'BS', name: 'Viga', width: 150, height: 300 }],
  openingTemplates: [{
    id: 'OT',
    itemType: 'window',
    name: 'Ventana',
    width: 1000,
    height: 1200,
    sillHeight: 900
  }],
  foundationSections: [
    { id: 'FC', itemType: 'cimiento', name: 'Cimiento', width: 400, depth: 600 },
    {
      id: 'FS',
      itemType: 'sobrecimiento',
      name: 'Sobrecimiento',
      width: 140,
      height: 450
    }
  ],
  metalconProfiles: [
    { id: 'MC-USED', code: '90CA085', shape: 'C', H: 90, B: 38, e: 0.85 },
    { id: 'MC-FREE', code: '60CA085', shape: 'C', H: 60, B: 38, e: 0.85 }
  ],
  materials: [{ id: 'MAT', name: 'Acero', category: 'metalcon' }],
  trussTemplates: []
};

function wall() {
  return {
    id: 'W1',
    type: 'wall',
    direction: 'x',
    xStart: 'X0',
    xEnd: 'X1',
    yStart: 'Y0',
    yEnd: 'Y0',
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 90,
    libraryId: 'WS',
    openings: [{
      id: 'O1',
      type: 'window',
      libraryId: 'OT',
      position: 1000,
      width: 1000,
      height: 1200,
      sillHeight: 900
    }],
    studs: [{ offset: 0, zMin: 0, zMax: 2400 }],
    headers: [],
    osbCourses: [{ panels: [] }],
    osbNoggings: [],
    studsStale: false,
    osbStale: false
  };
}

function model(overrides = {}) {
  return {
    modelVersion: 2,
    grid: {
      xAxes: [{ id: 'X0', position: 0 }, { id: 'X1', position: 4000 }],
      yAxes: [{ id: 'Y0', position: 0 }, { id: 'Y1', position: 3000 }],
      zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
    },
    elements: [
      wall(),
      {
        id: 'C1',
        type: 'column',
        libraryId: 'CS',
        axisXId: 'X0',
        axisYId: 'Y0',
        bottomZ: 'Z0',
        topZ: 'Z1',
        widthX: 200,
        widthY: 300
      },
      {
        id: 'B1',
        type: 'beam',
        libraryId: 'BS',
        startRef: 'C1',
        endRef: 'C1',
        levelZ: 'Z1',
        width: 150,
        height: 300
      },
      {
        id: 'F1',
        type: 'foundation',
        foundationType: 'corrida',
        libraryId: 'FC',
        direction: 'x',
        fixedAxisId: 'Y0',
        startAxisId: 'X0',
        endAxisId: 'X1',
        levelZ: 'Z0',
        cimiento: { libraryId: 'FC', width: 400, depth: 600 },
        sobrecimiento: { libraryId: 'FS', width: 140, height: 450 }
      }
    ],
    library: structuredClone(LIBRARY),
    projectParams: [],
    dimensions: [],
    wallTypes: [{
      id: 'WT',
      name: 'Exterior',
      role: 'MP1',
      metalconDefaults: {
        spacing: 400,
        studProfileId: 'MC-USED',
        trackProfileId: 'MC-USED',
        materialId: null
      },
      osbDefaults: {
        panelWidth: 1220,
        panelHeight: 2440,
        minPanelWidth: 200,
        gap: 5
      }
    }],
    projectInfo: { obra: 'Casa', revisiones: [] },
    osbDefaults: {
      panelWidth: 1220,
      panelHeight: 2440,
      minPanelWidth: 200,
      gap: 5
    },
    metalconDefaults: null,
    roofSystems: [{
      id: 'R1',
      name: 'Techo',
      runAxis: 'x',
      runRange: { from: 0, to: 4000 },
      trussSpacing: 1000,
      trussGeometry: { resolved: true, members: [] },
      trussPositions: [{ offset: 0, world: { x: 0, y: 0 } }],
      stale: false
    }],
    roofPlanes: [],
    currentZLevelId: 'Z0',
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    viewMode: 'plan',
    ...overrides
  };
}

function resetStore(nextModel = model()) {
  useModelStore.setState({
    model: nextModel,
    view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewModeB: 'plan',
    layout: 'single',
    past: [],
    future: [],
    modelImportFeedback: null,
    legendCollapsedA: false,
    legendCollapsedB: false
  });
}

beforeEach(() => resetStore());

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.FileReader;
});

test('SPEC-003-D: proyecto, grilla y cotas mutan con historial y valores observables', () => {
  const actions = useModelStore.getState();

  actions.addProjectParam({ name: 'altura', value: 2400 });
  const parameterId = useModelStore.getState().model.projectParams[0].id;
  actions.updateProjectParam(parameterId, { value: 2600 });
  assert.equal(useModelStore.getState().model.projectParams[0].value, 2600);
  actions.removeProjectParam(parameterId);
  assert.deepEqual(useModelStore.getState().model.projectParams, []);

  actions.setOsbDefaults({ minPanelWidth: 100, gap: 3 });
  actions.setMetalconDefaults({ spacing: 600, studProfileId: 'MC-USED' });
  assert.equal(useModelStore.getState().model.osbDefaults.minPanelWidth, 200);
  assert.equal(useModelStore.getState().model.metalconDefaults.spacing, 600);

  actions.setProjectInfo({ obra: 'Casa editada', dibujo: 'FB' });
  actions.addRevision();
  actions.updateRevision(0, { descripcion: 'Entrega' });
  assert.equal(useModelStore.getState().model.projectInfo.revisiones[0].descripcion, 'Entrega');
  assert.equal(useModelStore.getState().model.projectInfo.revisiones[0].autor, 'FB');
  actions.removeRevision(0);
  assert.deepEqual(useModelStore.getState().model.projectInfo.revisiones, []);

  actions.addXAxis(8000, 'X2');
  actions.addYAxis(6000, 'Y2');
  const stateAfterAxes = useModelStore.getState();
  const xId = stateAfterAxes.model.grid.xAxes.at(-1).id;
  const yId = stateAfterAxes.model.grid.yAxes.at(-1).id;
  actions.addAuxXAxis(xId, 500, 'XA');
  actions.addAuxYAxis(yId, 600, 'YA');
  actions.addAuxXAxis('missing', 10, 'NO');
  actions.addAuxYAxis('missing', 10, 'NO');
  assert.equal(useModelStore.getState().model.grid.xAxes.at(-1).position, 8500);
  assert.equal(useModelStore.getState().model.grid.yAxes.at(-1).position, 6600);
  actions.updateXAxis(xId, { position: 8100 });
  actions.updateYAxis(yId, { position: 6100 });
  actions.removeXAxis(xId);
  actions.removeYAxis(yId);

  resetStore(model({
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    currentZLevelId: null
  }));
  const fresh = useModelStore.getState();
  fresh.addZLevel(0, 'Z0');
  const zId = useModelStore.getState().model.grid.zLevels[0].id;
  assert.equal(useModelStore.getState().model.currentZLevelId, zId);
  fresh.updateZLevel(zId, { elevation: 100 });
  fresh.addZLevel(2400, 'Z1');
  fresh.removeZLevel(zId);
  assert.equal(
    useModelStore.getState().model.currentZLevelId,
    useModelStore.getState().model.grid.zLevels[0].id
  );

  fresh.addDimension({ kind: 'linear', label: 'A' });
  const dimensionId = useModelStore.getState().model.dimensions[0].id;
  fresh.updateDimension(dimensionId, { label: 'B' });
  assert.equal(useModelStore.getState().model.dimensions[0].label, 'B');
  fresh.removeDimension(dimensionId);
  assert.deepEqual(useModelStore.getState().model.dimensions, []);
  assert.ok(useModelStore.getState().past.length > 0);
});

test('SPEC-003-D: sustitución de biblioteca propaga cada familia referenciada', () => {
  const actions = useModelStore.getState();

  actions.updateLibraryItem('wallSections', 'WS', { thickness: 140 });
  actions.updateLibraryItem('columnSections', 'CS', { widthX: 250, widthY: 350 });
  actions.updateLibraryItem('beamSections', 'BS', { width: 200, height: 400 });
  actions.updateLibraryItem('openingTemplates', 'OT', {
    width: 1100,
    height: 1300,
    sillHeight: 800
  });
  actions.updateLibraryItem('foundationSections', 'FC', { width: 500, depth: 700 });
  actions.updateLibraryItem('foundationSections', 'FS', { width: 160, height: 500 });

  const current = useModelStore.getState().model;
  const byId = new Map(current.elements.map((element) => [element.id, element]));
  assert.equal(byId.get('W1').thickness, 140);
  assert.deepEqual(
    { widthX: byId.get('C1').widthX, widthY: byId.get('C1').widthY },
    { widthX: 250, widthY: 350 }
  );
  assert.deepEqual(
    { width: byId.get('B1').width, height: byId.get('B1').height },
    { width: 200, height: 400 }
  );
  assert.deepEqual(
    {
      width: byId.get('W1').openings[0].width,
      height: byId.get('W1').openings[0].height,
      sillHeight: byId.get('W1').openings[0].sillHeight
    },
    { width: 1100, height: 1300, sillHeight: 800 }
  );
  assert.deepEqual(byId.get('F1').cimiento, {
    libraryId: 'FC',
    width: 500,
    depth: 700
  });
  assert.deepEqual(byId.get('F1').sobrecimiento, {
    libraryId: 'FS',
    width: 160,
    height: 500
  });
  assert.equal(byId.get('W1').studsStale, true);
  assert.ok(useModelStore.getState().past.length >= 6);
});

test('SPEC-003-D: un perfil Metalcon usado por un tipo no puede eliminarse en silencio', () => {
  const actions = useModelStore.getState();
  const before = useModelStore.getState().model;

  assert.deepEqual(actions.removeLibraryItem('metalconProfiles', 'MC-USED'), {
    ok: false,
    error: 'El perfil MC-USED está referenciado por 1 tipo(s) de muro.',
    wallTypeIds: ['WT']
  });
  assert.equal(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);

  assert.deepEqual(actions.removeLibraryItem('metalconProfiles', 'MC-FREE'), {
    ok: true,
    key: 'metalconProfiles',
    id: 'MC-FREE'
  });
  assert.equal(
    useModelStore.getState().model.library.metalconProfiles.some(
      (profile) => profile.id === 'MC-FREE'
    ),
    false
  );
  assert.equal(useModelStore.getState().past.length, 1);
});

test('SPEC-003-D: navegación de niveles, vistas y encuadre no contamina historial', () => {
  const actions = useModelStore.getState();
  actions.goToPreviousZLevel();
  assert.equal(useModelStore.getState().model.currentZLevelId, 'Z0');
  actions.goToNextZLevel();
  assert.equal(useModelStore.getState().model.currentZLevelId, 'Z1');
  actions.goToNextZLevel();
  assert.equal(useModelStore.getState().model.currentZLevelId, 'Z1');
  actions.goToPreviousZLevel();

  actions.zoomIn();
  actions.zoomOut(800, 600);
  actions.setViewOffset(10, 20);
  actions.toggleAxes();
  actions.fitToContent(800, 600);
  actions.setViewMode('elevation-x-X0');
  actions.fitToContent(800, 600);
  actions.setViewMode('elevation-y-Y0');
  actions.fitToContent(800, 600);

  actions.setLayout('split');
  actions.setViewModeB('elevation-x-X0');
  actions.zoomInB(400, 600);
  actions.zoomOutB(400, 600);
  actions.setViewOffsetB(30, 40);
  actions.toggleAxesB();
  actions.fitToContentB(400, 600);
  actions.setViewModeB('elevation-y-Y0');
  actions.fitToContentB(400, 600);
  actions.toggleLegendCollapsed('a');
  actions.toggleLegendCollapsed('b');

  actions.centerOnElement('O1', 800, 600);
  assert.equal(useModelStore.getState().model.selectedElementId, 'O1');
  assert.equal(useModelStore.getState().model.viewMode, 'plan');
  actions.setViewMode('elevation-y-Y0');
  actions.zoomToElement('O1', 800, 600);
  assert.ok(
    Number.isFinite(useModelStore.getState().view.scale),
    JSON.stringify(useModelStore.getState().view)
  );
  assert.ok(
    Number.isFinite(useModelStore.getState().viewB.scale),
    JSON.stringify(useModelStore.getState().viewB)
  );
  assert.equal(useModelStore.getState().legendCollapsedA, true);
  assert.equal(useModelStore.getState().legendCollapsedB, true);
  assert.equal(useModelStore.getState().past.length, 0);
});

test('SPEC-003-D: techumbre y mutaciones agrupadas son atómicas y reversibles', () => {
  const actions = useModelStore.getState();
  actions.duplicateRoofSystem('missing');
  assert.equal(useModelStore.getState().past.length, 0);
  actions.duplicateRoofSystem('R1');
  let current = useModelStore.getState().model;
  assert.equal(current.roofSystems.length, 2);
  const duplicate = current.roofSystems[1];
  assert.deepEqual(duplicate.runRange, { from: 4000, to: 8000 });
  assert.equal(duplicate.trussGeometry, undefined);
  assert.equal(duplicate.trussPositions[0].world.x, 1000);

  actions.selectRoofSystem(duplicate.id);
  actions.removeRoofSystem(duplicate.id);
  assert.equal(useModelStore.getState().model.selectedRoofSystemId, null);
  actions.addRoofSystem({ name: 'Nuevo' });
  const addedRoofId = useModelStore.getState().model.roofSystems.at(-1).id;
  assert.ok(addedRoofId);

  actions.addAxesAndElements([
    { id: 'X2', axis: 'x', position: 8000, label: 'X2' },
    { id: 'Y2', axis: 'y', position: 6000, label: 'Y2' }
  ], [{
    type: 'column',
    axisXId: 'X2',
    axisYId: 'Y2',
    bottomZ: 'Z0',
    topZ: 'Z1'
  }]);
  current = useModelStore.getState().model;
  assert.ok(current.grid.xAxes.some((axis) => axis.id === 'X2'));
  assert.ok(current.grid.yAxes.some((axis) => axis.id === 'Y2'));
  assert.equal(current.elements.at(-1).type, 'column');

  const historyBeforeEmptyBatch = useModelStore.getState().past.length;
  actions.applyWallPatchesBatch([]);
  assert.equal(useModelStore.getState().past.length, historyBeforeEmptyBatch);
  actions.applyWallPatchesBatch([{
    wallId: 'W1',
    patch: { studs: [{ offset: 400, zMin: 0, zMax: 2400 }], headers: [] }
  }]);
  assert.equal(
    useModelStore.getState().model.elements.find((element) => element.id === 'W1')
      .studs[0].offset,
    400
  );
  actions.commitWallRegeneration('W1', 'wallFraming', {
    studs: [{ offset: 800, zMin: 0, zMax: 2400 }],
    headers: []
  });
  assert.equal(
    useModelStore.getState().model.elements.find((element) => element.id === 'W1')
      .studs[0].offset,
    800
  );

  actions.addOpeningToWall('W1', {
    type: 'door',
    offset: 2000,
    width: 900,
    height: 2100
  });
  const openingId = useModelStore.getState().model.elements
    .find((element) => element.id === 'W1').openings.at(-1).id;
  actions.updateOpening('W1', openingId, { width: 950 });
  assert.equal(
    useModelStore.getState().model.elements.find((element) => element.id === 'W1')
      .openings.at(-1).width,
    950
  );
  actions.undo();
  actions.redo();
  assert.ok(useModelStore.getState().past.length > 0);
});

test('SPEC-003-D: eliminación distingue sistema, cota, elemento y vano', () => {
  const actions = useModelStore.getState();

  actions.selectRoofSystem('R1');
  actions.deleteSelectedElement();
  assert.equal(useModelStore.getState().model.roofSystems.length, 0);

  resetStore(model({
    dimensions: [{ id: 'D1', kind: 'linear' }],
    selectedElementId: 'D1'
  }));
  useModelStore.getState().deleteSelectedElement();
  assert.deepEqual(useModelStore.getState().model.dimensions, []);

  resetStore(model({ selectedElementId: 'C1' }));
  useModelStore.getState().deleteSelectedElement();
  assert.equal(
    useModelStore.getState().model.elements.some((element) => element.id === 'C1'),
    false
  );

  resetStore(model({ selectedElementId: 'O1' }));
  useModelStore.getState().deleteSelectedElement();
  const changedWall = useModelStore.getState().model.elements
    .find((element) => element.id === 'W1');
  assert.deepEqual(changedWall.openings, []);
  assert.equal(changedWall.studsStale, true);
});

test('SPEC-003-D: persistencia y archivo usan fronteras controladas y errores tipados', () => {
  resetStore(model({
    elements: [],
    wallTypes: [],
    roofSystems: [],
    library: {
      wallSections: [],
      columnSections: [],
      beamSections: [],
      openingTemplates: [],
      foundationSections: [],
      metalconProfiles: [],
      materials: [],
      trussTemplates: []
    }
  }));
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const actions = useModelStore.getState();
  actions.saveModel();
  assert.equal(values.size, 1);
  assert.equal(actions.loadModel().ok, true);

  values.clear();
  assert.equal(actions.loadModel().error.code, 'MODEL_NOT_FOUND');
  values.set('modelador-structural-v1', '{"grid":');
  assert.equal(actions.loadModel().error.code, 'INVALID_JSON');
  assert.equal(useModelStore.getState().modelImportFeedback.severity, 'error');

  class SuccessfulReader {
    readAsText() {
      this.onload({
        target: {
          result: JSON.stringify({
            modelVersion: 2,
            grid: { xAxes: [], yAxes: [], zLevels: [] },
            elements: []
          })
        }
      });
    }
  }
  assert.deepEqual(
    actions.importModelFromFile(
      { name: 'ok.json' },
      { FileReader: SuccessfulReader }
    ),
    { ok: true }
  );
  assert.equal(useModelStore.getState().model.elements.length, 0);
  assert.equal(
    actions.importModelFromFile({}, { FileReader: null }).error.code,
    'FILE_READER_UNAVAILABLE'
  );

  let anchor = null;
  let revoked = null;
  const originalDocument = globalThis.document;
  const originalUrl = globalThis.URL;
  globalThis.document = {
    createElement: () => ({
      click() {
        anchor = this;
      }
    })
  };
  globalThis.URL = {
    createObjectURL: () => 'blob:model',
    revokeObjectURL: (url) => { revoked = url; }
  };
  try {
    assert.equal(actions.exportModelToFile().status, 'pass');
    assert.equal(anchor.download, 'geometria-agnostica.json');
    assert.equal(anchor.href, 'blob:model');
    assert.equal(revoked, 'blob:model');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    globalThis.URL = originalUrl;
  }
});
