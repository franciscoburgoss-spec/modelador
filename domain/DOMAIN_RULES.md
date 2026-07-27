# 00 — Reglas de dominio

> Transversal: aplica a tabiquería, OSB, techumbre y fundaciones por igual. Se adjunta en **toda**
> sesión, sea del bloque que sea. El detalle de cómo se llegó a cada regla está en
> `cierre-discusion-reglas-de-dominio-v2.md` (consulta, no se adjunta).

---

## 1. Taxonomía

Toda regla tiene **invariante** (por qué existe — del sistema constructivo) y **valor** (cuánto —
casi siempre de proyecto, acotado por el invariante). Dos ejes independientes:

**`scope`** — quién puede cambiarlo: `sistema` · `proyecto` · `oficina` · `elemento`

**`origen`** — de dónde sale el número:

| origen | citable | editable | severidad máxima |
|---|---|---|---|
| `manual` | sí, con sección **y edición** | no | `error` |
| `derivado` | no, se calcula | no | `error` |
| `obra` | no | siempre | `info` |

**`origen = 'obra'` ⇒ `scope ≠ 'sistema'`.** Una regla `obra` nunca cita manual.

Prueba operativa para clasificar, en orden:
1. Si lo cambio, ¿sigue siendo Metalcon? No → `sistema`.
2. ¿El manual da valor único o rango? Rango → el rango es sistema, el valor es proyecto.
3. ¿Quién responde si está mal? Fabricante → sistema. El ingeniero que firma → proyecto.

**Las tolerancias numéricas no son reglas** y no entran al catálogo: `EPS`, `PERP_TOL`, `Z_TOL`,
`GAP_TOL`, `SPAN_TOL`, `MIN_TRAMO`.

---

## 2. Shape del finding

El proyecto ya tiene vocabulario. **No se inventa uno nuevo: se extiende.**

### Severidades — las tres que ya existen

`error` · `warning` · `info`. Mapeo al informe de revisión:

| código | informe |
|---|---|
| `error` | crítico |
| `warning` | moderado (incluye "valor al borde del rango permitido") |
| `info` | observación |

### Campos de id — **tipados, nunca genéricos**

En uso: `wallIds` · `elementIds` · `roofSystemIds` · `roofPlaneIds`.
`ValidationModal` **despacha según qué campo venga** para ofrecer "Ver faldón" / "Ver sistema", y
solo muestra el botón si hay ids. Un campo genérico rompería esa navegación.

Un finding sin ids apuntables lleva el array vacío **a propósito** (precedente: `legacyShadowed`).

### Shape

```js
{ severity, category, rule, measured, limit, message, <idsTipados> }
```

- `category` — la que ya usa el módulo (`supportLedger`, `purlinTemplate`, `plane`,
  `legacyShadowed`, `incompatibleSlope`, `invalidSupport`, `orphanTruss`…).
- `rule` — id de catálogo, tres niveles: `dominio.pieza.propiedad`
  (`osb.tornillo.borde`, `osb.cadeneta.ala`, `muro.jamba.armado`).
- `measured` / `limit` — **nunca booleano**. Las violaciones reales son marginales (margen 7,5 vs
  1,0 mm): "no cumple" no le sirve al revisor.
- La **cita vive en la regla**, no en el finding: `fuente: { doc, ed, seccion }` estructurada,
  porque un informe de revisión debe declarar contra qué edición chequeó.

---

## 3. Herencia — **el contenedor manda**

Precedente vivo: `resolvePurlinParams` (B4.7.2). La plantilla manda; si el faldón trae valores
propios que difieren, se emite finding `info` categoría `purlinTemplate` **y se usa el de la
plantilla**. Sin plantilla, cae a los valores propios.

Vale igual para `wallTypes`: **el tipo gana, el override se reporta y se descarta.**

> Corrección: `brief-reglas-de-dominio.md` decía "override-gana" citando este mismo precedente.
> Es al revés.

---

## 4. Convención de fase — `memberOffsetMode` es el mecanismo

Ya existe y es la fuente única de "dónde está la cara" para 2D, DXF y 3D:

```js
export const CHORD_RECT_MODE = { topChord: 'minus', bottomChord: 'plus' };
export function memberOffsetMode(role, ctx) { … }        // ctx opcional (D-034)
export function studFlangeSpan(stud, ctx, flangeWidth)   // → { xMin, xMax } en offsets locales
```

> **Estado: implementado en R2.** `ctx = { offset, length, jambMins, jambMaxs }`. Sin `ctx`, el
> comportamiento es el histórico, así que las dos llamadas de cercha no se tocaron. Los dos
> emisores de elevación (`exportFramingDxf.js` y `render/wall.js`) consumen `studFlangeSpan`:
> ya no hay bloque duplicado.

- `'plus'` → la línea es la cara **inferior** · `'minus'` → cara **superior** · `'center'` → eje.
- El `|| 'center'` significa que **hoy todas las piezas de muro ya son eje**. La convención elegida
  (`offset` = eje del ala) ya es la de facto; lo nuevo son solo las excepciones.

**Excepciones — las tres, ya vigentes** (el ala no puede invadir espacio que no es del muro):

1. Montantes de extremo de muro → a ras hacia adentro: `[0, B]` al inicio, `[L−B, L]` al fin (no
   de −19 a +19). **R2**: 89 piezas de `casa-L`, en 45 de 45 muros.
2. **Jambas de vano → a ras del vano, hacia afuera.** Ya estaba implementado; R2 lo mudó de sitio
   sin cambiar un solo número — las 273 jambas dan `deepEqual` contra el cálculo anterior.
3. **Precedencia: el extremo de muro gana sobre el borde de vano.** No se dibuja acero donde no hay
   muro. Medido: 3 piezas de `casa-L` salían 38 mm afuera porque ganaba la jamba; hoy **0**.

> **Corrección (R2, medida).** La versión anterior de esta tabla decía que `corner` y `backup`
> heredan la excepción de extremo. Falso para `backup`: está a 100 mm del extremo, no en él. Y su
> existencia misma la revisa **R6** — el `backup` es un préstamo de la tabiquería de madera que
> contradice el pilar compuesto contiguo del Anexo IV p.70 (**D-033**).
>
> También: la fase **no es propiedad del rol** sino del rol en su posición — el mismo `corner`
> necesita fase opuesta en `offset 0` y en `offset = length`. Por eso `memberOffsetMode` recibe un
> segundo argumento de contexto y **no** se crean roles nuevos (**D-034**).

Se declaran **en esa tabla**, no en cada emisor. Nota de cierre de s4, textual: *"si aparece un rol
nuevo de barra, definir su modo ahí y los tres consumidores quedan alineados solos."*

---

## 5. Rol de muro — nomenclatura del manual

| rol | qué es |
|---|---|
| `MP1` | con chapa estructural — corte por diafragma |
| `MP2` | sin chapa, con ángulo tensor y diagonales — corte por arriostramiento |
| `MP3` | resiste carga vertical y transversal, **no corte** |
| `tabique` | no estructural |

- El **tipo declara rol y valores**; la **regla declara a qué roles aplica**. El tipo nunca nombra
  una regla; la regla nunca nombra un tipo.
- **`aplicaA: [...]` es el dato. No hay escala ni herencia entre roles**: MP2 es muro de corte *sin*
  placa, así que las reglas de OSB no le aplican aunque las de corte sí.
- Un tipo **no puede aflojar** una regla `manual`. Sí puede cambiar valores, y el límite de reglas
  `origen: 'obra'`.
- **Nunca inferir el rol de la geometría.** Sin rol declarado no se aplica ninguna regla condicionada
  a rol, y sale finding `info`.
- Cambiar el rol **marca stale, nunca regenera solo** (precedente `studsStale` / `osbStale`).

---

## 6. Nomenclatura de piezas

`role` es **identificador** (no cambia, sin migración). El rótulo del plano es presentación.

`ROLE_TAG` ya rotula con **letras**, que es lo correcto en una elevación densa:

| role | tag | nombre chileno |
|---|---|---|
| `stud` | (agrupado) | pie derecho |
| `edge` | `E` | cabezal |
| `corner` | `T` | cabezal (pilar conformado con `backup`) |
| `backup` | `R` | refuerzo de pilar |
| `king` / `jack` | `K` / `J` | jamba |
| `header` | `D` | dintel |
| `sill` | `A` | alfeizar |
| `cripple` | `C` | **muchacho** |
| `crippleTop` | `CS` | **puntal** |
| `nogging` | — | cadeneta |

**Cerrado en R1:** `header` y `sill` ganaron tag (`D` / `A`) y se rotulan en elevación —
`pieceLabelEntities` recibe la colección `headers`, no solo `studs`. La leyenda de la lámina traduce
las nueve letras a nombre chileno: **la fila de `SIMBOLOGIA` que ya existía es la traducción**, no
un bloque aparte (ver D-031). Fuente de los nombres: Manual Práctico LP §1.1.

Queda solo `nogging` sin tag: no es pieza de tabiquería todavía → **R3**.

"Alfeizar" va sin tilde en LP → pasa `sanitizeDxfText` sin tocar nada.

---

## 7. Valores fijados, con fuente

| valor | fuente | origen |
|---|---|---|
| Tornillo a borde de placa **10 mm** (límite resistente **9,5**) | Anexo IV MP1 · §1.5.2.1 · LP APA | manual |
| Dilatación entre placas **5 mm** (mínimo normativo 3) | Manual Práctico LP · Anexo IV MP1 | manual |
| Cadena sobre el ala: **`separacion = gap + 2·e_borde`** · **`margen = B/2 − gap/2 − e_borde`**. Con B 38, e_borde 10 y **gap 5** (D-022): **6,5 \| 25 \| 6,5**. Con gap 3 da 7,5 \| 23 \| 7,5 — es la misma regla, y así aparece citada en el manual | Anexo IV MP1 · **D-037** | manual |
| Margen de junta con C 38 y gap 5 = **6,5**. **El número depende del gap: no se cita suelto** (ver fila anterior y D-037) | — | derivado |
| Cadeneta: perfil **heredado del muro**; exige `B ≥ 2·e_borde + gap` (= **25** con e_borde 10 y gap 5). Perfil U (B=25) queda al límite exacto: **no sirve**. Banda **centrada en la junta**, altura = `B` real (D-038) | — | derivado |
| Paso de montante **≤ 610** (MP1) · **≤ 600** (MP2) | §1.5.2.1 · Anexo IV | manual |
| Tornillos: **@100** encuentros L/T/fin · **@150** borde de placa · **@300** campo | Anexo IV p.70 · §1.5.2.1 | manual |
| N°10×3/4″ **@150 zig-zag** cose las piezas del pilar compuesto (acero-acero, no placa) | Anexo IV p.70 | manual |
| Junta de placa **siempre sobre pie derecho** — la placa se recorta; el 1220 no es módulo | LP §1.3 | manual |
| Largo de panel: MP2 **3,0–5,0 m** · MP3 **≤ 5 m** | Anexo IV | manual |
| Capacidad de corte OSB 7/16 una cara **417 kgf/m** sismo · 542 viento | §1.5.2 | manual |
| Muro contable: revestido en toda la altura, sin aberturas, L ≥ 1,20 m con h = 2,4 (o h/L < 2:1) | §1.5.2.1 | manual |
| OSB **e = 15 mm mín** en escantillón III. Alternativa de proyecto para subir capacidad de corte | Anexo IV p.81 | manual |
| Armado de jamba **según cálculo**. Default espalda con espalda, `check: null` | Anexo IV MP1/MP2 | manual |
| `supportElevation` = cara **inferior** de la cuerda inferior; solera en `[supportElevation − h, supportElevation]`; **`hSolera ≤ supportOffset`** | B-01, confirmado por Fran | derivado |
| Cuerda inferior parte en la **cara interior** del muro canaleta; la solera va **contra** esa cara, del lado del recinto | B-01 / s4, confirmado por Fran | manual (obra) |
| `MIN_EDGE_MARGIN`: invariante *no coincidir término de placa con vano* + valor **100** | Anexo IV | mixto |
| `MIN_COURSE_HEIGHT = 300` — manejabilidad de la tira | — | **obra** |
| `kerf = 5` — ancho del disco, **desacoplado del gap** | — | **obra** |
| Distancia montante–jamba: **< 30** `error` · **30–150** `warning` | — | mixto |
| Tolerancia llegada de cercha ↔ jamba **19 mm** (media ala) | Anexo IV p.73 | derivado |
| Traslape de esquina L: **lapa el muro más largo** → mayor \|dx\| → menor id | — | **oficina** |
| **Holgura de manilla**: borde de vano de puerta a **50–60 mm** de la cara del muro perpendicular. Sin ella la hoja no abre 90° | terreno (Fran) | **obra** |
| Encuentro L/T: montantes **contiguos y cosidos** (N°10×3/4″ @150 zig-zag). **Sin** montante de respaldo separado | Anexo IV p.70 | manual |
| Ala del montante: **B = 38** en serie 90 (`90CA085p`) → media ala **19** | catálogo Cintac | derivado |

**Aviso de cobertura:** las cerchas del proyecto (pendiente 3,9–17,7 %, monopitch) están **fuera del
rango tabulado** del Anexo III (30–100 %, dos aguas). Las reglas de cercha serán en su mayoría
`derivado` u `obra`, **no** `manual`. No citar el Anexo III para una pendiente de 4 %.

---

## 8. Reglas de trabajo del dominio

- **El detalle va antes de la decisión.** Corte o elevación primero, criterio después.
- **No inventar geometría.** Dato que no resuelve → no se dibuja y se avisa.
- **Generar y verificar son cosas distintas.** Un `check` puede cruzar módulos donde generar no debe
  (el check de apoyo de cercha lee techumbre y tabiquería sin acoplar la generación).
- Un `check` **no re-genera y compara** — eso detecta staleness, no violación.
- **`check: null` es valor legítimo.** Anclar desde vanos y escalonar cursos impares son política de
  layout: producen otro despiece, igual de válido.
- **La validación reporta, no bloquea** — excepto el `.inp`.
- El informe declara **cobertura**: lo que pasó, lo que falló y lo que **no se pudo verificar**.
- **El plano lleva criterios, no observaciones.** Los findings van a pantalla y al informe markdown;
  el cuadro de criterios se llena automático desde el catálogo en `NOTAS GENERALES`.
- **Fuente única de verdad.** Precedentes que funcionaron: `memberOffsetMode` alineó 2D/3D/DXF;
  `getRoofSystems` unificó la fuente de techumbre. Toda propuesta debería poder explicarse así.
