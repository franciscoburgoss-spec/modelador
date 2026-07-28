import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyShearCapacity,
  computeShearCapacityByDirection,
  summarizeShearCapacityByDirection
} from '../src/core/shearCapacity.js';
import { presentFinding } from '../src/core/domainFindingPresentation.js';
import { validateModel } from '../src/core/modelValidation.js';

const grid = {
  xAxes: [
    { id: 'X0', label: '0', position: 0 },
    { id: 'X1100', label: '1,10', position: 1100 },
    { id: 'X1200', label: '1,20', position: 1200 },
    { id: 'X3000', label: '3,00', position: 3000 }
  ],
  yAxes: [
    { id: 'Y0', label: '0', position: 0 },
    { id: 'Y1000', label: '1,00', position: 1000 },
    { id: 'Y2000', label: '2,00', position: 2000 }
  ],
  zLevels: [
    { id: 'Z0', label: 'NPT', elevation: 0 },
    { id: 'Z2400', label: '+2,40', elevation: 2400 },
    { id: 'Z2401', label: '+2,401', elevation: 2401 }
  ]
};

const profiles = [
  { id: 'C90', code: '90CA085', shape: 'C', H: 90, e: 0.85 },
  { id: 'U92', code: '92C085', shape: 'U', H: 92, e: 0.85 },
  { id: 'C60', code: '60CA085', shape: 'C', H: 60, e: 0.85 },
  { id: 'C90-THIN', code: '90CA05', shape: 'C', H: 90, e: 0.5 },
  { id: 'U62', code: '62C085', shape: 'U', H: 62, e: 0.85 },
  { id: 'U92-THIN', code: '92C05', shape: 'U', H: 92, e: 0.5 }
];

function wallType(id, {
  role = 'MP1',
  spacing = 400,
  studProfileId = 'C90',
  trackProfileId = 'U92'
} = {}) {
  return {
    id,
    name: id,
    role,
    metalconDefaults: {
      spacing,
      studProfileId,
      trackProfileId,
      materialId: null
    },
    osbDefaults: {
      panelWidth: 1220,
      panelHeight: 2440,
      minPanelWidth: 200,
      gap: 5
    }
  };
}

function osbCourses(height = 2400) {
  return [{
    zMin: 0,
    zMax: height,
    height,
    panels: [{ start: 0, end: 1200, width: 1200 }]
  }];
}

function wallX(id, overrides = {}) {
  return {
    id,
    type: 'wall',
    direction: 'x',
    xStart: 'X0',
    xEnd: 'X3000',
    yStart: 'Y0',
    yEnd: 'Y0',
    bottomZ: 'Z0',
    topZ: 'Z2400',
    thickness: 90,
    wallTypeId: 'MP1',
    openings: [],
    studsStale: false,
    osbStale: false,
    osbCourses: osbCourses(),
    ...overrides
  };
}

function wallY(id, overrides = {}) {
  return {
    ...wallX(id),
    direction: 'y',
    xStart: 'X0',
    xEnd: 'X0',
    yStart: 'Y0',
    yEnd: 'Y2000',
    ...overrides
  };
}

function model(elements, wallTypes = [wallType('MP1')]) {
  return {
    modelVersion: 2,
    grid,
    projectParams: [],
    elements,
    wallTypes,
    library: { metalconProfiles: profiles },
    roofSystems: [],
    roofPlanes: [],
    dimensions: []
  };
}

function condition(result, wallId, code) {
  return result.walls
    .find((wall) => wall.wallId === wallId)
    ?.conditions.find((item) => item.code === code);
}

test('R7-C: clasificador separa verified, conditional y excluded sin mezclar capacidades', () => {
  const pass = [{ code: 'available', status: 'pass', measured: 1, limit: 1 }];
  const unknown = [
    ...pass,
    { code: 'not-modeled', status: 'unknown', measured: null, limit: null }
  ];
  const fail = [
    ...unknown,
    { code: 'failed', status: 'fail', measured: 2, limit: 1 }
  ];

  assert.deepEqual(classifyShearCapacity(pass, 3), {
    status: 'verified',
    capacityKgf: 1251,
    conditionalCapacityKgf: null
  });
  assert.deepEqual(classifyShearCapacity(unknown, 3), {
    status: 'conditional',
    capacityKgf: null,
    conditionalCapacityKgf: 1251
  });
  assert.deepEqual(classifyShearCapacity(fail, 3), {
    status: 'excluded',
    capacityKgf: null,
    conditionalCapacityKgf: null
  });
  assert.deepEqual(summarizeShearCapacityByDirection([
    {
      direction: 'x',
      lengthM: 3,
      status: 'verified',
      capacityKgf: 1251,
      conditionalCapacityKgf: null
    },
    {
      direction: 'x',
      lengthM: 2,
      status: 'conditional',
      capacityKgf: null,
      conditionalCapacityKgf: 834
    },
    {
      direction: 'x',
      lengthM: 1.1,
      status: 'excluded',
      capacityKgf: null,
      conditionalCapacityKgf: null
    }
  ]), {
    x: {
      verifiedCapacityKgf: 1251,
      conditionalCapacityKgf: 834,
      excludedLengthM: 1.1,
      wallCounts: { verified: 1, conditional: 1, excluded: 1 }
    },
    y: {
      verifiedCapacityKgf: 0,
      conditionalCapacityKgf: 0,
      excludedLengthM: 0,
      wallCounts: { verified: 0, conditional: 0, excluded: 0 }
    }
  });
});

test('R7-C: cálculo puro separa X/Y y mantiene unknown fuera de capacidad verificada', () => {
  const source = model([wallX('x'), wallY('y')]);
  const before = structuredClone(source);
  const result = computeShearCapacityByDirection(source);

  assert.deepEqual(source, before);
  assert.deepEqual(result.walls.map((wall) => ({
    wallId: wall.wallId,
    direction: wall.direction,
    lengthM: wall.lengthM,
    status: wall.status,
    capacityKgf: wall.capacityKgf,
    conditionalCapacityKgf: wall.conditionalCapacityKgf
  })), [
    {
      wallId: 'x',
      direction: 'x',
      lengthM: 3,
      status: 'conditional',
      capacityKgf: null,
      conditionalCapacityKgf: 1251
    },
    {
      wallId: 'y',
      direction: 'y',
      lengthM: 2,
      status: 'conditional',
      capacityKgf: null,
      conditionalCapacityKgf: 834
    }
  ]);
  assert.deepEqual(result.totals, {
    x: {
      verifiedCapacityKgf: 0,
      conditionalCapacityKgf: 1251,
      excludedLengthM: 0,
      wallCounts: { verified: 0, conditional: 1, excluded: 0 }
    },
    y: {
      verifiedCapacityKgf: 0,
      conditionalCapacityKgf: 834,
      excludedLengthM: 0,
      wallCounts: { verified: 0, conditional: 1, excluded: 0 }
    }
  });
  assert.deepEqual(
    result.walls[0].conditions
      .filter((item) => item.status === 'unknown')
      .map((item) => item.code),
    [
      'osb.thickness',
      'osb.faces',
      'osb.fasteners',
      'wall.endStuds.double'
    ]
  );
});

test('R7-C: cubre cada condición disponible y excluye fallas sin inventar datos', () => {
  const opening = {
    id: 'door',
    type: 'door',
    axisType: 'x',
    position: 600,
    width: 900,
    height: 2100
  };
  const cases = [
    {
      id: 'geometry',
      wall: wallX('geometry', { xEnd: 'MISSING' }),
      code: 'wall.geometry'
    },
    {
      id: 'opening',
      wall: wallX('opening', { openings: [opening] }),
      code: 'wall.openings'
    },
    {
      id: 'aspect',
      wall: wallX('aspect', { xEnd: 'X1100' }),
      code: 'wall.aspectRatio'
    },
    {
      id: 'stud-series',
      wall: wallX('stud-series', { wallTypeId: 'STUD-SERIES' }),
      code: 'wall.stud.series'
    },
    {
      id: 'stud-thickness',
      wall: wallX('stud-thickness', { wallTypeId: 'STUD-THICKNESS' }),
      code: 'wall.stud.thickness'
    },
    {
      id: 'track-series',
      wall: wallX('track-series', { wallTypeId: 'TRACK-SERIES' }),
      code: 'wall.track.series'
    },
    {
      id: 'track-thickness',
      wall: wallX('track-thickness', { wallTypeId: 'TRACK-THICKNESS' }),
      code: 'wall.track.thickness'
    },
    {
      id: 'spacing',
      wall: wallX('spacing', { wallTypeId: 'SPACING' }),
      code: 'wall.stud.spacing'
    },
    {
      id: 'osb-missing',
      wall: wallX('osb-missing', { osbCourses: undefined }),
      code: 'wall.osb.fullHeight'
    },
    {
      id: 'osb-stale',
      wall: wallX('osb-stale', { osbStale: true }),
      code: 'wall.osb.fullHeight'
    },
    {
      id: 'osb-incomplete',
      wall: wallX('osb-incomplete', { osbCourses: osbCourses(2300) }),
      code: 'wall.osb.fullHeight'
    },
    {
      id: 'osb-without-panels',
      wall: wallX('osb-without-panels', {
        osbCourses: [{ zMin: 0, zMax: 2400, height: 2400, panels: [] }]
      }),
      code: 'wall.osb.fullHeight'
    }
  ];
  const wallTypes = [
    wallType('MP1'),
    wallType('STUD-SERIES', { studProfileId: 'C60' }),
    wallType('STUD-THICKNESS', { studProfileId: 'C90-THIN' }),
    wallType('TRACK-SERIES', { trackProfileId: 'U62' }),
    wallType('TRACK-THICKNESS', { trackProfileId: 'U92-THIN' }),
    wallType('SPACING', { spacing: 611 })
  ];

  for (const sample of cases) {
    const result = computeShearCapacityByDirection(model([sample.wall], wallTypes));
    const wall = result.walls[0];
    assert.equal(wall.status, 'excluded', sample.id);
    assert.equal(wall.capacityKgf, null, sample.id);
    assert.equal(wall.conditionalCapacityKgf, null, sample.id);
    assert.equal(condition(result, sample.id, sample.code)?.status, 'fail', sample.id);
  }
});

test('R7-C: razón de aspecto acepta 1.200 mm a h=2.400 y exige h/largo < 2 fuera de ese caso', () => {
  const result = computeShearCapacityByDirection(model([
    wallX('exact', { xEnd: 'X1200' }),
    wallX('too-tall', {
      xEnd: 'X1200',
      yStart: 'Y1000',
      yEnd: 'Y1000',
      topZ: 'Z2401',
      osbCourses: osbCourses(2401)
    })
  ]));

  assert.equal(condition(result, 'exact', 'wall.aspectRatio').status, 'pass');
  assert.equal(condition(result, 'too-tall', 'wall.aspectRatio').status, 'fail');
});

test('R7-C: roles ajenos quedan fuera de la matriz y la cobertura declara la razón', () => {
  const source = model([
    wallX('mp1'),
    wallX('mp2', {
      wallTypeId: 'MP2',
      yStart: 'Y1000',
      yEnd: 'Y1000'
    }),
    wallX('legacy', {
      wallTypeId: undefined,
      yStart: 'Y2000',
      yEnd: 'Y2000'
    })
  ], [
    wallType('MP1'),
    wallType('MP2', { role: 'MP2', spacing: 600 })
  ]);
  const result = computeShearCapacityByDirection(source);

  assert.deepEqual(result.walls.map((wall) => wall.wallId), ['mp1']);
  assert.deepEqual(result.coverage.checkedWallIds, ['mp1']);
  assert.ok(result.coverage.skipped.some((item) => (
    item.wallId === 'mp2' && item.reason === 'rule-not-applicable'
  )));
  assert.ok(result.coverage.skipped.some((item) => (
    item.wallId === 'legacy' && item.reason === 'wall-role-unresolved'
  )));
});

test('R7-C: findings por dirección presentan ambas capacidades, cobertura, fuente y navegación', () => {
  const source = model([
    wallX('x'),
    wallY('y', { osbStale: true })
  ]);
  const result = computeShearCapacityByDirection(source);

  assert.equal(result.findings.length, 2);
  assert.deepEqual(result.findings.map((finding) => finding.rule), [
    'muro.corte.capacidadOsb',
    'muro.corte.capacidadOsb'
  ]);
  assert.match(result.findings[0].message, /0 kgf verificados; 1251 kgf condicionados/i);
  assert.match(result.findings[0].message, /0 verificables, 1 condicionados, 0 excluidos/i);
  assert.match(result.findings[1].message, /0 kgf verificados; 0 kgf condicionados/i);
  assert.match(result.findings[1].message, /0 verificables, 0 condicionados, 1 excluidos/i);

  const presented = presentFinding(result.findings[0]);
  assert.equal(presented.measuredText, '0 kgf');
  assert.equal(presented.sources.length, 1);
  assert.deepEqual(presented.navigation, {
    kind: 'wall',
    id: 'x',
    label: 'Centrar muro'
  });

  const integrated = validateModel(source)
    .filter((finding) => finding.category === 'shearCapacity');
  assert.equal(integrated.length, 2);
});
