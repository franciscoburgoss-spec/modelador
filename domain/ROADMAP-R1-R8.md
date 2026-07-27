# Plan R — Reglas de dominio declaradas

> Ocho sesiones. Cada una cierra con los cinco requisitos de `00-protocolo.md` §4.
> Reescrito el 26-jul-2026 tras revisar los `cierre-*.md`: **R1 y R2 se abarataron**, R4 se corrigió.

---

## R1 — Leyenda de nomenclatura chilena · Sonnet — ✅ CERRADA

> Cerrada con Parte A + B + C. Suite 507/507, `ezdxf audit` 0/0 en 36 archivos. Ver `cierre-R1.md`.
> Dos desvíos respecto de lo previsto acá: (1) el hallazgo de que `header`/`sill` viven en la
> colección `headers` y no llegaban al rotulador — agregar claves a `ROLE_TAG` no bastaba;
> (2) la leyenda se resolvió reescribiendo filas existentes, no agregando un bloque (**D-031**).

**Diagnóstico.** `ROLE_TAG` (`exportFramingDxf.js:167`) rotula con letras —`E`, `T`, `R`, `K`, `J`,
`C`, `CS`— y no hay nada que las traduzca en la lámina. Además `header`, `sill` y `nogging` no
tienen entrada: dintel, alfeizar y cadeneta no se rotulan.

**Decisión (D-029).** El `role` no cambia — es identificador, y cambiarlo obligaría a migrar modelos
guardados sin ganar nada. Se agrega la traducción letra → nombre chileno a la leyenda de la lámina,
y las tres entradas faltantes a `ROLE_TAG`.

Nombres: Manual Práctico LP §1.1 — pie derecho, cabezal, jamba, dintel, alfeizar, **muchacho**
(`cripple`), **puntal** (`crippleTop`), cadeneta. "Alfeizar" sin tilde.

**No se toca:** `metalconModulation.js`, el shape de `wall.studs`, ningún cálculo.

**Aceptación.** La lámina de tabiquería muestra la leyenda completa; `ezdxf doc.audit()` 0/0;
metrado sin movimiento (`deepEqual` contra el baseline).

---

## R2 — Fase: tres excepciones en `memberOffsetMode` · Opus — ✅ CERRADA

> Cerrada con Parte A + B. Suite 518/518, `ezdxf audit` 0/0 en 40 archivos, metrado idéntico.
> Ver `cierre-R2.md`. Sin desvíos respecto de `spec-R2.md`: la medición previa se confirmó
> exacta. Decisiones nuevas: **D-035** (derogación parcial de la excepción 2 de D-019) y
> **D-036** (span a mundo por los dos extremos).

> ⚠ **La medición previa a la spec corrigió tres cosas de lo que dice esta sección.** Manda
> `spec-R2.md`, no esto:
> 1. La jamba **ya va a ras** (273 piezas). No come 19 mm: el hack existe, pero **duplicado** en
>    `exportFramingDxf.js` y `render/wall.js`, fuera de `memberOffsetMode`.
> 2. Lo que sí sobresale son los **89 montantes de extremo** (19 mm), en 45 de 45 muros.
> 3. El criterio de aceptación "2D, 3D y DXF dan la misma cota" es **inalcanzable**: el 3D no
>    dibuja montantes de muro (`buildWallBoxes` hace cajas sólidas). No hay nada que comparar.

**Diagnóstico.** `memberOffsetMode(role)` devuelve `CHORD_RECT_MODE[role] || 'center'`, así que hoy
**todas** las piezas de muro son `'center'` = eje. Correcto para el montante de campo; incorrecto en
tres casos donde el ala invadiría espacio ajeno. El más grave: la jamba se centra en el borde del
vano y le come **19 mm por lado** al vano libre.

**Decisión (D-019).** Registrar las tres excepciones en esa tabla, no en cada emisor:
extremos de muro a ras · `corner`/`backup` heredan · jambas a ras del vano hacia afuera.

Es exactamente lo que invita la nota de cierre de s4. **No se crea mecanismo nuevo.**

**Riesgo.** `CHORD_RECT_MODE` hoy es un mapa `role → modo` plano, y dos de las excepciones dependen
del **extremo** (inicio o fin del muro) y del **lado del vano**, no solo del rol. Resolver si eso se
expresa con roles nuevos o con un segundo argumento **antes** de codificar.

**Aceptación.** Vano libre modelado = vano dibujado, en `casa-L` y `modelo-26`. Entramado sin
cambio. 2D, 3D y DXF dan la misma cota para cada cara (comparación miembro a miembro, patrón de
`tests/build3dMemberOffset.test.mjs`).

---

## R3 — Cadeneta como pieza de tabiquería · Opus

> ⚠ **La medición previa a la spec corrigió cuatro cosas de esta sección.** Manda
> `spec-R3.md`, no esto:
> 1. **El metrado no se mueve: hay que crearlo.** `takeoff.js` no lee `wall.studs`; el muro
>    se metra por superficie neta. El `90CA085 count 30 / ml 54,078` citado abajo es una fila
>    de **techumbre**, no de tabiquería. Entra a R3 como Parte D (D-040).
> 2. Las cifras son bajas: no es "1 cadeneta → 6 piezas", son **67 tramos → ≈506 piezas**
>    (156,10 m brutos → ≈136,87 m netos).
> 3. La exclusión del `.inp` **no es teórica**: `exportCalculix.js:284` lee `wall.studs`.
> 4. El `kerf` está acoplado al `gap` **en la UI** (`OsbNestingModal.jsx:68`), no solo en un
>    comentario.

**Decisión (D-020, D-021).** Orden sin ciclo:
`computeCourseBreaks` (puro, no usa studs) → `metalconModulation(wall, …, jointZs)` →
`computeOsbPanelLayout(wall, …, studs)`. El compositor es `batchModulation`.

Incluye: `role:'nogging'` en `wall.studs` · perfil heredado del montante · despiece entre montantes ·
**centrada** en la junta (hoy va debajo, `exportFramingDxf.js:506`) · altura de banda = ala real (hoy
`NOGGING_H = 60` inventado) · capa de tabiquería (hoy `OSB`) · rótulo condicional a que exista pieza
(hoy incondicional) · `kerf` desacoplado del `gap` · exclusión del `.inp`.

**Guarda obligatoria:** `computeOsbPanelLayout` ignora `role:'nogging'` en los studs que recibe.

**El metrado se mueve.** `casa-L` / `90CA085` estaba en `count 30` / `ml 54.07846831134833`, y s5
verificó que no se movía. Ahora sí: hay que **re-baselinar y dejar el número nuevo escrito en el
cierre**. Un muro de 4 m con paso 600 pasa de 1 cadeneta a 6 piezas.

**Precedente de contraste:** la banda de solera de s5 es *referencia, no despiece* — no entra en
`wall.studs` ni se metra. La cadeneta es lo contrario, y por eso sí entra.

---

## R4 — Shape del finding + catálogo · Opus

**Diagnóstico.** Tres formas conviven: 29 `findings.push`, 47 `warnings.push` con strings libres en
16 módulos, y `modelValidation.issue(severity, category, message, elementIds)`.

**Decisión (D-016).** Extender, no reemplazar. Severidades `error`/`warning`/`info` — las que ya
existen. **Campos de id tipados** (`wallIds` 21 usos · `elementIds` 15 · `roofSystemIds` 6 ·
`roofPlaneIds` 4): `ValidationModal` despacha según cuál venga, y un campo genérico rompería la
navegación. Se agregan `rule`, `measured`, `limit`.

Más `core/domainRules.js` con las primeras reglas OSB y `fuente: { doc, ed, seccion }`.

**Entra también `muro.vano.holguraManilla`** (D-032): 50–60 mm entre el borde de un vano de puerta
y la cara del muro perpendicular. `origen: obra` ⇒ severidad máxima `info` por la tabla de §1 de
`00-reglas-de-dominio.md`. Es un buen segundo caso end-to-end porque su `origen` es distinto al de
`osb.cadeneta.ala`: prueba que el shape aguanta reglas no citables.

**Corte sugerido:** el catálogo con **una** regla completa end-to-end (`osb.cadeneta.ala`) antes de
migrar los 76 sitios. Si el shape no aguanta, se descubre con una y no con setenta y seis.

---

## R5 — Rol de muro y `wallTypes` · Opus

**Decisión (D-017, D-018).** Roles MP1 / MP2 / MP3 / tabique. `aplicaA` explícito, **sin escala ni
herencia entre roles**. El tipo gana sobre el override por muro, que se reporta `info` y se descarta
(patrón `resolvePurlinParams`, D-005).

Elimina `allowRotation` como opción: pasa a derivarse del rol.

Migración: sin rol declarado no se aplica ninguna regla condicionada a rol + finding `info`.
**Nunca inferir el rol de la geometría.** Cambiar el rol marca stale, no regenera.

Resuelve un dolor independiente: hoy `metalconDefaults` y `osbDefaults` son de proyecto, así que una
casa con exteriores serie 90 y tabiques serie 60 no puede tener dos defaults.

---

## R6 — Encuentros L/T y traslape de esquina · Opus

`detectWallCorners` devuelve `{start, end}` booleanos y su propio comentario admite que no distingue
L de T ni dice con qué muro se encontró. Pasa a `{ start: { wallId, tipo }, end: {...} }` —
**compatible por construcción**: el consumidor solo lo evalúa como truthy.

Traslape (D-024): lapa el más largo → mayor |dx| → menor id. El muro lapado corre su origen de
modulación, y ese origen alimenta el anclaje desde vanos y `MIN_EDGE_MARGIN`.

El **T no toca la placa** (el muro interior llega por dentro y su revestimiento es yeso cartón,
fuera de alcance). Solo la L.

**Entra el `backup` (D-033).** Medido en R2: hoy una esquina L del modelo queda con **4 montantes**
(`corner` + `backup` de cada muro, separados 100 mm), y el Anexo IV p.70 pone **2, contiguos y
cosidos** con N°10×3/4″ @150 zig-zag. El rol es un préstamo del *backer stud* de la tabiquería de
madera —`metalconModulation.js:11` lo dice textualmente— y no corresponde a Metalcon.

**El metrado se mueve**: son 88 piezas en `casa-L`. Re-baselinar y dejar el número nuevo en el
cierre, igual que R3.

---

## R7 — Checks · Sonnet

Montante–jamba (D-025) · **holgura de manilla en vano de puerta (D-032)** · apoyo de cercha en dintel (Anexo IV p.73, tolerancia 19 mm, acotado a
llegadas sobre vano) · `MIN_TRAMO` deja de descartar en silencio · largo de panel MP2/MP3 ·
capacidad de corte por dirección (417 kgf/m sobre muros que cumplan §1.5.2.1).

La capacidad de corte **es el primer ladrillo de B7**, no un extra.

---

## R8 — Informe markdown · Sonnet

`core/reportMarkdown.js` con el formato del protocolo `revision-normativa-nch`:
`| # | Sección | Hallazgo | Norma | Esperado | Encontrado |`, y crítico / moderado / observación
mapeados desde `error` / `warning` / `info`.

Declara **cobertura**: lo que pasó, lo que falló y lo que no se pudo verificar (`check: null` o dato
faltante). Más el cuadro de criterios en `NOTAS GENERALES`, automático desde el catálogo y filtrado
por los roles presentes.

---

## Orden y dependencias

```
R1 ✅┐
R2 ✅┼─→ R3 ─→ R4 ─→ R5 ─→ R6
    │              └─→ R7 ─→ R8
```

R1 y R2 son independientes entre sí. R1 primero por ser la más barata y visible: si algo del
contexto nuevo está mal escrito, se descubre ahí y no en R3, que mueve datos.

**Fuera de este plan** (deudas de `00-estado.md`): `core/levelResolution.js`, planta de techumbre,
solera como `*ELEMENT`.
