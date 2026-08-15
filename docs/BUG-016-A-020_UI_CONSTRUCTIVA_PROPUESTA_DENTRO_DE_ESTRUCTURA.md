# BUG-016-A-020 — UI constructiva propuesta dentro de Estructura

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

Durante la planificación de la integración store/UI de SPEC-016-A se propuso inicialmente
incorporar la nueva herramienta al menú `Estructura`.

La SPEC vigente y REQ-UX-005 exigen explícitamente:

`Soluciones constructivas > Escenarios…`

como herramienta separada de `Estructura`.

## Impacto

Si esa propuesta se implementara:

- mezclaría intención/topología estructural con decisiones constructivas;
- rompería la independencia exigida por SPEC-016-A;
- contradiría el criterio de aceptación que exige menús separados.

El hallazgo ocurrió antes de modificar store, App, MenuBar o componentes, por lo que no existe
contract drift productivo.

## Correctiva exigida

La integración debe:

- crear un menú raíz `Soluciones constructivas`;
- incorporar allí `Escenarios…`;
- mantener intactas las herramientas existentes de `Estructura`;
- impedir que componentes de SPEC-015 sean trasladados o duplicados;
- mantener Metalcon/OSB fuera de la nueva herramienta.

## Criterio de cierre

Cerrar sólo cuando tests de componente y revisión visual demuestren que:

- `Soluciones constructivas > Escenarios…` existe;
- `Estructura` permanece independiente;
- no se trasladaron herramientas de la serie 015;
- no aparecen controles Metalcon/OSB;
- la navegación es accesible y funcional.

## Cierre verificado

Cierre validado el 14-ago-2026 sobre FX-008 real y la implementación
vigente de SPEC-016-A.

### Integración y separación de workspaces

Se verificó que:

- existe el menú raíz `Soluciones constructivas`;
- `Escenarios…` se abre desde `Soluciones constructivas`;
- `Estructura` conserva sus herramientas existentes;
- no se trasladaron ni duplicaron herramientas de SPEC-015;
- no aparecen controles Metalcon ni OSB dentro del workspace constructivo;
- el diálogo de escenarios es independiente y accesible.

### Alcance por requirements

La creación de escenarios quedó funcional para los dos contratos permitidos:

- `scope: { mode: 'all' }`;
- `scope: { mode: 'requirements', requirementIds: [...] }`.

Para el alcance por requirements se verificó que:

- las opciones se derivan de `buildConstructiveStructuralWorkspace(model)`
  y de sus `structuralRequirements` vigentes;
- cada checkbox conserva como valor contractual el `requirement.id` canónico;
- cero requirements seleccionados impide crear el escenario;
- los IDs seleccionados se canonicalizan antes de persistir;
- volver a `Todo el alcance` no persiste `requirementIds`;
- no se persisten regiones, descriptores ni referencias de presentación.

### Presentación humana

La UI consume la presentación ya compuesta en:

`requirementWorkspace.proposalWorkspace.visualPresentation`

sin crear una autoridad paralela ni recalcular nombres desde geometría cruda.

En la revisión visual de FX-008 se verificó que requirements que comparten
el mismo muro o región se distinguen mediante contexto humano, incluyendo:

- bordes de cubierta `B1`, `B3`, etc.;
- `Cara +N` y `Cara −N`;
- extremos estructurales;
- relaciones entre elementos;
- destino compacto como `Muro X · 6→7 @ C`.

La referencia técnica completa permanece como identidad contractual, pero
queda subordinada visualmente mediante un token corto del tipo:

`Req · a78e8cc9`

La presentación no modifica lo persistido en el escenario.

### Evidencia automática

Suite afectada posterior al GREEN visual:

- tests: `25`;
- pass: `25`;
- fail: `0`;
- skipped: `0`.

Build de producción:

- `vite build`: PASS;
- `329 modules transformed`;
- build completado correctamente.

La advertencia de Vite por chunks mayores a 600 kB no pertenece al alcance
de BUG-016-A-020 y no bloquea este cierre.

### Fronteras preservadas

Durante la correctiva visual final se preservaron explícitamente:

- `src/store/useModelStore.js`
  - SHA-256:
    `2ca9192c27ce3067a354d371274def62bcf37a090ca2f3e66800978c68a80e83`;
- `tests/constructiveScenariosWorkspace.component.test.jsx`
  - SHA-256:
    `53e4ec78f9abfddc0f80c7c7cf270d97f5421e0c335b1aef82162a972eb16726`.

El diálogo validado quedó en:

- `src/components/modals/ConstructiveScenariosWorkspaceDialog.jsx`
  - SHA-256:
    `6175133b7ea04be7abc26093ce4e76692e9bf24cbef8db7912d5fc669b935351`.

No se modificaron por esta correctiva:

- contratos B1/B2/B3;
- schemas;
- autoridad geométrica;
- `structuralIntent`;
- persistencia de resultados constructivos.

### Revisión humana

La revisión visual en localhost sobre el checkpoint real de FX-008 fue
aprobada el 14-ago-2026.

Se consideró aceptable:

- separación de menús y workspaces;
- legibilidad del selector;
- scroll de las nueve opciones;
- diferenciación humana de requirements concurrentes;
- subordinación de hashes e IDs técnicos;
- conservación de relaciones complejas sin simplificación estructural
  incorrecta.

Con esta evidencia se satisfacen todos los criterios de cierre de
BUG-016-A-020.
