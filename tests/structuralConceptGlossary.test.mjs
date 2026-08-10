import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STRUCTURAL_CONCEPT_GLOSSARY_SCHEMA,
  structuralConcept,
  structuralConceptOptions
} from '../src/core/structuralConceptGlossary.js';

test('SPEC-015-D REV7: glosario distingue declaración, efecto y no-significado', () => {
  assert.equal(STRUCTURAL_CONCEPT_GLOSSARY_SCHEMA, 'structural-concept-glossary-v1.0');
  const gravity = structuralConcept('roofBoundary', 'gravitySupport');
  const lateral = structuralConcept('roofBoundary', 'lateralSupport');
  assert.match(gravity.effect, /caminos gravitacionales candidatos/);
  assert.match(gravity.notMeans, /No demuestra capacidad/);
  assert.match(lateral.notMeans, /No implica carga vertical/);
});

test('SPEC-015-D REV7: gutterSupport conserva valor canónico pero usa nombre no ambiguo', () => {
  const gutter = structuralConcept('roofBoundary', 'gutterSupport');
  assert.equal(gutter.label, 'Soporte local de canaleta');
  assert.match(gutter.notMeans, /No declara apoyo gravitacional/);
  assert.ok(structuralConceptOptions('roofBoundary').some((item) => (
    item.value === 'gutterSupport' && item.label === 'Soporte local de canaleta'
  )));
});

test('SPEC-015-D REV7: diafragma candidato no equivale a previsto', () => {
  const candidate = structuralConcept('diaphragmBehavior', 'candidate');
  assert.equal(candidate.label, 'Candidato declarado');
  assert.match(candidate.effect, /no inicia una ruta lateral intent-backed/);
  assert.match(candidate.notMeans, /No equivale a Previsto/);
});
