# Spec R5 — Roles de muro y `wallTypes`

> Quinta unidad del plan de reglas de dominio.
> Base: commit `916b150`, suite 598/598.
> Decisiones de origen: legado **D-017** y **D-018**; gobernanza **D-019** y **D-020**.

## Diagnóstico

El modelo sólo puede declarar defaults globales:

- `model.metalconDefaults` define paso, perfiles y material para todo el proyecto;
- `model.osbDefaults` define placa, corte mínimo y dilatación para todo el proyecto;
- siete campos persistidos por muro (`framingStudProfileId`, `framingTrackProfileId`,
  `framingMaterialId`, `studSpacing`, `osbPanelWidth`, `osbPanelHeight` y
  `osbMinPanelWidth`) actúan como overrides y hoy ganan sobre esos defaults;
- no existen `wallTypes`, `wallTypeId`, rol de muro ni `aplicaA` en el catálogo de reglas.

Esto impide representar sin overrides una vivienda con exteriores serie 90 y tabiques serie 60.
También impide decidir de forma declarativa qué reglas corresponden a un muro. Inferir MP1 porque
hay OSB, MP2 porque aparecen diagonales o tabique por espesor sería circular: esos derivados pueden
estar ausentes o stale y la geometría no declara la función estructural.

La medición de `tests/fixtures/casa-L.json` confirma:

- 45/45 muros carecen de tipo y rol;
- 45/45 guardan los siete overrides enumerados;
- `metalconDefaults` es `null` y `osbDefaults.gap` conserva 3 mm;
- el archivo no declara `modelVersion`, por lo que hoy recorre `0→1`;
- sólo hay una serie de perfil en los muros, de modo que no prueba defaults distintos por tipo.

El esquema vigente termina en `modelVersion = 1`. Su única migración agrega las dos colecciones de
techumbre. No valida tipos de muro ni referencias desde un muro.

Hay además cuatro fronteras que la incorporación del tipo debe cubrir:

1. `batchModulation` resuelve hoy `muro → default global`; para los campos propios gana el muro,
   contrario a la precedencia decidida para R5.
2. `MetalconModulationModal`, `OsbModulationModal` y “Generar todos” escriben/leen defaults
   globales y no ofrecen administrar o asignar tipos.
3. `planWallSplit` copiaría un futuro `wallTypeId`, pero `planWallMerge` conservaría
   silenciosamente el valor del tramo más largo si los tipos difieren.
4. `osbNesting.nestPieces` acepta `allowRotation` desde cualquier llamador. La única protección
   actual es el default `false`; la función no conoce el rol del muro.

Los consumidores DXF leen un único `model.osbDefaults.gap`. Si dos tipos usan valores distintos,
el gap efectivo debe viajar con el despiece de cada muro para que preview y salida no diverjan.

## Decisión

### 1. Contrato de rol y tipo

Se crea un módulo puro `core/wallTypes.js`. Los únicos roles válidos, sin orden ni herencia, son:

```js
['MP1', 'MP2', 'MP3', 'tabique']
```

El modelo gana una colección superior:

```js
wallTypes: [{
  id,
  name,
  role,
  metalconDefaults: {
    spacing,
    studProfileId,
    trackProfileId,
    materialId
  },
  osbDefaults: {
    panelWidth,
    panelHeight,
    minPanelWidth,
    gap
  }
}]
```

- `id` es estable y único; no se edita después de crear el tipo.
- `name` es texto no vacío y `role` es uno de los cuatro valores exactos.
- `materialId` puede ser `null`; los demás campos son obligatorios y finitos/positivos.
- `minPanelWidth` mantiene el piso duro de 200 mm.
- Los IDs de perfil deben existir y corresponder a forma C para montante y U para solera.
- Un muro referencia el tipo sólo mediante `wallTypeId`. No se agrega `wall.role`: el rol vive en
  el tipo para que no existan dos autoridades.
- Un muro sin `wallTypeId` es válido y queda explícitamente “sin tipo/rol”.
- Un `wallTypeId` declarado que no existe es un error de esquema/importación, no un fallback.

La función pura `resolveWallTypeConfig(model, wall)` entrega el tipo, rol, configuración efectiva
y findings, sin mutar el modelo.

### 2. Precedencia y compatibilidad legacy

Para un muro con tipo válido, el tipo es la única fuente de defaults. Si alguno de los siete campos
persistidos por muro difiere del valor homólogo del tipo:

- se usa el valor del tipo;
- se emite un finding `info`, categoría `wallType`, con `wallIds`;
- el dato divergente se conserva en el archivo hasta regenerar, pero queda descartado para el
  cálculo. La regeneración persiste el valor efectivo y elimina la divergencia.

No se aplica fallback parcial desde un override cuando el tipo existe: un tipo incompleto es
inválido.

Para un muro sin tipo se conserva exactamente la precedencia legacy:

```text
valor persistido por muro → default global del proyecto → default histórico de la función
```

Este camino mantiene operables los modelos migrados, pero emite un finding `info`, categoría
`wallRole`, por muro y ninguna regla condicionada a rol se evalúa. Los comandos nuevos no crean
defaults globales: `metalconDefaults` y `osbDefaults` quedan como fallback de compatibilidad y se
preservan mientras existan proyectos sin tipo.

### 3. Migración explícita a versión 2

`CURRENT_MODEL_VERSION` pasa a 2 y se agrega la migración pura `1→2`:

- agrega `wallTypes: []`;
- no agrega `wallTypeId` ni `role` a ningún muro;
- conserva byte a byte lógico los defaults globales, overrides, derivados y geometría;
- no inspecciona espesor, perfil, OSB, diagonales, ubicación ni nombre para inferir un rol.

Un archivo sin versión sigue el recorrido `0→1→2`. La migración es secuencial, pura e idempotente.
Se agrega un fixture v1 anterior al cambio con dos muros y series 90/60 distintas. El roundtrip
demuestra preservación de ambos juegos de valores sin fabricar tipos.

### 4. Aplicación explícita de reglas

Las tres reglas de `domainRules.js` ganan `aplicaA`, congelado junto al resto de su metadata:

| Regla | `aplicaA` |
|---|---|
| `osb.tornillo.borde` | `['MP1']` |
| `osb.cadeneta.ala` | `['MP1']` |
| `muro.vano.holguraManilla` | `['MP1', 'MP2', 'MP3', 'tabique']` |

`ruleAppliesToRole(ruleId, role)` comprueba pertenencia exacta. No existe comparación ordinal,
escala ni herencia. Con rol ausente devuelve `false`; R7 usará esta puerta al emitir checks.
R5 no agrega checks geométricos.

### 5. Mutaciones e invalidación

El store expone acciones trazables para crear, editar y eliminar tipos, y para asignarlos a un
muro:

- crear/editar valida mediante el contrato puro;
- editar nombre no invalida derivados;
- cambiar rol o cualquier default invalida centralizadamente `wallFraming` y `wallOsb` sólo en los
  muros que usan ese tipo;
- asignar, cambiar o quitar `wallTypeId` invalida ambos derivados del muro afectado;
- ninguna de esas acciones regenera;
- eliminar un tipo referenciado se bloquea con resultado explícito; nunca deja referencias rotas
  ni desasigna muros en silencio.

Dividir conserva el `wallTypeId` en ambos tramos. Unir y listar candidatos exige el mismo
`wallTypeId`, incluido `null`; tipos distintos bloquean la unión en vez de elegir el tramo más
largo.

### 6. Modulación, gap y nesting

La modulación individual y batch consume `resolveWallTypeConfig`:

- muros tipados usan exclusivamente los defaults del tipo;
- muros sin tipo conservan la salida legacy;
- los patches de regeneración persisten los valores efectivos y agregan `osbGap`;
- preview, dibujo y DXF usan `wall.osbGap` cuando existe, con fallback al gap global sólo para
  despieces legacy.

La opción pública `allowRotation` desaparece de `nestPieces`. Cada pieza lleva el rol resuelto del
muro y la rotación se deriva así:

| rol | rotación OSB |
|---|---|
| `tabique` | permitida |
| `MP1`, `MP2`, `MP3` o sin rol | prohibida |

`MP1` conserva la hebra vertical exigida para chapa estructural; `MP2` no usa OSB como sistema de
corte; `MP3` sigue siendo estructural y el único caso inequívocamente no estructural es `tabique`.
Un caller no puede forzar rotación pasando texto/configuración.

### 7. Coordinación UI

La UI permite:

- crear y editar tipos con nombre, rol y los dos grupos de defaults;
- asignar o quitar un tipo al crear/editar un muro;
- ver el tipo y rol efectivos en los modales de modulación;
- editar la configuración en el tipo cuando el muro está tipado, sin ofrecer un override que será
  ignorado;
- conservar el flujo legacy para muros sin tipo, rotulado como compatibilidad;
- ejecutar “Generar todos” cuando exista al menos un muro con configuración efectiva completa.

Los findings `wallRole` y `wallType` aparecen mediante el modal común cerrado en R4 y navegan al
muro con `wallIds`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Inferir MP1 por OSB, MP2 por diagonales o tabique por espesor | Usa derivados potencialmente stale y convierte geometría en una declaración estructural que el usuario nunca hizo |
| Guardar `role` tanto en el tipo como en cada muro | Crea dos autoridades y obliga a decidir precedencia en cada consumidor |
| Escala `tabique < MP3 < MP2 < MP1` | MP2 resiste corte sin placa; una escala le heredaría reglas OSB falsas |
| Override por muro sobre el tipo | Repite el problema de defaults divergentes y contradice el precedente `resolvePurlinParams` |
| Crear automáticamente tipos desde los siete overrides de `casa-L` | Aunque los valores coincidan, no demuestran si el muro es MP1, MP2, MP3 o tabique |
| Borrar defaults/overrides al migrar | Descarta datos importados y cambia la regeneración de modelos existentes |
| Permitir `allowRotation:true` desde configuración | Un parámetro libre puede rotar chapa estructural; el rol ya contiene la decisión necesaria |
| Unir muros de tipos distintos conservando el más largo | Cambia silenciosamente el rol y los defaults del tramo descartado |

## Alcance

- `src/core/wallTypes.js`: roles, validación, lookup, resolución de precedencia y rotación.
- `src/core/domainRules.js`: metadata `aplicaA` y consulta exacta por rol.
- `src/core/modelSchema.js`: versión 2, migración, validación de colección y referencias.
- Fixture v1 con dos juegos de defaults de muro y pruebas de migración/roundtrip.
- `src/core/derivedInvalidation.js`, store y contrato de mutadores de tipos/asignación.
- `src/core/wallSplitMerge.js`: preservación y compatibilidad de `wallTypeId`.
- Modulación Metalcon/OSB individual y batch.
- Nesting OSB y propagación del rol por pieza.
- Gap efectivo por muro en preview y DXF.
- UI mínima de CRUD/asignación de tipos y lectura de configuración efectiva.
- Findings informativos de rol ausente y override ignorado.
- Documentación, trazabilidad y cierre por corte.

## Fuera de alcance

- Inferir o asignar roles automáticamente a `casa-L` u otro modelo.
- Emitir checks geométricos de R7.
- Agregar reglas nuevas al catálogo, capacidades de corte o largos MP2/MP3.
- Implementar encuentros L/T, traslape o eliminar `backup`; corresponde a R6.
- Cambiar la geometría de montantes, placas o cadenetas.
- Regenerar derivados al cambiar tipo o rol.
- Eliminar los defaults globales legacy mientras existan modelos sin tipo.
- Cambiar metrado, secciones CalculiX o formato INP.
- Informe markdown; corresponde a R8.
- Resolver el fixture integral independiente de `SPEC-003`/R-006.

## Criterios de aceptación

1. El contrato acepta exactamente `MP1`, `MP2`, `MP3` y `tabique`; rechaza tipos con ID/nombre
   inválido, rol desconocido, defaults incompletos, números no finitos, `minPanelWidth < 200` o
   perfiles C/U incompatibles.
2. Un muro tipado resuelve exclusivamente los defaults de su tipo. Cada override divergente
   produce `info` con `wallIds` y no cambia el resultado efectivo.
3. Un muro sin tipo conserva `deepEqual` la configuración y salida legacy, produce `wallRole`
   `info` y no satisface ninguna regla condicionada.
4. `modelVersion` 2 valida `wallTypes` y referencias. Los fixtures recorren `0→1→2` y `1→2` de
   forma pura e idempotente, conservan los juegos de overrides/defaults y no crean roles ni tipos.
5. Las tres reglas declaran exactamente los `aplicaA` decididos, congelados. MP2 no hereda reglas
   OSB y la holgura de manilla aplica a los cuatro roles.
6. Crear/editar/asignar tipos entra al historial; rol/defaults/asignación invalidan framing+OSB
   sólo en muros afectados y nunca regeneran. Renombrar no invalida.
7. No se puede eliminar un tipo usado. Dividir preserva el tipo y unir/candidatos rechazan tipos
   distintos, sin pérdida silenciosa.
8. Modulación individual, batch y “Generar todos” usan la misma resolución efectiva. Un fixture
   con tipos serie 90 y 60 genera cada muro con sus perfiles/pasos sin overrides manuales.
9. Regenerar persiste `osbGap`; preview y emisores DXF usan el gap del muro. Despieces legacy sin
   `osbGap` conservan `deepEqual`/bytes respecto del baseline.
10. `allowRotation` deja de ser una opción aceptada. Sólo piezas de `tabique` pueden rotar; MP1,
    MP2, MP3 y muros sin rol no rotan aunque un caller intente pasar el flag anterior.
11. La UI permite CRUD/asignación, muestra tipo/rol/configuración efectiva, no ofrece overrides en
    muros tipados y conserva explícitamente el camino legacy sin tipo.
12. Revertir por separado contrato/migración, invalidación/store y adopción/rotación rompe al menos
    una prueba de cada corte.
13. `make governance` y `npm run validate` terminan con código 0; cualquier DXF tocado pasa
    `ezdxf doc.audit()` con 0 errores y 0 reparaciones. No aplica smoke CalculiX porque R5 no
    modifica emisores ni archivos INP.

## Evidencia

- Pruebas unitarias de `wallTypes`: shape, precedencia, findings, `aplicaA` y rotación.
- Pruebas de `modelSchema` con fixture v1, secuencia `0→1→2`, roundtrip y referencias rotas.
- Contratos de store/invalidación para CRUD, asignación, undo/redo y bloqueo de eliminación.
- Pruebas de split/merge con tipos iguales, distintos y ausentes.
- Pruebas de modulación batch con dos tipos/perfiles y regresión `deepEqual` del camino legacy.
- Pruebas de nesting por rol, incluido intento de usar el antiguo `allowRotation`.
- Inspección reproducible de coordinación UI y findings navegables.
- Auditoría `ezdxf` 0/0 de cada salida modificada y comparación byte a byte del caso legacy.
- Prueba de reversión por corte.
- Cierres `sessions/close-SPEC-R5-*.md`.

## Corte sugerido

| Corte | Unidad cerrable |
|---|---|
| **A** | Contrato puro de tipos/roles, `aplicaA`, resolución efectiva y migración `modelVersion` 2 |
| **B** | CRUD/asignación en store, invalidación central y contratos de dividir/unir |
| **C** | Adopción en modulación, gap/DXF, nesting por rol y coordinación UI |

El orden es A → B → C. A fija el formato persistido antes de cualquier mutador; B garantiza que
ninguna mutación deja derivados válidos por error; C conecta consumidores y React sólo después de
cerrar ambos contratos puros.
