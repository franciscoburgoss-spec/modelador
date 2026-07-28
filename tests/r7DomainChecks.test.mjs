import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { modulateAllWallsMetalcon } from '../src/core/batchModulation.js';
import { evaluateWallDomainChecks } from '../src/core/domainChecks.js';
import { presentFinding } from '../src/core/domainFindingPresentation.js';
import { validateModel } from '../src/core/modelValidation.js';

const grid = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X04', position: 400 },
    { id: 'X1', position: 1000 },
    { id: 'X3', position: 3000 },
    { id: 'X4', position: 4000 },
    { id: 'X5', position: 5000 },
    { id: 'X51', position: 5100 }
  ],
  yAxes: [
    { id: 'Y0', position: 0 },
    { id: 'Y1', position: 1000 },
    { id: 'Y2', position: 2000 },
    { id: 'Y3', position: 3000 },
    { id: 'Y4', position: 4000 }
  ],
  zLevels: [
    { id: 'Z0', elevation: 0 },
    { id: 'Z1', elevation: 2400 },
    { id: 'Z2', elevation: 3000 },
    { id: 'Z3', elevation: 5400 }
  ]
};

const profiles = [
  { id: 'C90', shape: 'C', B: 38 },
  { id: 'U90', shape: 'U' }
];

function wallType(id, role, spacing = 400) {
  return {
    id,
    name: id,
    role,
    metalconDefaults: {
      spacing,
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
}

function wallX(id, xEnd = 'X4', overrides = {}) {
  return {
    id,
    type: 'wall',
    direction: 'x',
    xStart: 'X0',
    xEnd,
    yStart: 'Y0',
    yEnd: 'Y0',
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 90,
    openings: [],
    ...overrides
  };
}

function wallY(id, xAxis = 'X1', overrides = {}) {
  return {
    id,
    type: 'wall',
    direction: 'y',
    xStart: xAxis,
    xEnd: xAxis,
    yStart: 'Y0',
    yEnd: 'Y2',
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 101.1,
    openings: [],
    ...overrides
  };
}

function model(elements, wallTypes = []) {
  return {
    modelVersion: 2,
    grid,
    projectParams: [],
    elements,
    wallTypes,
    library: { metalconProfiles: profiles }
  };
}

function fullStud(offset, role) {
  return { offset, zMin: 0, zMax: 2400, role };
}

test('R7-A: los checks son puros, omiten reglas condicionadas sin rol y mantienen visible cadeneta corta', () => {
  const source = model([wallX('legacy', 'X4', {
    studs: [
      fullStud(0, 'edge'),
      fullStud(4000, 'edge'),
      { oMin: 38, oMax: 62, zMin: 1200, zMax: 1238, role: 'nogging' }
    ]
  })]);
  const before = structuredClone(source);
  const result = evaluateWallDomainChecks(source);

  assert.deepEqual(source, before);
  assert.equal(result.findings.length, 1);
  assert.deepEqual({
    severity: result.findings[0].severity,
    category: result.findings[0].category,
    measured: result.findings[0].measured,
    limit: result.findings[0].limit,
    wallIds: result.findings[0].wallIds
  }, {
    severity: 'warning',
    category: 'shortNogging',
    measured: { value: 24, unit: 'mm' },
    limit: { min: 30, unit: 'mm' },
    wallIds: ['legacy']
  });
  assert.ok(result.coverage.checkedWallIds.includes('legacy'));
  assert.ok(result.coverage.skipped.some((item) => (
    item.wallId === 'legacy' && item.reason === 'wall-role-unresolved'
  )));
});

test('R7-A: montante–jamba usa ejes y clasifica 30/150 sin confundir piezas parciales', () => {
  const typed = wallType('MP1', 'MP1');
  const source = model([
    wallX('error', 'X4', {
      wallTypeId: 'MP1',
      studs: [
        fullStud(0, 'edge'),
        fullStud(400, 'stud'),
        fullStud(429, 'king'),
        { offset: 428, zMin: 0, zMax: 2100, role: 'jack' },
        fullStud(4000, 'edge')
      ]
    }),
    wallX('warning', 'X4', {
      wallTypeId: 'MP1',
      yStart: 'Y1',
      yEnd: 'Y1',
      studs: [
        fullStud(0, 'edge'),
        fullStud(400, 'stud'),
        fullStud(430, 'king'),
        fullStud(4000, 'edge')
      ]
    }),
    wallX('ok', 'X4', {
      wallTypeId: 'MP1',
      yStart: 'Y2',
      yEnd: 'Y2',
      studs: [
        fullStud(0, 'edge'),
        fullStud(400, 'stud'),
        fullStud(550, 'king'),
        fullStud(4000, 'edge')
      ]
    })
  ], [typed]);

  const findings = evaluateWallDomainChecks(source).findings
    .filter((finding) => finding.category === 'studJambDistance');
  assert.deepEqual(findings.map((finding) => ({
    severity: finding.severity,
    measured: finding.measured.value,
    wallId: finding.wallIds[0],
    rule: finding.rule
  })), [
    { severity: 'error', measured: 29, wallId: 'error', rule: undefined },
    { severity: 'warning', measured: 30, wallId: 'warning', rule: undefined }
  ]);
});

test('R7-A: paso tipado MP1/MP2 usa 610/600 y un derivado stale no se inspecciona', () => {
  const source = model([
    wallX('mp1', 'X4', { wallTypeId: 'MP1' }),
    wallX('mp2', 'X4', { wallTypeId: 'MP2' }),
    wallX('stale', 'X4', {
      wallTypeId: 'MP2',
      studsStale: true,
      studs: [fullStud(0, 'edge'), fullStud(20, 'king')]
    })
  ], [
    wallType('MP1', 'MP1', 611),
    wallType('MP2', 'MP2', 600)
  ]);
  const result = evaluateWallDomainChecks(source);
  const spacing = result.findings.filter((finding) => finding.category === 'studSpacing');

  assert.equal(spacing.length, 1);
  assert.equal(spacing[0].wallIds[0], 'mp1');
  assert.deepEqual(spacing[0].measured, { value: 611, unit: 'mm' });
  assert.deepEqual(spacing[0].limit, { max: 610, unit: 'mm' });
  assert.equal(
    result.findings.some((finding) => finding.wallIds?.includes('stale')),
    false
  );
  assert.ok(result.coverage.skipped.some((item) => (
    item.wallId === 'stale'
    && item.rule === 'muro.jamba.distanciaMontante'
    && item.reason === 'framing-stale'
  )));
});

test('R7-A: holgura usa la cara perpendicular, tolera 1 mm y declara ambigüedad', () => {
  const typed = wallType('tabique', 'tabique');
  const passingDoor = {
    id: 'pass-door',
    type: 'door',
    axisType: 'x',
    position: 1550,
    width: 900,
    height: 2100,
    referenceAxisId: 'X1',
    referenceEdge: 'left',
    edgeOffset: 100
  };
  const intrudingDoor = {
    ...passingDoor,
    id: 'intruding-door',
    position: 1450,
    edgeOffset: 0
  };
  const clean = evaluateWallDomainChecks(model([
    wallX('host', 'X4', {
      wallTypeId: 'tabique',
      openings: [passingDoor, intrudingDoor]
    }),
    wallY('perpendicular')
  ], [typed]));
  const clearance = clean.findings.filter((finding) => (
    finding.category === 'doorReferenceClearance'
  ));

  assert.equal(clearance.length, 1, '49,45 mm cumple por tolerancia; sólo se informa la invasión');
  assert.deepEqual(clearance[0].measured, { value: -50.55, unit: 'mm' });
  assert.deepEqual(clearance[0].limit, { min: 50, max: 60, unit: 'mm' });
  assert.match(clearance[0].message, /borde de referencia/i);
  assert.doesNotMatch(clearance[0].message, /manilla verificada/i);

  const ambiguous = evaluateWallDomainChecks(model([
    wallX('host', 'X4', { wallTypeId: 'tabique', openings: [passingDoor] }),
    wallY('p90', 'X1', { thickness: 90 }),
    wallY('p100', 'X1', { thickness: 100 })
  ], [typed]));
  const ambiguity = ambiguous.findings.find((finding) => (
    finding.category === 'doorReferenceAmbiguity'
  ));
  assert.ok(ambiguity);
  assert.deepEqual(ambiguity.wallIds, ['host', 'p100', 'p90']);
  assert.equal(Object.hasOwn(ambiguity, 'measured'), false);
});

test('R7-A: muro perpendicular sin traslape Z no habilita la holgura', () => {
  const typed = wallType('tabique', 'tabique');
  const source = model([
    wallX('host', 'X4', {
      wallTypeId: 'tabique',
      openings: [{
        id: 'door',
        type: 'door',
        axisType: 'x',
        position: 1450,
        width: 900,
        height: 2100,
        referenceAxisId: 'X1',
        referenceEdge: 'left',
        edgeOffset: 0
      }]
    }),
    wallY('upper', 'X1', { bottomZ: 'Z2', topZ: 'Z3' })
  ], [typed]);
  const result = evaluateWallDomainChecks(source);

  assert.equal(
    result.findings.some((finding) => finding.category.startsWith('doorReference')),
    false
  );
  assert.ok(result.coverage.skipped.some((item) => (
    item.wallId === 'host'
    && item.rule === 'muro.vano.holguraManilla'
    && item.reason === 'no-perpendicular-wall-at-reference'
  )));
});

test('R7-A: largo nominal acepta límites MP2/MP3 y rechaza sólo fuera de rango', () => {
  const source = model([
    wallX('mp2-min', 'X3', { wallTypeId: 'MP2' }),
    wallX('mp2-max', 'X5', { wallTypeId: 'MP2', yStart: 'Y1', yEnd: 'Y1' }),
    wallX('mp2-short', 'X1', { wallTypeId: 'MP2', yStart: 'Y2', yEnd: 'Y2' }),
    wallX('mp3-max', 'X5', { wallTypeId: 'MP3', yStart: 'Y3', yEnd: 'Y3' }),
    wallX('mp3-long', 'X51', { wallTypeId: 'MP3', yStart: 'Y4', yEnd: 'Y4' })
  ], [
    wallType('MP2', 'MP2', 600),
    wallType('MP3', 'MP3', 600)
  ]);
  const findings = evaluateWallDomainChecks(source).findings
    .filter((finding) => finding.category === 'wallPanelLength');

  assert.deepEqual(findings.map((finding) => [
    finding.wallIds[0],
    finding.measured.value,
    finding.limit
  ]), [
    ['mp2-short', 1000, { min: 3000, max: 5000, unit: 'mm' }],
    ['mp3-long', 5100, { max: 5000, unit: 'mm' }]
  ]);
});

test('R7-A: validateModel integra findings de dominio sin duplicar wallRole', () => {
  const source = model([
    wallX('legacy'),
    wallX('typed', 'X1', { wallTypeId: 'MP2', yStart: 'Y1', yEnd: 'Y1' })
  ], [wallType('MP2', 'MP2', 600)]);
  const findings = validateModel(source);

  assert.equal(findings.filter((finding) => finding.category === 'wallRole').length, 1);
  assert.ok(findings.some((finding) => (
    finding.category === 'wallPanelLength' && finding.wallIds?.includes('typed')
  )));
});

test('R7-A: presentación conserva medida, límite, fuente y navegación tipada', () => {
  const source = model([
    wallX('typed', 'X1', { wallTypeId: 'MP2' })
  ], [wallType('MP2', 'MP2', 600)]);
  const finding = evaluateWallDomainChecks(source).findings.find((item) => (
    item.category === 'wallPanelLength'
  ));
  const presented = presentFinding(finding);

  assert.equal(presented.measuredText, '1000 mm');
  assert.equal(presented.limitText, '3000–5000 mm');
  assert.equal(presented.sources.length, 1);
  assert.match(presented.sources[0].url, /^https:\/\/www\.cintac\.cl\//);
  assert.deepEqual(presented.navigation, {
    kind: 'wall',
    id: 'typed',
    label: 'Centrar muro'
  });
});

test('R7-A: regeneración tipada omite sólo stud próximo si el paso resultante cumple', () => {
  const mp1 = wallType('MP1', 'MP1', 400);
  const mp2 = wallType('MP2', 'MP2', 600);
  const opening = (position) => ({
    id: `door-${position}`,
    type: 'door',
    axisType: 'x',
    position,
    width: 900,
    height: 2100
  });
  const source = model([
    wallX('can-remove', 'X4', {
      wallTypeId: 'MP1',
      openings: [opening(900)]
    }),
    wallX('must-keep', 'X4', {
      wallTypeId: 'MP2',
      yStart: 'Y1',
      yEnd: 'Y1',
      openings: [opening(1100)]
    }),
    wallX('legacy', 'X4', {
      yStart: 'Y2',
      yEnd: 'Y2',
      openings: [opening(900)]
    })
  ], [mp1, mp2]);
  const result = modulateAllWallsMetalcon(source, {
    spacing: 400,
    studProfileId: 'C90',
    trackProfileId: 'U90'
  });
  const patches = new Map(result.patches.map(({ wallId, patch }) => [wallId, patch]));
  const verticalRolesAt = (wallId, offset) => patches.get(wallId).studs
    .filter((piece) => piece.role !== 'nogging' && Math.abs(piece.offset - offset) < 1)
    .map((piece) => piece.role);

  assert.deepEqual(verticalRolesAt('can-remove', 400), []);
  assert.deepEqual(verticalRolesAt('can-remove', 450), ['king', 'jack', 'crippleTop']);
  assert.deepEqual(verticalRolesAt('must-keep', 600), ['stud']);
  assert.deepEqual(verticalRolesAt('must-keep', 650), ['king', 'jack', 'crippleTop']);
  assert.deepEqual(verticalRolesAt('legacy', 400), ['stud']);
});

test('R7-A: un apoyo T próximo a jamba se conserva como corner', () => {
  const source = model([
    wallX('host', 'X4', {
      wallTypeId: 'MP1',
      yStart: 'Y3',
      yEnd: 'Y3',
      openings: [{
        id: 'door',
        type: 'door',
        axisType: 'x',
        position: 900,
        width: 900,
        height: 2100
      }]
    }),
    wallY('branch', 'X04', {
      yStart: 'Y3',
      yEnd: 'Y4'
    })
  ], [wallType('MP1', 'MP1', 400)]);
  const result = modulateAllWallsMetalcon(source, {
    spacing: 400,
    studProfileId: 'C90',
    trackProfileId: 'U90'
  });
  const host = result.patches.find(({ wallId }) => wallId === 'host').patch;

  assert.deepEqual(
    host.studs.filter((piece) => (
      piece.role !== 'nogging' && Math.abs(piece.offset - 400) < 1
    )).map((piece) => piece.role),
    ['corner']
  );
});

test('R7-A: grilla exactamente sobre jamba se reclasifica king sin duplicar altura completa', () => {
  const source = model([
    wallX('exact', 'X4', {
      wallTypeId: 'MP1',
      openings: [{
        id: 'door',
        type: 'door',
        axisType: 'x',
        position: 850,
        width: 900,
        height: 2100
      }]
    })
  ], [wallType('MP1', 'MP1', 400)]);
  const [{ patch }] = modulateAllWallsMetalcon(source).patches;
  const at400 = patch.studs.filter((piece) => (
    piece.role !== 'nogging' && Math.abs(piece.offset - 400) < 1
  ));

  assert.deepEqual(at400.map((piece) => piece.role), ['king', 'jack', 'crippleTop']);
  assert.equal(
    at400.filter((piece) => piece.zMin === 0 && piece.zMax === 2400).length,
    1
  );
});

test('R7-A: casa-L conserva geometría y reporta exactamente seis cadenetas de 12/24 mm', async () => {
  const casaL = JSON.parse(await readFile(
    new URL('./fixtures/casa-L.json', import.meta.url),
    'utf8'
  ));
  const regeneration = modulateAllWallsMetalcon(casaL, casaL.metalconDefaults || {});
  const patches = new Map(regeneration.patches.map(({ wallId, patch }) => [wallId, patch]));
  const regenerated = {
    ...casaL,
    elements: casaL.elements.map((element) => (
      patches.has(element.id) ? { ...element, ...patches.get(element.id) } : element
    ))
  };
  const before = structuredClone(regenerated);
  const result = evaluateWallDomainChecks(regenerated);
  const short = result.findings.filter((finding) => finding.category === 'shortNogging');

  assert.deepEqual(regenerated, before);
  assert.deepEqual(short.map((finding) => finding.measured.value).sort((a, b) => a - b), [
    12, 12, 24, 24, 24, 24
  ]);
});
