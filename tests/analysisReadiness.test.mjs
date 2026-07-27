import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnalysisReadiness } from '../src/core/analysisReadiness.js';

function emptyLibrary(overrides = {}) {
  return { materials: [], columnSections: [], beamSections: [], metalconProfiles: [], ...overrides };
}

test('analysisReadiness: pilar sin libraryId → info "sin sección de librería"', () => {
  const model = { elements: [{ id: 'c1', type: 'column' }], library: emptyLibrary() };
  const issues = checkAnalysisReadiness(model);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'info');
  assert.equal(issues[0].category, 'Sin sección de librería');
});

test('analysisReadiness: pilar con sección pero sin materialId → info "sin material asignado"', () => {
  const model = {
    elements: [{ id: 'c1', type: 'column', libraryId: 10 }],
    library: emptyLibrary({ columnSections: [{ id: 10, name: 'Pilar 30x30' }] })
  };
  const issues = checkAnalysisReadiness(model);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, 'Sin material asignado');
});

test('analysisReadiness: pilar con material metalcon pero sin perfil → info "sin perfil de catálogo"', () => {
  const model = {
    elements: [{ id: 'c1', type: 'column', libraryId: 10 }],
    library: emptyLibrary({
      columnSections: [{ id: 10, name: 'Pilar metalcon', materialId: 1 }],
      materials: [{ id: 1, name: 'Metalcon', category: 'metalcon' }]
    })
  };
  const issues = checkAnalysisReadiness(model);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, 'Sin perfil de catálogo');
});

test('analysisReadiness: pilar con material y perfil metalcon completos → sin issues', () => {
  const model = {
    elements: [{ id: 'c1', type: 'column', libraryId: 10 }],
    library: emptyLibrary({
      columnSections: [{ id: 10, name: 'Pilar metalcon', materialId: 1, metalconProfileId: 99 }],
      materials: [{ id: 1, name: 'Metalcon', category: 'metalcon' }]
    })
  };
  assert.equal(checkAnalysisReadiness(model).length, 0);
});

test('analysisReadiness: pilar con material hormigón (sin catálogo de perfiles) → sin issues', () => {
  const model = {
    elements: [{ id: 'c1', type: 'column', libraryId: 10 }],
    library: emptyLibrary({
      columnSections: [{ id: 10, name: 'Pilar H30', materialId: 1 }],
      materials: [{ id: 1, name: 'Hormigón H30', category: 'hormigon' }]
    })
  };
  assert.equal(checkAnalysisReadiness(model).length, 0);
});

test('analysisReadiness: pilar con sección de librería eliminada → warning', () => {
  const model = { elements: [{ id: 'c1', type: 'column', libraryId: 999 }], library: emptyLibrary() };
  const issues = checkAnalysisReadiness(model);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'warning');
  assert.equal(issues[0].category, 'Sección eliminada');
});

test('analysisReadiness: muro sin metalcon asignado no genera issues', () => {
  const model = { elements: [{ id: 'w1', type: 'wall' }], library: emptyLibrary() };
  assert.equal(checkAnalysisReadiness(model).length, 0);
});

test('analysisReadiness: muro con perfiles asignados pero sin studs → warning "despiece desactualizado"', () => {
  const model = {
    elements: [{ id: 'w1', type: 'wall', framingStudProfileId: 5, studs: [] }],
    library: emptyLibrary({ metalconProfiles: [{ id: 5, shape: 'C' }] })
  };
  const issues = checkAnalysisReadiness(model);
  assert.ok(issues.some(i => i.category === 'Despiece desactualizado'));
});

test('analysisReadiness: muro con studs y material asignado completos → sin issues', () => {
  const model = {
    elements: [{ id: 'w1', type: 'wall', framingStudProfileId: 5, framingMaterialId: 1, studs: [{ offset: 0, zMin: 0, zMax: 2400 }] }],
    library: emptyLibrary({ metalconProfiles: [{ id: 5, shape: 'C' }], materials: [{ id: 1, name: 'Metalcon', category: 'metalcon' }] })
  };
  assert.equal(checkAnalysisReadiness(model).length, 0);
});

test('analysisReadiness: muro con studs pero sin material asignado → info', () => {
  const model = {
    elements: [{ id: 'w1', type: 'wall', framingStudProfileId: 5, studs: [{ offset: 0, zMin: 0, zMax: 2400 }] }],
    library: emptyLibrary({ metalconProfiles: [{ id: 5, shape: 'C' }] })
  };
  const issues = checkAnalysisReadiness(model);
  assert.ok(issues.some(i => i.severity === 'info' && i.category === 'Sin material asignado'));
});
