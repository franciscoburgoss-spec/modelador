import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAIN_RULES,
  REPORT_SECTIONS,
  SHEET_VARIANTS,
  assertValidDomainRules,
  getDomainRule,
  ruleAppliesToRole,
  resolveRuleLimit
} from '../src/core/domainRules.js';

const RULE_IDS = [
  'muro.corte.capacidadOsb',
  'muro.dintel.llegadaCercha',
  'muro.jamba.distanciaMontante',
  'muro.montante.paso',
  'muro.panel.largo',
  'muro.vano.holguraManilla',
  'osb.cadeneta.ala',
  'osb.tornillo.borde'
];

test('R7-A: el catálogo conserva R4 y declara las cinco reglas R7 con sus taxonomías', () => {
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
  assert.deepEqual(
    {
      origen: DOMAIN_RULES['muro.jamba.distanciaMontante'].origen,
      severity: DOMAIN_RULES['muro.jamba.distanciaMontante'].severity,
      aplicaA: DOMAIN_RULES['muro.jamba.distanciaMontante'].aplicaA
    },
    {
      origen: 'obra',
      severity: 'info',
      aplicaA: ['MP1', 'MP2', 'MP3', 'tabique']
    }
  );
  for (const ruleId of [
    'muro.montante.paso',
    'muro.dintel.llegadaCercha',
    'muro.panel.largo',
    'muro.corte.capacidadOsb'
  ]) {
    assert.equal(DOMAIN_RULES[ruleId].origen, 'manual');
  }
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
  assert.equal(Object.isFrozen(manual.sheetVariants), true);
  assert.throws(() => {
    manual.titulo = 'mutado';
  }, TypeError);
  assert.throws(() => {
    derived.dependsOn.push('otra.regla.falsa');
  }, TypeError);
});

test('R8-A: cada regla declara sección de informe y variantes de lámina válidas', () => {
  assert.deepEqual(REPORT_SECTIONS, ['Muros', 'OSB', 'Techumbre', 'Modelo']);
  assert.deepEqual(SHEET_VARIANTS, ['framing', 'osb', 'truss', 'foundations']);
  assert.deepEqual(
    Object.fromEntries(Object.entries(DOMAIN_RULES).map(([id, rule]) => [
      id,
      [rule.reportSection, rule.sheetVariants]
    ])),
    {
      'osb.tornillo.borde': ['OSB', ['osb']],
      'osb.cadeneta.ala': ['OSB', ['osb']],
      'muro.vano.holguraManilla': ['Muros', ['framing']],
      'muro.montante.paso': ['Muros', ['framing']],
      'muro.jamba.distanciaMontante': ['Muros', ['framing']],
      'muro.dintel.llegadaCercha': ['Techumbre', ['truss']],
      'muro.panel.largo': ['Muros', ['framing']],
      'muro.corte.capacidadOsb': ['OSB', ['osb']]
    }
  );
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
  assert.deepEqual(resolveRuleLimit('muro.montante.paso', { role: 'MP1' }), {
    max: 610,
    unit: 'mm'
  });
  assert.deepEqual(resolveRuleLimit('muro.montante.paso', { role: 'MP2' }), {
    max: 600,
    unit: 'mm'
  });
  assert.equal(resolveRuleLimit('muro.montante.paso', { role: 'MP3' }), null);
  assert.deepEqual(resolveRuleLimit('muro.dintel.llegadaCercha', { flangeWidth: 38 }), {
    max: 19,
    unit: 'mm'
  });
  assert.equal(resolveRuleLimit('muro.dintel.llegadaCercha'), null);
  assert.deepEqual(resolveRuleLimit('muro.panel.largo', { role: 'MP2' }), {
    min: 3000,
    max: 5000,
    unit: 'mm'
  });
  assert.deepEqual(resolveRuleLimit('muro.panel.largo', { role: 'MP3' }), {
    max: 5000,
    unit: 'mm'
  });
  assert.deepEqual(resolveRuleLimit('muro.corte.capacidadOsb'), {
    equal: 417,
    unit: 'kgf/m'
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
      reportSection: 'Modelo',
      sheetVariants: [],
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
        reportSection: 'Estructura'
      }
    }),
    /reportSection/i
  );
  assert.throws(
    () => assertValidDomainRules({
      ...valid,
      'dominio.pieza.propiedad': {
        ...valid['dominio.pieza.propiedad'],
        sheetVariants: ['osb', 'osb']
      }
    }),
    /sheetVariants/i
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
