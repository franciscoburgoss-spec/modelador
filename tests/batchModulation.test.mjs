import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulateAllWallsMetalcon, modulateAllWallsOsb, modulateAllWallsFull } from '../src/core/batchModulation.js';

const grid = {
  xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: 4000 }],
  yAxes: [
    { id: 'Y1', position: 0 },
    { id: 'Y2', position: 3000 },
    { id: 'Y3', position: 6000 }
  ],
  zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
};

const wallX = (id, overrides = {}) => ({
  id, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1',
  bottomZ: 'Z0', topZ: 'Z1', thickness: 90, openings: [], ...overrides
});

const wallDegenerate = (id) => ({
  // mismo eje inicio/fin → largo 0 → no resoluble
  id, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X1', yStart: 'Y1', yEnd: 'Y1',
  bottomZ: 'Z0', topZ: 'Z1', thickness: 90, openings: []
});

const profiles = [
  { id: 'C90', shape: 'C', B: 40 },
  { id: 'U90', shape: 'U' },
  { id: 'C60', shape: 'C', B: 35 },
  { id: 'U60', shape: 'U' }
];

const wallType = (id, role, studProfileId, trackProfileId, spacing, gap) => ({
  id,
  name: id,
  role,
  metalconDefaults: { spacing, studProfileId, trackProfileId, materialId: null },
  osbDefaults: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap }
});

test('modulateAllWallsMetalcon: genera patch para cada muro elegible con defaults', () => {
  const model = {
    grid,
    projectParams: [],
    elements: [wallX(1), wallX(2, { yStart: 'Y2', yEnd: 'Y2' })]
  };
  const { patches, skipped } = modulateAllWallsMetalcon(model, {
    spacing: 400, studProfileId: 'S1', trackProfileId: 'T1', materialId: null
  });
  assert.equal(patches.length, 2);
  assert.equal(skipped.length, 0);
  assert.ok(patches[0].patch.studs.length > 0);
  assert.equal(patches[0].patch.framingStudProfileId, 'S1');
  assert.equal(patches[0].patch.framingTrackProfileId, 'T1');
});

test('modulateAllWallsMetalcon: respeta config propia del muro por sobre el default', () => {
  const model = {
    grid, projectParams: [],
    elements: [wallX(1, { framingStudProfileId: 'OWN', studSpacing: 600 })]
  };
  const { patches } = modulateAllWallsMetalcon(model, { spacing: 400, studProfileId: 'DEFAULT', trackProfileId: 'T1' });
  assert.equal(patches[0].patch.framingStudProfileId, 'OWN');
  assert.equal(patches[0].patch.studSpacing, 600);
});

test('modulateAllWallsMetalcon: muro no resoluble se omite con razón, no rompe el resto', () => {
  const model = { grid, projectParams: [], elements: [wallX(1), wallDegenerate(2)] };
  const { patches, skipped } = modulateAllWallsMetalcon(model, { studProfileId: 'S1', trackProfileId: 'T1' });
  assert.equal(patches.length, 1);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].wallId, 2);
  assert.ok(skipped[0].reason);
});

test('modulateAllWallsMetalcon: sin perfil (ni propio ni default) se omite', () => {
  const model = { grid, projectParams: [], elements: [wallX(1)] };
  const { patches, skipped } = modulateAllWallsMetalcon(model, {});
  assert.equal(patches.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /perfil/);
});

test('modulateAllWallsMetalcon: skipExisting omite muros que ya tienen studs', () => {
  const model = {
    grid, projectParams: [],
    elements: [
      wallX(1, { studs: [{ offset: 0, zMin: 0, zMax: 2400, role: 'edge' }] }),
      wallX(2, { yStart: 'Y2', yEnd: 'Y2' })
    ]
  };
  const { patches, skipped } = modulateAllWallsMetalcon(model, { studProfileId: 'S1', trackProfileId: 'T1' }, { skipExisting: true });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].wallId, 2);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].wallId, 1);
});

test('modulateAllWallsOsb: solo considera muros con studs ya generados', () => {
  const model = {
    grid, projectParams: [],
    elements: [
      wallX(1, { studs: [{ offset: 0, zMin: 0, zMax: 2400, role: 'edge' }, { offset: 4000, zMin: 0, zMax: 2400, role: 'edge' }] }),
      wallX(2, { yStart: 'Y2', yEnd: 'Y2' }) // sin studs → no elegible
    ]
  };
  const { patches, skipped } = modulateAllWallsOsb(model, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].wallId, 1);
  assert.equal(skipped.length, 0); // el muro 2 ni siquiera entra al pool, no es un "fallo"
  assert.ok(patches[0].patch.osbCourses.length > 0);
});

test('modulateAllWallsOsb: skipExisting omite muros que ya tienen osbCourses', () => {
  const studs = [{ offset: 0, zMin: 0, zMax: 2400, role: 'edge' }, { offset: 4000, zMin: 0, zMax: 2400, role: 'edge' }];
  const model = {
    grid, projectParams: [],
    elements: [
      wallX(1, { studs, osbCourses: [{ panels: [] }] }),
      wallX(2, { studs, yStart: 'Y2', yEnd: 'Y2' })
    ]
  };
  const { patches, skipped } = modulateAllWallsOsb(model, { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 }, { skipExisting: true });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].wallId, 2);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].wallId, 1);
});

test('modulateAllWallsFull: encadena metalcon → OSB, un muro sin studs previos recibe ambos patches fusionados', () => {
  const model = { grid, projectParams: [], elements: [wallX(1)] };
  const { patches, skippedMetalcon, skippedOsb } = modulateAllWallsFull(model, {
    metalcon: { spacing: 400, studProfileId: 'S1', trackProfileId: 'T1' },
    osb: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 }
  });
  assert.equal(skippedMetalcon.length, 0);
  assert.equal(skippedOsb.length, 0);
  assert.equal(patches.length, 1);
  assert.ok(patches[0].patch.studs.length > 0, 'trae el patch de metalcon');
  assert.ok(patches[0].patch.osbCourses.length > 0, 'trae también el de OSB, generado sobre el modelo intermedio con los studs recién creados');
});

test('modulateAllWallsFull: muro sin perfil metalcon queda fuera de metalcon y por lo tanto de OSB también', () => {
  const model = { grid, projectParams: [], elements: [wallX(1)] };
  const { patches, skippedMetalcon, skippedOsb } = modulateAllWallsFull(model, {
    metalcon: {}, // sin perfiles
    osb: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 }
  });
  assert.equal(patches.length, 0);
  assert.equal(skippedMetalcon.length, 1);
  assert.match(skippedMetalcon[0].reason, /perfil/);
  assert.equal(skippedOsb.length, 0); // ni siquiera entra al pool de OSB (no tiene studs), no es un "fallo" de OSB
});

test('modulateAllWallsFull: skipExisting respeta ambos subsistemas por separado', () => {
  const studs = [{ offset: 0, zMin: 0, zMax: 2400, role: 'edge' }, { offset: 4000, zMin: 0, zMax: 2400, role: 'edge' }];
  const model = {
    grid, projectParams: [],
    elements: [
      wallX(1, { studs, osbCourses: [{ panels: [] }] }), // ya tiene ambos → se salta completo
      wallX(2, { yStart: 'Y2', yEnd: 'Y2', studs }), // ya tiene metalcon, falta OSB
      wallX(3, { yStart: 'Y3', yEnd: 'Y3' }) // no tiene nada
    ]
  };
  const { patches, skippedMetalcon, skippedOsb } = modulateAllWallsFull(model, {
    metalcon: { spacing: 400, studProfileId: 'S1', trackProfileId: 'T1' },
    osb: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 }
  }, { skipExisting: true });

  const patchByWall = new Map(patches.map(p => [p.wallId, p.patch]));
  assert.ok(!patchByWall.has(1), 'muro 1 ya tenía ambos: no recibe nada');
  assert.ok(patchByWall.get(2)?.osbCourses?.length > 0, 'muro 2 solo recibe OSB (metalcon ya lo tenía)');
  assert.ok(!('studs' in (patchByWall.get(2) || {})), 'muro 2 no repite el patch de metalcon que ya tenía');
  assert.ok(patchByWall.get(3)?.studs?.length > 0 && patchByWall.get(3)?.osbCourses?.length > 0, 'muro 3 recibe ambos, de cero');
  assert.equal(skippedMetalcon.find(s => s.wallId === 1)?.reason, 'ya tiene despiece');
  assert.equal(skippedOsb.find(s => s.wallId === 1)?.reason, 'ya tiene despiece OSB');
});

test('R5-C: batch/full resuelven dos tipos 90/60 sin overrides y persisten configuración efectiva', () => {
  const model = {
    grid,
    projectParams: [],
    library: { metalconProfiles: profiles },
    wallTypes: [
      wallType('exterior-90', 'MP1', 'C90', 'U90', 400, 5),
      wallType('tabique-60', 'tabique', 'C60', 'U60', 600, 3)
    ],
    elements: [
      wallX('W90', { wallTypeId: 'exterior-90' }),
      wallX('W60', { wallTypeId: 'tabique-60', yStart: 'Y2', yEnd: 'Y2' })
    ]
  };

  const result = modulateAllWallsFull(model);
  const patches = new Map(result.patches.map(({ wallId, patch }) => [wallId, patch]));
  assert.equal(result.skippedMetalcon.length, 0);
  assert.equal(result.skippedOsb.length, 0);
  assert.deepEqual(
    {
      stud: patches.get('W90').framingStudProfileId,
      track: patches.get('W90').framingTrackProfileId,
      spacing: patches.get('W90').studSpacing,
      gap: patches.get('W90').osbGap
    },
    { stud: 'C90', track: 'U90', spacing: 400, gap: 5 }
  );
  assert.deepEqual(
    {
      stud: patches.get('W60').framingStudProfileId,
      track: patches.get('W60').framingTrackProfileId,
      spacing: patches.get('W60').studSpacing,
      gap: patches.get('W60').osbGap
    },
    { stud: 'C60', track: 'U60', spacing: 600, gap: 3 }
  );
});

test('R5-C: un tipo gana sobre overrides divergentes al regenerar', () => {
  const model = {
    grid,
    projectParams: [],
    library: { metalconProfiles: profiles },
    wallTypes: [wallType('exterior-90', 'MP1', 'C90', 'U90', 400, 5)],
    elements: [wallX('W1', {
      wallTypeId: 'exterior-90',
      framingStudProfileId: 'C60',
      framingTrackProfileId: 'U60',
      studSpacing: 600,
      osbGap: 3
    })]
  };
  const [{ patch }] = modulateAllWallsMetalcon(model).patches;
  assert.equal(patch.framingStudProfileId, 'C90');
  assert.equal(patch.framingTrackProfileId, 'U90');
  assert.equal(patch.studSpacing, 400);
  assert.equal(patch.osbGap, 5);
});
