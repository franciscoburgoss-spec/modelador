# Spec R3 — La cadeneta como pieza de tabiquería

> Tercera sesión del plan de reglas de dominio. **Modelo: Opus.**
> Base: `modelador-v49-R2.zip`, suite 518/518.
> Decisiones que la originan: **D-020**, **D-021** (`00-decisiones.md`).

> ⚠ **Esta spec reemplaza el diagnóstico de `plan-R-reglas.md` §R3.** La medición previa lo corrigió
> en cuatro puntos, y uno de ellos cambia el alcance: el metrado **no se mueve solo**, hay que
> crearlo. Lo que manda es este archivo.

---

## 1. Diagnóstico — medido sobre `casa-L`

> **Nota de fixture.** `casa-L.json` y `modelo-26.json` comparten `elements` byte a byte: para
> tabiquería son el mismo caso (ficha en `00-estado.md`). Todas las cifras valen para ambos.

### 1.0 Punto de partida

La cadeneta existe, pero como **subproducto del despiece de placas**, no como pieza de acero:

| dónde | qué es hoy |
|---|---|
| `osbModulation.js:295-310` | `computeNoggings(bounds, openings, length, round1)` — emite `{z, oMin, oMax, role:'nogging'}` |
| `osbModulation.js:492` | se llama dentro de `computeOsbPanelLayout` |
| store / `batchModulation.js:109` | se persiste en `wall.osbNoggings`, no en `wall.studs` |
| `exportFramingDxf.js:520-523` | se dibuja con `NOGGING_H = 60` en la capa `OSB` |
| `render/osbModulation.js:58-60` | preview del modal, mismo criterio |
| `takeoff.js` | **no aparece** |
| `exportCalculix.js` | **no aparece** (por omisión, no por guarda) |
| `ROLE_TAG` | **sin entrada** — es la deuda A-5 |

### 1.1 Es un tramo continuo, no un despiece

`computeNoggings` corta el tramo solo donde la junta cruza el vacío de un vano. Medido:

| medida | valor |
|---|---|
| muros con cadeneta | **40** de 45 |
| tramos emitidos hoy | **67** |
| largo total bruto | **156,10 m** |
| piezas si se despieza entre montantes | **≈ 506** |
| largo neto descontando el ancho del montante | **≈ 136,87 m** |

El mayor: muro `1784600403613`, 11.500 mm de un tirón, **1 tramo** para 70 montantes.

> Las dos últimas cifras son una estimación con `B = 38` uniforme. **El número exacto sale de
> `studFlangeSpan`** (R2), que ya conoce la cara real de cada montante — ver §2.2.

### 1.2 `NOGGING_H = 60` es un número inventado

`exportFramingDxf.js:520`, textual: *"mm, solo representación gráfica — el perfil real sale del
catálogo"*. El perfil real de ambos fixtures es `90CA085p`, **B = 38**. Y la banda se dibuja **bajo**
la junta (`n.z - NOGGING_H` a `n.z`), no centrada en ella.

### 1.3 Las dos cadenas de cotas del §7 son la misma regla con distinto gap

`00-reglas-de-dominio.md` §7 lleva dos cadenas sobre el ala de 38 que parecen incompatibles:
`7,5 | 23 | 7,5` (citada al manual) y el margen derivado de **6,5**. Ambas suman 38. Dibujadas a
escala y resueltas:

```
separacion de tornillos = gap + 2 · e_borde
margen al borde del ala = B/2 − gap/2 − e_borde
```

| gap | separación | margen | e_borde resultante |
|---|---|---|---|
| **3** (mínimo normativo) | 23 | **7,5** | 10,0 |
| **5** (LP, vigente por D-022) | 25 | **6,5** | 10,0 |

`7,5 | 23 | 7,5` está calculada con gap 3. **D-022 dejó el gap en 5**, así que la cadena vigente es
`6,5 | 25 | 6,5`. Las dos preservan `e_borde = 10,0` exacto y ninguna baja del límite resistente de
9,5. No hay conflicto que arbitrar: hay una fórmula mal registrada como resultado.

### 1.4 El metrado NO se mueve solo — hay que crearlo

**El plan R3 se equivoca acá, y es la corrección de alcance de esta spec.** Dice: *"El metrado se
mueve. `casa-L` / `90CA085` estaba en `count 30` / `ml 54.07846831134833` … Ahora sí."* Medido:

- Esa fila sale de `getGroup('roof', …)` (`takeoff.js:181`). Es **techumbre**, no tabiquería.
- `grep -c "studs" src/core/takeoff.js` → **0**. El takeoff nunca lee `wall.studs`.
- El muro se metra por **superficie neta** (`takeoff.js:89-101`): `length × height − Σ vanos`, con
  `count` = número de muros. `casa-L` da `count 45`, `ml 204,60`, `m2 586,20`.

Consecuencia: agregar `role:'nogging'` a `wall.studs` **no cambia una sola celda del takeoff**.
Metrar la cadeneta obliga a **crear** metrado de tabiquería por pieza, que hoy no existe.

**Decidido por Fran (R3 prep): sí entra a R3.**

### 1.5 La exclusión del `.inp` es obligatoria, no teórica

`exportCalculix.js:284`: `const studs = wall.studs;` — el emisor lee la colección completa y la
traduce a nodos + `ELSET`. Sin guarda explícita, R3 mete **≈506 barras horizontales** al modelo FEM
el mismo día que la cadeneta entra a `wall.studs`.

### 1.6 El `kerf` está acoplado al `gap`, y el acople está en la UI

`OsbNestingModal.jsx:68`:

```js
const [kerf, setKerf] = useState(model.osbDefaults?.gap ?? 5);
```

El ancho del disco de la sierra se inicializa desde la dilatación entre placas. Coinciden hoy en 5
por casualidad histórica. Bajar la dilatación cambiaría el disco.

### 1.7 Lo que el plan sí acierta

`computeCourseBreaks` (`osbModulation.js:265`) ya es **puro** —recibe `(wallHeight, panelHeight,
minCourseHeight, enforceMinCourse)` y no toca studs—. D-021 es implementable sin refactor previo.

---

## 2. Decisión

### 2.1 La cadeneta pasa a `wall.studs` con `role:'nogging'`

Es pieza de acero: se compra, se corta, se atornilla y se metra. `wall.osbNoggings` deja de ser la
fuente. El orden sin ciclo de D-021, con `batchModulation` de compositor:

```
computeCourseBreaks(wallHeight, panelHeight, …)   → jointZs   (puro, no usa studs)
metalconModulation(wall, …, jointZs)              → studs incl. role:'nogging'
computeOsbPanelLayout(wall, …, studs)             → placas    (ignora role:'nogging')
```

**Guarda obligatoria (D-021):** `computeOsbPanelLayout` filtra `role:'nogging'` de los studs que
recibe. Sin ella, la cadeneta que respalda una junta se cuenta a sí misma como respaldo de esa
junta.

### 2.2 El despiece se apoya en `studFlangeSpan` — no se inventa geometría

R2 dejó la cara real de cada montante en una sola función. La cadeneta va **de cara a cara** entre
montantes consecutivos:

```
pieza_i = [ studFlangeSpan(stud_i).xMax , studFlangeSpan(stud_{i+1}).xMin ]
```

No se resta `B` a ojo ni se asume que todos los montantes están al eje: los de extremo y las jambas
ya no lo están. Es el precedente de fuente única aplicado por tercera vez (`memberOffsetMode` →
`getRoofSystems` → `studFlangeSpan`).

Los cortes por vano de `computeNoggings` se conservan tal cual: donde la junta cruza el vacío no hay
material que fijar.

### 2.3 Geometría de la pieza — cerrada por el detalle en corte (D-030)

| propiedad | valor | por qué |
|---|---|---|
| altura de banda | **`B` real del perfil del muro** (38 en serie 90) | `NOGGING_H = 60` es inventado (§1.2) |
| posición | **centrada en la junta**: `[z − B/2, z + B/2]` | el ala recibe los dos bordes de placa; bajo la junta solo recibe uno |
| perfil | **heredado del montante del muro** | D-020 |
| exigencia | `B ≥ 2·e_borde + gap` → con `e_borde 10` y `gap 5`: **B ≥ 25** | U de B=25 queda al límite exacto: no sirve |
| cadena vigente | **`6,5 \| 25 \| 6,5`** | §1.3 — es la fórmula con gap 5 |

`zMin`/`zMax` de la pieza salen de esa banda, con el mismo shape que cualquier stud: R3 **no**
cambia el shape de `wall.studs`.

### 2.4 Metrado de tabiquería por pieza — Parte D

Sección nueva en `takeoff.js`, **aditiva**: la fila de muro por superficie **no se toca** (es la que
alimenta el presupuesto de revestimiento). Se agregan filas por perfil y rol, agrupando
`wall.studs` + `wall.headers`, con `count` = piezas y `ml` = suma de largos netos.

**El baseline se mueve por creación, no por corrección.** Las 11 filas actuales quedan idénticas;
aparecen filas nuevas. El cierre deja escritos los números nuevos.

### 2.5 Rótulo y capa

- `ROLE_TAG` gana `nogging: 'CD'` — cierra **A-5**. Leyenda: "Cadeneta" (`00-reglas-de-dominio.md`
  §6, fuente Manual Práctico LP §1.1). El precedente de R1 es que la fila de `SIMBOLOGIA` se
  reescribe, no se agrega bloque (D-031); acá es una fila nueva, y el margen medido en R1 lo
  permite (A3 quedó en 14 de 16).
- El rótulo pasa a ser **condicional a que exista pieza**: hoy `CADENETA + HUINCHA (junta
  horizontal @z=…)` se emite aunque el tramo no produzca cadeneta.
- Capa: **`MONTANTES`**, la capa de tabiquería que ya existe.

### 2.6 `kerf` desacoplado

`OsbNestingModal.jsx:68` pasa a un default propio de 5 mm, sin leer `osbDefaults.gap`. Es un valor
`origen: obra` (`00-reglas-de-dominio.md` §7), editable, sin cita de manual.

### 2.7 Exclusión del `.inp`

Guarda explícita en `exportCalculix.js`: `role:'nogging'` no genera nodo ni elemento. Mismo criterio
que `edgeChord` en techumbre — pieza de construcción, no de análisis.

### Alternativas descartadas — para no rediscutirlas

| alternativa | por qué no |
|---|---|
| Dejar la cadeneta en `wall.osbNoggings` y solo metrarla desde ahí | La cadeneta es acero, no placa. Vivir en el despiece de OSB es lo que la dejó fuera del metrado, del 3D y del `.inp` desde el principio |
| Capa DXF propia (`CADENETAS`) | Obliga a tocar `tablesSection`, la leyenda de las cuatro láminas y el orden de plumas — todo fuera del núcleo de R3. Se reevalúa si un revisor pide apagarla por separado |
| Rehacer el metrado de muro (de superficie a piezas) | La fila por superficie alimenta el revestimiento. Reemplazarla rompería el presupuesto para ganar una vista que se obtiene agregando |
| Elegir entre las cadenas `7,5\|23\|7,5` y `6,5\|25\|6,5` | Falsa disyuntiva: §1.3 muestra que son la misma fórmula con distinto gap |
| Restar `B` al offset para despiezar | Falso desde R2: los montantes de extremo y las jambas no están al eje. Hay que leer `studFlangeSpan` |

---

## 3. Alcance

**Se toca:**

- `osbModulation.js` — `computeNoggings` sale de `computeOsbPanelLayout`; guarda de `role:'nogging'`
  en `computeOsbPanelLayout`; `computeCourseBreaks` se expone como productor de `jointZs`.
- `metalconModulation.js` — recibe `jointZs` y emite `role:'nogging'` en `wall.studs`. **Único
  cambio permitido**: nada de roles, offsets ni `backupOffset`.
- `batchModulation.js` — compositor en el orden de §2.1.
- `exportFramingDxf.js` — banda desde el perfil real, centrada; capa `MONTANTES`; rótulo
  condicional; `ROLE_TAG.nogging`.
- `render/osbModulation.js` y `render/wall.js` — consumir la pieza real.
- `takeoff.js` — Parte D, sección aditiva.
- `exportCalculix.js` — guarda de exclusión.
- `sheetLegend.js` — fila `CD`.
- `OsbNestingModal.jsx` — `kerf` desacoplado.

**No se toca, explícitamente:**

- `trussLayout.js` — `studFlangeSpan` se **consume**, no se modifica. Si R3 necesita cambiarla, se
  para y se pregunta.
- La fila de metrado de muro por superficie.
- `wallTypes`, `core/domainRules.js`, shape del finding → **R4/R5**.
- `detectWallCorners`, el `backup`, el traslape de esquina → **R6**.
- Checks y findings nuevos → **R7**. R3 no emite ningún finding.
- Toda la techumbre.

Si aparece trabajo fuera de esta lista: se anota en `00-estado.md` y **no se hace**.

---

## 4. Criterios de aceptación

1. **La cadeneta vive en `wall.studs`** con `role:'nogging'` en los 40 muros que hoy tienen
   `osbNoggings`, y `wall.osbNoggings` deja de ser la fuente del dibujo.
2. **Despiezada entre montantes**: los 67 tramos pasan a **N piezas** (≈506; el número exacto lo fija
   `studFlangeSpan` y se escribe en el cierre). Ninguna pieza solapa un montante:
   `pieza.oMin ≥ span_i.xMax` y `pieza.oMax ≤ span_{i+1}.xMin` para todo par consecutivo.
3. **Banda centrada y con el perfil real**: `zMax − zMin = 38` (no 60) y `(zMin + zMax)/2 = z_junta`
   en las N piezas. `grep -c "NOGGING_H"` → **0**.
4. **Guarda de D-021 verificada**: el despiece de placas de `casa-L` es `deepEqual` contra el
   baseline capturado antes del cambio. Con la guarda revertida, cambia.
5. **Cortes por vano preservados**: el caso de `osbModulation.test.mjs:296` (puerta que cruza la
   junta → dos tramos) sigue produciendo dos corridas de piezas, no una.
6. **Fuera del `.inp`**: el `.inp` de `casa-L` tiene el mismo número de nodos y elementos que antes
   de R3. Comparación numérica, no visual.
7. **Metrado**: las 11 filas actuales `deepEqual` contra el baseline; las filas nuevas de tabiquería
   por pieza aparecen con `count` y `ml` escritos en el cierre.
8. **Rótulo `CD`** presente en la elevación de un muro con cadeneta, y **ausente** en un muro de una
   sola hilada. Leyenda con la traducción, sin truncado en A3.
9. **`kerf` desacoplado**: cambiar `osbDefaults.gap` no cambia el kerf del nesting.
10. **`ezdxf doc.audit()` 0/0** en los planos R12 y las láminas AC1015.
11. **Prueba de la prueba**: revertir cada parte por separado; cada una rompe sus tests. Reportar el
    conteo.
12. Suite verde: 518 + los nuevos. `vite build` OK.

---

## 5. Sugerencia de corte

El orden no es negociable en los dos primeros pasos: la pieza tiene que existir antes de dibujarla,
y la guarda de D-021 tiene que estar antes de que la pieza llegue a `computeOsbPanelLayout`.

| # | unidad | cerrable sola |
|---|---|---|
| **A** | Orden sin ciclo + `role:'nogging'` en `wall.studs` + guarda de D-021 + despiece por `studFlangeSpan` | **sí** — con los criterios 1, 2, 4, 5 |
| **B** | Dibujo: banda real centrada, capa, rótulo condicional, `ROLE_TAG.CD`, leyenda | sí — criterios 3, 8, 10 |
| **C** | Exclusión del `.inp` + `kerf` desacoplado | sí — criterios 6, 9. Ambos son guardas de una línea |
| **D** | Metrado de tabiquería por pieza | **sí, y es la más separable**: no depende de A salvo por las filas de cadeneta |

**Si la sesión se hace larga, cortar después de A.** Es la única parte que cambia datos persistidos;
B, C y D son presentación, guardas y agregación sobre esos datos. El orden inverso no sirve.

C se puede adelantar en cualquier momento: son dos guardas independientes de todo lo demás, y la
del `.inp` conviene tenerla **antes** de que A entregue las 506 piezas.

## 6. Fuera de alcance registrado

- `wallTypes` y la serie de perfil por muro (una casa con exteriores serie 90 y tabiques serie 60
  todavía no puede tener dos defaults) → **R5**.
- Cualquier check sobre la cadeneta —`B ≥ 2·e_borde + gap`, paso de tornillos— → **R7**. R3 genera
  la pieza; verificarla es otra cosa (`00-reglas-de-dominio.md` §8).
- La corrección de `00-reglas-de-dominio.md` §7 (§1.3 de esta spec) **ya está hecha en la prep**,
  junto con las decisiones **D-037…D-041**. R3 no vuelve sobre ella: la lee y la aplica.
