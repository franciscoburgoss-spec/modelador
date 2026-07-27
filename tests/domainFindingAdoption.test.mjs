import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAnalysisReadiness } from '../src/core/analysisReadiness.js';
import { validateModel } from '../src/core/modelValidation.js';
import { validateRoofPlanes } from '../src/core/roofPlaneValidation.js';
import { validateRoofSystems } from '../src/core/trussLayout.js';

const BASELINES = {
  model: [
    {
      severity: 'warning',
      category: 'Ejes duplicados',
      message: 'Ejes X "1" y "2" están en la misma posición (0 mm) — revisa si uno sobra.',
      elementIds: []
    }
  ],
  readiness: [
    {
      severity: 'info',
      category: 'Sin sección de librería',
      message: 'Pilar sin sección de librería asignada — usará material genérico (hormigón) en CalculiX.',
      elementIds: ['C-1']
    }
  ],
  systems: [
    {
      severity: 'error',
      category: 'invalidSupport',
      message: 'sistema RS-1: el muro de apoyo bajo y alto ya no existe (¿se dividió, unió o eliminó?) — reasignar el apoyo en Techumbre',
      roofSystemIds: ['RS-1']
    }
  ],
  planes: [
    {
      severity: 'info',
      category: 'edge',
      message: 'faldón "Norte": corrida recortada',
      roofPlaneIds: ['RP-1']
    }
  ]
};

test('R4-B: los cuatro productores conservan deepEqual sus baselines legacy', () => {
  const modelFindings = validateModel({
    elements: [],
    grid: {
      xAxes: [
        { id: 'X1', label: '1', position: 0 },
        { id: 'X2', label: '2', position: 0 }
      ],
      yAxes: [],
      zLevels: []
    },
    projectParams: []
  });
  const readinessFindings = checkAnalysisReadiness({
    elements: [{ id: 'C-1', type: 'column' }],
    library: {}
  });
  const systemFindings = validateRoofSystems({
    roofSystems: [{ id: 'RS-1' }],
    elements: [],
    grid: { xAxes: [], yAxes: [], zLevels: [] }
  });
  const planeFindings = validateRoofPlanes(
    {
      roofPlanes: [{ id: 'RP-1', name: 'Norte' }],
      elements: [],
      projectParams: []
    },
    () => ({
      findings: [{ severity: 'info', category: 'edge', message: 'corrida recortada' }]
    })
  );

  assert.deepEqual(modelFindings, BASELINES.model);
  assert.deepEqual(readinessFindings, BASELINES.readiness);
  assert.deepEqual(systemFindings, BASELINES.systems);
  assert.deepEqual(planeFindings, BASELINES.planes);
});

test('R4-B: las cuatro fronteras delegan la construcción al contrato compartido', () => {
  const modulePaths = [
    '../src/core/modelValidation.js',
    '../src/core/analysisReadiness.js',
    '../src/core/trussLayout.js',
    '../src/core/roofPlaneValidation.js'
  ];

  for (const modulePath of modulePaths) {
    const source = readFileSync(new URL(modulePath, import.meta.url), 'utf8');
    assert.match(
      source,
      /import\s+\{\s*createFinding\s*\}\s+from\s+['"]\.\/domainFindings\.js['"]/,
      `${modulePath} debe importar createFinding`
    );
    assert.match(
      source,
      /return createFinding\(\{/,
      `${modulePath} debe delegar su helper de frontera en createFinding`
    );
  }
});

test('R5-C: validación común adopta findings wallRole y wallType con navegación al muro', () => {
  const base = {
    elements: [
      { id: 'legacy', type: 'wall' },
      {
        id: 'typed',
        type: 'wall',
        wallTypeId: 'T1',
        studSpacing: 600
      }
    ],
    wallTypes: [{
      id: 'T1',
      name: 'Exterior',
      role: 'MP1',
      metalconDefaults: {
        spacing: 400, studProfileId: 'C90', trackProfileId: 'U90', materialId: null
      },
      osbDefaults: {
        panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap: 5
      }
    }],
    library: {
      metalconProfiles: [{ id: 'C90', shape: 'C' }, { id: 'U90', shape: 'U' }]
    },
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    projectParams: []
  };
  const findings = validateModel(base);
  assert.ok(findings.some((finding) => (
    finding.category === 'wallRole' && finding.wallIds?.includes('legacy')
  )));
  assert.ok(findings.some((finding) => (
    finding.category === 'wallType' && finding.wallIds?.includes('typed')
  )));
});
