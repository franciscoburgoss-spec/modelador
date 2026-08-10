# BUG-015-D-016 — Goldens JSON y fixture de persistencia todavía congelados en structural-intent-v1.0

## Contexto

Durante la validación completa de SPEC-015-D REV8, después de corregir el lint de
`StructuralInterfacesPanel.jsx`, la suite completa llegó a `npm test` y detectó dos fallos:

1. `tests/artifactGoldens.test.mjs` comparó cuatro hashes semánticos JSON de REV7 contra artefactos
   que ahora pasan de `structural-intent-v1.0` a `structural-intent-v1.1`.
2. `tests/nodeProjectFileSystem.test.mjs` construía su fixture del ensayo SIGKILL con v1.0 y luego
   exigía que `openNativeProject()` devolviera literalmente ese objeto, aunque REV8 migra
   correctamente v1.0→v1.1 al abrir.

## Diagnóstico

Se compararon campo por campo los cinco artefactos JSON de referencia generados desde el mismo
working tree REV7 y desde REV8. `json-fx008-agnostic-geometry` permanece idéntico. Los otros cuatro
artefactos difieren exclusivamente en:

- `structuralIntent.schema`: `structural-intent-v1.0` → `structural-intent-v1.1`;
- adición de `structuralIntent.interfaceIntents: []`;
- adición de `structuralIntent.relationIntents: []`.

No cambian geometría, ejes, elementos, vanos, derivados, perfiles, magnitudes ni referencias.
Por tanto, los hashes semánticos nuevos son consecuencia legítima del contrato nativo v1.1 y no
una filtración hacia `agnostic-geometry-v1.0`.

La prueba SIGKILL no pretende comprobar migración; su objetivo es demostrar atomicidad entre
`fsync` y `rename`. Usar un fixture legacy mezcla dos contratos independientes y vuelve obsoleta
la expectativa `deepEqual`.

## Corrección

- Regenerar explícitamente `harness/goldens/json.golden.json` con el generador oficial. La única
  diferencia aceptada son cuatro `semanticSha256`.
- Actualizar únicamente el helper `project()` de `tests/nodeProjectFileSystem.test.mjs` al schema
  vigente `structural-intent-v1.1`, agregando arrays vacíos de interfaces y relaciones.
- Mantener intactas todas las pruebas que usan v1.0 deliberadamente para verificar migración y
  compatibilidad legacy.

## Invariantes

- No cambia código productivo.
- No cambia `modelVersion: 3`.
- No cambia `agnostic-geometry-v1.0` ni su evidencia FX-008.
- No se inventan interfaces ni relaciones durante migración.
- No se ejecuta Git.
