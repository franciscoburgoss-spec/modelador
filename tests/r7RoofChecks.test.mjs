import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateRoofSupportChecks } from '../src/core/roofSupportChecks.js';
import { resolveRoofPlane } from '../src/core/roofPlane.js';
import { validateModel } from '../src/core/modelValidation.js';
import { presentFinding } from '../src/core/domainFindingPresentation.js';

const supportGrid = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X300', position: 300 },
    { id: 'X700', position: 700 },
    { id: 'X800', position: 800 },
    { id: 'X850', position: 850 },
    { id: 'X1000', position: 1000 },
    { id: 'X1100', position: 1100 },
    { id: 'X2000', position: 2000 }
  ],
  yAxes: [
    { id: 'Y0', position: 0 },
    { id: 'Y800', position: 800 },
    { id: 'Y1000', position: 1000 }
  ],
  zLevels: [
    { id: 'Z0', elevation: 0 },
    { id: 'Z1', elevation: 3000 },
    { id: 'Z2', elevation: 4000 }
  ]
};

function wallX(id, xStart, xEnd, yAxis, overrides = {}) {
  return {
    id,
    type: 'wall',
    direction: 'x',
    xStart,
    xEnd,
    yStart: yAxis,
    yEnd: yAxis,
    bottomZ: 'Z0',
    topZ: 'Z2',
    thickness: 90,
    framingStudProfileId: 'C90',
    openings: [],
    ...overrides
  };
}

function opening(id, position = 500, width = 400) {
  return {
    id,
    type: 'window',
    axisType: 'x',
    position,
    width,
    height: 1000,
    sillHeight: 900
  };
}

function legacyRoofModel({ flangeWidth = 38, stale = false } = {}) {
  return {
    grid: supportGrid,
    projectParams: [],
    wallTypes: [],
    elements: [
      wallX('low', 'X0', 'X2000', 'Y0', {
        openings: [opening('stack-a'), opening('stack-b')]
      }),
      wallX('high', 'X0', 'X2000', 'Y1000')
    ],
    library: {
      metalconProfiles: [
        { id: 'C90', code: 'C90', shape: 'C', B: flangeWidth },
        { id: 'U90', code: 'U90', shape: 'U' }
      ]
    },
    roofSystems: [{
      id: 'legacy-roof',
      wallLowId: 'low',
      wallHighId: 'high',
      runAxis: 'x',
      supportElevation: 3000,
      stale,
      trussPositions: [
        { offset: 319 },
        { offset: 500 },
        { offset: 1500 }
      ]
    }],
    roofPlanes: []
  };
}

test('R7-B: llegada legacy es pura, agrupa vanos apilados y sólo informa posiciones sobre vano', () => {
  const source = legacyRoofModel();
  const before = structuredClone(source);
  const result = evaluateRoofSupportChecks(source);
  const findings = result.findings.filter((finding) => (
    finding.category === 'trussJambAlignment'
  ));

  assert.deepEqual(source, before);
  assert.equal(findings.length, 1, '19 mm cumple; 500 mm se agrupa; 1500 mm queda fuera del vano');
  assert.deepEqual(findings[0], {
    severity: 'error',
    category: 'trussJambAlignment',
    message: 'Muro low: cercha en 500 mm llega sobre vano a 200 mm de la jamba más cercana.',
    rule: 'muro.dintel.llegadaCercha',
    measured: { value: 200, unit: 'mm' },
    limit: { max: 19, unit: 'mm' },
    wallIds: ['low'],
    roofSystemIds: ['legacy-roof']
  });
  assert.deepEqual(result.coverage.checkedWallIds, ['high', 'low']);
  const presented = presentFinding(findings[0]);
  assert.equal(presented.measuredText, '200 mm');
  assert.equal(presented.limitText, '≤ 19 mm');
  assert.equal(presented.sources.length, 1);
  assert.deepEqual(presented.navigation, {
    kind: 'roofSystem',
    id: 'legacy-roof',
    label: 'Ver sistema'
  });
});

test('R7-B: perfil sin B resoluble y sistema stale quedan no verificables sin fallback a 19 mm', () => {
  const noFlange = evaluateRoofSupportChecks(legacyRoofModel({ flangeWidth: null }));
  assert.equal(noFlange.findings.length, 0);
  assert.ok(noFlange.coverage.skipped.some((item) => (
    item.wallId === 'low'
    && item.rule === 'muro.dintel.llegadaCercha'
    && item.reason === 'stud-flange-unresolved'
  )));

  const stale = evaluateRoofSupportChecks(legacyRoofModel({ stale: true }));
  assert.equal(stale.findings.length, 0);
  assert.ok(stale.coverage.skipped.some((item) => (
    item.wallId === 'low' && item.reason === 'roof-system-stale'
  )));
});

const planeEjeA = {
  id: 'ejeA',
  canalWallId: 1784600403613,
  supportLevelId: 1784556741132,
  supportOffset: 100,
  crownClearance: 200,
  heelHeight: 300,
  gutterNotchWidth: 200,
  trussSpacing: 1200,
  chainOrigin: 'start',
  shortSpanThreshold: 500,
  purlinSpacing: 800,
  purlinProfileH: 35,
  profiles: {
    topChord: '90CA085',
    bottomChord: '90CA085',
    post: '40CA085',
    diagonal: '60CA085'
  },
  polygon: [
    { x: 3000, y: 0 },
    { x: 14500, y: 0 },
    { x: 14500, y: 2000 },
    { x: 12800, y: 2000 },
    { x: 12800, y: 1200 },
    { x: 3000, y: 1200 }
  ]
};

test('R7-B: la fuente viva roofPlanes tiene precedencia y produce navegación al faldón', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('../lab/roofPlane/fixtures/modelo-26.json', import.meta.url),
    'utf8'
  ));
  const elements = fixture.elements.map((element) => {
    if (element.type !== 'wall') return element;
    if (element.id === planeEjeA.canalWallId) {
      return {
        ...element,
        openings: [opening('plane-opening', 6650.55, 800)]
      };
    }
    return { ...element, openings: [] };
  });
  const source = {
    ...fixture,
    elements,
    roofPlanes: [planeEjeA],
    roofSystems: [{
      id: 'shadowed',
      wallLowId: planeEjeA.canalWallId,
      wallHighId: 1784604634483,
      trussPositions: [{ offset: 6650.55 }]
    }]
  };
  const result = evaluateRoofSupportChecks(source);
  const findings = result.findings.filter((finding) => (
    finding.category === 'trussJambAlignment'
  ));

  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].roofPlaneIds, ['ejeA']);
  assert.equal(Object.hasOwn(findings[0], 'roofSystemIds'), false);
  assert.deepEqual(findings[0].measured, { value: 400, unit: 'mm' });
  assert.deepEqual(presentFinding(findings[0]).navigation, {
    kind: 'roofPlane',
    id: 'ejeA',
    label: 'Ver faldón'
  });
});

test('R7-B: casa-L conserva seis llegadas únicas sobre vano y todas exceden 19 mm', async () => {
  const casaL = JSON.parse(await readFile(
    new URL('./fixtures/casa-L.json', import.meta.url),
    'utf8'
  ));
  const before = structuredClone(casaL);
  const result = evaluateRoofSupportChecks(casaL);
  const findings = result.findings.filter((finding) => (
    finding.category === 'trussJambAlignment'
  ));

  assert.deepEqual(casaL, before);
  assert.equal(findings.length, 6);
  assert.ok(findings.every((finding) => (
    finding.limit.max === 19
    && finding.measured.value > 19
    && finding.roofSystemIds.length === 1
  )));
});

function shortSpanModel({ stage }) {
  const candidate = stage === 'polygon-run'
    ? wallX('candidate', 'X800', 'X1100', 'Y1000')
    : stage === 'polygon-edge'
      ? wallX('candidate', 'X0', 'X1000', 'Y800')
      : wallX('candidate', 'X800', 'X1000', 'Y1000');
  const polygon = stage === 'support-overlap'
    ? undefined
    : stage === 'polygon-edge'
      ? [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 800 },
          { x: 800, y: 800 },
          { x: 800, y: 1000 },
          { x: 0, y: 1000 }
        ]
      : [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 }
      ];
  const plane = {
    id: `plane-${stage}`,
    canalWallId: 'canal',
    supportLevelId: 'Z1',
    supportOffset: 0,
    highWalls: stage === 'support-overlap' ? ['candidate'] : [],
    polygon
  };
  return {
    model: {
      grid: supportGrid,
      projectParams: [],
      elements: [
        wallX('canal', 'X0', 'X1000', 'Y0'),
        candidate
      ],
      library: { metalconProfiles: [] },
      roofPlanes: [plane],
      roofSystems: []
    },
    plane
  };
}

for (const [stage, measured] of [
  ['support-overlap', 200],
  ['polygon-run', 200],
  ['polygon-edge', 200]
]) {
  test(`R7-B: MIN_TRAMO hace visible ${stage} sin crear el tramo`, () => {
    const { model, plane } = shortSpanModel({ stage });
    const before = structuredClone(model);
    const resolved = resolveRoofPlane({ model, plane });
    const finding = resolved.findings.find((item) => (
      item.category === 'shortRoofSpan' && item.stage === stage
    ));

    assert.deepEqual(model, before);
    assert.ok(finding);
    assert.deepEqual(finding.measured, { value: measured, unit: 'mm' });
    assert.deepEqual(finding.limit, { exclusiveMin: 200, unit: 'mm' });
    assert.equal(presentFinding(finding).limitText, '> 200 mm');
    assert.deepEqual(finding.wallIds, ['candidate']);
    assert.equal(resolved.tramos.length, 0);
  });
}

test('R7-B: validateModel integra el cruce de techumbre sin duplicar la evaluación', () => {
  const findings = validateModel(legacyRoofModel());
  assert.equal(
    findings.filter((finding) => finding.category === 'trussJambAlignment').length,
    1
  );
});
