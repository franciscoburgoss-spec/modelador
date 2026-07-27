import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAIN_RULES,
  assertValidDomainRules,
  getDomainRule,
  ruleAppliesToRole,
  resolveRuleLimit
} from '../src/core/domainRules.js';

const RULE_IDS = [
  'muro.vano.holguraManilla',
  'osb.cadeneta.ala',
  'osb.tornillo.borde'
];

test('R4-A: el catálogo declara exactamente las tres reglas iniciales y sus taxonomías', () => {
  assert.deepEqual(Object.keys(DOMAIN_RULES).sort(), RULE_IDS);
  assert.deepEqual(
    {
      scope: DOMAIN_RULES['osb.tornillo.borde'].scope,
      origen: DOMAIN_RULES['osb.tornillo.borde'].origen,
      severity: DOMAIN_RULES['osb.tornillo.borde'].severity
    },
    { scope: 'sistema', origen: 'manual', severity: 'error' }
  );
  assert.deepEqual(
    {
      scope: DOMAIN_RULES['osb.cadeneta.ala'].scope,
      origen: DOMAIN_RULES['osb.cadeneta.ala'].origen,
      severity: DOMAIN_RULES['osb.cadeneta.ala'].severity,
      dependsOn: DOMAIN_RULES['osb.cadeneta.ala'].dependsOn
    },
    {
      scope: 'sistema',
      origen: 'derivado',
      severity: 'error',
      dependsOn: ['osb.tornillo.borde']
    }
  );
  assert.deepEqual(
    {
      scope: DOMAIN_RULES['muro.vano.holguraManilla'].scope,
      origen: DOMAIN_RULES['muro.vano.holguraManilla'].origen,
      severity: DOMAIN_RULES['muro.vano.holguraManilla'].severity
    },
    { scope: 'proyecto', origen: 'obra', severity: 'info' }
  );
});

test('R4-A: una regla manual identifica la publicación y una regla de obra no inventa cita', () => {
  const manual = getDomainRule('osb.tornillo.borde');
  assert.deepEqual(Object.keys(manual.fuente).sort(), [
    'consultado',
    'doc',
    'ed',
    'seccion',
    'url'
  ]);
  assert.equal(manual.fuente.ed, 'sin edición declarada');
  assert.match(manual.fuente.url, /^https:\/\/lpchile\.cl\//);
  assert.equal(manual.fuente.consultado, '2026-07-27');

  const obra = getDomainRule('muro.vano.holguraManilla');
  assert.equal(obra.fuente, null);
});

test('R4-A: catálogo, reglas, fuentes y dependencias son inmutables', () => {
  const manual = getDomainRule('osb.tornillo.borde');
  const derived = getDomainRule('osb.cadeneta.ala');
  assert.equal(Object.isFrozen(DOMAIN_RULES), true);
  assert.equal(Object.isFrozen(manual), true);
  assert.equal(Object.isFrozen(manual.fuente), true);
  assert.equal(Object.isFrozen(derived.dependsOn), true);
  assert.equal(Object.isFrozen(derived.aplicaA), true);
  assert.throws(() => {
    manual.titulo = 'mutado';
  }, TypeError);
  assert.throws(() => {
    derived.dependsOn.push('otra.regla.falsa');
  }, TypeError);
});

test('R5-A: aplicaA es explícito y no hereda reglas entre roles', () => {
  assert.deepEqual(DOMAIN_RULES['osb.tornillo.borde'].aplicaA, ['MP1']);
  assert.deepEqual(DOMAIN_RULES['osb.cadeneta.ala'].aplicaA, ['MP1']);
  assert.deepEqual(
    DOMAIN_RULES['muro.vano.holguraManilla'].aplicaA,
    ['MP1', 'MP2', 'MP3', 'tabique']
  );
  assert.equal(ruleAppliesToRole('osb.tornillo.borde', 'MP1'), true);
  assert.equal(ruleAppliesToRole('osb.tornillo.borde', 'MP2'), false);
  assert.equal(ruleAppliesToRole('osb.tornillo.borde', null), false);
  assert.equal(ruleAppliesToRole('muro.vano.holguraManilla', 'tabique'), true);
  assert.throws(() => ruleAppliesToRole('regla.ausente', 'MP1'), /inexistente/i);
  assert.throws(() => ruleAppliesToRole('osb.tornillo.borde', 'mp1'), /role/i);
});

test('R4-A: límites resuelven gap efectivo sin default oculto', () => {
  assert.deepEqual(resolveRuleLimit('osb.tornillo.borde'), { min: 10, unit: 'mm' });
  assert.deepEqual(resolveRuleLimit('osb.cadeneta.ala', { gap: 3 }), { min: 23, unit: 'mm' });
  assert.deepEqual(resolveRuleLimit('osb.cadeneta.ala', { gap: 5 }), { min: 25, unit: 'mm' });
  assert.equal(resolveRuleLimit('osb.cadeneta.ala'), null);
  assert.equal(resolveRuleLimit('osb.cadeneta.ala', { gap: '5' }), null);
  assert.deepEqual(resolveRuleLimit('muro.vano.holguraManilla'), {
    min: 50,
    max: 60,
    unit: 'mm'
  });
});

test('R4-A: el catálogo rechaza ids, taxonomías, fuentes y dependencias inválidas', () => {
  const valid = {
    'dominio.pieza.propiedad': {
      id: 'dominio.pieza.propiedad',
      titulo: 'Regla de prueba',
      descripcion: 'Contrato mínimo verificable.',
      scope: 'sistema',
      origen: 'manual',
      severity: 'error',
      unidad: 'mm',
      fuente: {
        doc: 'Documento',
        ed: '1',
        seccion: '§1',
        url: 'https://example.com/manual.pdf',
        consultado: '2026-07-27'
      },
      aplicaA: ['MP1'],
      dependsOn: [],
      resolveLimit: () => ({ min: 1, unit: 'mm' })
    }
  };

  assert.doesNotThrow(() => assertValidDomainRules(valid));
  assert.throws(
    () => assertValidDomainRules({ ...valid, roto: { ...valid['dominio.pieza.propiedad'] } }),
    /id.*clave|clave.*id/i
  );
  assert.throws(
    () => assertValidDomainRules({
      ...valid,
      'dominio.pieza.propiedad': { ...valid['dominio.pieza.propiedad'], scope: 'global' }
    }),
    /scope/i
  );
  assert.throws(
    () => assertValidDomainRules({
      ...valid,
      'dominio.pieza.propiedad': { ...valid['dominio.pieza.propiedad'], fuente: null }
    }),
    /fuente/i
  );
  assert.throws(
    () => assertValidDomainRules({
      ...valid,
      'dominio.pieza.propiedad': {
        ...valid['dominio.pieza.propiedad'],
        dependsOn: ['otra.regla.ausente']
      }
    }),
    /dependencia/i
  );
  assert.throws(
    () => assertValidDomainRules({
      ...valid,
      'dominio.pieza.propiedad': {
        ...valid['dominio.pieza.propiedad'],
        aplicaA: ['MP1', 'MP1']
      }
    }),
    /aplicaA/i
  );
  assert.throws(
    () => assertValidDomainRules({
      ...valid,
      'dominio.pieza.propiedad': {
        ...valid['dominio.pieza.propiedad'],
        aplicaA: ['todos']
      }
    }),
    /aplicaA/i
  );
});

test('R4-A: lookup y resolución rechazan una regla inexistente', () => {
  assert.equal(getDomainRule('regla.que.noExiste'), null);
  assert.equal(getDomainRule('toString'), null, 'no expone propiedades heredadas del prototipo');
  assert.throws(() => resolveRuleLimit('regla.que.noExiste'), /regla inexistente/i);
});
