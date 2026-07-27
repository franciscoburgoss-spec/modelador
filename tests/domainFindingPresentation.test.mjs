import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFinding } from '../src/core/domainFindings.js';
import { resolveRuleLimit } from '../src/core/domainRules.js';
import {
  groupFindingsBySeverity,
  presentFinding,
  resolveFindingNavigation
} from '../src/core/domainFindingPresentation.js';

test('R4-C: agrupa error, warning e info sin perder findings de ningún productor', () => {
  const findings = [
    { severity: 'info', category: 'modelo', message: 'dato informativo', elementIds: [1] },
    { severity: 'error', category: 'techumbre', message: 'error de faldón', roofPlaneIds: [2] },
    { severity: 'warning', category: 'modelo', message: 'revisar geometría', elementIds: [3] }
  ];

  assert.deepEqual(groupFindingsBySeverity(findings), [
    { severity: 'error', findings: [findings[1]] },
    { severity: 'warning', findings: [findings[2]] },
    { severity: 'info', findings: [findings[0]] }
  ]);
});

test('R4-C: presenta medida, límite y fuente resuelta desde la regla derivada', () => {
  const finding = createFinding({
    category: 'cadeneta',
    rule: 'osb.cadeneta.ala',
    measured: { value: 22, unit: 'mm' },
    limit: resolveRuleLimit('osb.cadeneta.ala', { gap: 3 }),
    message: 'El ala no recibe ambos bordes de placa.',
    wallIds: [101]
  });

  const presented = presentFinding(finding);
  assert.equal(presented.severityLabel, 'Error');
  assert.equal(presented.ruleTitle, 'Ala útil de cadeneta en junta horizontal');
  assert.equal(presented.measuredText, '22 mm');
  assert.equal(presented.limitText, '≥ 23 mm');
  assert.equal(presented.sources.length, 1);
  assert.equal(presented.sources[0].ed, 'sin edición declarada');
  assert.match(presented.sources[0].url, /^https:\/\/lpchile\.cl\//);
});

test('R4-C: distingue dato no verificable, límite no resoluble y campos legacy ausentes', () => {
  const unresolved = presentFinding(createFinding({
    category: 'cadeneta',
    rule: 'osb.cadeneta.ala',
    measured: null,
    limit: null,
    message: 'No se pudo verificar.',
    wallIds: []
  }));
  assert.equal(unresolved.measuredText, 'No verificable');
  assert.equal(unresolved.limitText, 'No resoluble');

  const legacy = presentFinding({
    severity: 'warning',
    category: 'legacy',
    message: 'Sin datos de regla.',
    elementIds: [1]
  });
  assert.equal(legacy.ruleTitle, null);
  assert.equal(legacy.measuredText, null);
  assert.equal(legacy.limitText, null);
  assert.deepEqual(legacy.sources, []);
});

test('R4-C: formatea límites iguales, máximos y rangos', () => {
  const base = { severity: 'info', category: 'formato', message: 'límite' };
  assert.equal(presentFinding({ ...base, limit: { equal: 10, unit: 'mm' } }).limitText, '= 10 mm');
  assert.equal(presentFinding({ ...base, limit: { max: 10, unit: 'mm' } }).limitText, '≤ 10 mm');
  assert.equal(
    presentFinding({ ...base, limit: { min: 50, max: 60, unit: 'mm' } }).limitText,
    '50–60 mm'
  );
});

test('R4-C: navegación respeta prioridad tipada y no inventa acción sin ids', () => {
  assert.deepEqual(resolveFindingNavigation({
    roofPlaneIds: ['P1'],
    roofSystemIds: ['S1'],
    wallIds: ['W1'],
    elementIds: ['E1']
  }), { kind: 'roofPlane', id: 'P1', label: 'Ver faldón' });
  assert.deepEqual(
    resolveFindingNavigation({ roofSystemIds: ['S1'], wallIds: ['W1'], elementIds: ['E1'] }),
    { kind: 'roofSystem', id: 'S1', label: 'Ver sistema' }
  );
  assert.deepEqual(
    resolveFindingNavigation({ wallIds: ['W1'], elementIds: ['E1'] }),
    { kind: 'wall', id: 'W1', label: 'Centrar muro' }
  );
  assert.deepEqual(
    resolveFindingNavigation({ elementIds: ['E1'] }),
    { kind: 'element', id: 'E1', label: 'Centrar' }
  );
  assert.equal(resolveFindingNavigation({}), null);
  assert.equal(resolveFindingNavigation({ roofPlaneIds: [], wallIds: [] }), null);
});

test('R4-C: ValidationModal coordina las funciones puras de presentación y navegación', () => {
  const source = readFileSync(
    new URL('../src/components/modals/ValidationModal.jsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /from ['"]\.\.\/\.\.\/core\/domainFindingPresentation\.js['"]/);
  assert.match(source, /groupFindingsBySeverity\(/);
  assert.match(source, /presentFinding\(/);
  assert.match(source, /resolveFindingNavigation\(/);
});
