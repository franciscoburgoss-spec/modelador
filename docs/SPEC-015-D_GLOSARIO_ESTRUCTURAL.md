# SPEC-015-D — Glosario estructural de aplicación

Documento de apoyo de la implementación REV7. La fuente ejecutable es `src/core/structuralConceptGlossary.js`.

## Regla de lectura

Todo concepto debe leerse en tres niveles operativos:

`qué declara → qué habilita → qué no demuestra`

La intención estructural es una declaración humana. Las propuestas y caminos son derivados candidatos. Ningún estado candidato equivale a verificación.

## Principios

- una dirección resistente no asigna automáticamente bordes de apoyo;
- `gravitySupport` busca transferencia gravitacional, no demuestra capacidad;
- `lateralSupport` no implica carga vertical;
- `gravityAndLateralSupport` declara ambas funciones sin verificarlas;
- `gutterSupport` se presenta como **Soporte local de canaleta** y no inicia receptor resistente;
- `diaphragmBehavior=intended` puede respaldar un estudio lateral, pero no verifica diafragma;
- `diaphragmBehavior=candidate` se presenta como **Candidato declarado** y no inicia una ruta lateral intent-backed;
- una ruta `completeCandidate` sólo expresa continuidad geométrica/declarativa hasta base.
