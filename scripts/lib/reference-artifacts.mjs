import { readFileSync } from 'node:fs';

import { serializeAgnosticGeometry } from '../../src/core/agnosticGeometry.js';
import { modulateAllWallsFull } from '../../src/core/batchModulation.js';
import {
  applyWallRegenerationPatch,
  invalidateDerived
} from '../../src/core/derivedInvalidation.js';
import { generateCalculix } from '../../src/core/exportCalculix.js';
import { generateCalculixFoundation } from '../../src/core/exportCalculixFoundation.js';
import { generateCalculixTruss } from '../../src/core/exportCalculixTruss.js';
import { generateDxf } from '../../src/core/exportDxf.js';
import { generateFoundationSheets } from '../../src/core/exportFoundationsDxf.js';
import { generateFramingDxf } from '../../src/core/exportFramingDxf.js';
import { generateOsbFramingDxf } from '../../src/core/exportOsbDxf.js';
import {
  generateFramingSheets,
  generateOsbFramingSheets,
  generateTrussSheets
} from '../../src/core/exportSheetsDxf.js';
import { generateTrussDxf } from '../../src/core/exportTrussDxf.js';
import {
  prepareModelImport,
  prepareModelJsonImport
} from '../../src/core/modelSchema.js';
import { generateTakeoffCsv } from '../../src/core/takeoff.js';

export const REFERENCE_DATE = '2026-07-28';

const FIXTURES = {
  fx3: new URL('../../tests/fixtures/fx-003-vivienda-independiente.json', import.meta.url),
  fx4: new URL('../../tests/fixtures/fx-004-cubierta-moderna.json', import.meta.url),
  casaL: new URL('../../tests/fixtures/casa-L.json', import.meta.url),
  casaLCompleta: new URL(
    '../../tests/fixtures/casa-L-completa-v3.json',
    import.meta.url
  )
};

function loadFixture(url) {
  const source = JSON.parse(readFileSync(url, 'utf8'));
  return prepareModelImport(source).model;
}

function regenerateWalls(model) {
  const result = modulateAllWallsFull(model, {
    metalcon: model.metalconDefaults || {},
    osb: model.osbDefaults || {}
  });
  const wallCount = model.elements.filter((element) => element.type === 'wall').length;
  if (
    result.blocked.length > 0
    || result.skippedMetalcon.length > 0
    || result.skippedOsb.length > 0
    || result.patches.length !== wallCount
  ) {
    throw new Error(
      `Regeneración de referencia incompleta: ${JSON.stringify({
        wallCount,
        patches: result.patches.length,
        skippedMetalcon: result.skippedMetalcon,
        skippedOsb: result.skippedOsb,
        blocked: result.blocked
      })}`
    );
  }

  const patches = new Map(
    result.patches.map(({ wallId, patch }) => [String(wallId), patch])
  );
  return {
    ...model,
    elements: model.elements.map((element) => {
      const patch = patches.get(String(element.id));
      return patch && element.type === 'wall'
        ? applyWallRegenerationPatch(element, patch)
        : element;
    })
  };
}

function withReferenceSheetMetadata(model) {
  return {
    ...model,
    projectInfo: {
      ...(model.projectInfo || {}),
      fecha: REFERENCE_DATE,
      formato: 'A3'
    }
  };
}

function roundtrip(model) {
  return prepareModelJsonImport(JSON.stringify(model)).model;
}

function withLf(content) {
  return `${String(content).replace(/\r\n?/g, '\n').replace(/\n*$/, '')}\n`;
}

function artifact(id, format, family, variant, sourceFixture, filename, content) {
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(`${id}: el exportador no produjo contenido.`);
  }
  return {
    id,
    format,
    family,
    variant,
    sourceFixture,
    filename,
    content: withLf(content)
  };
}

function sheetArtifacts({
  idPrefix,
  family,
  sourceFixture,
  sheets
}) {
  if (sheets.length === 0) {
    throw new Error(`${idPrefix}: el exportador no produjo láminas.`);
  }
  return sheets.map((sheet, index) => artifact(
    `${idPrefix}-${index + 1}`,
    'dxf',
    family,
    'A3',
    sourceFixture,
    sheet.filename,
    sheet.content
  ));
}

export function buildReferenceModels() {
  const fx3 = loadFixture(FIXTURES.fx3);
  const fx4 = loadFixture(FIXTURES.fx4);
  const casaL = loadFixture(FIXTURES.casaL);
  const casaLCompleta = loadFixture(FIXTURES.casaLCompleta);
  const fx3Generated = withReferenceSheetMetadata(regenerateWalls(fx3));
  const fx4Generated = withReferenceSheetMetadata(regenerateWalls(fx4));
  const casaLGenerated = withReferenceSheetMetadata(regenerateWalls(casaL));
  const firstWallId = fx3Generated.elements.find((element) => element.type === 'wall')?.id;
  if (firstWallId == null) throw new Error('FX-003 no contiene el muro de referencia.');

  return {
    fx3,
    fx4,
    casaL: withReferenceSheetMetadata(casaL),
    casaLCompleta,
    casaLGenerated,
    fx3Generated,
    fx4Generated,
    fx3Stale: invalidateDerived(fx3Generated, firstWallId)
  };
}

export function buildDxfQualityArtifacts(models = buildReferenceModels()) {
  const {
    casaL,
    fx3Generated,
    fx4Generated
  } = models;
  const groups = [
    {
      qualityFamily: 'foundations',
      sourceFixture: 'FX-001',
      sheets: generateFoundationSheets(casaL, { format: 'A1' })
    },
    {
      qualityFamily: 'framing',
      sourceFixture: 'FX-003',
      sheets: generateFramingSheets(fx3Generated, { format: 'A1' })
    },
    {
      qualityFamily: 'osb',
      sourceFixture: 'FX-003',
      sheets: generateOsbFramingSheets(fx3Generated, { format: 'A1' })
    },
    {
      qualityFamily: 'truss',
      sourceFixture: 'FX-004',
      sheets: generateTrussSheets(fx4Generated, { format: 'A1' })
    }
  ];

  return groups.flatMap(({ qualityFamily, sourceFixture, sheets }) => {
    if (sheets.length === 0) {
      throw new Error(`dxf-quality-${qualityFamily}-a1: el exportador no produjo láminas.`);
    }
    return sheets.map((sheet, index) => ({
      ...artifact(
        `dxf-quality-${qualityFamily}-a1-${index + 1}`,
        'dxf',
        `quality-${qualityFamily}-a1`,
        'A1',
        sourceFixture,
        sheet.filename,
        sheet.content
      ),
      qualityFamily,
      sheetFormat: 'A1'
    }));
  });
}

export function buildReferenceArtifacts(models = buildReferenceModels()) {
  const {
    fx3,
    fx4,
    casaL,
    casaLCompleta,
    casaLGenerated,
    fx3Generated,
    fx4Generated,
    fx3Stale
  } = models;

  return [
    artifact(
      'json-fx003-roundtrip',
      'json',
      'json-roundtrip',
      'persisted',
      'FX-003',
      'fx-003-roundtrip.json',
      JSON.stringify(roundtrip(fx3), null, 2)
    ),
    artifact(
      'json-fx004-roundtrip',
      'json',
      'json-roundtrip',
      'persisted',
      'FX-004',
      'fx-004-roundtrip.json',
      JSON.stringify(roundtrip(fx4), null, 2)
    ),
    artifact(
      'json-fx008-agnostic-geometry',
      'json',
      'agnostic-geometry',
      'v1.0',
      'FX-008',
      'geometria-agnostica-base.json',
      serializeAgnosticGeometry(casaLCompleta)
    ),
    artifact(
      'json-fx003-derived-fresh',
      'json',
      'json-derived-state',
      'fresh',
      'FX-003',
      'fx-003-derived-fresh.json',
      JSON.stringify(roundtrip(fx3Generated), null, 2)
    ),
    artifact(
      'json-fx003-derived-stale',
      'json',
      'json-derived-state',
      'stale',
      'FX-003',
      'fx-003-derived-stale.json',
      JSON.stringify(roundtrip(fx3Stale), null, 2)
    ),
    artifact(
      'csv-fx003-takeoff',
      'csv',
      'takeoff',
      'generated',
      'FX-003',
      'fx-003-metrado.csv',
      generateTakeoffCsv(fx3Generated)
    ),
    artifact(
      'csv-fx004-takeoff',
      'csv',
      'takeoff',
      'generated',
      'FX-004',
      'fx-004-metrado.csv',
      generateTakeoffCsv(fx4Generated)
    ),
    artifact(
      'dxf-plan',
      'dxf',
      'plan',
      'R12',
      'FX-003',
      'planta-r12.dxf',
      generateDxf(fx3)
    ),
    ...sheetArtifacts({
      idPrefix: 'dxf-foundations',
      family: 'foundations',
      sourceFixture: 'FX-001',
      sheets: generateFoundationSheets(casaL, { format: 'A3' })
    }),
    artifact(
      'dxf-framing-r12',
      'dxf',
      'framing-r12',
      'R12',
      'FX-003',
      'tabiqueria-r12.dxf',
      generateFramingDxf(fx3Generated)
    ),
    ...sheetArtifacts({
      idPrefix: 'dxf-framing-a3',
      family: 'framing-a3',
      sourceFixture: 'FX-003',
      sheets: generateFramingSheets(fx3Generated, { format: 'A3' })
    }),
    artifact(
      'dxf-osb-r12',
      'dxf',
      'osb-r12',
      'R12',
      'FX-003',
      'osb-r12.dxf',
      generateOsbFramingDxf(fx3Generated)
    ),
    ...sheetArtifacts({
      idPrefix: 'dxf-osb-a3',
      family: 'osb-a3',
      sourceFixture: 'FX-003',
      sheets: generateOsbFramingSheets(fx3Generated, { format: 'A3' })
    }),
    artifact(
      'dxf-truss-r12',
      'dxf',
      'truss-r12',
      'R12',
      'FX-004',
      'cerchas-r12.dxf',
      generateTrussDxf(fx4Generated)
    ),
    ...sheetArtifacts({
      idPrefix: 'dxf-truss-a3',
      family: 'truss-a3',
      sourceFixture: 'FX-004',
      sheets: generateTrussSheets(fx4Generated, { format: 'A3' })
    }),
    artifact(
      'inp-global',
      'inp',
      'calculix-global',
      'reference-only',
      'FX-001',
      'global.inp',
      generateCalculix(casaLGenerated)
    ),
    artifact(
      'inp-truss',
      'inp',
      'calculix-truss',
      'reference-only',
      'FX-004',
      'cerchas.inp',
      generateCalculixTruss(fx4Generated)
    ),
    artifact(
      'inp-foundations',
      'inp',
      'calculix-foundations',
      'reference-only',
      'FX-001',
      'fundaciones.inp',
      generateCalculixFoundation(casaL)
    )
  ];
}
