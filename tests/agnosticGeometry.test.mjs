import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  AGNOSTIC_GEOMETRY_FILENAME,
  AGNOSTIC_GEOMETRY_MIME,
  AgnosticGeometryError,
  downloadAgnosticGeometry,
  projectAgnosticGeometry,
  serializeAgnosticGeometry
} from '../src/core/agnosticGeometry.js';
import { consumeSpec14Input, Spec14InputError } from '../src/core/spec14Input.js';

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`fixtures/${name}`, import.meta.url), 'utf8'));
}

function emptyModel(overrides = {}) {
  return {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    projectParams: [],
    roofSystems: [],
    roofPlanes: [],
    ...overrides
  };
}

function geometryModel() {
  return emptyModel({
    grid: {
      xAxes: [
        { id: 'X0', position: 0, label: 'A' },
        { id: 'X1', position: 4000, label: 'B' }
      ],
      yAxes: [
        { id: 'Y0', position: 0, label: '1' },
        { id: 'Y1', position: 3000, label: '2' }
      ],
      zLevels: [
        { id: 'Z-FOUND', elevation: -1000 },
        { id: 'Z0', elevation: 0 },
        { id: 'Z1', elevation: 2400 }
      ]
    },
    projectParams: [
      { id: 'P-T', name: 'ESPESOR', value: 90 },
      { id: 'P-H', name: 'ALTO_VANO', value: 1200 }
    ],
    elements: [
      {
        id: 'W1', type: 'wall', direction: 'x',
        xStart: 'X0', xEnd: 'X1', yStart: 'Y0', yEnd: 'Y0',
        bottomZ: 'Z0', topZ: 'Z1', thickness: '=ESPESOR',
        openings: [{
          id: 'O1', type: 'window', axisType: 'x',
          referenceAxisId: 'X0', referenceEdge: 'left', edgeOffset: 400,
          position: -999, width: 1200, height: '=ALTO_VANO', sillHeight: 800
        }]
      },
      {
        id: 'C1', type: 'column', axisXId: 'X1', axisYId: 'Y1',
        offsetX: -100, offsetY: 50, bottomZ: 'Z0', topZ: 'Z1',
        widthX: 200, widthY: 300
      },
      {
        id: 'B1', type: 'beam', direction: 'y', fixedAxisId: 'X1',
        startAxisId: 'Y0', endAxisId: 'Y1', levelZ: 'Z1', width: 200, height: 400
      },
      {
        id: 'F1', type: 'foundation', foundationType: 'corrida', direction: 'x',
        fixedAxisId: 'Y0', startAxisId: 'X0', endAxisId: 'X1', levelZ: 'Z0',
        topOffset: 0,
        sobrecimiento: { width: 200, height: 400 },
        cimiento: { width: 500, depth: 600 },
        emplantillado: { thickness: 50, overhang: 100 }
      },
      {
        id: 'F2', type: 'foundation', foundationType: 'aislada',
        axisXId: { refElementId: 'C1', edge: 'center' }, axisYId: 'Y1',
        levelZ: 'Z0', topOffset: 0,
        aislada: { lengthX: 1000, lengthY: 1200, depth: 500 }
      }
    ]
  });
}

function heterogeneousCrownModel() {
  return emptyModel({
    grid: {
      xAxes: [
        { id: 'X-CROWN-0', position: 0 },
        { id: 'X-CROWN-MID', position: 2000 },
        { id: 'X-CROWN-1', position: 4000 }
      ],
      yAxes: [
        { id: 'Y-CANAL', position: 0 },
        { id: 'Y-CROWN', position: 3000 }
      ],
      zLevels: [
        { id: 'Z-CROWN-0', elevation: 0 },
        { id: 'Z-CANAL', elevation: 2400 },
        { id: 'Z-CROWN-LOW', elevation: 3000 },
        { id: 'Z-CROWN-HIGH', elevation: 3300 }
      ]
    },
    elements: [
      {
        id: 'W-CANAL', type: 'wall', direction: 'x',
        xStart: 'X-CROWN-0', xEnd: 'X-CROWN-1',
        yStart: 'Y-CANAL', yEnd: 'Y-CANAL',
        bottomZ: 'Z-CROWN-0', topZ: 'Z-CANAL', thickness: 90, openings: []
      },
      {
        id: 'W-CROWN-LOW', type: 'wall', direction: 'x',
        xStart: 'X-CROWN-0', xEnd: 'X-CROWN-MID',
        yStart: 'Y-CROWN', yEnd: 'Y-CROWN',
        bottomZ: 'Z-CROWN-0', topZ: 'Z-CROWN-LOW', thickness: 90, openings: [],
        studs: [{ role: 'stud', offset: 0 }]
      },
      {
        id: 'W-CROWN-HIGH', type: 'wall', direction: 'x',
        xStart: 'X-CROWN-MID', xEnd: 'X-CROWN-1',
        yStart: 'Y-CROWN', yEnd: 'Y-CROWN',
        bottomZ: 'Z-CROWN-0', topZ: 'Z-CROWN-HIGH', thickness: 90, openings: [],
        osbCourses: [{ id: 'OSB-SENTINEL' }]
      }
    ],
    roofPlanes: [{
      id: 'RP-HETEROGENEOUS-CROWNS',
      canalWallId: 'W-CANAL',
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 }
      ],
      supportLevelId: 'Z-CANAL',
      supportOffset: 0,
      heelHeight: 100,
      crownClearance: 100,
      trussGeometry: { members: [{ id: 'MEMBER-SENTINEL' }] },
      purlins: [{ id: 'PURLIN-SENTINEL' }],
      findings: [{ id: 'FINDING-SENTINEL' }]
    }]
  });
}

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      keys.add(key);
      collectKeys(item, keys);
    });
  }
  return keys;
}

test('SPEC-006-B: el contrato declara sólo elements y roofGeometry en la raíz', () => {
  const projected = projectAgnosticGeometry(emptyModel());
  assert.deepEqual(projected, {
    schema: 'agnostic-geometry-v1.0',
    units: { length: 'millimeter' },
    coordinates: {
      type: 'cartesian',
      handedness: 'right-handed',
      axes: { x: 'plan', y: 'plan', z: 'vertical-up' }
    },
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    roofGeometry: []
  });
  for (const legacyKey of ['walls', 'columns', 'beams', 'foundations', 'roofs']) {
    assert.equal(Object.hasOwn(projected, legacyKey), false);
  }
  assert.equal(serializeAgnosticGeometry(emptyModel()).endsWith('\n'), true);
});

test('SPEC-006-A: resuelve fórmulas, referencias, vanos y sólidos multicapa sin intercambiar y/z', () => {
  const source = geometryModel();
  const before = structuredClone(source);
  const projected = projectAgnosticGeometry(source);

  assert.deepEqual(projected.grid, {
    xAxes: [{ id: 'X0', x: 0 }, { id: 'X1', x: 4000 }],
    yAxes: [{ id: 'Y0', y: 0 }, { id: 'Y1', y: 3000 }],
    zLevels: [
      { id: 'Z-FOUND', z: -1000 },
      { id: 'Z0', z: 0 },
      { id: 'Z1', z: 2400 }
    ]
  });
  assert.deepEqual(projected.elements.find(({ type }) => type === 'wall'), {
    id: 'W1',
    type: 'wall',
    prism: {
      kind: 'oriented-prism',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      thickness: 90,
      height: 2400
    },
    openings: [{
      id: 'O1',
      kind: 'window',
      hostWallId: 'W1',
      void: {
        kind: 'oriented-prism',
        start: { x: 400, y: 0, z: 800 },
        end: { x: 1600, y: 0, z: 800 },
        thickness: 90,
        height: 1200
      }
    }]
  });
  assert.deepEqual(projected.elements.find(({ type }) => type === 'column').prism, {
    kind: 'axis-aligned-prism',
    min: { x: 3800, y: 2900, z: 0 },
    max: { x: 4000, y: 3200, z: 2400 }
  });
  assert.deepEqual(projected.elements.find(({ type }) => type === 'beam').prism, {
    kind: 'oriented-prism',
    start: { x: 4000, y: 0, z: 2400 },
    end: { x: 4000, y: 3000, z: 2400 },
    width: 200,
    height: 400
  });
  assert.deepEqual(projected.elements.find(({ id }) => id === 'F1').solids, [
    {
      role: 'cimiento',
      prism: {
        kind: 'axis-aligned-prism',
        min: { x: 0, y: -250, z: -1000 },
        max: { x: 4000, y: 250, z: -400 }
      }
    },
    {
      role: 'emplantillado',
      prism: {
        kind: 'axis-aligned-prism',
        min: { x: 0, y: -350, z: -1050 },
        max: { x: 4000, y: 350, z: -1000 }
      }
    },
    {
      role: 'sobrecimiento',
      prism: {
        kind: 'axis-aligned-prism',
        min: { x: 0, y: -100, z: -400 },
        max: { x: 4000, y: 100, z: 0 }
      }
    }
  ]);
  assert.deepEqual(projected.elements.find(({ id }) => id === 'F2').solids[0], {
    role: 'zapata',
    prism: {
      kind: 'axis-aligned-prism',
      min: { x: 3400, y: 2400, z: -500 },
      max: { x: 4400, y: 3600, z: 0 }
    }
  });
  assert.deepEqual(source, before);
});

test('SPEC-006-B: casa-L es consumible literalmente por la entrada obligatoria de SPEC-14', async () => {
  const source = await fixture('casa-L.json');
  const projected = projectAgnosticGeometry(source);
  const consumed = consumeSpec14Input(projected);
  assert.equal(consumed.walls.length, 45);
  assert.equal(consumed.openings.length, 43);
  assert.equal(consumed.foundations.length, 4);
  assert.equal(consumed.roofGeometry.length, 2);
  assert.ok(consumed.roofGeometry.every((roof) => roof.source === 'roof-system'));
  assert.ok(consumed.roofGeometry.every((roof) => roof.surface.boundary.length === 4));
  assert.deepEqual(
    new Set(consumed.walls.map(({ id }) => id)),
    new Set(source.elements.filter(({ type }) => type === 'wall').map(({ id }) => id))
  );
  assert.deepEqual(
    new Set(consumed.openings.map(({ id }) => id)),
    new Set(source.elements.flatMap((element) => element.openings ?? []).map(({ id }) => id))
  );
  assert.deepEqual(
    new Set(consumed.foundations.map(({ id }) => id)),
    new Set(source.elements.filter(({ type }) => type === 'foundation').map(({ id }) => id))
  );
  assert.deepEqual(
    new Set(consumed.roofGeometry.map(({ id }) => id)),
    new Set(source.roofSystems.map(({ id }) => id))
  );

  const forbidden = new Set([
    'library', 'libraryId', 'wallTypeId', 'wallTypes', 'materials', 'profiles',
    'studs', 'framing', 'osb', 'osbCourses', 'osbDefaults', 'metalconDefaults',
    'trussGeometry', 'trussPositions', 'purlins', 'supportLedgers', 'stale',
    'studsStale', 'osbStale', 'selectedElementId', 'viewMode', 'projectParams'
  ]);
  const leaked = [...collectKeys(projected)].filter((key) => forbidden.has(key));
  assert.deepEqual(leaked, []);
});

test('SPEC-006-B: FX-003 conserva tipos y FX-004 roofGeometry sin solución constructiva', async () => {
  const fx3 = projectAgnosticGeometry(await fixture('fx-003-vivienda-independiente.json'));
  const consumedFx3 = consumeSpec14Input(fx3);
  assert.equal(consumedFx3.walls.length, 6);
  assert.equal(consumedFx3.openings.length, 6);
  assert.deepEqual(new Set(fx3.elements.map(({ type }) => type)), new Set(['wall']));

  const fx4 = projectAgnosticGeometry(await fixture('fx-004-cubierta-moderna.json'));
  assert.equal(fx4.elements.filter(({ type }) => type === 'wall').length, 4);
  assert.equal(fx4.roofGeometry.length, 1);
  assert.equal(fx4.roofGeometry[0].id, 'FX4-RP-01');
  assert.equal(fx4.roofGeometry[0].source, 'roof-plane');
  assert.deepEqual(
    fx4.roofGeometry[0].surface.boundary.map(({ x, y }) => ({ x, y })),
    [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 3200 }, { x: 0, y: 3200 }]
  );
  assert.doesNotMatch(JSON.stringify(fx4), /template|profile|spacing|member|purlin/i);
});

test('SPEC-006-C: coronaciones colineales heterogéneas usan la menor restricción y son invariantes por permutación', () => {
  const source = heterogeneousCrownModel();
  const projected = projectAgnosticGeometry(source);
  const roof = projected.roofGeometry.find(({ id }) => id === 'RP-HETEROGENEOUS-CROWNS');

  assert.equal(projected.roofGeometry.length, 1);
  assert.equal(roof.source, 'roof-plane');
  assert.equal(roof.surface.kind, 'planar-polygon');
  assert.deepEqual(roof.surface.boundary, [
    { x: 0, y: 0, z: 2500 },
    { x: 4000, y: 0, z: 2500 },
    { x: 4000, y: 3000, z: 2900 },
    { x: 0, y: 3000, z: 2900 }
  ]);
  const highEdge = roof.surface.boundary.filter(({ y }) => y === 3000);
  assert.ok(highEdge.every(({ z }) => z <= 3000 - 100 && z <= 3300 - 100));
  assert.ok(roof.surface.boundary.every((point) => (
    Object.values(point).every(Number.isFinite)
  )));

  const permuted = structuredClone(source);
  permuted.elements.reverse();
  assert.equal(serializeAgnosticGeometry(permuted), serializeAgnosticGeometry(source));
  assert.equal(consumeSpec14Input(projected).roofGeometry.length, 1);
  assert.doesNotMatch(
    JSON.stringify(projected),
    /studs|osbCourses|trussGeometry|members|purlins|findings|SENTINEL/
  );
});

test('SPEC-006-C: una coronación gobernante bajo la canaleta falla atómicamente', () => {
  const source = heterogeneousCrownModel();
  source.grid.zLevels.find(({ id }) => id === 'Z-CROWN-LOW').elevation = 2500;
  const events = [];

  assert.throws(
    () => downloadAgnosticGeometry(source, {
      Blob: class { constructor() { events.push('blob'); } },
      document: { createElement() { events.push('element'); } },
      URL: {
        createObjectURL() { events.push('url'); },
        revokeObjectURL() { events.push('revoke'); }
      }
    }),
    (error) => error instanceof AgnosticGeometryError
      && error.code === 'INVALID_DIMENSION'
      && error.ids.includes('RP-HETEROGENEOUS-CROWNS')
      && /pendiente negativa/.test(error.message)
  );
  assert.deepEqual(events, []);
});

test('SPEC-006-B: el consumidor rechaza la forma separada y entradas sin muros', () => {
  const projected = projectAgnosticGeometry(geometryModel());
  const walls = projected.elements.filter(({ type }) => type === 'wall');
  const legacySeparated = { ...projected, walls };
  delete legacySeparated.elements;
  assert.throws(
    () => consumeSpec14Input(legacySeparated),
    (error) => error instanceof Spec14InputError && error.code === 'INVALID_COLLECTION'
  );
  assert.throws(
    () => consumeSpec14Input(projectAgnosticGeometry(emptyModel())),
    (error) => error instanceof Spec14InputError && error.code === 'MISSING_WALLS'
  );
});

test('SPEC-006-B: el consumidor contractual acepta una entrada mínima literal', () => {
  const input = {
    schema: 'agnostic-geometry-v1.0',
    grid: {
      xAxes: [{ id: 'X0', x: 0 }],
      yAxes: [{ id: 'Y0', y: 0 }],
      zLevels: [{ id: 'Z0', z: 0 }]
    },
    elements: [{
      id: 'W1',
      type: 'wall',
      prism: {
        kind: 'oriented-prism',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        thickness: 90,
        height: 2400
      },
      openings: []
    }],
    roofGeometry: []
  };
  const before = structuredClone(input);
  const consumed = consumeSpec14Input(input);
  assert.deepEqual(consumed.walls.map(({ id }) => id), ['W1']);
  assert.deepEqual(consumed.openings, []);
  assert.deepEqual(input, before);
});

test('SPEC-006-A: serialización canónica ignora permutaciones equivalentes y termina en newline', () => {
  const source = geometryModel();
  const permuted = structuredClone(source);
  for (const field of ['xAxes', 'yAxes', 'zLevels']) permuted.grid[field].reverse();
  permuted.elements.reverse();
  permuted.elements.find(({ id }) => id === 'W1').openings.reverse();
  permuted.roofSystems.reverse();
  permuted.roofPlanes.reverse();

  const a = serializeAgnosticGeometry(source);
  const b = serializeAgnosticGeometry(permuted);
  assert.equal(a, b);
  assert.equal(a.at(-1), '\n');
});

test('SPEC-006-A: corpus adversario aborta con error tipado y contexto', () => {
  const cases = [
    {
      code: 'UNKNOWN_ELEMENT_TYPE',
      model: emptyModel({ elements: [{ id: 'E-X', type: 'mesh' }] }),
      id: 'E-X'
    },
    {
      code: 'UNRESOLVED_REFERENCE',
      model: { ...geometryModel(), elements: geometryModel().elements.map((item) => (
        item.id === 'W1' ? { ...item, xEnd: 'X-ROTO' } : item
      )) },
      id: 'W1'
    },
    {
      code: 'DUPLICATE_ID',
      model: emptyModel({
        grid: {
          xAxes: [{ id: 'DUP', position: 0 }],
          yAxes: [{ id: 'DUP', position: 0 }],
          zLevels: []
        }
      }),
      id: 'DUP'
    },
    {
      code: 'INVALID_DIMENSION',
      model: { ...geometryModel(), elements: geometryModel().elements.map((item) => (
        item.id === 'W1' ? { ...item, thickness: 0 } : item
      )) },
      id: 'W1'
    },
    {
      code: 'NON_FINITE_NUMBER',
      model: emptyModel({
        grid: { xAxes: [{ id: 'X-NAN', position: NaN }], yAxes: [], zLevels: [] }
      }),
      id: 'X-NAN'
    }
  ];

  for (const entry of cases) {
    assert.throws(
      () => projectAgnosticGeometry(entry.model),
      (error) => error instanceof AgnosticGeometryError
        && error.code === entry.code
        && error.ids.includes(entry.id),
      entry.code
    );
  }
});

test('SPEC-006-A: rechazo geométrico sucede antes de Blob/URL y la descarga revoca aun si click falla', () => {
  const events = [];
  let downloadedBlob = null;
  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options.type;
      events.push(['blob', options.type]);
    }
  }
  const anchor = {
    href: '', download: '',
    click() { events.push(['click', this.href, this.download]); }
  };
  const environment = {
    Blob: FakeBlob,
    document: { createElement: () => anchor },
    URL: {
      createObjectURL(blob) {
        downloadedBlob = blob;
        events.push(['url', blob.type]);
        return 'blob:geometry';
      },
      revokeObjectURL(url) { events.push(['revoke', url]); }
    }
  };

  assert.equal(downloadAgnosticGeometry(emptyModel(), environment).status, 'pass');
  assert.equal(anchor.download, AGNOSTIC_GEOMETRY_FILENAME);
  assert.equal(anchor.download, 'geometria-agnostica.json');
  assert.equal(anchor.href, 'blob:geometry');
  assert.equal(events[0][1], AGNOSTIC_GEOMETRY_MIME);
  assert.equal(events[0][1], 'application/json;charset=utf-8');
  assert.match(events[0][0], /blob/);
  assert.equal(downloadedBlob.parts[0].endsWith('\n'), true);
  assert.deepEqual(events.at(-1), ['revoke', 'blob:geometry']);

  const invalidEvents = [];
  assert.throws(
    () => downloadAgnosticGeometry(
      emptyModel({ elements: [{ id: 'X', type: 'unknown' }] }),
      {
        Blob: class { constructor() { invalidEvents.push('blob'); } },
        document: { createElement() { invalidEvents.push('element'); } },
        URL: {
          createObjectURL() { invalidEvents.push('url'); },
          revokeObjectURL() { invalidEvents.push('revoke'); }
        }
      }
    ),
    (error) => error instanceof AgnosticGeometryError
  );
  assert.deepEqual(invalidEvents, []);

  const revoked = [];
  assert.throws(
    () => downloadAgnosticGeometry(emptyModel(), {
      Blob: FakeBlob,
      document: { createElement: () => ({ click() { throw new Error('click falló'); } }) },
      URL: {
        createObjectURL: () => 'blob:failed',
        revokeObjectURL: (url) => revoked.push(url)
      }
    }),
    /click falló/
  );
  assert.deepEqual(revoked, ['blob:failed']);
});
