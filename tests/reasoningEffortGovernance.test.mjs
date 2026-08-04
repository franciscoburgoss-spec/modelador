import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReasoningEffortGovernance } from '../scripts/lib/reasoning-effort-governance.mjs';

const policy = [
  '## Niveles permitidos',
  '## Matriz aprobada para el programa actual',
  '## Apertura obligatoria',
  '## Escalamiento a xhigh',
  '`max` está prohibido',
  'No hay tareas preasignadas a `xhigh`.',
].join('\n');

const spec = (effort = 'high', escalation = 'condicionado') => `
## Ejecución Codex

- Esfuerzo planificado: \`${effort}\`
- Escalamiento xhigh: \`${escalation}\`
- Motivo: prueba
`;

const status = (planned = 'high', effective = 'high') => `
| Spec activa | \`SPEC-X\` — prueba |
| Esfuerzo activo | \`${planned}\` planificado / \`${effective}\` efectivo; sin escalamiento |
`;

function validate(overrides = {}) {
  return validateReasoningEffortGovernance({
    effortPolicy: policy,
    status: status(),
    specs: { 'SPEC-X-test.md': spec() },
    specTemplate: '## Ejecución Codex',
    closeTemplate: '| Esfuerzo planificado |\n| Esfuerzo efectivo |\n| Escalamiento |',
    ...overrides,
  });
}

test('G0 acepta spec activa con esfuerzo ordinario planificado y efectivo iguales', () => {
  assert.deepEqual(validate(), []);
});

test('G0 rechaza esfuerzo efectivo distinto del planificado', () => {
  assert.ok(validate({ status: status('high', 'xhigh') }).some((error) => (
    error.includes('difiere del planificado')
  )));
});

test('G0 rechaza una spec activa sin declaración de ejecución Codex', () => {
  const errors = validate({ specs: { 'SPEC-X-test.md': '## Diagnóstico\n\nPrueba.' } });
  assert.ok(errors.some((error) => error.includes('falta "## Ejecución Codex"')));
  assert.ok(errors.some((error) => error.includes('esfuerzo planificado debe ser')));
});

test('G0 impide planificar xhigh y exige declarar su política de escalamiento', () => {
  const errors = validate({ specs: { 'SPEC-X-test.md': spec('xhigh', 'automático') } });
  assert.ok(errors.some((error) => error.includes('nunca xhigh')));
  assert.ok(errors.some((error) => error.includes('prohibido o condicionado')));
});

test('G0 exige que una sesión sin spec activa declare esfuerzo inactivo', () => {
  assert.deepEqual(validate({
    status: '| Spec activa | Ninguna |\n| Esfuerzo activo | Ninguno |',
  }), []);
  assert.ok(validate({ status: '| Spec activa | Ninguna |' }).some((error) => (
    error.includes('Esfuerzo activo | Ninguno')
  )));
});
