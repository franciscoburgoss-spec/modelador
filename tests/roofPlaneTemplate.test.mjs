// tests/roofPlaneTemplate.test.mjs
// ★ B4.7.2 — La costanera (perfil OMA + paso) es sección de PROYECTO: vive en la plantilla
// (library.trussTemplates) y el faldón la HEREDA vía templateId. Verificación por datos:
//   - herencia: sin valores propios, el faldón toma perfil+paso+altura de la plantilla.
//   - migración: si el faldón arrastra valores propios divergentes, manda la plantilla + finding info.
//   - compat: sin plantilla, cae a los valores propios del faldón (comportamiento previo a B4.7.2).
//   - integración: getRoofPurlinBoxes/roofPurlinTakeoff usan el perfil de la plantilla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolvePurlinParams } from '../src/core/trussTemplates.js';
import { getRoofPurlinBoxes, roofPurlinTakeoff } from '../src/core/roofPlaneOutputs.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));

// library con una plantilla que define costanera de proyecto (35OMA085 @600) y los perfiles OMA
// del catálogo (para resolver la altura por code).
const template = {
  id: 'tpl-proj', name: 'Proyecto', postSpacing: 600, diagonalPattern: 'W',
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  purlinProfile: '35OMA085', purlinSpacing: 600
};
const library = { trussTemplates: [template], metalconProfiles: base.library.metalconProfiles };

test('herencia: el faldón sin costanera propia toma perfil+paso+altura de la plantilla', () => {
  const r = resolvePurlinParams({ plane: { templateId: 'tpl-proj' }, library });
  assert.equal(r.profile, '35OMA085');
  assert.equal(r.spacing, 600);
  assert.equal(r.profileH, 35, 'altura resuelta del catálogo por code');
  assert.equal(r.findings.length, 0, 'sin divergencia, sin aviso');
});

test('migración: valores propios divergentes → manda la plantilla + finding info por cada diferencia', () => {
  const r = resolvePurlinParams({
    plane: { templateId: 'tpl-proj', purlinProfile: '35OMA05', purlinSpacing: 800 },
    library
  });
  assert.equal(r.profile, '35OMA085', 'la plantilla manda sobre el valor propio');
  assert.equal(r.spacing, 600);
  assert.equal(r.findings.length, 2, 'un aviso por perfil y otro por paso');
  for (const f of r.findings) {
    assert.equal(f.severity, 'info');
    assert.equal(f.category, 'purlinTemplate');
  }
});

test('compat: sin plantilla cae a los valores propios del faldón (previo a B4.7.2)', () => {
  const r = resolvePurlinParams({
    plane: { purlinProfile: '35OMA05', purlinSpacing: 800, purlinProfileH: 35 },
    library
  });
  assert.equal(r.profile, '35OMA05');
  assert.equal(r.spacing, 800);
  assert.equal(r.profileH, 35);
  assert.equal(r.findings.length, 0, 'sin plantilla no hay migración que avisar');
});

// --- integración: un faldón con templateId produce costaneras con el perfil de la plantilla ------
const planeEjeA = {
  id: 'ejeA', templateId: 'tpl-proj', canalWallId: 1784600403613, supportLevelId: 1784556741132,
  supportOffset: 100, crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinCommercialLength: 6000, purlinOverlap: 100,
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 }, { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};

function makeModel() {
  return { ...base, library, roofSystems: [], roofPlanes: [planeEjeA] };
}

test('integración: getRoofPurlinBoxes etiqueta las costaneras con el perfil de la plantilla', () => {
  const boxes = getRoofPurlinBoxes(makeModel());
  assert.ok(boxes.length > 0, 'el faldón produce costaneras');
  assert.ok(boxes.every(b => b.profile === '35OMA085'), 'todas con el perfil de la plantilla');
  assert.ok(boxes.every(b => b.size.y === 35), 'altura del perfil del catálogo (H=35)');
});

test('integración: el metrado agrupa las costaneras bajo el perfil de la plantilla', () => {
  const takeoff = roofPurlinTakeoff(makeModel());
  assert.ok(takeoff.has('35OMA085'), 'partida bajo el perfil heredado');
  assert.ok(takeoff.get('35OMA085').ml > 0);
});
