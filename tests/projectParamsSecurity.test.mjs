import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildParamsMap, isValidParamName, resolveValue
} from '../src/core/projectParams.js';

test('fórmulas: el payload conocido no puede ejecutar código global', () => {
  let clearCalls = 0;
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { clear: () => { clearCalls += 1; } };

  try {
    const params = { localStorage: 0, clear: 0, source: 0 };
    const result = resolveValue(
      '=constructor.constructor(/localStorage.clear()/.source)()',
      params
    );
    assert.equal(Number.isNaN(result), true);
    assert.equal(clearCalls, 0);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test('fórmulas: propiedades, llamadas, globals y sintaxis ajena a la gramática se rechazan', () => {
  const adversarial = [
    '=constructor.constructor(1)',
    '=globalThis',
    '=Math.max(1)',
    '=x.toString',
    '=x()',
    '=x[0]',
    '=1 ** 2',
    '=1; 2'
  ];
  for (const formula of adversarial) {
    assert.equal(Number.isNaN(resolveValue(formula, { x: 2 })), true, formula);
  }
});

test('fórmulas: conserva números, precedencia, unarios, paréntesis y referencias declaradas', () => {
  const params = buildParamsMap([
    { name: 'ancho', value: 90 },
    { name: 'placa', value: 11.1 }
  ]);
  const elements = {
    muro_1: { id: 'muro_1', thickness: '=ancho + placa' }
  };

  assert.equal(resolveValue('=2 + 3 * 4', params), 14);
  assert.equal(resolveValue('=-(2 + 3) * +4', params), -20);
  assert.equal(resolveValue('=ancho + placa', params), 101.1);
  assert.equal(resolveValue('=muro_1.thickness / 2', params, elements), 50.55);
});

test('fórmulas: todos los fixtures heredados conservan sus resultados conocidos', () => {
  const fixturePaths = [
    path.join(import.meta.dirname, 'fixtures', 'casa-L.json'),
    path.join(import.meta.dirname, '..', 'lab', 'roofPlane', 'fixtures', 'modelo-26.json')
  ];
  let formulaCount = 0;

  for (const fixturePath of fixturePaths) {
    const model = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const params = buildParamsMap(model.projectParams);
    const elements = Object.fromEntries(model.elements.map((element) => [element.id, element]));
    const visit = (value) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
      else if (typeof value === 'string' && value.trim().startsWith('=')) {
        formulaCount += 1;
        assert.equal(resolveValue(value, params, elements), 101.1, `${fixturePath}: ${value}`);
      }
    };
    visit(model);
  }
  assert.equal(formulaCount, 92, 'el corpus heredado completo debe seguir cubierto');
});

test('fórmulas: sólo usa claves propias y reserva nombres de prototipo', () => {
  const params = buildParamsMap([
    { name: 'seguro', value: 5 },
    { name: 'constructor', value: 9 },
    { name: '__proto__', value: 7 }
  ]);

  assert.equal(Object.getPrototypeOf(params), null);
  assert.equal(resolveValue('=seguro', params), 5);
  assert.equal(Number.isNaN(resolveValue('=toString', params)), true);
  assert.equal(Number.isNaN(resolveValue('=constructor', params)), true);
  assert.equal(isValidParamName('constructor'), false);
  assert.equal(isValidParamName('__proto__'), false);
});

test('fórmulas: limita profundidad de AST y cadenas recursivas de elementos', () => {
  const nested = `=${'('.repeat(80)}1${')'.repeat(80)}`;
  assert.equal(Number.isNaN(resolveValue(nested, {})), true);

  const elements = {};
  for (let index = 0; index < 80; index += 1) {
    elements[`e${index}`] = {
      id: `e${index}`,
      width: index === 79 ? 1 : `=e${index + 1}.width`
    };
  }
  assert.equal(Number.isNaN(resolveValue('=e0.width', {}, elements)), true);
});
