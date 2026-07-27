import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinding } from '../src/core/domainFindings.js';
import { resolveRuleLimit } from '../src/core/domainRules.js';

test('R4-A: construye un finding de cadeneta con regla, medida, límite e ids tipados', () => {
  const finding = createFinding({
    category: 'cadeneta',
    rule: 'osb.cadeneta.ala',
    measured: { value: 22, unit: 'mm' },
    limit: resolveRuleLimit('osb.cadeneta.ala', { gap: 3 }),
    message: 'El ala no recibe ambos bordes de placa.',
    wallIds: [101]
  });

  assert.deepEqual(finding, {
    severity: 'error',
    category: 'cadeneta',
    message: 'El ala no recibe ambos bordes de placa.',
    rule: 'osb.cadeneta.ala',
    measured: { value: 22, unit: 'mm' },
    limit: { min: 23, unit: 'mm' },
    wallIds: [101]
  });
  assert.equal('ids' in finding, false);
  assert.equal('fuente' in finding, false, 'la cita vive sólo en el catálogo');
});

test('R4-A: un finding legacy conserva exactamente su shape observable', () => {
  assert.deepEqual(
    createFinding({
      severity: 'warning',
      category: 'Largo cero',
      message: 'El elemento tiene largo cero.',
      elementIds: ['w1']
    }),
    {
      severity: 'warning',
      category: 'Largo cero',
      message: 'El elemento tiene largo cero.',
      elementIds: ['w1']
    }
  );
});

test('R4-A: measured y limit aceptan null explícito para un dato no verificable', () => {
  assert.deepEqual(
    createFinding({
      category: 'cadeneta',
      rule: 'osb.cadeneta.ala',
      measured: null,
      limit: null,
      message: 'No se pudo resolver el perfil.',
      wallIds: []
    }),
    {
      severity: 'error',
      category: 'cadeneta',
      message: 'No se pudo resolver el perfil.',
      rule: 'osb.cadeneta.ala',
      measured: null,
      limit: null,
      wallIds: []
    }
  );
});

test('R4-A: rechaza reglas inexistentes, escala inválida y severity sobre el máximo', () => {
  assert.throws(
    () => createFinding({
      category: 'prueba',
      rule: 'regla.que.noExiste',
      message: 'No debe construirse.'
    }),
    /regla inexistente/i
  );
  assert.throws(
    () => createFinding({
      severity: 'critical',
      category: 'prueba',
      message: 'No debe construirse.'
    }),
    /severity/i
  );
  assert.throws(
    () => createFinding({
      severity: 'warning',
      category: 'holgura',
      rule: 'muro.vano.holguraManilla',
      message: 'No debe escalar una regla de obra.'
    }),
    /severidad máxima/i
  );
});

test('R4-A: rechaza booleanos, no finitos, límites ambiguos y unidades incompatibles', () => {
  const base = {
    category: 'cadeneta',
    rule: 'osb.cadeneta.ala',
    message: 'Dato inválido.'
  };
  for (const measured of [
    true,
    { value: Number.NaN, unit: 'mm' },
    { value: 22, unit: '' }
  ]) {
    assert.throws(() => createFinding({ ...base, measured }), /measured/i);
  }
  for (const limit of [
    false,
    { unit: 'mm' },
    { min: Number.POSITIVE_INFINITY, unit: 'mm' },
    { min: 60, max: 50, unit: 'mm' },
    { min: 20, equal: 20, unit: 'mm' }
  ]) {
    assert.throws(() => createFinding({ ...base, limit }), /limit/i);
  }
  assert.throws(
    () => createFinding({
      ...base,
      measured: { value: 22, unit: 'mm' },
      limit: { min: 2.3, unit: 'cm' }
    }),
    /unidad/i
  );
});

test('R4-A: rechaza ids genéricos o colecciones tipadas mal formadas', () => {
  const base = {
    severity: 'info',
    category: 'prueba',
    message: 'IDs inválidos.'
  };
  assert.throws(() => createFinding({ ...base, ids: [1] }), /ids genérico/i);
  assert.throws(() => createFinding({ ...base, wallIds: 1 }), /wallIds/i);
  assert.throws(() => createFinding({ ...base, roofPlaneIds: [null] }), /roofPlaneIds/i);
});
