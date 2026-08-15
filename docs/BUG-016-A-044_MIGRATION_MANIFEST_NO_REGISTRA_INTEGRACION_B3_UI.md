# BUG-016-A-044 — Migration manifest no registra integración B3/UI

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

Después de corregir focalmente BUG-016-A-043 se repitió:

`npm run validate`

La cadena integral avanzó satisfactoriamente por:

- format;
- lint;
- Node;
- componentes;
- Rust;
- Tauri check;
- laboratorio;
- cobertura;
- goldens;
- auditoría DXF;
- smoke CalculiX;
- build.

El gate se detuvo en:

`npm run verify:migration`

con:

`Migración inválida (3)`

y los siguientes archivos:

- `src/App.jsx`;
- `src/components/MenuBar.jsx`;
- `src/store/useModelStore.js`.

Para los tres casos el diagnóstico fue:

`el archivo difiere del hash registrado`.

`npm run validate` terminó con exit code `1`.

## Contexto

Los tres archivos forman parte de la integración productiva de SPEC-016-A
B3/UI ya implementada y revisada:

- `src/App.jsx`: composición del workspace constructivo;
- `src/components/MenuBar.jsx`: entrada independiente
  `Soluciones constructivas → Escenarios`;
- `src/store/useModelStore.js`: operaciones persistentes/históricas de
  escenarios y receipts.

El fallo observado no demuestra por sí mismo una regresión funcional de
esos archivos. Demuestra que su estado actual todavía no está reflejado en
el migration manifest gobernado.

El proyecto dispone del mecanismo oficial:

`node scripts/migration-manifest.mjs --record ...`

que registra cambios posteriores sin alterar los hashes de origen.

No se debe editar el manifest manualmente sólo para hacer pasar el gate.

## Relación con BUG-016-A-043

BUG-016-A-043 permanece abierto hasta conseguir un `npm run validate`
integral verde.

Sin embargo, su defecto específico de compatibilidad WebView ya quedó
corregido y fue ejercitado satisfactoriamente dentro de la suite integral:

- Node: `1212/1212 PASS`;
- componentes: `61/61 PASS`;
- la prueba SPEC-004-D1 contra `Object.hasOwn`: PASS.

El bloqueo actual del validate pertenece a este BUG-016-A-044.

## Impacto

Mientras el migration manifest no refleje los tres archivos gobernados:

- `npm run verify:migration` falla;
- `npm run validate` no puede completarse;
- BUG-016-A-043 no puede cerrarse;
- BUG-016-A-040 permanece abierto;
- no procede la auditoría final de los 20 criterios;
- no se crea `sessions/close-SPEC-016-A.md`.

## Correctiva exigida

Antes de registrar nuevos hashes se debe comprobar:

1. los SHA-256 actuales de los tres archivos;
2. sus entradas vigentes en `governance/MIGRATION_MANIFEST.json`;
3. el mecanismo oficial de `scripts/migration-manifest.mjs`;
4. que los tres cambios pertenecen realmente a SPEC-016;
5. que no existe un cuarto archivo gobernado divergente oculto.

Si se confirma ese diagnóstico, la correctiva debe usar exclusivamente el
mecanismo oficial `--record`, con `changedBy=SPEC-016`, sin alterar hashes
de origen ni modificar código productivo.

## Criterio de cierre

Cerrar únicamente cuando:

- los tres archivos queden registrados mediante el mecanismo oficial;
- `npm run verify:migration` sea PASS;
- el manifest conserve los hashes de origen;
- no aparezcan divergencias adicionales;
- `npm run validate` completo termine con exit code `0`;
- `git diff --check` y governance permanezcan verdes.

No se autoriza modificación de tests, producto, SPEC ni contratos para
hacer pasar este gate.

## Cierre verificado

La correctiva quedó verificada integralmente el 14-ago-2026.

Los cambios legítimos de integración B3/UI fueron registrados mediante el
mecanismo oficial:

`node scripts/migration-manifest.mjs --record SPEC-016 ...`

sobre:

- `src/App.jsx`;
- `src/components/MenuBar.jsx`;
- `src/store/useModelStore.js`.

No se editó manualmente el migration manifest para forzar el gate.

### Evidencia del registro

SHA-256 final de:

`governance/MIGRATION_MANIFEST.json`

`63be7cfab4ab7d7bbc485be15e0cc462edbbb7b49ef0dcae6d8d1460f168bd4f`

El auditor posterior a `--record` demostró:

- hashes de origen: PRESERVADOS;
- cambios fuera de
  `workspaceBytes/workspaceSha256/changedBy`: NINGUNO;
- `changedBy`: `SPEC-016` para las tres entradas.

Workspace SHA-256 registrados:

- `src/App.jsx`:
  `ca9dbab8115c75d11d75a093b59c9c0aa88fd3ab9e05c7da9b15f8460ceecdc8`;
- `src/components/MenuBar.jsx`:
  `0d06f9f38a31cc82b99b4386f55890a48d503460ede5fd26a4d968e80af5b104`;
- `src/store/useModelStore.js`:
  `2ca9192c27ce3067a354d371274def62bcf37a090ca2f3e66800978c68a80e83`.

El gate focal produjo:

`Migración válida: 187 archivos (129 idénticos al origen, 58 cambios posteriores registrados), 2 fixtures.`

### Gate integral

El `npm run validate` posterior terminó con exit code `0`.

Los chequeos posteriores confirmaron:

- `npm run verify:migration`: PASS;
- `git diff --check`: PASS;
- `make governance`: PASS.

No fue necesario modificar código productivo, tests, contratos B1/B2/B3,
SPEC-016-A ni las autoridades estructurales para hacer pasar este gate.

BUG-016-A-044 queda cerrado.
