# BUG-015-E-013 — Escapes innecesarios en test visual

## Estado

CERRADO — 11-ago-2026

## Contexto

Durante la validación integral posterior a SPEC-015-E B3.2.1, npm run validate superó format:check y format:rust, pero se detuvo en lint.

ESLint informó cinco errores no-useless-escape en tests/spec015eEvidenceVisualCorrective.test.mjs.

Los errores estaban en los títulos de tres tests y no afectaban las expresiones regulares, la evidencia estructural ni la semántica R11.

## Causa

Cinco barras / estaban escapadas innecesariamente en cadenas JavaScript ordinarias:

- C/6 y C/7.
- completeCandidate/notVerified.
- B1/C6/C7.

## Corrección

Se eliminaron exclusivamente esos cinco escapes de los títulos de test.

No se modificaron:

- expresiones regulares;
- lógica de los tests;
- src/core/structuralRequirements.js;
- contrato R11;
- geometría agnóstica;
- intención estructural;
- interfaces o relaciones REV8;
- caminos de carga candidatos;
- evidencia JSON estructural.

## Validación

Gate focal:

npm run lint

Resultado: PASS.

Validación integral posterior:

- formato: PASS;
- lint: PASS;
- Node: 1023/1023 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS;
- laboratorio: 35/35 PASS;
- cobertura core y store: PASS;
- goldens: 19 PASS;
- DXF: PASS;
- CalculiX: 3/3 PASS;
- build: PASS;
- migración: PASS;
- artefactos y derivados: PASS;
- auditoría Codex: PASS;
- gobernanza: PASS.

## Impacto

El defecto era exclusivamente estático dentro del test visual y bloqueaba lint.

No produjo cambio semántico en SPEC-015-E ni alteró la evidencia aprobada de B3.2/B3.2.1.
