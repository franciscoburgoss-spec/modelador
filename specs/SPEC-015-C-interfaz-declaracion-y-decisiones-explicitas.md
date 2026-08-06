# SPEC-015-C — Interfaz de declaración y decisiones estructurales explícitas

**Estado:** cerrada · 2026-08-06
**Fase:** B — implementación y validación local completadas
**Base declarada por el generador:** `main` · `ef39f2be817128d3731f43b8c89b50a8f719a45d`
**Entrada validada:** 572 archivos · SHA-256 `2d963fa0476b1dd95e92d438bf09c23499a3e63a3451d10009e512f5e3db5ecc`
**Esfuerzo planificado para la Fase B:** `medium`
**Escalamiento `xhigh`:** prohibido

---

## Diagnóstico

### 1.1 Entrada autoritativa recibida

El archivo `modelador_SPEC_015_C_INPUT_2026-08-05.zip` sí contiene el repositorio liviano esperado.
Se verificó:

```text
archivos:  572
bytes ZIP: 1.729.641
SHA-256:  2d963fa0476b1dd95e92d438bf09c23499a3e63a3451d10009e512f5e3db5ecc
unzip -t:  PASS
```

Se preservaron dos copias byte a byte:

```text
SPEC-015-C_INPUT_IMMUTABLE.zip
SPEC-015-C_WORKING.zip
```

Ambas conservan el SHA-256 anterior. El ZIP excluye `.git`, por lo que el commit no puede
recalcularse dentro de la copia extraída. La base `main/ef39f2b` se toma del generador ejecutado por
el usuario, que exigió rama, HEAD y árbol limpio antes de producir el ZIP. El contenido concuerda
con el cierre de SPEC-015-B y el estado esperado.

### 1.2 Estado real confirmado en los 572 archivos

- `governance/STATUS.md` declara SPEC-015-B cerrada y SPEC-015-C pendiente de apertura formal;
- el borrador de SPEC-015-C sigue en planificación y no existe implementación productiva;
- `structural-intent-v1.0` mantiene activas `elementIntents[]` y `roofIntents[]`;
- `intersectionIntents[]`, `supportIntents[]`, `diaphragmIntents[]` y `overrides[]` deben permanecer
  vacíos;
- existen mutaciones unitarias de elementos y cubiertas, pero no mutaciones de lote;
- el store integra cada mutación unitaria mediante una llamada a `withHistory`;
- `withHistory` reconcilia intención después de cambios geométricos;
- la selección global continúa siendo singular y la selección múltiple debe ser local al workspace;
- no existe menú `Estructura`, workspace, registro persistente ni tests de SPEC-015-C;
- `Modal.jsx` no aporta por sí solo semántica de diálogo, Escape, focus trap ni restauración de foco;
- `ElementInventoryModal.jsx` demuestra un patrón de selección local, pero mezcla tipos/roles
  constructivos y sólo sirve como referencia de interacción.

### 1.3 Validaciones aisladas ejecutadas

Sobre la copia de trabajo, sin modificar archivos productivos:

```text
make governance: PASS
22 archivos requeridos / 44 requisitos / 56 decisiones

pruebas Node enfocadas: PASS 39/39
- modelSchema
- nativeProjectFile
- legacyProjectMigration
- structuralIntent
- structuralIntentIntegration
- roofStructuralIntent
- roofStructuralIntentIntegration
- evidencia SPEC-015-B
```

También se ejecutó un validador aislado de Fase A que importó los módulos reales, aplicó el flujo
FX-008 y comprobó atomicidad simulada, roundtrip, bordes y byte identity.

Los tests de componentes no se ejecutaron en este entorno porque `npm ci` recibió HTTP 404 para
`zustand@4.5.7` desde el registry interno. Esto no es un fallo del repositorio ni se declara como
gate aprobado; la validación local del Mac sigue siendo la autoridad final.

### 1.4 Caso real confirmado

El fixture real `tests/fixtures/casa-L-completa-v3.json` declara:

```text
modelVersion: 3
fixture SHA-256: 6cc9e2d1d452c6da26984b23b01a047ca7c9c1465e34e9129caf69784f7b3f09
ejes X:       18
ejes Y:       17
niveles Z:    6
elementos:    77
muros:        45
vanos:        43
fundaciones:  32
cubiertas:    7
```

Su exportación agnóstica permanece:

```text
bytes:   81.875
SHA-256: 966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a
```

## 2. Problema

Después de SPEC-015-A/B existe una autoridad persistente para intención estructural, pero no una
interfaz segura para declararla. La UI vigente de tipos de muro pertenece a una solución
constructiva y no puede reutilizarse como autoridad de intención.

La herramienta nueva debe permitir decisiones manuales sin:

- inferir función desde geometría o `wallType`;
- mezclar Metalcon, OSB, perfiles, materiales o modulación;
- presentar una propuesta futura como declaración vigente;
- fabricar conexiones entre bordes de cubierta y muros;
- crear pasos de historial parciales;
- persistir borradores, errores o referencias rotas;
- confundir `undetermined` con ausencia de declaración.

---

## Decisión

Crear un menú principal separado:

```text
Estructura
├── Intención estructural…
├── Propuestas estructurales… [deshabilitado]
├── Caminos de carga…         [deshabilitado]
└── Topología estructural…    [deshabilitado]
```

En este corte sólo `Intención estructural…` abre una herramienta. Los otros ítems son visibles,
tienen semántica de control deshabilitado y no ejecutan acciones.

La herramienta contiene:

```text
Resumen
Muros y elementos
Techumbre
Encuentros
Diafragmas
Pendientes
Trazabilidad
```

La vista `Trazabilidad` se incorpora como ajuste de Fase A porque el borrador exigía un registro de
cambios, pero no definía dónde revisarlo. No crea una autoridad paralela: muestra el linaje de
ediciones de la autoridad vigente.

---

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: la implementación integra contratos ya existentes con una UI separada, batch atómico,
  trazabilidad y pruebas, sin abrir propuestas, caminos de carga ni colecciones futuras.

---

## 4. Principios e invariantes

### R-015C-01 · Autoridades separadas

La geometría, la intención declarada, la trazabilidad de edición y las soluciones constructivas son
autoridades distintas.

### R-015C-02 · Cero inferencia silenciosa

La UI no propone ni completa valores desde:

- posición;
- contacto;
- fundación;
- cubierta;
- tipo de muro;
- perfiles;
- modulación;
- material;
- resultados de cálculo.

Los valores iniciales de una entidad sin intención son vacíos de formulario, no inferencias.

### R-015C-03 · Declaración explícita

`undetermined` es una declaración válida y persistente. No equivale a `No definido`.

```text
No definido  = no existe intención persistente para el objetivo
undetermined = existe una intención persistente que declara indeterminación
```

### R-015C-04 · Sin verificación resistente

La herramienta no usa “aprobado”, “verificado”, “cumple”, “portante” ni “no estructural” como
resultado de cálculo. Toda pantalla muestra:

> Intención declarada. No constituye verificación de capacidad ni camino de cargas.

### R-015C-05 · Mutación sólo por dominio

React no construye ni escribe directamente `model.structuralIntent` ni
`model.structuralIntentTrace`. El store delega al dominio.

### R-015C-06 · Atomicidad

Toda acción confirmada produce:

- cero cambios, cuando es no-op;
- o una mutación completa;
- un único paso de historial;
- un único evento de trazabilidad;
- cero invalidaciones de derivados constructivos.

Cancelación, error o conflicto producen cero cambios, cero eventos y cero pasos de historial.

### R-015C-07 · Bordes no son muros

Seleccionar, declarar o modificar un borde canónico de cubierta:

- no selecciona un muro;
- no crea intención de muro;
- no modifica intención de muro;
- no crea una relación borde–muro.

### R-015C-08 · Geometría agnóstica byte-identical

La intención y su trazabilidad no forman parte de `agnostic-geometry-v1.0`. El caso FX-008 debe
mantener 81.875 bytes y el SHA-256 indicado en §1.3.

### R-015C-09 · Colecciones futuras inactivas

`intersectionIntents[]`, `supportIntents[]`, `diaphragmIntents[]` y `overrides[]` permanecen vacíos.
La UI no persiste placeholders.

### R-015C-10 · Historial y trazabilidad complementarios

Undo y redo revierten/restauran la mutación y su evento de usuario dentro de la misma instantánea.
El registro persistente describe comandos explícitos del usuario en la rama vigente; las
reconciliaciones automáticas por cambios geométricos continúan documentadas mediante
`structuralIntentFindings` y no fabrican eventos de usuario.

---

---

## 5. Vocabulario visible

### 5.1 Estados

| Estado visible | Condición |
|---|---|
| `Declarado` | existe intención persistente, válida y con objetivo resoluble |
| `No definido` | no existe intención persistente para el objetivo/campo |
| `Inválido` | el borrador abierto viola el contrato; nunca se persiste |
| `Referencia rota` | el objetivo del borrador o una referencia visual desapareció mientras la herramienta estaba abierta |

Prioridad para el estado agregado de una fila:

```text
Referencia rota > Inválido > Declarado > No definido
```

### 5.2 Etiquetas de elementos

Persistencia y etiquetas humanas:

| Valor | Etiqueta |
|---|---|
| `resistant` | Participación resistente prevista |
| `secondary` | Participación secundaria prevista |
| `undetermined` | Participación indeterminada declarada |
| `gravityResistance` | Resistencia gravitacional |
| `inPlaneLateralResistance` | Resistencia lateral en el plano |
| `loadTransfer` | Transferencia de cargas |
| `diaphragmAction` | Acción de diafragma |
| `collectorAction` | Acción de colector |
| `support` | Apoyo |
| `stabilization` | Estabilización |
| `spaceDivision` | División de espacios |
| `buildingEnvelope` | Envolvente del edificio |
| `solidary` | Solidario |
| `floating` | Flotante |
| `undetermined` | Interacción indeterminada |
| `notApplicable` | No aplicable |

La palabra `tabique` no se usa como clasificación de intención porque puede confundirse con roles
constructivos vigentes. Se usa `elemento secundario de división de espacios`.

### 5.3 Reglas activas del contrato

- `resistant` requiere al menos una función resistente;
- `secondary` sólo admite `spaceDivision`, `buildingEnvelope` o `stabilization`;
- `secondary` requiere `solidary`, `floating` o `undetermined`;
- cualquier participación distinta de `secondary` exige `notApplicable`;
- `status` se persiste como `declared`;
- `source` se persiste como `userDeclared`;
- `notes` es texto o `null`.

---

## 6. Arquitectura funcional

### 6.1 Presentador puro

Se define conceptualmente un módulo puro, sin React ni store:

```text
src/core/structuralIntentWorkspace.js
```

Responsabilidades:

```text
buildStructuralIntentWorkspace(model)
buildElementIntentDraft(model, elementId)
buildRoofIntentDraft(model, roofGeometryId)
validateElementDraft(...)
validateRoofDraft(...)
prepareElementIntentBatch(...)
classifyWorkspaceState(...)
mapStructuralIntentIssuesToFields(...)
buildPendingIntentItems(...)
buildStructuralIntentSummary(...)
```

No muta. No importa módulos constructivos. No es una segunda validación de dominio: prepara vistas y
convierte errores tipados a estados de interfaz.

### 6.2 Dominio

Contratos nuevos mínimos:

```text
setElementIntentsBatch(model, elementIds, input, options?)
removeElementIntentsBatch(model, elementIds, options?)
canonicalizeStructuralIntentTrace(trace)
validateStructuralIntentTrace(trace)
fingerprintStructuralIntentTarget(targetType, targetId, intentOrNull)
appendStructuralIntentUserEvent(model, eventInput)
```

Las mutaciones unitarias y de lote deben admitir un contexto explícito de acción de usuario desde
el store. Las llamadas internas sin ese contexto —migración, importación, reconciliación o pruebas
de dominio puras— no fabrican eventos. La UI nunca llama directamente al append de trazabilidad.

### 6.3 Store

Acciones:

```text
setElementIntent(elementId, intent)
removeElementIntent(elementId)
setElementIntentsBatch(elementIds, input, options)
removeElementIntentsBatch(elementIds, options)
setRoofIntent(roofGeometryId, intent)
removeRoofIntent(roofGeometryId)
```

Cada acción llama una vez a `withHistory`. La selección múltiple no se agrega al store.

### 6.4 UI

Corte sugerido, sujeto a simplificación sin alterar responsabilidades:

```text
src/components/modals/StructuralIntentWorkspaceDialog.jsx
src/components/structuralIntent/StructuralIntentSummary.jsx
src/components/structuralIntent/ElementIntentView.jsx
src/components/structuralIntent/ElementIntentBatchConfirm.jsx
src/components/structuralIntent/RoofIntentView.jsx
src/components/structuralIntent/PendingIntentView.jsx
src/components/structuralIntent/StructuralIntentTraceView.jsx
```

Se usa un diálogo dedicado en vez de refactorizar globalmente `Modal.jsx`. Esta decisión reduce el
alcance y evita cambiar el comportamiento de todos los modales existentes.

---

## 7. Navegación macro → micro

### 7.1 Apertura

```text
Estructura
→ Intención estructural…
→ diálogo con foco inicial en Resumen
```

El elemento singular seleccionado en el lienzo puede enfocar su fila al abrir, pero no se añade
automáticamente a la selección masiva.

### 7.2 Resumen

Muestra:

- total de elementos por tipo;
- elementos declarados/no definidos;
- cubiertas declaradas/no definidas;
- declaraciones con `undetermined`;
- pendientes de reconciliación;
- cantidad de operaciones de usuario en la rama vigente;
- advertencia de no verificación.

No muestra porcentajes de cumplimiento.

### 7.3 Profundización

```text
Resumen
→ categoría
→ fila objetivo
→ geometría de referencia
→ declaración vigente
→ borrador
→ revisión de diferencias
→ confirmación
→ mutación
→ estado actualizado
→ trazabilidad
```

### 7.4 Cierre

Cerrar sin borrador pendiente no muta. Cerrar con borrador pendiente abre:

```text
Descartar cambios no guardados
Seguir editando
```

No existe guardado implícito al cerrar, cambiar de pestaña o seleccionar otra fila.

---

## 8. Vista Muros y elementos

### 8.1 Inventario

La vista usa `model.elements[]` como autoridad de IDs y geometría. Permite filtros por:

- tipo geométrico;
- estado;
- texto/ID;
- participación declarada;
- función declarada.

FX-008 muestra 77 elementos; el filtro inicial `Muros` muestra 45.

No lee `wallType`, `role`, perfiles ni campos de solución constructiva.

### 8.2 Selección local

La selección masiva es un `Set` local del workspace, con tokens tipados:

```text
number:1784606313849
string:"1784606313849"
```

Los dos IDs anteriores son distintos. Orden canónico:

```text
`${typeof id}:${String(id)}`
```

Acciones de selección:

```text
Seleccionar fila
Seleccionar visibles
Limpiar selección
```

La selección, filtros y navegación:

- no se persisten;
- no participan de undo/redo;
- no crean trazabilidad;
- se eliminan al cerrar.

### 8.3 Declaración individual

Flujo:

```text
abrir objetivo
→ copiar intención vigente o crear borrador vacío
→ editar campos
→ validar en memoria
→ revisar diff
→ Guardar declaración
```

Botón principal:

```text
Declarar     cuando no existe intención
Guardar cambios cuando existe
```

Una declaración idéntica a la vigente es un no-op: no crea historia ni evento.

### 8.4 Eliminación individual

```text
Eliminar declaración
→ confirmar objetivo y resumen
→ eliminar
```

La geometría no se elimina. Un objetivo sin intención produce no-op.

### 8.5 Validación en campo

Los errores tipados se asocian por `details[].path`. Ejemplos:

| Código | Campo |
|---|---|
| `SI-RESISTANT-FUNCTION-REQUIRED` | Funciones |
| `SI-SECONDARY-FUNCTION-NOT-ALLOWED` | Funciones |
| `SI-SECONDARY-INTERACTION-REQUIRED` | Interacción secundaria |
| `SI-SECONDARY-INTERACTION-NOT-APPLICABLE` | Interacción secundaria |
| `SI-ELEMENT-REFERENCE-NOT-FOUND` | Objetivo / referencia rota |

El resumen de errores tiene `role="alert"` y enlaza al primer campo inválido.

---

## 9. Asignación masiva

### 9.1 Contrato de entrada

```js
setElementIntentsBatch(
  model,
  elementIds,
  {
    participation,
    functions,
    secondaryInteraction,
    notesMode, // "preserve" | "replace"
    notes      // texto o null cuando notesMode="replace"
  },
  {
    expectedPrevious: [
      { elementId, fingerprint }
    ]
  }
)
```

Reglas:

1. `elementIds` debe ser no vacío.
2. IDs numéricos y de texto se conservan tipados.
3. Duplicados tipados se rechazan; no se eliminan silenciosamente.
4. Todos los objetivos deben existir.
5. Se construyen todos los candidatos antes de mutar.
6. Todos los candidatos se validan contra el mismo modelo original.
7. `notesMode="preserve"` conserva notas de declaraciones existentes y usa `null` en objetivos
   todavía no declarados.
8. Los demás campos se reemplazan completamente.
9. Los cambios efectivos se ordenan canónicamente.
10. Si no hay cambios efectivos, el resultado es no-op.

### 9.2 Preparación y fingerprint de previsualización

`prepareElementIntentBatch` devuelve:

```json
{
  "selection": [],
  "previousGroups": [],
  "nextDeclaration": {},
  "effectiveChanges": [],
  "conflicts": [],
  "expectedPrevious": [],
  "canConfirm": true
}
```

`expectedPrevious` evita confirmar una previsualización obsoleta. El dominio vuelve a calcular el
fingerprint de cada objetivo justo antes de mutar.

### 9.3 Diferencia versus conflicto

No son conflictos:

- que los objetivos tengan valores anteriores distintos;
- que unos tengan declaración y otros no;
- que las notas se preserven individualmente.

Son conflictos bloqueantes:

```text
SI-BATCH-DUPLICATE-TARGET
SI-BATCH-TARGET-NOT-FOUND
SI-BATCH-CANDIDATE-INVALID
SI-BATCH-PREVIEW-STALE
```

### 9.4 Confirmación

La confirmación muestra:

- cantidad seleccionada;
- cantidad con cambio efectivo;
- IDs ordenados;
- valores anteriores agrupados;
- declaración nueva;
- política de notas;
- conflictos;
- texto “se creará un solo paso de historial”.

Botones:

```text
Cancelar
Confirmar asignación a N elementos
```

Cancelar o conflicto deja el modelo exacto.

### 9.5 Resultado

```json
{
  "model": {},
  "affectedElementIds": [],
  "affectedRoofGeometryIds": [],
  "invalidatedStructuralDerivatives": [],
  "conflicts": []
}
```

El store ejecuta una única llamada a `withHistory`.

---

## 10. Vista Techumbre

### 10.1 Fuente

La lista consume exclusivamente:

```text
projectAgnosticGeometry(model).roofGeometry
```

o la proyección selectiva equivalente ya implementada.

FX-008 lista exactamente siete IDs:

```text
1785030887081
1785158713616
1785161146258
1785161198226
1785161271814
1785161396221
1785161662029
```

### 10.2 Geometría visible

Para cada cubierta:

- ID;
- polígono XY;
- rango Z;
- número de vértices;
- bordes canónicos;
- dirección canónica de cada borde;
- intención vigente.

El rótulo humano `B1…Bn` sigue el recorrido del polígono sólo para visualizar. No se persiste ni
reemplaza `boundaryId`. La lista persistente sigue ordenada por `boundaryId`.

### 10.3 Distribución y direcciones

| Distribución | Reglas |
|---|---|
| `oneWay` | requiere dirección primaria; secundaria `null` |
| `twoWay` | requiere primaria y secundaria no paralelas |
| `local` | primaria y secundaria `null` |
| `undetermined` | primaria y secundaria `null` |

`v` y `-v` se muestran canónicamente iguales.

### 10.4 Diafragma de cubierta

Valores disponibles:

```text
intended
notIntended
candidate
undetermined
```

`candidate` se muestra como `Candidato declarado`, acompañado de la advertencia de que no es una
propuesta automática ni verificación.

Esta edición pertenece a `roofIntents[].diaphragmBehavior`. No activa ni escribe
`diaphragmIntents[]`.

### 10.5 Bordes

Funciones:

```text
gravitySupport
lateralSupport
gravityAndLateralSupport
geometricBoundary
gutterSupport
nonStructuralBoundary
undetermined
```

Un borde no declarado se muestra `No definido`. No se exige declarar todos los bordes para guardar
una intención válida si el dominio acepta una lista parcial.

### 10.6 Guardado y eliminación

Crear, modificar o eliminar una intención de cubierta sigue las mismas reglas atómicas y de
trazabilidad que un elemento.

Un borde ajeno al polígono vigente bloquea el guardado. Una selección visual de borde jamás escribe
en `elementIntents[]`.

---

## 11. Vistas inactivas y Pendientes

### 11.1 Encuentros

Vista informativa:

```text
Edición no disponible en SPEC-015-C.
intersectionIntents[] permanece vacío.
```

Puede mostrar conteos geométricos o findings ya existentes, pero no un formulario.

### 11.2 Diafragmas

Vista informativa:

```text
La colección diaphragmIntents[] no está activa.
En este corte sólo puede declararse diaphragmBehavior dentro de roofIntents[].
```

### 11.3 Pendientes

Agrega, sin fabricar obligación:

- `structuralIntentFindings` existentes;
- intenciones explícitas con `undetermined`;
- bordes no definidos;
- borradores con referencia rota;
- capacidades de contrato todavía inactivas;
- transferencias no declarables en este corte.

`No definido` no se convierte automáticamente en error. La vista distingue:

```text
informativo
requiere revisión
bloquea este guardado
fuera del corte
```

---

## 12. Referencia rota

### 12.1 Condición productiva

El proyecto nativo válido no persiste referencias rotas. El estado aparece sólo cuando:

1. un formulario sigue abierto y su elemento/cubierta desaparece o cambia de identidad;
2. un borde seleccionado desaparece tras reconciliación geométrica;
3. una previsualización de lote queda obsoleta;
4. un finding vigente exige revisar una referencia que cambió.

### 12.2 Comportamiento

```text
estado = Referencia rota
Guardar = deshabilitado
```

Acciones:

```text
Recargar desde el modelo
Descartar borrador
Ir a Pendientes
```

No se relaja el schema ni se persiste el borrador roto.

### 12.3 Pruebas

Se cubre con:

- un presentador puro sobre fixture stale;
- reconciliación de borde/finding real;
- cambio del modelo mientras el diálogo permanece abierto.

---

## 13. Trazabilidad persistente

### 13.1 Ubicación y opcionalidad

Se agrega un campo superior opcional del proyecto nativo:

```json
{
  "structuralIntentTrace": {
    "schema": "structural-intent-trace-v1.0",
    "events": []
  }
}
```

No se añade dentro de `structuralIntent`, porque su allowlist es estricta. El campo permanece
**ausente** mientras no exista una mutación efectiva del usuario. Importar, migrar, abrir o volver a
guardar un proyecto sin trazabilidad no materializa un contenedor vacío.

### 13.2 Compatibilidad y versión

`modelVersion` permanece en `3`.

La decisión queda respaldada por el repositorio real:

- `prepareModelImport` conserva campos superiores aditivos;
- `serializeNativeProject` preserva byte-semánticamente un `structuralIntentTrace` opcional;
- el roundtrip v3 aislado conservó el registro completo;
- el roundtrip de un proyecto sin registro mantuvo el campo ausente;
- la trazabilidad no es autoridad geométrica ni reemplaza `structuralIntent`.

La Fase B debe agregar validación/canonicalización explícita cuando el campo exista, sin inventarlo
cuando falte. Un cambio futuro que convierta el registro en una autoridad causal completa o exija
compatibilidad incompatible con v3 deberá abrir otra decisión y otra versión; no se ampliará en
silencio dentro de este corte.

### 13.3 Evento de usuario

```json
{
  "sequence": 3,
  "action": "structuralIntentUpdated",
  "operation": "batchSet",
  "targetType": "element",
  "changes": [
    {
      "targetType": "element",
      "targetId": 1784751397992,
      "changeKind": "created",
      "previousFingerprint": "64 hex",
      "nextFingerprint": "64 hex"
    }
  ],
  "source": "userAction"
}
```

Reglas:

- `sequence` comienza en 1 y es contiguo dentro de la rama vigente;
- no hay timestamp, UUID ni dato aleatorio;
- `action` es siempre `structuralIntentUpdated`;
- `operation` pertenece a `set | remove | batchSet | batchRemove`;
- `targetType` pertenece a `element | roof`;
- cada cambio repite su tipo para que el envelope del fingerprint sea autosuficiente;
- `changes[]` contiene sólo cambios efectivos y se ordena por tipo de ID e ID;
- `source` es siempre `userAction` en esta versión.

`clearStructuralIntent()` no es una acción expuesta por el workspace de SPEC-015-C. Si se usa como
reset administrativo, elimina intención, findings y trace; no crea un evento autorreferente.

### 13.4 Fingerprint exacto

1. Canonicalizar la intención objetivo con el canonicalizador del dominio.
2. Construir exactamente, en este orden de claves:

```json
{
  "targetType": "element",
  "targetId": 1784606313849,
  "intent": {}
}
```

3. Para ausencia usar `"intent": null`.
4. Serializar mediante `JSON.stringify` sin espacios ni newline.
5. Codificar UTF-8.
6. Calcular SHA-256.
7. Emitir 64 caracteres hexadecimales minúsculos.

El fingerprint no incluye geometría, registro, history, selección, UI ni datos constructivos.

### 13.5 Acciones registradas

| Acción efectiva del workspace | Evento |
|---|---|
| crear o modificar intención individual | `set` + `created|modified` |
| eliminar intención individual | `remove` + `removed` |
| asignar lote | `batchSet` |
| eliminar declaraciones del lote | `batchRemove` |

No registran:

- abrir/cerrar;
- selección y filtros;
- previsualizaciones;
- borradores inválidos;
- cancelación y no-op;
- importación o migración;
- reconciliación geométrica automática;
- undo/redo como acción nueva.

Las reconciliaciones automáticas permanecen visibles en `Pendientes` mediante
`structuralIntentFindings`; la vista Trazabilidad presenta ambos canales sin mezclarlos.

### 13.6 Canonicalización y validación

- ausencia del campo es válida y se preserva;
- si existe, `schema` y `events[]` son obligatorios;
- las secuencias deben ser exactamente `1..N`;
- fingerprints deben ser SHA-256 hex minúsculo;
- cada evento debe contener al menos un cambio efectivo;
- no se permiten campos desconocidos;
- no se exige reconstruir toda la autoridad vigente desde el log, porque las reconciliaciones se
  trazan en findings y pueden modificarla sin evento de usuario;
- save/reopen conserva igualdad profunda y orden canónico.

### 13.7 Semántica de undo/redo

La mutación y el evento viven en la misma instantánea:

```text
confirmar → estado S1 + evento E1
undo      → estado S0 sin E1
redo      → estado S1 con E1
```

Después de undo y una nueva edición se descarta la rama redo; la siguiente secuencia se deriva del
último evento que siga vigente. Los findings creados por reconciliación siguen la misma semántica de
instantáneas, aunque no pertenezcan al registro de comandos del usuario.

## 14. Errores, concurrencia y no-op

### 14.1 Error de dominio

El dominio valida antes de mutar. La UI:

- muestra mensaje general;
- asocia detalles a campos;
- mantiene el borrador;
- no crea historia ni evento.

### 14.2 Modelo cambiado con el diálogo abierto

Toda edición conserva fingerprints previos. Antes de guardar:

- si coinciden, continúa;
- si no coinciden, marca `Referencia rota` o `previsualización obsoleta`;
- exige recargar y revisar.

### 14.3 No-op

Guardar bytes canónicos equivalentes a la intención vigente devuelve el modelo original y no crea
un paso de historial.

### 14.4 Fallo inesperado

Se muestra un banner no destructivo con código disponible. No se sustituye por datos por defecto.

---

## 15. Historial y navegación

| Acción | Historial | Trazabilidad |
|---|---:|---:|
| seleccionar pestaña | no | no |
| seleccionar fila | no | no |
| seleccionar lote | no | no |
| editar borrador | no | no |
| cancelar | no | no |
| guardar individual efectivo | 1 | 1 |
| eliminar individual efectivo | 1 | 1 |
| confirmar lote efectivo | 1 | 1 |
| eliminar lote efectivo | 1 | 1 |
| undo | revierte 1 | revierte evento asociado |
| redo | restaura 1 | restaura evento asociado |

Al ejecutar undo/redo con un borrador abierto:

- la vista se rehidrata desde el store;
- el borrador se marca obsoleto;
- la selección local puede conservarse;
- cualquier confirmación de lote abierta se invalida.

---

## 16. Accesibilidad y teclado

El workspace usa un diálogo dedicado con:

```text
role="dialog"
aria-modal="true"
aria-labelledby="<id del título>"
```

Requisitos:

1. el botón de cierre tiene nombre accesible;
2. `Escape` solicita cierre y respeta borradores pendientes;
3. el foco inicial queda en la pestaña activa o el encabezado;
4. el foco queda atrapado dentro del diálogo;
5. al cerrar se restaura al ítem `Intención estructural…`;
6. pestañas usan `role="tablist"`, `tab`, `tabpanel`;
7. `ArrowLeft`, `ArrowRight`, `Home`, `End` navegan pestañas;
8. listas y tablas son operables sin mouse;
9. el estado no depende sólo del color;
10. controles deshabilitados usan semántica nativa y explicación visible;
11. confirmaciones reciben foco y lo devuelven al control de origen;
12. mensajes de error relevantes usan `role="alert"`.

No se endurece globalmente `Modal.jsx` en este corte salvo que una prueba demuestre que el diálogo
dedicado no puede cumplir el contrato. Ese caso sería una contradicción material.

---

## 17. Independencia constructiva

El grafo recursivo iniciado en el workspace y su presentador no puede importar ni consumir:

```text
wallTypes.js
WallTypesModal.jsx
batchModulation.js
MetalconModulationModal.jsx
OsbModulationModal.jsx
OsbNestingModal.jsx
build3d.js
exportFramingDxf.js
exportOsbDxf.js
metalconProfiles
materials
studs
headers
osbCourses
```

Tampoco pueden aparecer en el workspace como etiquetas funcionales:

```text
Metalcon
OSB
MP1
MP2
MP3
perfil
montante
solera
```

El test de grafo comienza en el nuevo workspace/presentador, no en `MenuBar.jsx`, porque el menú
general ya integra herramientas de otros dominios.

Una prueba de reversión introduce temporalmente una importación prohibida y debe fallar.

---

## 18. Aplicación obligatoria a FX-008

### 18.1 Ajuste de contradicción del borrador

El borrador decía simultáneamente:

```text
dejar la participación del frontón en undetermined
comprobar que el frontón continúa sin intención
```

Esto es imposible por R-015C-03. El flujo aprobado para implementar será:

- el frontón queda `No definido`, sin guardado;
- `undetermined` se prueba aparte como una declaración válida.

### 18.2 Objetivos reales

| Uso | ID |
|---|---:|
| muro de frontón que queda sin intención | `1784819708086` |
| muro interior resistente lateral | `1784606313849` |
| prueba aislada de declaración `undetermined` | `1784818076062` |
| secundarios de lote | `1784751397992`, `1784752583321`, `1784752639636` |
| secundario modificado a flotante | `1784752583321` |
| cubierta | `1785030887081` |

### 18.3 Flujo macro → micro

1. Abrir `Estructura > Intención estructural…`.
2. Revisar Resumen: 77 elementos —45 muros y 32 fundaciones—, 7 cubiertas y cero declaraciones.
3. Abrir el frontón `1784819708086`.
4. Observar geometría; no guardar. Estado final: `No definido`.
5. En una prueba aislada del presentador/dominio, declarar `1784818076062` como `undetermined` y
   comprobar que existe una intención válida; esta prueba no integra el estado final demostrado.
6. Abrir la cubierta `1785030887081`.
7. Declarar:
   - `loadDistribution=oneWay`;
   - primaria `{x:0,y:1}`;
   - secundaria `null`;
   - `diaphragmBehavior=candidate`;
   - funciones explícitas de B1…B6 según §18.4.
8. Confirmar que el frontón sigue sin intención.
9. Abrir el muro interior `1784606313849`.
10. Declarar `resistant` + `inPlaneLateralResistance`.
11. Confirmar que no se creó relación con cubierta.
12. Mostrar en Pendientes que la transferencia sigue fuera del corte.
13. Seleccionar tres elementos secundarios.
14. Previsualizar asignación masiva:
    - `secondary`;
    - `spaceDivision`;
    - `solidary`;
    - preservar notas.
15. Confirmar una sola operación.
16. Modificar `1784752583321` de `solidary` a `floating`.
17. Revisar cuatro eventos de usuario en la rama vigente.
18. Undo revierte sólo la modificación a flotante y elimina su evento.
19. Redo restaura modificación y evento.
20. Guardar/reabrir: declaraciones y trace se reproducen.
21. Exportar geometría agnóstica: bytes y hash permanecen idénticos.

### 18.4 Cubierta y bordes reales

La etiqueta Bn es visual. El `boundaryId` completo es la autoridad.

| Etiqueta | Función demostrativa declarada |
|---|---|
| B1 | `gutterSupport` |
| B2 | `geometricBoundary` |
| B3 | `gravitySupport` |
| B4 | `geometricBoundary` |
| B5 | `gravitySupport` |
| B6 | `lateralSupport` |

Estas funciones son decisiones de la demostración, no inferencias geométricas ni una validación
ingenieril.

### 18.5 Resultado final esperado

```text
frontón sin intención: 1
elementos declarados:  4
cubiertas declaradas:  1
eventos de usuario:    4
intersectionIntents:   0
supportIntents:        0
diaphragmIntents:      0
overrides:             0
```

---

## 19. Pruebas obligatorias de Fase B

### 19.1 Menú e integración

1. aparece `Estructura`;
2. `Intención estructural…` abre;
3. tres ítems futuros están deshabilitados;
4. abrir/cerrar sin cambios conserva el modelo.

### 19.2 Elementos

5. inventario no infiere desde `wallType`;
6. crear individual;
7. modificar individual;
8. eliminar individual;
9. `undetermined` persiste como declaración;
10. combinación inválida no guarda;
11. muro interior puede declararse lateral;
12. secundario cambia `solidary → floating`;
13. no-op no crea historia/evento.

### 19.3 Lote

14. selección múltiple local;
15. IDs tipados y ordenados;
16. duplicado se rechaza;
17. resumen anterior/nuevo;
18. preservar/reemplazar notas;
19. confirmación explícita;
20. cancelación cero cambios;
21. candidato inválido cero cambios;
22. preview stale cero cambios;
23. lote válido un paso;
24. lote válido un evento;
25. undo/redo del lote completo;
26. eliminación masiva atómica.

### 19.4 Techumbre

27. siete cubiertas FX-008;
28. polígono y B1…Bn;
29. `boundaryId` completo consultable;
30. crear/modificar/eliminar;
31. combinaciones de distribución;
32. `v`/`-v`;
33. borde ajeno se rechaza;
34. seleccionar borde no modifica muros;
35. finding de borde desaparecido;
36. cambio constructivo sin cambio agnóstico no altera vista.

### 19.5 Estados

37. Declarado;
38. No definido;
39. Inválido;
40. Referencia rota por borrador stale;
41. prioridad de estados;
42. no usa aprobado/verificado;
43. error se asocia a campo;
44. no persiste borrador inválido.

### 19.6 Trazabilidad

45. schema vacío por defecto;
46. crear/modificar/eliminar;
47. lote mixto;
48. fingerprints deterministas;
49. orden de secuencia;
50. no-op sin evento;
51. cancelar sin evento;
52. importación/migración sin eventos;
53. reconciliación usa findings, no evento de usuario;
54. undo elimina evento;
55. redo restaura;
56. branch después de undo;
57. roundtrip conserva;
58. evento inválido se rechaza.

### 19.7 Accesibilidad

59. diálogo nombrado;
60. close nombrado;
61. Escape;
62. trap;
63. foco inicial/restaurado;
64. teclado de tabs;
65. confirmación accesible;
66. disabled anunciado;
67. error alert.

### 19.8 Independencia

68. grafo sin imports prohibidos;
69. textos constructivos ausentes;
70. prueba de reversión.

### 19.9 Persistencia e identidad

71. v3 sin trace abre con trace vacío;
72. v3 con trace reabre igual;
73. native/web copy conservan;
74. agnostic geometry byte-identical;
75. navegación no entra al modelo.

### 19.10 Evidencia

76. generador reproducible;
77. HTML/JSON/manifest byte-identical;
78. flujo FX-008;
79. casos de error;
80. advertencia de no verificación.

---

## Criterios de aceptación

1. La herramienta es una autoridad de edición independiente de soluciones constructivas.
2. Toda intención disponible de elementos y techumbre puede crearse, modificarse y eliminarse.
3. Las mutaciones de lote son atómicas, confirmadas y de un paso de historial.
4. `undetermined` y `No definido` son visual y persistentemente distintos.
5. Techumbre usa polígonos y bordes canónicos; nunca modifica muros por selección de borde.
6. `Referencia rota` tiene una causa productiva definida y nunca se persiste.
7. Las vistas inactivas no crean contratos falsos.
8. El registro persistente es determinista, sigue el linaje de undo/redo y no sustituye la
   intención vigente.
9. `modelVersion` sigue en 3 salvo contradicción material aprobada.
10. FX-008 reproduce el flujo exacto de §18.
11. La geometría agnóstica mantiene bytes y SHA-256.
12. La accesibilidad definida se prueba por teclado.
13. La independencia se comprueba recursivamente y mediante reversión.
14. La evidencia no se presenta como cálculo ni verificación resistente.
15. Todos los gates realmente ejecutados se reportan con sus resultados; la validación Mac es final.

---

## Alcance

- menú `Estructura`;
- workspace independiente;
- resumen;
- elementos individual;
- elementos en lote;
- techumbre y bordes;
- estados;
- pendientes;
- trazabilidad persistente;
- undo/redo;
- reapertura;
- accesibilidad;
- independencia constructiva;
- tests y evidencia FX-008.

---

## Fuera de alcance

- propuestas;
- aceptación/rechazo de propuestas;
- caminos de carga;
- verificación de capacidad;
- R6–R12;
- edición de `intersectionIntents[]`;
- edición de `supportIntents[]`;
- edición de `diaphragmIntents[]`;
- edición de `overrides[]`;
- menú Soluciones constructivas;
- refactor general de tipos de muro;
- perfiles, materiales, Metalcon, OSB o modulación;
- clasificación automática;
- relación borde–muro;
- solución F-009;
- arreglo de R-017 sin bloqueo probado y BUG previo;
- cambios visuales generales;
- bitácora forense de acciones deshechas.

---

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| reutilizar modal de tipos de muro | mezcla intención y solución |
| selección múltiple global | amplía el store y cambia el lienzo sin necesidad |
| guardar al cambiar un selector | impide revisar, confirmar y cancelar |
| batch mediante llamadas unitarias | crea historia/eventos parciales |
| deduplicar IDs silenciosamente | oculta un error del llamador |
| interpretar diferencias previas como conflicto | impediría lotes legítimos |
| persistir `invalid`/`brokenReference` | degrada el schema válido |
| usar timestamps en trace | rompe determinismo sin aportar orden necesario |
| evento compensatorio por undo | duplica semántica y no refleja instantáneas |
| trace dentro de `structuralIntent` | rompe su allowlist y mezcla autoridad con linaje |
| modificar globalmente `Modal.jsx` | amplía regresión fuera del corte |
| llamar “tabique” al secundario | puede confundirse con rol constructivo |
| tratar `undetermined` como vacío | pierde una decisión explícita |

---

## 24. Hallazgos y ajustes de Fase A

### H-015C-A-01 · Entrada correcta y baseline reproducible

El segundo ZIP sí contiene los 572 archivos del repositorio y coincide con el estado esperado de
SPEC-015-B. Se elimina la limitación de la primera entrega basada sólo en el paquete de inicio.

### H-015C-A-02 · `undetermined` no equivale a ausencia

El frontón del flujo queda `No definido`, sin guardar. La validez persistente de `undetermined` se
demuestra por separado con el dominio real y con sus tests.

### H-015C-A-03 · Lote requiere una transacción, no varias acciones del store

Las APIs actuales son unitarias. El corte necesita mutadores batch puros, prevalidación total,
comparación stale y una única llamada a `withHistory`.

### H-015C-A-04 · No-op efectivo no existe todavía para `set`

Los setters unitarios actuales producen un modelo nuevo aunque la declaración canónica sea igual.
La Fase B debe detectar igualdad antes de añadir trace o historial.

### H-015C-A-05 · El orden canónico de bordes no es orden gráfico

`canonicalizeRoofBoundaries()` ordena por `boundaryId`. Para mostrar B1…Bn siguiendo el polígono,
el presentador debe recorrer `surface.boundary` y vincular cada tramo con su `boundaryId` canónico.
La etiqueta Bn nunca se persiste ni sustituye al ID.

### H-015C-A-06 · Trazabilidad opcional compatible con v3

El roundtrip real conserva un campo superior aditivo y mantiene ausente el campo cuando no existe.
Se ajusta la SPEC: el registro no se materializa vacío y nace sólo con la primera mutación efectiva.

### H-015C-A-07 · Eventos de usuario y reconciliación son canales distintos

Las reconciliaciones vigentes ya producen `structuralIntentFindings`. El trace registra comandos
del usuario; Pendientes/Trazabilidad muestran ambos sin fabricar eventos durante cambios
geométricos, importación o migración.

### H-015C-A-08 · `Referencia rota` es un estado transitorio real

Puede aparecer si el objetivo del borrador desaparece por undo, eliminación o reconciliación
mientras el workspace está abierto. No se relaja el schema para persistirla.

### H-015C-A-09 · Diafragma de cubierta no habilita diafragmas globales

Sólo `roofIntents[].diaphragmBehavior` es editable. `diaphragmIntents[]` permanece vacío e
informativo.

### H-015C-A-10 · El modal genérico no cubre accesibilidad del corte

Se mantiene un diálogo dedicado con nombre accesible, Escape, focus trap, foco inicial y
restauración. No se refactoriza globalmente `Modal.jsx`.

### H-015C-A-11 · Diferencia previa no es conflicto de lote

Heterogeneidad, ausencia y notas distintas se resumen en la confirmación. Sólo duplicado, objetivo
inexistente, candidato inválido o preview stale bloquean.

### H-015C-A-12 · Componentes pendientes de la autoridad local

El entorno de análisis no pudo instalar `zustand@4.5.7` por un 404 del registry interno. No se
oculta la limitación ni se declara el gate de componentes; debe ejecutarse en la validación local de
Fase B.

## Evidencia

Artefactos aislados, no integrados al producto:

```text
SPEC-015-C_COMPLETA_FASE_A_REPO_VALIDADA.md
FX-008-SPEC-015-C-PROTOTIPO-REPO-VALIDADO.html
SPEC-015-C_REPO_VALIDATION.json
SPEC-015-C_DIAGNOSTICO_HALLAZGOS_REPO.md
SPEC-015-C_VALIDACION_REPO_FASE_A.md
SPEC-015-C_FASE_A_REPO_SHA256.txt
```

La evidencia muestra navegación, declaración individual, lote, confirmación, techumbre, bordes,
estados, errores, trace, findings, undo/redo y reapertura, sin presentarse como verificación
resistente.

## 25. Validación contra ZIP real

Resultado ejecutado sobre la copia de trabajo:

```text
ZIP y copia inmutable: SHA-256 coincidente
unzip -t: PASS
inventario: 572 archivos
make governance baseline: PASS 22/44/56
pruebas Node enfocadas: PASS 39/39
FX-008: 45 muros / 43 vanos / 32 fundaciones / 7 cubiertas
flujo de dominio: PASS
cubierta 1785030887081: 6/6 bordes reales vinculados
lote inválido simulado: cero cambio al modelo original
roundtrip v3 con trace opcional: preservado
roundtrip v3 sin trace: campo sigue ausente
agnostic geometry: byte-identical 81.875 bytes
SHA-256: 966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a
```

No se modificaron `src/`, `tests/`, `governance/STATUS.md`, schema, store ni componentes. No se
abrió formalmente la SPEC. `make governance` se ejecutó sólo sobre el baseline cerrado; deberá
repetirse después de la apertura formal de Fase B.

## 26. Apertura formal de Fase B

El usuario aprobó explícitamente esta versión el 06-ago-2026 mediante la instrucción:

> Apruebo SPEC-015-C Fase A validada contra el repositorio. Comienza la Fase B.

La implementación queda autorizada únicamente después de actualizar `governance/STATUS.md` y
ejecutar `make governance` sobre esta SPEC activa. El alcance aprobado permanece inmutable durante
la sesión.

Si la implementación descubre una contradicción material —incluido que `modelVersion: 3` no pueda
admitir la extensión de trace— se documentará y se detendrá ese cambio hasta nueva aprobación.

---


## 27. Implementación de Fase B preparada para validación local

El corte aprobado quedó implementado en una copia de trabajo derivada del ZIP inmutable. Se añadieron:

- `structuralIntentTrace-v1.0` opcional, validado y canonicalizado sin cambiar `modelVersion: 3`;
- detección de no-op y mutaciones `set/remove` unitarias con evento sólo para acciones efectivas;
- `setElementIntentsBatch` y `removeElementIntentsBatch` con IDs tipados, validación total,
  fingerprints de previsualización y una única transacción;
- acciones del store que delegan al dominio y crean cero o un paso de historial;
- presentador puro `structuralIntentWorkspace.js`;
- menú principal `Estructura` y diálogo dedicado con resumen, elementos, lote, techumbre, vistas
  inactivas, pendientes y trazabilidad;
- semántica accesible de diálogo, Escape, focus trap, restauración de foco y tabs por teclado;
- auditor recursivo de independencia con frontera explícita en el store compartido y prueba de
  reversión;
- evidencia reproducible HTML/JSON/manifiesto para FX-008.

Validaciones ejecutadas en el entorno de preparación:

```text
make governance de apertura: PASS 22/44/56
make governance final de implementación: PASS 22/46/57
format:check: PASS · 509 archivos de texto
node --check: PASS · 238 archivos JS/MJS
pruebas puras enfocadas SPEC-015-A/B/C: PASS 36/36
suite Node sin dependencias externas: PASS 808/808 en 102 archivos
laboratorio de techumbre: PASS 35/35
goldens semánticos: PASS 19 artefactos
independencia recursiva y reversión: PASS · 17 módulos
evidencia FX-008: PASS · 4 elementos / 1 cubierta / 4 eventos
contrato de derivados: PASS · 14 exportadores / 14 mutadores
manifiesto de migración: PASS · 187 archivos / 57 cambios registrados
auditoría Codex: PASS · 11 completas / 2 fallidas recuperadas
agnostic geometry: 81.875 bytes / SHA-256 966c0f25...f24a / byte-identical
```

No se declaran aprobados en este entorno:

- tests Zustand/React, lint y build: `npm ci` no pudo obtener `zustand@4.5.7` desde el registry
  disponible;
- formato, pruebas y check Rust/Tauri: `cargo` no está instalado en el entorno de preparación;
- inventario de artefactos y `git diff --check`: el ZIP no contiene `.git`;
- auditoría DXF y smoke CalculiX: requieren los entornos externos gobernados del Mac.

El validador único entregado debe ejecutar estos gates sobre el repositorio local y constituye la
autoridad final.

La SPEC permaneció activa hasta obtener la validación local autoritativa. No se ejecutó `git add`,
commit ni push.

---

## 28. Cierre local autoritativo

El 06-ago-2026 el usuario ejecutó el validador único sobre el repositorio local aplicado en
`/Volumes/MEM EXT/Developer/modelador`. La ejecución aprobó los 25 gates previstos:

```text
PASS - SPEC-015-C · 25/25 gates aprobados
Logs: /Volumes/MEM EXT/Developer/modelador/artifacts/validation-spec-015-c/20260806-084630
No se ejecutó git add, commit ni push.
```

La validación confirma en el Mac autoritativo:

- preflight Git, Node/npm y dependencias;
- gobernanza y evidencia reproducible;
- formato JavaScript y Rust, ESLint, tests Node/componentes y Rust;
- Tauri, laboratorio de techumbre y cobertura core/store;
- goldens, auditoría DXF, smoke CalculiX y build Vite;
- manifiesto de migración, inventario de artefactos y contrato de derivados;
- auditoría Codex, byte identity, independencia constructiva y `git diff --check`.

La geometría agnóstica permanece byte-identical con 81.875 bytes y SHA-256
`966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a`. La evidencia FX-008
mantiene 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas, con 4 declaraciones de elemento,
1 declaración de cubierta y 4 eventos vigentes.

El cierre inmutable se registra en `sessions/close-SPEC-015-C.md`. SPEC-015-D queda pendiente de
apertura formal. F-009 permanece fuera de alcance y SPEC-08 continúa deshabilitada hasta completar
R12 sin errores.

---

## Corte final

SPEC-015-C queda cerrada con esfuerzo `medium` planificado y efectivo, sin escalamiento. No se
abre SPEC-015-D ni se ejecuta Git como parte de este cierre documental.
