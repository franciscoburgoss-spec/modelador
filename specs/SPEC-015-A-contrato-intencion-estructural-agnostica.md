# SPEC-015-A — Contrato persistente de intención estructural agnóstica

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

El modelo persistente relaciona cada muro con `wallTypeId`. La colección `wallTypes` contiene roles
y parámetros Metalcon/OSB. Esa relación sirve a la solución constructiva actual, pero no puede ser
la autoridad de intención estructural porque:

1. MP1, MP2, MP3 y tabique pertenecen al vocabulario Metalcon vigente;
2. un material o sistema no determina por sí solo la participación estructural prevista;
3. la misma geometría debe permitir varias soluciones constructivas;
4. SPEC-014-B dejó R6–R12 pendientes hasta disponer de una entrada de intención independiente;
5. `agnostic-geometry-v1.0` excluye correctamente tipos, perfiles, materiales y roles constructivos.

La aplicación necesita una autoridad persistente que registre exclusivamente decisiones humanas
sobre la participación prevista de los elementos, sin incorporar soluciones, verificaciones ni
propuestas automáticas.

## Decisión

Crear el contrato `structural-intent-v1.0` como propiedad del archivo nativo del proyecto y elevar
el modelo persistente a `modelVersion: 3`.

La intención:

- referencia elementos y geometrías mediante IDs;
- es editable únicamente mediante acciones explícitas del usuario;
- no forma parte de `agnostic-geometry-v1.0`;
- no se deriva desde Metalcon ni desde la geometría;
- no contiene perfiles, materiales, capacidades ni miembros generados;
- puede quedar incompleta o indeterminada;
- conserva procedencia y revisión.

El archivo nativo v3 incorporará:

```json
{
  "modelVersion": 3,
  "structuralIntent": {
    "schema": "structural-intent-v1.0",
    "elementIntents": [],
    "roofIntents": [],
    "intersectionIntents": [],
    "supportIntents": [],
    "diaphragmIntents": [],
    "overrides": []
  }
}
```

## Base conceptual

La clasificación general usa conceptos de NCh 433:

- estructura resistente;
- elemento secundario;
- diafragma;
- interacción de tabiques solidarios o flotantes.

La intención no declara cumplimiento normativo. Sólo registra qué función espera el usuario que
cumpla una entidad.

## Contrato

### Intención de elemento

```json
{
  "intentId": "intent:element:1784600403613",
  "elementId": 1784600403613,
  "participation": "resistant",
  "functions": [
    "gravityResistance",
    "inPlaneLateralResistance"
  ],
  "secondaryInteraction": "notApplicable",
  "status": "declared",
  "source": "userDeclared",
  "notes": null
}
```

Valores de `participation`:

```text
resistant
secondary
undetermined
```

Valores iniciales de `functions`:

```text
gravityResistance
inPlaneLateralResistance
loadTransfer
diaphragmAction
collectorAction
support
stabilization
spaceDivision
buildingEnvelope
```

Valores de `secondaryInteraction`:

```text
solidary
floating
undetermined
notApplicable
```

Reglas:

1. `resistant` requiere al menos una función resistente.
2. `secondary` puede usar `spaceDivision`, `buildingEnvelope` o `stabilization`.
3. `secondaryInteraction` sólo puede ser `solidary`, `floating` o `undetermined` cuando
   `participation=secondary`.
4. `undetermined` no puede presentarse como error; es una decisión pendiente.
5. `source` sólo registra procedencia. No cambia la autoridad de la decisión.
6. No se almacena `verified`, capacidad o conformidad dentro de la intención.

### Intenciones no implementadas en este corte

Las colecciones `roofIntents`, `intersectionIntents`, `supportIntents` y `diaphragmIntents` se
incluyen vacías para fijar la raíz del contrato. Sus contratos internos se activarán en las SPEC
posteriores correspondientes.

### IDs

Los `intentId` son estables y derivados de la entidad objetivo. No usan fecha, contador global ni
aleatoriedad.

Ejemplo:

```text
intent:element:<elementId>
```

Sólo puede existir una intención vigente por elemento. La historia se registra fuera del objeto
vigente si el proyecto implementa auditoría de cambios.

## Migración v2 → v3

La migración debe:

1. conservar byte a byte los campos constructivos válidos del modelo v2;
2. mantener `wallTypes` y `element.wallTypeId`;
3. añadir la raíz vacía `structuralIntent`;
4. no crear intenciones desde MP1, MP2, MP3, tabique, perfiles u OSB;
5. no analizar geometría para fabricar intenciones;
6. ser determinista e idempotente;
7. conservar la capacidad de abrir y guardar el proyecto.

Resultado obligatorio:

```text
proyecto v2 con Metalcon
  ↓ migración
proyecto v3 con Metalcon intacto + structuralIntent vacío
```

## Mutaciones

Definir operaciones explícitas:

```text
setElementIntent(elementId, intent)
removeElementIntent(elementId)
clearStructuralIntent()
```

Cada mutación debe:

- validar antes de modificar;
- ser atómica;
- registrar los IDs afectados;
- invalidar derivados estructurales posteriores cuando existan;
- no invalidar geometría agnóstica;
- no modificar datos Metalcon.

## División, unión y eliminación

### División de muro

La división no debe copiar silenciosamente la intención como decisión final.

Resultado:

- crear propuestas de herencia para ambos muros nuevos;
- conservar la decisión original en trazabilidad;
- dejar la aceptación de la herencia para SPEC-015-C/D.

Mientras esas SPEC no existan, la división elimina la referencia inválida y produce un finding
persistente `SI-INTENT-REVIEW-AFTER-SPLIT`.

### Unión de muros

- intenciones iguales: puede proponerse conservarla;
- intenciones distintas: la unión debe bloquearse o exigir una decisión previa;
- ausencia de intención: no se inventa una.

### Eliminación

Eliminar un elemento elimina su intención vigente y toda referencia estructural que apunte a él.
La eliminación no modifica soluciones constructivas de otros elementos.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: modifica el contrato persistente, la migración y las autoridades de dominio sin tocar
  todavía topología ni soluciones constructivas.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Guardar `role` directamente en el muro | Mezcla geometría editable e intención ampliable |
| Traducir MP1/MP2/MP3/tabique | Infiere intención desde un sistema constructivo |
| Añadir intención al JSON agnóstico | Mezcla autoridades y altera una frontera ya estable |
| Guardar propuestas dentro de la intención | Una sugerencia no es una decisión del usuario |
| Crear escenarios constructivos en v3 | Pertenece a la serie 016 |

## Alcance

- Definir y validar `structural-intent-v1.0`.
- Incorporar el contrato al modelo nativo v3.
- Implementar migración v2 → v3 sin inferencias.
- Incorporar mutaciones puras y atómicas de intención de elementos.
- Resolver referencias rotas, IDs duplicados y valores inválidos.
- Definir invalidación estructural mínima.
- Mantener intactos el exportador agnóstico y el flujo constructivo actual.
- Probar modelos mínimos, adversarios y el proyecto real.

## Fuera de alcance

- Interfaz de usuario.
- Intención detallada de techumbre.
- Propuestas automáticas.
- Caminos de carga.
- R6–R12 de SPEC-14.
- Escenarios constructivos.
- Migración de `wallTypes`.
- Modulación Metalcon, OSB, DXF o capacidad de corte.
- Inferencia desde ejes o geometría.

## Criterios de aceptación

1. Un modelo v3 válido contiene exactamente una raíz `structuralIntent` con schema y colecciones
   documentadas.
2. La migración de un modelo v2 conserva `wallTypes`, `wallTypeId`, perfiles, OSB y derivados
   persistentes permitidos, y añade intención vacía.
3. Ningún rol o dato Metalcon crea una entrada en `elementIntents`.
4. Crear, actualizar y eliminar una intención válida produce un estado determinista y no modifica
   geometría ni solución constructiva.
5. Referencia inexistente, ID duplicado, combinación inválida de participación/funciones o valor
   desconocido falla antes de mutar el modelo.
6. Reordenar `elementIntents` equivalentes no cambia la serialización canónica.
7. Guardar y reabrir conserva la intención exactamente.
8. `agnostic-geometry-v1.0` emitido antes y después de agregar intención produce los mismos bytes.
9. El proyecto real conserva 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas; la migración no
   altera esos conteos ni sus coordenadas.
10. Una inspección estática demuestra que el módulo no importa `wallTypes.js`, `wallRoles.js`,
    Metalcon, OSB ni módulos de modulación.
11. Una prueba de reversión que traduzca `wallType.role` a intención hace fallar la suite.
12. Pruebas enfocadas, cobertura, build, `npm run validate`, `make governance`,
    `npm run codex:audit` y `git diff --check` pasan.

## Evidencia

- Tests de contrato y migración.
- Fixture v2 con tipos Metalcon y salida v3 exacta.
- Corpus adversario de referencias, IDs y combinaciones inválidas.
- Comparación byte a byte de la exportación agnóstica antes/después.
- Inspección de dependencias prohibidas.
- Aplicación al fixture real.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-015-A.md`.

## Corte sugerido

Detener cuando el modelo v3 pueda persistir intención de elementos sin UI, sin propuestas y sin
conocer ninguna solución constructiva.
