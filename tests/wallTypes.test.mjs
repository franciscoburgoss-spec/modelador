import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALL_ROLES,
  assertValidWallTypes,
  resolveWallTypeConfig,
  wallRoleAllowsOsbRotation
} from '../src/core/wallTypes.js';

const library = {
  metalconProfiles: [
    { id: 'C90', shape: 'C', catalogDesignation: '90CA085' },
    { id: 'U90', shape: 'U', catalogDesignation: '92C085' },
    { id: 'C60', shape: 'C', catalogDesignation: '60CA085' },
    { id: 'U60', shape: 'U', catalogDesignation: '62C085' }
  ]
};

const type90 = {
  id: 'exterior-90',
  name: 'Exterior serie 90',
  role: 'MP1',
  metalconDefaults: {
    spacing: 600,
    studProfileId: 'C90',
    trackProfileId: 'U90',
    materialId: null
  },
  osbDefaults: {
    panelWidth: 1220,
    panelHeight: 2440,
    minPanelWidth: 200,
    gap: 5
  }
};

const model = {
  wallTypes: [type90],
  library,
  metalconDefaults: {
    spacing: 400,
    studProfileId: 'C60',
    trackProfileId: 'U60',
    materialId: 7
  },
  osbDefaults: {
    panelWidth: 1200,
    panelHeight: 2400,
    minPanelWidth: 250,
    gap: 3
  }
};

test('R5-A: acepta exactamente los cuatro roles y un tipo completo con perfiles C/U', () => {
  assert.deepEqual(WALL_ROLES, ['MP1', 'MP2', 'MP3', 'tabique']);
  assert.doesNotThrow(() => assertValidWallTypes([type90], library));

  for (const role of WALL_ROLES) {
    assert.doesNotThrow(() => assertValidWallTypes([{ ...type90, id: role, role }], library));
  }
  assert.throws(
    () => assertValidWallTypes([{ ...type90, role: 'mp1' }], library),
    /role/i
  );
});

test('R5-A: rechaza IDs/nombres inválidos, duplicados, defaults rotos y perfiles incompatibles', () => {
  assert.throws(() => assertValidWallTypes({}, library), /array/i);
  assert.throws(() => assertValidWallTypes([null], library), /objeto/i);
  const invalidCases = [
    [{ ...type90, id: '' }],
    [{ ...type90, name: '   ' }],
    [type90, { ...type90 }],
    [{ ...type90, metalconDefaults: null }],
    [{ ...type90, osbDefaults: null }],
    [{
      ...type90,
      metalconDefaults: { ...type90.metalconDefaults, studProfileId: undefined }
    }],
    [{
      ...type90,
      osbDefaults: { ...type90.osbDefaults, panelWidth: undefined }
    }],
    [{ ...type90, metalconDefaults: { ...type90.metalconDefaults, spacing: Infinity } }],
    [{ ...type90, metalconDefaults: { ...type90.metalconDefaults, materialId: undefined } }],
    [{ ...type90, metalconDefaults: { ...type90.metalconDefaults, materialId: '' } }],
    [{ ...type90, osbDefaults: { ...type90.osbDefaults, panelWidth: 0 } }],
    [{ ...type90, osbDefaults: { ...type90.osbDefaults, panelHeight: 0 } }],
    [{ ...type90, osbDefaults: { ...type90.osbDefaults, minPanelWidth: 199 } }],
    [{ ...type90, osbDefaults: { ...type90.osbDefaults, gap: -1 } }],
    [{ ...type90, metalconDefaults: { ...type90.metalconDefaults, studProfileId: 'U90' } }],
    [{ ...type90, metalconDefaults: { ...type90.metalconDefaults, trackProfileId: 'C90' } }],
    [{ ...type90, metalconDefaults: { ...type90.metalconDefaults, studProfileId: 'missing' } }]
  ];

  for (const wallTypes of invalidCases) {
    assert.throws(() => assertValidWallTypes(wallTypes, library), TypeError);
  }
});

test('R5-A: el tipo gana sobre cada override divergente y produce findings navegables', () => {
  const wall = {
    id: 'W1',
    type: 'wall',
    wallTypeId: 'exterior-90',
    framingStudProfileId: 'C60',
    framingTrackProfileId: 'U60',
    framingMaterialId: 7,
    studSpacing: 400,
    osbPanelWidth: 1200,
    osbPanelHeight: 2400,
    osbMinPanelWidth: 250
  };
  const original = structuredClone(wall);
  const resolved = resolveWallTypeConfig(model, wall);

  assert.equal(resolved.source, 'wallType');
  assert.equal(resolved.wallType, type90);
  assert.equal(resolved.role, 'MP1');
  assert.deepEqual(resolved.metalconDefaults, type90.metalconDefaults);
  assert.deepEqual(resolved.osbDefaults, type90.osbDefaults);
  assert.equal(resolved.findings.length, 7);
  assert.ok(resolved.findings.every((finding) => finding.severity === 'info'));
  assert.ok(resolved.findings.every((finding) => finding.category === 'wallType'));
  assert.ok(resolved.findings.every((finding) => (
    finding.wallIds.length === 1 && finding.wallIds[0] === 'W1'
  )));
  assert.deepEqual(wall, original, 'resolver no muta el muro ni descarta datos importados');
});

test('R5-A: muro tipado sin overrides no inventa findings y referencia rota no cae a legacy', () => {
  const resolved = resolveWallTypeConfig(model, {
    id: 'W2',
    type: 'wall',
    wallTypeId: 'exterior-90'
  });
  assert.deepEqual(resolved.findings, []);
  assert.throws(
    () => resolveWallTypeConfig(model, {
      id: 'W3',
      type: 'wall',
      wallTypeId: 'missing'
    }),
    /wallTypeId.*no existe/i
  );
  assert.throws(() => resolveWallTypeConfig(null, {}), /model/i);
  assert.throws(() => resolveWallTypeConfig(model, { type: 'beam' }), /tipo wall/i);
});

test('R5-A: muro sin tipo conserva la precedencia legacy y emite wallRole info', () => {
  const wall = {
    id: 'W4',
    type: 'wall',
    framingStudProfileId: 'C90',
    studSpacing: 500,
    osbPanelHeight: 2500
  };
  const resolved = resolveWallTypeConfig(model, wall);

  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.wallType, null);
  assert.equal(resolved.role, null);
  assert.deepEqual(resolved.metalconDefaults, {
    spacing: 500,
    studProfileId: 'C90',
    trackProfileId: 'U60',
    materialId: 7
  });
  assert.deepEqual(resolved.osbDefaults, {
    panelWidth: 1200,
    panelHeight: 2500,
    minPanelWidth: 250,
    gap: 3
  });
  assert.deepEqual(resolved.findings.map((finding) => ({
    severity: finding.severity,
    category: finding.category,
    wallIds: finding.wallIds
  })), [{
    severity: 'info',
    category: 'wallRole',
    wallIds: ['W4']
  }]);
});

test('R5-A: sólo tabique permite rotación OSB; rol ausente es conservador', () => {
  assert.equal(wallRoleAllowsOsbRotation('tabique'), true);
  for (const role of ['MP1', 'MP2', 'MP3', null, undefined]) {
    assert.equal(wallRoleAllowsOsbRotation(role), false);
  }
  assert.throws(() => wallRoleAllowsOsbRotation('otro'), /role/i);
});
