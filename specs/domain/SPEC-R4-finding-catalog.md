# Spec R4 — Contrato de findings y catálogo de reglas

> Cuarta unidad del plan de reglas de dominio.
> Base: commit `948724c`, suite 578/578.
> Decisiones de origen: legado **D-014**, **D-015**, **D-016** y **D-032**.

## Diagnóstico

El proyecto ya tiene un vocabulario útil de hallazgos, pero no un contrato compartido:

- `modelValidation.js` construye 27 hallazgos mediante un helper privado con
  `{ severity, category, message, elementIds }`;
- `analysisReadiness.js` construye otros 10 objetos equivalentes de forma literal;
- `trussLayout.js` y `roofPlaneValidation.js` repiten helpers con `roofSystemIds` y
  `roofPlaneIds`;
- existen 29 llamadas directas a `findings.push` en tres módulos de techumbre;
- existen 51 llamadas a `warnings.push` en 14 módulos, pero son resultados locales de generación,
  importación o exportación y no todas representan findings de dominio.

La cifra del roadmap —47 warnings en 16 módulos— quedó obsoleta. El conteo anterior mezclaba
contratos distintos y R3 agregó una advertencia local de modulación. R4 no convierte esos 51 sitios
por fuerza.

`ValidationModal` conserva la distinción entre `elementIds`, `roofSystemIds` y `roofPlaneIds`, pero:

- no despacha `wallIds`;
- los findings `info` de `validateModel` cuentan en el total y después no se dibujan;
- los findings `info` de techumbre se dibujan como advertencias;
- no existe una presentación común de `rule`, `measured` y `limit`.

El catálogo todavía no existe. Para las primeras reglas hay además dos condiciones de datos:

1. `casa-L` conserva `osbDefaults.gap = 3`, mientras los proyectos nuevos usan 5 mm. El límite de
   ala de cadeneta debe usar el gap efectivo y dar 23 mm o 25 mm respectivamente; no puede
   normalizar el modelo importado de manera silenciosa.
2. Las publicaciones oficiales disponibles no declaran número de edición en el documento del
   Manual Práctico LP. La identidad no se puede inventar desde la fecha del archivo.

Fuentes oficiales verificadas el 27-jul-2026:

- Manual Práctico de Construcción LP, Anexo 3 — Sistema estructural de acero galvanizado liviano:
  <https://lpchile.cl/wp-content/uploads/2017/08/03_ANEXO_METALCON-253_268.pdf>.
- Catálogo LP OSB APA, código de documento `OSB TEC 240821`:
  <https://lpchile.cl/wp-content/uploads/2017/09/CATALOGO-APA-FINAL-2.pdf>.

## Decisión

### 1. Catálogo puro e inmutable

Se crea `core/domainRules.js` sin dependencias de React ni del store. Cada regla declara:

```js
{
  id,
  titulo,
  descripcion,
  scope,       // sistema | proyecto | oficina | elemento
  origen,      // manual | derivado | obra
  severity,    // error | warning | info
  unidad,
  fuente,      // null o { doc, ed, seccion, url, consultado }
  dependsOn,   // ids de otras reglas; [] cuando no aplica
  resolveLimit // función pura; devuelve { min?, max?, equal?, unit } o null
}
```

No se evalúan fórmulas de texto. `resolveLimit` es código puro declarado por la aplicación. Si falta
un dato necesario, devuelve `null`; no aplica defaults ocultos.

El primer catálogo contiene exactamente:

| Regla | Taxonomía | Límite |
|---|---|---|
| `osb.tornillo.borde` | `sistema` / `manual` / `error` | mínimo 10 mm |
| `osb.cadeneta.ala` | `sistema` / `derivado` / `error` | `2 × 10 mm + gap efectivo`; depende de `osb.tornillo.borde` |
| `muro.vano.holguraManilla` | `proyecto` / `obra` / `info` | rango 50–60 mm |

Una regla `manual` exige `fuente.doc`, `fuente.ed` y `fuente.seccion`. Si la publicación oficial no
declara edición, `ed` dice literalmente `sin edición declarada` y se fijan URL y fecha de consulta;
la fecha del upload no se presenta como edición. Una regla `obra` no puede llevar fuente y no puede
superar severidad `info`.

### 2. Shape canónico, compatible con legacy

Se crea un constructor puro para:

```js
{
  severity,
  category,
  rule,
  measured,
  limit,
  message,
  elementIds,
  wallIds,
  roofSystemIds,
  roofPlaneIds
}
```

- Los campos de IDs permanecen tipados. No existe `ids` genérico.
- Sólo se incluyen los campos de ID entregados; no se agregan arrays vacíos que alteren
  `deepEqual` de findings legacy.
- `rule`, `measured` y `limit` son opcionales para findings heredados.
- Un finding de dominio con `rule` exige que el ID exista en el catálogo.
- `measured` es `null` para dato no verificable o `{ value, unit }` con número finito.
- `limit` es `null` si la regla no se pudo resolver o un objeto con `min`, `max` o `equal` finito y
  `unit`. Nunca se usan booleanos para `measured` ni `limit`.
- La cita no se copia al finding: se resuelve desde `rule` en el catálogo.

### 3. Adopción por fronteras

Los helpers de `modelValidation`, `analysisReadiness`, `validateRoofSystems` y
`validateRoofPlanes` pasan a usar el constructor compartido sin cambiar su salida observable. Los
findings internos de cálculo pueden seguir siendo objetos mínimos; se normalizan en la frontera que
les agrega el ID navegable.

Las 51 advertencias locales no se migran en R4. Convertir una advertencia de un generador o
exportador en finding exige decidir su categoría, severidad y destino; hacerlo mecánicamente
mezclaría contratos.

### 4. Presentación y navegación

`ValidationModal` muestra `error`, `warning` e `info` sin perder ninguno. Un finding con regla
muestra medida, límite y fuente cuando corresponda. La navegación despacha por campo tipado con
esta prioridad:

1. `roofPlaneIds`;
2. `roofSystemIds`;
3. `wallIds`;
4. `elementIds`.

`wallIds` centra el primer muro igual que un `elementId`. Un finding sin IDs no presenta botón.

R4 prueba el recorrido catálogo → límite → finding → presentación con
`osb.cadeneta.ala`, pero **no inspecciona el modelo para emitir la violación**. La generación de
checks de cadeneta y holgura de manilla permanece en R7.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Reemplazar de una vez los 51 `warnings.push` | Son contratos locales heterogéneos; una migración mecánica inventaría severidades y navegación |
| Campo genérico `ids` | Rompe el despacho existente y pierde el tipo de destino |
| Copiar `fuente` dentro de cada finding | Duplica metadata y permite que una regla y sus hallazgos se contradigan |
| Guardar fórmulas como strings evaluables | Agrega una vía innecesaria de ejecución de texto; los límites son funciones puras de código |
| Aplicar gap 5 a `casa-L` al abrirlo | Cambia silenciosamente datos importados; con gap 3 el límite derivado correcto es 23 mm |
| Inventar una edición desde `2017/08` en la URL | La fecha de publicación no demuestra una edición documental |
| Implementar ahora los checks | La separación vigente es catálogo/shape en R4 y evaluación de reglas en R7 |

## Alcance

- `src/core/domainRules.js`: catálogo, lookup, validación de metadata y límites puros.
- `src/core/domainFindings.js`: constructor y validación del shape canónico.
- Fronteras de `modelValidation.js`, `analysisReadiness.js`, `trussLayout.js` y
  `roofPlaneValidation.js`.
- Presentación y navegación de findings en `ValidationModal.jsx`.
- Pruebas unitarias del catálogo, shape, compatibilidad legacy y presentación.
- Documentación, trazabilidad y cierre por corte.

## Fuera de alcance

- Emitir checks contra geometría real; corresponde a R7.
- Corregir puertas, perfiles, cadenetas o valores importados.
- `wallTypes`, roles MP1/MP2/MP3/tabique y `aplicaA`; corresponde a R5.
- Migrar los 51 warnings locales o cambiar APIs de generadores/exportadores.
- Persistir reglas o findings dentro del modelo.
- Cambiar invalidación de derivados.
- Informe markdown; corresponde a R8.
- DXF, INP, CalculiX, geometría y metrado.

## Criterios de aceptación

1. El catálogo contiene exactamente las tres reglas iniciales y rechaza IDs, taxonomías o
   dependencias inválidas.
2. Las reglas y su metadata quedan congeladas; un consumidor no puede mutarlas.
3. Toda regla `manual` tiene `{doc, ed, seccion, url, consultado}`; `obra` tiene `fuente:null` y
   severidad `info`.
4. `resolveLimit('osb.cadeneta.ala', {gap:3})` da mínimo 23 mm,
   `{gap:5}` da 25 mm y un gap no resoluble da `null`.
5. `muro.vano.holguraManilla` resuelve el rango 50–60 mm y no contiene cita normativa.
6. El constructor produce un finding de cadeneta con medida y límite numéricos, `wallIds`, sin
   campo `ids`, y rechaza booleanos, números no finitos o reglas inexistentes.
7. Los resultados legacy de `validateModel`, `checkAnalysisReadiness`, `validateRoofSystems` y
   `validateRoofPlanes` quedan `deepEqual` contra baselines capturados antes de cada adopción.
8. El modal presenta los tres niveles de severidad, incluidos los `info` de modelo, y muestra
   medida/límite/fuente de un finding de dominio.
9. La navegación cubre los cuatro campos tipados con la prioridad decidida; sin IDs no aparece
   acción.
10. `rg -o "warnings\\.push" src | wc -l` permanece en 51 salvo una spec posterior explícita.
11. Revertir por separado catálogo/shape, adopción y presentación rompe al menos una prueba de cada
    corte.
12. `make governance` y `npm run validate` terminan con código 0; no aplican auditoría DXF ni smoke
    CalculiX porque R4 no toca esos emisores.

## Evidencia

- `tests/domainRules.test.mjs`: catálogo, metadata, fuentes y resolución de límites.
- `tests/domainFindings.test.mjs`: shape, IDs tipados y entradas inválidas.
- Pruebas de regresión de los cuatro productores públicos con baseline `deepEqual`.
- Pruebas puras de presentación/navegación usadas por `ValidationModal`.
- Conteo reproducible de warnings locales.
- Prueba de reversión por corte.
- Cierres `sessions/close-SPEC-R4-*.md`.

## Corte sugerido

| Corte | Unidad cerrable |
|---|---|
| **A** | Catálogo de tres reglas, resolución de límites y constructor canónico |
| **B** | Adopción en las cuatro fronteras, preservando `deepEqual` los findings legacy |
| **C** | Presentación de severidad/datos/fuente y navegación por los cuatro IDs tipados |

El orden es A → B → C. A fija el contrato puro; B demuestra compatibilidad antes de tocar React; C
sólo coordina y presenta el contrato ya probado.
