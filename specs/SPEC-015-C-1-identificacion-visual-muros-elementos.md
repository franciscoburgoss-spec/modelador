# SPEC-015-C-1 — Identificación visual de muros y elementos

**Estado:** Cerrada el 06-ago-2026 después de validación local autoritativa
**Fecha:** 2026-08-06
**Posición:** correctiva independiente después de SPEC-015-C y antes de SPEC-015-D
**Baseline declarado:** `main` · `961782f` · `Implementa y cierra SPEC-015-C`
**Baseline verificable dentro del ZIP:** 589 archivos; `governance/STATUS.md` declara SPEC-015-C cerrada y ninguna SPEC activa
**ZIP recibido:** SHA-256 `88a1a7ffd2746892cfed2bc821a2112bc1edd2e058b9acd4cbde08bc6fa7d9b9`
**Esquemas persistentes que no cambian:** `modelVersion: 3`, `structural-intent-v1.0`, `structural-intent-trace-v1.0`, `agnostic-geometry-v1.0`

---

## Diagnóstico

### 1. Base y límites de verificación

El ZIP fue validado mediante `unzip -t` y extraído sobre una copia de trabajo distinta de la copia
inmutable. Contiene 589 archivos y no contiene `.git`; por ello la rama y el commit `961782f` no
pueden recalcularse desde el archivo extraído. Sí se verificaron las autoridades internas que
corresponden a ese baseline:

- `governance/STATUS.md` declara SPEC-015-C cerrada y SPEC-015-D pendiente de apertura formal;
- `specs/SPEC-015-C-interfaz-declaracion-y-decisiones-explicitas.md` está cerrada;
- existen el workspace, el dominio de intención, la traza, las pruebas y la evidencia FX-008 de
  SPEC-015-C;
- `make governance` sobre la copia sin cambios pasó con 22 archivos requeridos, 46 requisitos y 57
  decisiones;
- las cinco pruebas puras de `tests/structuralIntentWorkspace.test.mjs` pasaron.

La diferencia frente a los 572 archivos del ZIP de entrada de SPEC-015-C no es una divergencia del
contrato actual: el ZIP recibido ya incluye el corte cerrado de SPEC-015-C y sus archivos añadidos.

### 2. Reproducción de BUG-015-C-001

La pestaña productiva `Muros y elementos` construye cada fila con:

```text
checkbox · ID · tipo · estado · Editar
```

No existe un descriptor humano, mini preview, planta contextual, elevación, representación de vanos
ni acción que conserve el workspace mientras localiza el objetivo. Esto se observa en
`StructuralIntentWorkspaceDialog.jsx`, donde `renderElements` muestra sólo esos cinco campos.

La pestaña `Techumbre`, en cambio, llama a `RoofPolygon` y presenta el polígono real junto con los
bordes canónicos B1…Bn. La diferencia funcional reproduce el BUG:

```text
Techumbre:          lista ↔ polígono ↔ borde canónico ↔ formulario
Muros y elementos: lista por ID ↔ formulario
```

Para el muro real `1784605101040`, la interfaz vigente sólo expone el ID. La geometría autoritativa
permite describirlo sin inferencia:

```text
Muro X · 7→11A @ C · NPT→FRONTON GENERAL
x=14500→23200 · y=2000 · z=450→4150
L=8700 mm · e=101,1 mm · h=3700 mm · 3 vanos
```

### 3. Contratos reales inspeccionados

#### 3.1 Workspace y presentador actual

`src/core/structuralIntentWorkspace.js`:

- proyecta geometría mediante `projectAgnosticGeometry(model)`;
- genera para muros sólo largo, espesor, altura y cantidad de vanos;
- genera para fundaciones sólo cantidad de sólidos;
- no produce bounds, descriptor nominal, vecinos, geometría de preview ni fingerprints geométricos;
- genera filas exclusivamente desde `geometry.elements`, por lo que una intención huérfana no forma
  una fila visual propia;
- ya distingue `declared`, `undefined`, `invalid` y `brokenReference`;
- ya protege borradores de intención con `previousFingerprint`.

#### 3.2 Store

`src/store/useModelStore.js` separa parcialmente navegación y mutación:

- `withHistory` es la única envolvente ordinaria que agrega `past`, limpia `future` y marca el
  documento sucio;
- `selectElement`, `setViewMode`, `setCurrentZLevel`, zoom, pan y ajuste de vista no llaman a
  `withHistory`;
- las mutaciones de intención sí llaman al dominio con `recordUserAction: true` y sólo usan
  `withHistory` cuando existe un cambio efectivo;
- `centerOnElement` tampoco usa `withHistory`, pero escribe `model.selectedElementId`, cambia a
  planta y cambia nivel;
- `zoomToElement` sólo modifica transformaciones de vista;
- el estado transitorio ya tiene precedentes fuera de `model`: filtro, ghost layer, borrador de
  faldón, layout y vistas del panel B.

`centerOnElement` no puede reutilizarse sin mediación para esta SPEC porque ampliaría la selección
global y abriría efectos laterales en PropertiesPanel. El contrato correctivo exige un localizador
transitorio separado.

#### 3.3 Viewport y selección

`src/components/Canvas.jsx`:

- la selección ordinaria usa `model.selectedElementId`;
- el hit-test en planta y elevación termina en `selectElement`;
- hover actual informa coordenadas/snap, no una identidad local del workspace;
- zoom y pan son estado de vista sin historial;
- la vista principal y el panel dividido comparten la selección global.

`src/components/Viewer3D.jsx` usa `model.selectedElementId` para colorear una entidad. En este corte
no se exige selección 3D ni un localizador 3D nuevo; el localizador se limita al Canvas 2D productivo.
La preview aislada del workspace sí puede representar prismas en planta y elevación sin importar
Three.js.

#### 3.4 Inventario previo

`ElementInventoryModal.jsx` tiene una acción `Localizar` que llama a `centerOnElement` y cierra el
modal. Ese patrón es insuficiente para SPEC-015-C-1 porque:

- desmonta el inspector;
- perdería un borrador local de intención;
- modifica la selección global;
- no permite volver al mismo estado del workspace;
- no localiza un lote.

#### 3.5 Persistencia

`serializeNativeProject` serializa el modelo validado completo. Como varios campos de navegación
viven hoy dentro de `model`, la nueva funcionalidad no debe agregar otro campo visual al modelo.
Todo estado de C-1 debe residir fuera de `model`, no participar en `prepareModelImport` y no requerir
migración.

### 4. Caso real confirmado

El fixture `tests/fixtures/casa-L-completa-v3.json` fue proyectado con el módulo productivo real:

```text
modelVersion:       3
fixture SHA-256:    6cc9e2d1d452c6da26984b23b01a047ca7c9c1465e34e9129caf69784f7b3f09
geometría bytes:    81.875
geometría SHA-256:  966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a
elementos:          77
muros:              45
vanos:              43
fundaciones:         32
cubiertas:           7
```

---

## Decisión

Crear una capa de presentación geométrica pura y una interacción visual transitoria para la pestaña
`Muros y elementos`:

```text
modelo vigente
  └─ projectAgnosticGeometry(model)
      └─ presentador visual puro
          ├─ descriptor humano verificable
          ├─ preview individual
          ├─ preview de lote
          ├─ contexto cercano no semántico
          ├─ fingerprints geométricos
          └─ estado de referencia

lista local ↔ preview local ↔ modo localizar en Canvas
```

La capa no declara intención, no reconoce topología, no clasifica apoyos, no propone caminos de
carga y no altera ninguna autoridad persistente.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: el corte cruza presentador puro, workspace, Canvas, estado transitorio, protección de
  borradores y accesibilidad, pero no cambia schemas ni lógica resistente.

---

## Principios e invariantes

### R-015C1-01 · Identidad visual antes de editar

Toda fila editable debe tener una identidad comprensible sin memorizar el ID. El ID se conserva como
referencia exacta, no como único descriptor.

### R-015C1-02 · Autoridades separadas

La presentación visual no pertenece a:

- `structuralIntent`;
- `structuralIntentTrace`;
- `agnostic-geometry-v1.0`;
- geometría editable;
- solución constructiva;
- selección global del modelador.

### R-015C1-03 · Cero inferencia estructural

Palabras como vecino, contexto, cruce, cercanía o encuadre sólo describen representación. La UI no
puede convertir proximidad en contacto, continuidad, apoyo, portancia, resistencia, transferencia o
camino de carga.

### R-015C1-04 · Presentador puro

El presentador recibe un modelo válido y opciones de visualización, retorna datos serializables y no:

- muta la entrada;
- accede al DOM;
- importa React, Zustand, Three.js, `wallTypes`, Metalcon, OSB o topología;
- registra historia o trace;
- usa fecha, aleatoriedad o contador global.

### R-015C1-05 · No ampliar selección global

Activar una fila, hacer hover, seleccionar un lote, pulsar sobre la preview o localizar no escribe
`model.selectedElementId`, `selectedRoofSystemId` ni `selectedRoofPlaneId`.

### R-015C1-06 · Navegación sin efectos de dominio

Navegación, hover, foco, selección local, zoom, pan, fit, cambio temporal de vista, localización y
restauración producen:

```text
0 pasos de historial
0 eventos structuralIntentTrace
0 cambios de structuralIntent
0 documento dirty adicional
```

### R-015C1-07 · Borrador protegido

Localizar el objetivo actual no descarta ni confirma un borrador. Cambiar de objetivo con borrador
sucio exige una decisión explícita.

### R-015C1-08 · Señalización redundante

Ningún estado depende sólo del color. Objetivo, lote, hover, foco, stale y referencia rota usan al
menos dos señales entre etiqueta, trazo, patrón, icono, texto y ARIA.

---

## Contrato del presentador geométrico

### R-015C1-09 · Salida transitoria

La función sugerida para Fase B es:

```js
buildStructuralIntentVisualPresentation(model, options)
```

Su resultado no es un schema persistente. Puede declarar una etiqueta de runtime para pruebas:

```json
{
  "runtimeContract": "structural-intent-visual-presentation-v1.0",
  "sourceSchema": "agnostic-geometry-v1.0",
  "targets": [],
  "orphans": [],
  "presentationSha256": ""
}
```

Cada target contiene como mínimo:

```json
{
  "id": 1784605101040,
  "type": "wall",
  "descriptor": {},
  "planGeometry": {},
  "elevationGeometry": {},
  "openings": [],
  "bounds": {},
  "geometryFingerprint": "sha256",
  "state": "available"
}
```

Estados permitidos:

```text
available
unsupportedVisualType
brokenReference
invalidGeometry
```

### R-015C1-10 · Fuente geométrica

El presentador consume la salida real de `projectAgnosticGeometry(model)`. Puede construir un índice
de etiquetas desde `model.grid` únicamente para presentación nominal. Las coordenadas resueltas del
contrato agnóstico gobiernan la geometría; las etiquetas no pueden modificarla.

### R-015C1-11 · Fingerprint geométrico

`geometryFingerprint` es el SHA-256 de un objeto canónico con:

- ID y tipo;
- prisma o sólidos;
- vanos y `hostWallId`;
- descriptor nominal resuelto;
- versión del contrato visual.

No incluye intención, hover, zoom, filtros ni selección. Una permutación equivalente de colecciones
produce el mismo fingerprint.

### R-015C1-12 · Presentación determinista

Los targets se ordenan por token tipado de ID. Contexto, vanos, sólidos y etiquetas se ordenan por
claves geométricas estables. El mismo modelo y opciones producen `deepEqual` y el mismo
`presentationSha256`.

---

## Descriptor geométrico

### R-015C1-13 · Regla general

Todo descriptor presenta, en este orden:

1. tipo legible;
2. orientación o forma;
3. ejes nominales verificables;
4. coordenadas explícitas;
5. niveles/cotas;
6. dimensiones;
7. vanos o sólidos;
8. ID exacto.

### R-015C1-14 · Etiquetas de ejes y niveles

Una etiqueta nominal se usa sólo cuando la coordenada resuelta coincide con una posición de grilla
dentro de `0,1 mm`.

```text
coincidencia exacta: 7→11A @ C
sin coincidencia:    X=14535→23200 @ Y=2000
```

Siempre se muestran coordenadas numéricas como respaldo. No se asigna el eje “más cercano”.

### R-015C1-15 · Muro

Descriptor mínimo:

```text
Muro X|Y · eje inicial→eje final @ eje fijo · nivel base→nivel superior
x/y resuelto · z0→z1 · L · e · h · cantidad de vanos · ID
```

La elevación usa el eje local canónico positivo, aunque el muro haya sido declarado en sentido
inverso.

### R-015C1-16 · Pilar/columna

Se representa como rectángulo de huella y elevación vertical. Descriptor:

```text
Pilar · X×Y o coordenadas · z0→z1 · ancho X · ancho Y · altura · ID
```

### R-015C1-17 · Viga

Se representa como franja orientada. Descriptor:

```text
Viga X|Y · rango @ eje fijo · z · L · ancho · alto · ID
```

### R-015C1-18 · Fundación

Se representa por la unión visual de sus sólidos reales, diferenciados por rol mediante patrón y
texto. Descriptor:

```text
Fundación corrida|aislada · rango o centro · z mínimo→máximo · n sólidos · ID
```

No se muestra como una caja genérica si posee varias capas.

### R-015C1-19 · Tipo no soportado

Un tipo futuro o inválido no se dibuja con una forma inventada. Se muestra
`unsupportedVisualType`, con ID y mensaje verificable. Editar intención queda bloqueado hasta que el
presentador soporte el tipo o el contrato de dominio lo excluya explícitamente.

---

## Geometría de preview

### R-015C1-20 · Preview individual

La vista individual contiene:

- planta contextual;
- elevación del objetivo cuando existe un eje longitudinal/vertical interpretable;
- descriptor;
- vanos del objetivo;
- ejes nominales dentro del encuadre;
- lista de contexto cercano;
- acciones Ajustar, Acercar, Alejar y Localizar.

El objetivo usa etiqueta `T`, trazo más grueso y halo/patrón. Los elementos de contexto son tenues y
no reciben semántica.

### R-015C1-21 · Vanos

Los vanos de muro se dibujan como vacíos sobre el prisma anfitrión:

- en planta: interrupción blanca y bordes discontinuos;
- en elevación: rectángulo vacío con tipo puerta/ventana e ID accesible;
- en descriptor: cantidad total y lista opcional de dimensiones/cotas.

Un vano con `hostWallId` roto produce `brokenReference`; no se mueve al muro geométricamente más
cercano.

### R-015C1-22 · Contexto cercano, no “topología”

Para un conjunto seleccionado se calcula una envolvente XY. La distancia de contexto es:

```text
contextDistance = max(1200 mm, 0,15 × mayor dimensión XY de la envolvente)
```

Un muro no seleccionado entra al contexto si:

1. la distancia entre bounds XY es menor o igual a `contextDistance`;
2. sus intervalos Z se solapan o tocan dentro de `0,1 mm`;
3. no supera el límite de 24 candidatos.

Orden:

```text
distancia XY ascendente → token tipado de ID ascendente
```

La UI debe rotular la capa:

> Contexto cercano para orientación visual. No representa relación estructural ni topológica.

### R-015C1-23 · Encuadre

El fit usa la unión de objetivos y contexto visible con margen:

```text
margin = max(700 mm, 0,08 × mayor dimensión XY)
```

No altera la geometría. La escala inicial se deriva del viewport disponible y no forma parte del
fingerprint.

### R-015C1-24 · Capas

Capas mínimas:

```text
Objetivo(s)     siempre activa
Vanos           activa por defecto
Contexto muro   activa por defecto
Ejes            activa por defecto
Otros elementos desactivada por defecto
Fundaciones     desactivada por defecto para un muro
```

Activar o desactivar capas es navegación local sin historial ni trace.

---

## Preview de lote

### R-015C1-25 · Selección y objetivo activo son distintos

El lote usa:

- `selectedIds`: integrantes que recibirían una operación masiva;
- `activeId`: integrante cuyo descriptor se inspecciona;
- `hoveredId`: integrante apuntado/focalizado.

Cambiar `activeId` no agrega ni quita `selectedIds`. Espacio o checkbox alterna el lote.

### R-015C1-26 · Identificación individual dentro del lote

Cada integrante seleccionado recibe `S1…Sn` según orden canónico de ID. La preview nunca fusiona los
muros en una entidad geométrica ni presenta el lote como sistema resistente.

### R-015C1-27 · Resumen verificable

El resumen de lote muestra por integrante:

```text
marca · ID · tipo · ejes/coordenadas · niveles · dimensiones · vanos · estado
```

También muestra bounds conjuntos y cantidad seleccionada. No calcula continuidad, área resistente,
longitud efectiva ni camino de carga.

### R-015C1-28 · Preview de confirmación masiva

La confirmación existente conserva valores anteriores, valor nuevo y política de notas. C-1 agrega:

- mini preview del lote exacto;
- `geometryFingerprint` esperado por integrante;
- lista de referencias rotas;
- estado stale de la preview.

`canConfirm=false` cuando un fingerprint cambió, una referencia se rompió o el lote visual ya no
corresponde al lote validado.

---

## Sincronización y selección bidireccional

### R-015C1-29 · Lista → preview

Foco, click o Enter sobre una fila actualizan `activeId`, desplazan la preview al objetivo y actualizan
el descriptor. No alteran el lote salvo acción explícita sobre checkbox/Espacio.

### R-015C1-30 · Preview → lista

Click o Enter sobre una forma actualiza `activeId`, desplaza la fila al área visible y mueve el foco
a un control asociado. En modo lote, Espacio alterna el integrante sólo si pertenece al conjunto
seleccionable actual.

### R-015C1-31 · Hover y foco equivalentes

Hover puede mostrar un descriptor temporal, pero no cambia `activeId`. Foco de teclado produce el
mismo resaltado. Al salir, se restaura el descriptor activo.

### R-015C1-32 · Viewport principal → workspace

Mientras el localizador esté activo, un click sobre un target resaltado puede actualizar el
`activeId` local. No llama a `selectElement` y no cambia la selección global. Un click fuera de los
targets sólo panea o limpia hover.

Con borrador sucio, activar otro target desde Canvas queda bloqueado; hover sigue disponible.

---

## Localización temporal en el viewport

### R-015C1-33 · Estado transitorio separado

Fase B añade un slice de UI fuera de `model`, por ejemplo:

```json
{
  "structuralIntentLocator": {
    "active": false,
    "targetIds": [],
    "activeId": null,
    "hoveredId": null,
    "returnToken": null,
    "viewSnapshot": null,
    "fitRequest": null
  }
}
```

No se serializa, no se migra y no usa `withHistory`.

### R-015C1-34 · Entrada a modo localizar

Al pulsar `Localizar en modelo`:

1. se valida que la preview no esté stale ni rota;
2. se captura snapshot de layout, vistas A/B, modos, nivel y selección global;
3. el workspace permanece montado y conserva borradores;
4. el diálogo se compacta a una barra de retorno;
5. Canvas dibuja un overlay temporal para `targetIds`;
6. la selección global existente se conserva sin cambios.

### R-015C1-35 · Overlay

El overlay del Canvas usa geometría resuelta y señales redundantes:

- contorno grueso;
- etiqueta T o S1…Sn;
- halo/patrón;
- texto accesible con descriptor.

No reemplaza materiales, no alimenta PropertiesPanel y no reutiliza `attributeFilter` como autoridad.

### R-015C1-36 · Vista y nivel

Entrar al localizador no cambia la vista hasta una acción explícita `Ajustar`. Al ajustar:

- para un muro/lote se usa planta;
- el nivel temporal es el menor z base de los targets cuando existe un nivel exacto;
- la vista se encuadra con bounds conjuntos;
- los cambios son navegación, no historia.

Al volver existen dos acciones explícitas:

```text
Restaurar vista y volver   → aplica viewSnapshot
Conservar vista y volver   → conserva pan/zoom/modo/nivel actuales
```

Ambas preservan la selección global original.

### R-015C1-37 · Cierre y Escape

Escape en modo localizar restaura la vista por defecto y devuelve foco al botón que abrió el modo.
Escape no cierra el workspace directamente cuando hay un borrador sucio.

---

## Borradores, stale y referencias rotas

### R-015C1-38 · Revisión compuesta

Cada borrador individual conserva:

```text
previousIntentFingerprint
previousGeometryFingerprint
```

Un lote conserva ambos fingerprints por integrante.

### R-015C1-39 · Geometría stale

Si cambia el fingerprint geométrico:

- el preview se marca `stale`;
- Guardar, Confirmar lote y Localizar se deshabilitan;
- se anuncia el conflicto mediante `role=alert`;
- no se sustituye automáticamente la geometría visible.

Acción `Recargar geometría`:

- si la intención vigente conserva el fingerprint anterior, actualiza geometría y preserva campos
  del borrador;
- si la intención también cambió, exige `Recargar declaración`, descartando explícitamente el
  borrador o permitiendo copiar notas antes de hacerlo.

### R-015C1-40 · Referencia rota

Si el target desaparece:

- se conserva el último descriptor del borrador como snapshot local;
- el estado es `brokenReference`;
- editar, guardar y localizar quedan deshabilitados;
- no se busca sustituto por coordenada, tipo ni cercanía.

Para lote, una referencia rota bloquea confirmación. La acción `Excluir referencias rotas` requiere
confirmación y regenera fingerprints y preview.

### R-015C1-41 · Intenciones huérfanas

El presentador agrega `orphans[]` para toda `elementIntent` cuyo `elementId` no exista en la geometría.
Esas filas aparecen en estado Referencia rota aunque no exista un target en `geometry.elements`.
No se ocultan por el filtro “Sólo muros”.

### R-015C1-42 · Cambio de objetivo con borrador

Con borrador sucio:

- hover/foco de otro target: permitido, sin activar;
- Localizar objetivo actual: permitido;
- activar otro target, cambiar pestaña o cerrar: requiere confirmación;
- selección de lote: bloqueada si cambiaría el contexto del formulario individual.

---

## Teclado y accesibilidad

### R-015C1-43 · Estructura semántica

- lista: tabla o grid con encabezados y fila activa anunciada;
- preview: SVG con `title`, `desc` y targets focalizables;
- acciones: botones reales, no sólo gestos;
- estado: `aria-live` para activeId, cantidad de lote, stale y referencia rota;
- errores: `role=alert` y asociación con controles mediante `aria-describedby`.

### R-015C1-44 · Atajos locales

Cuando el foco está en lista/preview y no dentro de un input:

```text
↑ / ↓       fila anterior/siguiente
Home / End  primera/última fila
Enter       activar target
Espacio     alternar integrante del lote
L           localizar target o lote
+ / -       zoom de preview
0           ajustar preview
Escape      limpiar hover / salir de localizar / solicitar cierre protegido
```

Los atajos no interceptan escritura en input, select o textarea y no reemplazan los botones.

### R-015C1-45 · No depender del color

Estados mínimos:

| Estado | Señales obligatorias |
|---|---|
| Target individual | etiqueta T + trazo/halo |
| Integrante de lote | etiqueta S# + trazo/checkbox |
| Hover/foco | trazo discontinuo + descriptor temporal |
| Stale | icono/texto + bloqueo de acciones |
| Referencia rota | icono/texto + ausencia de preview activa |
| No definido / declarado | badge textual + `aria-label` |

---

## Demostración de cero historial y cero trazabilidad

### R-015C1-46 · Matriz de efectos

| Acción | Estado permitido | `past` | trace | intención | documento dirty |
|---|---|---:|---:|---:|---:|
| cambiar pestaña | UI local | 0 | 0 | 0 | 0 |
| hover/foco | UI local | 0 | 0 | 0 | 0 |
| activar fila/preview | UI local | 0 | 0 | 0 | 0 |
| alternar selección de lote | UI local | 0 | 0 | 0 | 0 |
| zoom/pan/fit preview | UI local | 0 | 0 | 0 | 0 |
| entrar/salir localizar | UI local | 0 | 0 | 0 | 0 |
| ajustar/restaurar viewport | vistas transitorias | 0 | 0 | 0 | 0 |
| confirmar declaración efectiva | dominio | +1 | +1 operación | cambia | sí |
| no-op/cancelar/error/stale | ninguno | 0 | 0 | 0 | 0 |

### R-015C1-47 · Prueba de frontera

La prueba productiva de Fase B debe capturar antes y después:

```js
{
  model: structuredClone(state.model),
  pastLength: state.past.length,
  futureLength: state.future.length,
  trace: structuredClone(state.model.structuralIntentTrace),
  dirty: state.projectDocument.dirty
}
```

Después de ejecutar navegación, hover, selección, zoom y localización:

- `structuralIntent`, `structuralIntentTrace` y geometría son `deepEqual`;
- `pastLength`, `futureLength` y `dirty` no cambian;
- sólo cambian slices de UI y vistas permitidas.

La evidencia aislada de Fase A ejecuta esa misma secuencia sobre su estado local y mantiene los tres
contadores en cero. No sustituye la prueba de implementación de Fase B.

---

## Aplicación a FX-008

### R-015C1-48 · Objetivo individual real

```text
ID:          1784605101040
Tipo:        muro
Orientación: X
Ejes:        7→11A @ C
Coordenadas: x=14500→23200 · y=2000
Niveles:     NPT 450 → FRONTON GENERAL 4150
Dimensiones: L=8700 · e=101,1 · h=3700 mm
Vanos:       3
```

Vanos reales:

| ID | Tipo | Tramo | z base | altura |
|---|---|---:|---:|---:|
| 1784605151802 | puerta | 15200→17000 | 450 | 2700 |
| 1784605173145 | ventana | 18000→19700 | 1350 | 1800 |
| 1784605196342 | puerta | 20700→22500 | 450 | 2700 |

Con la regla de contexto C-1, aparecen seis muros cercanos, ordenados por distancia e ID:

```text
1784754251210  distancia 0
1784756700772  distancia 0
1784819708086  distancia 0
1784607987483  distancia 1098,9 mm
1784754427246  distancia 1098,9 mm
1784756325325  distancia 1098,9 mm
```

Su presencia no declara encuentros ni apoyo.

### R-015C1-49 · Lote real

| Marca | ID | Descriptor | Dimensiones | Vanos |
|---|---:|---|---|---:|
| S1 | 1784751397992 | Muro Y · B→H @ 3 · NPT→CIELO GENERAL | L 4200 · e 101,1 · h 2800 | 2 |
| S2 | 1784752583321 | Muro Y · B→H @ 4 · NPT→CIELO GENERAL | L 4200 · e 101,1 · h 2800 | 0 |
| S3 | 1784752639636 | Muro Y · B→H @ 5 · NPT→CIELO GENERAL | L 4200 · e 101,1 · h 2800 | 2 |

Contexto visual resultante:

```text
1784604634483  distancia 0
1784606313849  distancia 0
1784670218571  distancia 0
1784751024158  distancia 1098,9 mm
1784600403613  distancia 1098,9 mm
```

El lote conserva tres IDs, tres descriptors y tres marcas. No se combina como “muro múltiple”,
pórtico, eje resistente ni línea de carga.

---

## Estados de error y mensajes

### R-015C1-50 · Códigos sugeridos

```text
SI-VISUAL-TARGET-NOT-FOUND
SI-VISUAL-UNSUPPORTED-TYPE
SI-VISUAL-GEOMETRY-INVALID
SI-VISUAL-PREVIEW-STALE
SI-VISUAL-BATCH-STALE
SI-VISUAL-OPENING-HOST-NOT-FOUND
SI-VISUAL-LOCATOR-TARGET-NOT-FOUND
SI-VISUAL-DIRTY-TARGET-SWITCH-BLOCKED
```

Los códigos son de presentación/flujo y no se escriben en `structuralIntentFindings`.

### R-015C1-51 · Fallo atómico de presentación

Un target inválido no impide listar otros targets válidos. La fila afectada muestra su estado y el
workspace continúa. Una preview de lote con cualquier target inválido bloquea la operación masiva
completa.

---

## Alcance

- abrir formalmente SPEC-015-C-1 y actualizar `governance/STATUS.md`;
- registrar `BUG-015-C-001` antes de corregirlo;
- ejecutar `make governance` antes de modificar producto;
- añadir presentador geométrico puro y fingerprints;
- enriquecer filas y descriptor;
- implementar preview individual y de lote;
- representar vanos y contexto cercano;
- sincronizar lista↔preview;
- añadir slice transitorio de localización fuera de `model`;
- integrar overlay en Canvas 2D sin usar selección global;
- preservar/restaurar vistas y borradores;
- resolver stale, referencia rota e intenciones huérfanas;
- completar teclado, foco y ARIA;
- añadir pruebas puras, store y componentes;
- generar evidencia FX-008, implementación, traza, patch, ZIP, aplicador y validador único.

## Fuera de alcance

- habilitar Propuestas estructurales, Caminos de carga o Topología estructural;
- ejecutar fases R6–R12 de SPEC-14;
- inferir roles, portancia, apoyo, continuidad o resistencia;
- modificar `structural-intent-v1.0`, `structural-intent-trace-v1.0` o
  `agnostic-geometry-v1.0`;
- persistir descriptor, preview, selección, hover, localizador o view snapshot;
- importar `wallTypes`, Metalcon, OSB, perfiles, materiales o resultados;
- ampliar la selección global o abrir PropertiesPanel desde la preview;
- implementar selección/localización 3D;
- modificar STATUS durante Fase A;
- hacer `git add`, commit o push.

---

## Criterios de aceptación

1. El presentador puro devuelve targets deterministas para wall, column, beam y foundation sin mutar
   el modelo ni importar UI, store, Three.js o fuentes constructivas.
2. El descriptor del muro `1784605101040` coincide con ejes 7→11A @ C, cotas 450→4150,
   dimensiones 8700/101,1/3700 y tres vanos.
3. Las etiquetas nominales sólo aparecen por coincidencia ±0,1 mm y siempre tienen respaldo de
   coordenadas explícitas.
4. La preview individual muestra planta, elevación, vanos, target T, contexto rotulado como no
   semántico y encuadre determinista.
5. La preview de lote muestra S1/S2/S3, conserva tres IDs y permite distinguir activeId de
   selectedIds.
6. Click/Enter en lista actualiza preview; click/Enter en preview actualiza lista; hover y foco no
   cambian activeId.
7. Localizar mantiene el workspace montado, preserva borrador, usa overlay transitorio y no escribe
   ninguna selección global.
8. Ajustar viewport puede cambiar temporalmente planta/nivel/zoom; Restaurar vuelve al snapshot y
   Conservar mantiene la nueva vista, ambos sin historial/trace.
9. Un borrador sucio bloquea cambio de target desde lista, preview y Canvas, pero permite localizar el
   objetivo vigente.
10. Un cambio geométrico vuelve stale la preview y bloquea Guardar/Confirmar/Localizar hasta recarga;
    un cambio de intención exige recargar declaración.
11. Una referencia rota permanece visible con último descriptor y no se sustituye silenciosamente;
    las intenciones huérfanas aparecen como filas rotas.
12. Las acciones de navegación, hover, selección local, zoom, pan, fit y localización conservan
    `past`, `future`, `structuralIntent`, `structuralIntentTrace` y dirty.
13. Una declaración efectiva conserva el contrato heredado de un historial y una operación de trace;
    no-op, cancelación, error y stale producen cero.
14. El flujo completo es operable por teclado, restaura foco y no depende sólo del color.
15. El componente no habilita los tres menús futuros ni importa módulos de propuestas, caminos de
    carga o topología.
16. La geometría agnóstica FX-008 conserva 81.875 bytes y SHA-256
    `966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a`.
17. Una prueba de reversión que conecte el localizador a `selectElement` o que llame a `withHistory`
    hace fallar la suite enfocada y vuelve a verde al restaurar la separación.
18. Una prueba de reversión que retire el fingerprint geométrico permite confirmar una preview stale,
    hace fallar la suite y vuelve a verde al restaurarlo.
19. Fase B ejecuta y documenta únicamente gates realmente corridos; la validación local del Mac es la
    autoridad final.
20. No existen cambios de schema, migración, STATUS anticipado, Git ni artefactos productivos fuera
    del corte aprobado.

---

## Evidencia

- `docs/BUG-015-C-001_REPRODUCCION_FASE_A.md`;
- `docs/SPEC-015-C-1_FASE_A.md`;
- `prototypes/SPEC-015-C-1/FX-008-SPEC-015-C-1-prototipo.html`;
- `prototypes/SPEC-015-C-1/FX-008-SPEC-015-C-1-data.json`;
- `prototypes/SPEC-015-C-1/generate-prototype.mjs`;
- manifiesto de hashes y comparación de árbol de Fase A.

La evidencia HTML usa exclusivamente la geometría real del fixture productivo. Su auditoría interna
es demostración de contrato visual, no gate de implementación.

---

## Contradicciones y ambigüedades resueltas

| Ambigüedad | Resolución de Fase A |
|---|---|
| Viewport principal versus diálogo modal | modo localizar compacta el diálogo sin desmontarlo |
| “Selección bidireccional” versus selección global | bidireccionalidad usa activeId local; la selección global no cambia |
| Localizar con borrador | permitido para target actual; cambiar target queda bloqueado |
| Etiqueta de eje versus coordenada | etiqueta sólo por coincidencia ±0,1 mm; coordenada siempre visible |
| Vecino versus topología | contexto por distancia/bounds, rotulado explícitamente como no semántico |
| Cambio de nivel/vista | snapshot, Ajustar explícito, Restaurar o Conservar al volver |
| Elementos no muro | prismas/sólidos reales por tipo; no forma genérica inventada |
| Referencia rota ausente de geometry.elements | colección `orphans[]` y fila visible |
| Stale de intención versus stale geométrico | fingerprints separados y bloqueo compuesto |
| Señalización por color | T/S#, trazo/patrón, texto y ARIA obligatorios |

No se detectó una contradicción material que obligue a alterar los contratos persistentes. La única
frontera nueva es un estado de UI transitorio fuera de `model`, consistente con precedentes del
store.

## Apertura de Fase B

Aprobación explícita recibida el 06-ago-2026. Se abre formalmente SPEC-015-C-1 con esfuerzo `high`,
escalamiento `xhigh` prohibido y alcance limitado a cerrar `BUG-015-C-001`. La apertura no habilita
Propuestas estructurales, Caminos de carga ni Topología, y no autoriza Git.


---

## Resultado de Fase B

El corte productivo implementa el contrato visual puro, preview individual y masiva, localización
transitoria, selección bidireccional sin ampliar la selección global, protección de borradores,
stale, referencia rota y accesibilidad. La evidencia FX-008 queda en `evidence/spec-015-c-1/`.

Los tests puros, evidencia, independencia, reversión y parse JSX ejecutables en el entorno de
preparación pasaron. La autoridad local del Mac ejecutó después el validador autocontenido v3 y
aprobó dependencias, manifiesto, gobernanza, evidencia, independencia, pruebas enfocadas, componente
enfocado, `npm run validate`, diff, evidencia final y manifiesto final. La SPEC queda cerrada.


---

## Cierre local autoritativo

El 06-ago-2026 el Mac objetivo ejecutó `validar_SPEC_015_C_1_AUTOCONTENIDO_v3.sh` sobre el
repositorio aplicado y aprobó el corte completo.

```text
PASS - SPEC-015-C-1 validada completamente.
Logs: /Volumes/MEM EXT/Developer/modelador/artifacts/validation-spec-015-c-1/20260806-143453
No se ejecutó git add, commit ni push.
```

Resultados consolidados: 22/22 tests enfocados, 10/10 pruebas del componente enfocado, 913/913
tests Node, 31/31 componentes, 9/9 Rust, cobertura del store 94,97 % líneas / 80,85 % ramas /
95,78 % funciones, 19 goldens, DXF 14 archivos con 0 errores/0 reparaciones, CalculiX 3/3, build
Vite, migración, artefactos, derivados, auditoría Codex y gobernanza final.

Los hotfixes BUG-015-C-002 y BUG-015-C-003 corrigieron exclusivamente empaquetado/validador.
BUG-015-C-004 corrigió la protección inmediata de referencias rotas y ajustó tres aserciones de
prueba ambiguas; el validador v3 demostró el resultado final.

SPEC-015-D permanece pendiente de apertura formal. No se habilitaron propuestas, caminos de carga
ni topología.
