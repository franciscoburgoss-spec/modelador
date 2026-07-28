import test from 'node:test';
import assert from 'node:assert/strict';
import { collectApplicableCriteria } from '../src/core/modelReview.js';
import {
  criteriaNotesForVariant,
  DEFAULT_NOTES,
  legendEntities
} from '../src/core/sheetLegend.js';
import { sheetLayout } from '../src/core/sheetFormats.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { generateFramingSheets } from '../src/core/exportSheetsDxf.js';

const grid = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X1', position: 4000 }
  ],
  yAxes: [{ id: 'Y0', position: 0 }],
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

function fourRoleModel() {
  return {
    grid,
    projectParams: [],
    projectInfo: {},
    elements: [
      wall('W1', 'T1'),
      wall('W2', 'T2'),
      wall('W3', 'T3'),
      wall('W4', 'T4')
    ],
    wallTypes: [
      wallType('T1', 'MP1', { spacing: 610, gap: 3 }),
      wallType('T2', 'MP2', { spacing: 600 }),
      wallType('T3', 'MP3'),
      wallType('T4', 'tabique')
    ],
    library: { metalconProfiles: profiles },
    roofSystems: [],
    roofPlanes: []
  };
}

function generatedFramingModel() {
  const baseWall = wall('W1', 'T1');
  const layout = computeStudLayout(baseWall, grid, {}, {}, { spacing: 610 });
  return {
    grid,
    projectParams: [],
    projectInfo: {
      formato: 'A3',
      notas: { framing: ['Nota propia integrada'] }
    },
    elements: [{
      ...baseWall,
      studs: layout.studs,
      headers: layout.headers,
      studSpacing: 610,
      framingStudProfileId: 'C90',
      framingTrackProfileId: 'U90'
    }],
    wallTypes: [wallType('T1', 'MP1', { spacing: 610 })],
    library: { metalconProfiles: profiles },
    roofSystems: [],
    roofPlanes: []
  };
}

test('R8-C: notas de criterio filtran variante/fuente y declaran ID, límite, rol y tipo', () => {
  const criteria = collectApplicableCriteria(fourRoleModel(), []);
  const framing = criteriaNotesForVariant(criteria, 'framing');

  assert.equal(
    framing.some((note) => note.includes('osb.tornillo.borde')),
    false
  );
  assert.ok(framing.includes(
    'muro.montante.paso: <= 610 mm; rol MP1; tipo T1'
  ));
  assert.ok(framing.includes(
    'muro.montante.paso: <= 600 mm; rol MP2; tipo T2'
  ));

  const findingOnly = {
    ...criteria[0],
    ruleId: 'finding.no.debe.salir',
    sheetVariants: ['framing'],
    source: 'finding'
  };
  assert.deepEqual(
    criteriaNotesForVariant([findingOnly], 'framing'),
    [],
    'un criterio agregado sólo por finding pertenece al informe, no a la lámina'
  );
});

test('R8-C: criterios se anteponen y preservan notas de usuario o defaults efectivos', () => {
  const layout = sheetLayout('A1');
  const criteria = collectApplicableCriteria(fourRoleModel(), []);
  const criterionId = 'muro.montante.paso';
  const ownNote = 'Nota propia del proyecto';
  const withOwn = legendEntities(
    layout,
    'framing',
    [],
    [ownNote],
    criteria
  ).join('\n');
  const withDefaults = legendEntities(
    layout,
    'framing',
    [],
    null,
    criteria
  ).join('\n');

  assert.ok(withOwn.indexOf(criterionId) < withOwn.indexOf(ownNote));
  assert.ok(withDefaults.indexOf(criterionId) < withDefaults.indexOf(
    DEFAULT_NOTES.framing[0]
  ));
});

test('R8-C: sin criterios aplicables la leyenda permanece byte a byte igual', () => {
  const layout = sheetLayout('A3');
  const views = ['D1 = MURO EJE A'];
  const notes = ['Nota propia del proyecto'];
  const baseline = legendEntities(layout, 'framing', views, notes);
  const withoutRoles = legendEntities(layout, 'framing', views, notes, []);

  assert.deepEqual(withoutRoles, baseline);
});

test('R8-C: el exportador DXF integra criterios antes de las notas efectivas', () => {
  const [sheet] = generateFramingSheets(generatedFramingModel());
  const criterionId = 'muro.montante.paso';
  const ownNote = 'Nota propia integrada';

  assert.equal(sheet.filename, 'tabiqueria_A3_lamina1.dxf');
  assert.ok(sheet.content.includes(criterionId));
  assert.ok(sheet.content.indexOf(criterionId) < sheet.content.indexOf(ownNote));
  assert.equal(sheet.content.includes('(...)'), false);
});

test('R8-C: peor caso A3 conserva todos los IDs por variante sin marcador de truncación', () => {
  const layout = sheetLayout('A3');
  const criteria = collectApplicableCriteria(fourRoleModel(), []);
  const expected = {
    framing: [
      'muro.vano.holguraManilla',
      'muro.montante.paso',
      'muro.jamba.distanciaMontante',
      'muro.panel.largo'
    ],
    osb: [
      'osb.tornillo.borde',
      'osb.cadeneta.ala',
      'muro.corte.capacidadOsb'
    ],
    truss: ['muro.dintel.llegadaCercha'],
    foundations: []
  };

  for (const [variant, ruleIds] of Object.entries(expected)) {
    const expectedNotes = criteriaNotesForVariant(criteria, variant);
    const content = legendEntities(
      layout,
      variant,
      ['D1 = VISTA'],
      null,
      criteria
    ).join('\n');
    for (const ruleId of ruleIds) {
      assert.ok(content.includes(ruleId), `${variant} perdió ${ruleId}`);
    }
    const expectedCounts = expectedNotes.reduce((counts, note) => {
      const ruleId = note.slice(0, note.indexOf(':'));
      counts.set(ruleId, (counts.get(ruleId) || 0) + 1);
      return counts;
    }, new Map());
    for (const [ruleId, count] of expectedCounts) {
      assert.equal(
        content.split(ruleId).length - 1,
        count,
        `${variant} perdió una variante de ${ruleId}`
      );
    }
    assert.equal(content.includes('(...)'), false, `${variant} truncó su leyenda`);
  }
});
