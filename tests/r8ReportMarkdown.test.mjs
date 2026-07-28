import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFinding } from '../src/core/domainFindings.js';
import {
  evaluateModelValidation,
  validateModel
} from '../src/core/modelValidation.js';
import {
  collectApplicableCriteria,
  evaluateModelReview
} from '../src/core/modelReview.js';
import { renderReviewMarkdown } from '../src/core/reportMarkdown.js';
import { validateRoofPlanes } from '../src/core/roofPlaneValidation.js';
import { validateRoofSystems } from '../src/core/trussLayout.js';

const grid = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X1', position: 4000 }
  ],
  yAxes: [
    { id: 'Y0', position: 0 },
    { id: 'Y1', position: 3000 }
  ],
  zLevels: [
    { id: 'Z0', elevation: 0 },
    { id: 'Z1', elevation: 2400 }
  ]
};

const profiles = [
  { id: 'C90', shape: 'C', B: 38, H: 90, e: 0.85 },
  { id: 'U90', shape: 'U', H: 92, e: 0.85 }
];

function wallType(id, role, { spacing = 400, gap = 5 } = {}) {
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
      gap
    }
  };
}

function wall(id, wallTypeId) {
  return {
    id,
    wallTypeId,
    type: 'wall',
    direction: 'x',
    xStart: 'X0',
    xEnd: 'X1',
    yStart: 'Y0',
    yEnd: 'Y0',
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 90,
    openings: []
  };
}

function typedModel(elements, wallTypes) {
  return {
    grid,
    projectParams: [],
    projectInfo: {},
    elements,
    wallTypes,
    library: { metalconProfiles: profiles },
    roofSystems: [],
    roofPlanes: []
  };
}

function emptyCoverage() {
  return {
    wallDomain: {
      instrumented: true,
      checkedWallIds: [],
      cleanWallIds: [],
      findingCount: 0,
      skipped: [],
      skippedGroups: []
    },
    roofSupport: {
      instrumented: true,
      checkedWallIds: [],
      cleanWallIds: [],
      findingCount: 0,
      skipped: [],
      skippedGroups: []
    },
    shearCapacity: {
      instrumented: true,
      checkedWallIds: [],
      skipped: [],
      skippedGroups: [],
      findingCount: 0,
      wallCounts: { verified: 0, conditional: 0, excluded: 0 },
      totals: {
        x: {
          verifiedCapacityKgf: 0,
          conditionalCapacityKgf: 0,
          excludedLengthM: 0,
          wallCounts: { verified: 0, conditional: 0, excluded: 0 }
        },
        y: {
          verifiedCapacityKgf: 0,
          conditionalCapacityKgf: 0,
          excludedLengthM: 0,
          wallCounts: { verified: 0, conditional: 0, excluded: 0 }
        }
      },
      unknownConditions: []
    },
    legacyGeometry: { instrumented: false, findingCount: 0 },
    roofGeometry: { instrumented: false, findingCount: 0 }
  };
}

test('R8-A: validateModel delega al snapshot estructurado sin cambiar su array', () => {
  const source = typedModel([wall('W1', 'MP1')], [wallType('MP1', 'MP1')]);
  const before = structuredClone(source);
  const evaluation = evaluateModelValidation(source, 7);

  assert.deepEqual(source, before);
  assert.ok(Array.isArray(evaluation.findings));
  assert.deepEqual(validateModel(source, 7), evaluation.findings);
  assert.deepEqual(Object.keys(evaluation.components), [
    'wallTypeFindings',
    'wallDomain',
    'roofSupport',
    'shearCapacity',
    'legacyGeometryFindings'
  ]);
  assert.deepEqual(evaluation.findings, [
    ...evaluation.components.wallTypeFindings,
    ...evaluation.components.wallDomain.findings,
    ...evaluation.components.roofSupport.findings,
    ...evaluation.components.shearCapacity.findings,
    ...evaluation.components.legacyGeometryFindings
  ]);
});

test('R8-A: casa-L conserva el snapshot visible 54 = 8/1/45 y declara cobertura incompleta', async () => {
  const casaL = JSON.parse(await readFile(
    new URL('./fixtures/casa-L.json', import.meta.url),
    'utf8'
  ));
  const before = structuredClone(casaL);
  const review = evaluateModelReview(casaL);
  const direct = [
    ...validateModel(casaL),
    ...validateRoofSystems(casaL),
    ...validateRoofPlanes(casaL)
  ];

  assert.deepEqual(casaL, before);
  assert.deepEqual(review.findings, direct);
  assert.equal(review.findings.length, 54);
  assert.deepEqual(
    review.findings.reduce((counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    }, { error: 0, warning: 0, info: 0 }),
    { error: 8, warning: 1, info: 45 }
  );
  assert.deepEqual(review.coverage.wallDomain.checkedWallIds, []);
  assert.equal(review.coverage.wallDomain.findingCount, 0);
  assert.deepEqual(review.coverage.wallDomain.skippedGroups, [{
    rule: null,
    reason: 'wall-role-unresolved',
    count: 45
  }]);
  assert.deepEqual(review.coverage.roofSupport.checkedWallIds.length, 3);
  assert.equal(review.coverage.roofSupport.findingCount, 6);
  assert.deepEqual(review.coverage.shearCapacity.wallCounts, {
    verified: 0,
    conditional: 0,
    excluded: 0
  });
  assert.equal(review.coverage.legacyGeometry.instrumented, false);
  assert.equal(review.coverage.roofGeometry.instrumented, false);
  assert.equal(review.criteria.length, 1);
  assert.equal(review.criteria[0].ruleId, 'muro.dintel.llegadaCercha');
  assert.deepEqual(review.criteria[0].limit, { max: 19, unit: 'mm' });
  assert.equal(review.criteria[0].source, 'finding');
});

test('R8-A: criterios usan sólo tipos asignados y separan límites distintos de MP1/MP2', () => {
  const model = typedModel(
    [wall('W1', 'tipo-mp1'), wall('W2', 'tipo-mp2'), wall('legacy')],
    [
      wallType('tipo-mp1', 'MP1', { gap: 3 }),
      wallType('tipo-mp2', 'MP2', { spacing: 500 }),
      wallType('tipo-no-usado', 'MP3')
    ]
  );
  const criteria = collectApplicableCriteria(model, []);
  const spacing = criteria.filter((item) => item.ruleId === 'muro.montante.paso');

  assert.equal(criteria.length, 9);
  assert.deepEqual(spacing.map((item) => item.limit), [
    { max: 610, unit: 'mm' },
    { max: 600, unit: 'mm' }
  ]);
  assert.deepEqual(
    criteria.find((item) => item.ruleId === 'osb.cadeneta.ala').limit,
    { min: 23, unit: 'mm' }
  );
  assert.equal(
    criteria.some((item) => item.wallTypeIds.includes('tipo-no-usado')),
    false
  );
  assert.equal(
    criteria.some((item) => item.wallTypeIds.includes(undefined)),
    false,
    'un muro legacy no recibe rol inferido'
  );
  assert.ok(criteria.every((item) => item.source === 'assigned-type'));
});

test('R8-A: un finding legacy agrega su regla y límite sólo al informe', () => {
  const finding = createFinding({
    category: 'trussJambAlignment',
    rule: 'muro.dintel.llegadaCercha',
    message: 'Llegada fuera de jamba.',
    measured: { value: 30, unit: 'mm' },
    limit: { max: 19, unit: 'mm' },
    wallIds: ['legacy']
  });
  const criteria = collectApplicableCriteria(typedModel([wall('legacy')], []), [finding]);

  assert.deepEqual(criteria.map((item) => ({
    ruleId: item.ruleId,
    limit: item.limit,
    source: item.source,
    roles: item.roles,
    wallTypeIds: item.wallTypeIds,
    sheetVariants: item.sheetVariants
  })), [{
    ruleId: 'muro.dintel.llegadaCercha',
    limit: { max: 19, unit: 'mm' },
    source: 'finding',
    roles: [],
    wallTypeIds: [],
    sheetVariants: ['truss']
  }]);
});

test('R8-A: cobertura resume muros limpios y capacidad conditional/excluded/unknown', () => {
  const type = wallType('tipo-mp1', 'MP1');
  const covered = {
    osbCourses: [{ zMin: 0, zMax: 2400, panels: [{}] }],
    osbStale: false,
    studsStale: false
  };
  const source = typedModel([
    { ...wall('conditional', 'tipo-mp1'), ...covered },
    {
      ...wall('excluded', 'tipo-mp1'),
      yStart: 'Y1',
      yEnd: 'Y1',
      openings: [{ id: 'V1', type: 'window' }],
      ...covered
    }
  ], [type]);
  const coverage = evaluateModelReview(source).coverage;

  assert.deepEqual(coverage.wallDomain.checkedWallIds, ['conditional', 'excluded']);
  assert.deepEqual(coverage.wallDomain.cleanWallIds, ['conditional', 'excluded']);
  assert.deepEqual(coverage.shearCapacity.wallCounts, {
    verified: 0,
    conditional: 1,
    excluded: 1
  });
  assert.equal(coverage.shearCapacity.totals.x.conditionalCapacityKgf, 1668);
  assert.equal(coverage.shearCapacity.totals.x.excludedLengthM, 4);
  assert.deepEqual(coverage.shearCapacity.unknownConditions, [
    { code: 'osb.thickness', count: 2 },
    { code: 'osb.faces', count: 2 },
    { code: 'osb.fasteners', count: 2 },
    { code: 'wall.endStuds.double', count: 2 }
  ]);
});

test('R8-A: renderer distingue fuentes, ausencia, null y produce una fila por finding', () => {
  const findings = [
    createFinding({
      category: 'manual',
      rule: 'muro.dintel.llegadaCercha',
      message: 'Criterio manual.',
      measured: { value: 30, unit: 'mm' },
      limit: { max: 19, unit: 'mm' },
      wallIds: ['W1']
    }),
    createFinding({
      category: 'derivada',
      rule: 'osb.cadeneta.ala',
      message: 'Criterio derivado.',
      measured: null,
      limit: null,
      wallIds: ['W1']
    }),
    createFinding({
      category: 'obra',
      rule: 'muro.vano.holguraManilla',
      message: 'Criterio de obra.',
      wallIds: ['W1']
    }),
    createFinding({
      severity: 'warning',
      category: 'legacy',
      message: 'Sin catálogo.',
      elementIds: ['E1']
    })
  ];
  const markdown = renderReviewMarkdown({
    findings,
    coverage: emptyCoverage(),
    criteria: []
  }, {
    projectInfo: {
      obra: 'Casa',
      ubicacion: 'Santiago',
      proyectoNumero: 'P-1',
      fecha: '2026-07-27'
    }
  });

  assert.equal(markdown.match(/^\| \d+ \|/gm)?.length, findings.length);
  assert.match(markdown, /\[Manual de Diseño Metalcon — §1\.5\.2, §1\.5\.2\.1 y Anexo IV\]\(https:\/\/www\.cintac\.cl\//);
  assert.match(markdown, /No aplica — criterio derivado/);
  assert.match(markdown, /No aplica — criterio de obra/);
  assert.match(markdown, /Sin regla catalogada/);
  assert.match(markdown, /\| No resoluble \| No verificable \|/);
  assert.match(markdown, /\| No declarado \| No medido \|/);
});

test('R8-A: renderer neutraliza texto no confiable, usa LF y es determinista', () => {
  const review = {
    findings: [{
      severity: 'error',
      category: 'mala|categoría',
      message: 'línea 1\r\nlínea 2 \\ <script>alert(1)</script> [x](https://evil.test)',
      elementIds: ['E1']
    }],
    coverage: emptyCoverage(),
    criteria: []
  };
  const options = {
    projectInfo: {
      obra: 'Obra | peligrosa',
      ubicacion: '<img src=x onerror=alert(1)>',
      proyectoNumero: '\\demo',
      fecha: ''
    },
    date: '2026-07-27'
  };
  const first = renderReviewMarkdown(review, options);
  const second = renderReviewMarkdown(review, options);

  assert.equal(first, second);
  assert.equal(first.includes('\r'), false);
  assert.equal(first.includes('<script>'), false);
  assert.equal(first.includes('<img'), false);
  assert.equal(first.includes('](https://evil.test)'), false);
  assert.match(first, /mala\\\|categoría/);
  assert.match(first, /línea 1 \/ línea 2/);
});

test('R8-A: cero findings conserva las tres secciones explícitas', () => {
  const markdown = renderReviewMarkdown({
    findings: [],
    coverage: emptyCoverage(),
    criteria: []
  });

  for (const heading of [
    '## Hallazgos críticos',
    '## Hallazgos moderados',
    '## Observaciones'
  ]) {
    assert.ok(markdown.includes(`${heading}\n\nSin hallazgos.`));
  }
});
