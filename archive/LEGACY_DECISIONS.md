# 00 — Bitácora de decisiones

> **Append-only.** Una decisión no se edita: si se revierte, se agrega una entrada nueva que la
> deroga y se marca la vieja. Cada entrada tiene id estable para poder citarla desde un spec, un
> comentario de código o un finding.
>
> No se adjunta por defecto — es consulta. Se pide cuando una sesión necesita saber *por qué*.

Estados: **vigente** · **derogada por D-xxx** · **descartada**

---

## Techumbre por faldones (B4)

| id | fecha | decisión | por qué | vive en |
|---|---|---|---|---|
| **D-001** | jul-2026 | El faldón (`roofPlane`) reemplaza a `roofSystems` como entidad persistida. Polígono libre de N vértices sobre esquinas de eje | El modelo por tramos rectangulares producía vanos irregulares y particiones falsas. El polígono evita la frontera ficticia en la L y garantiza paso constante | `roofPlane.js` |
| **D-002** | jul-2026 | Cadena de cerchas **global** al faldón, paso fijo sobre toda la corrida | En obra el paso es constante; el muro del quiebre es apoyo intermedio, no borde | `trussChain.js` |
| **D-003** | jul-2026 | **Pendiente única por faldón**, del tramo más restrictivo. Holgura de coronación = mínimo garantizado | Fran acepta que el brazo corto quede más escondido a cambio de plano de techo continuo | `roofPlane.js` |
| **D-004** | jul-2026 | Coronación incompatible → **avisa, no fuerza** (`incompatibleSlope`) | La validación reporta, no bloquea | `roofPlane.js` |
| **D-005** | B4.7.2 | Costanera es **sección de proyecto**: vive en la plantilla, el faldón hereda. **La plantilla gana**; el valor propio divergente se reporta `info` y se descarta | Fuente única. Es el precedente de herencia del proyecto | `resolvePurlinParams` |
| **D-006** | B4.7.7 | `levelType` gana `terreno` (NTN) y `pisoTerminado` (NPT) con `datum:true` | Faltaba el **tipo**, no la asignación: la taxonomía no cubría niveles de referencia | `levelTypes.js` |
| **D-007** | B4.7.8-s1 | La cuerda inferior parte en la **cara interior** del muro canaleta (`perpInner`), no en su eje. `supportElevation` = cara inferior de la cuerda inferior. `hSolera ≤ supportOffset` | Origen en el eje + luz entre caras daba −½ espesor de desfase (50,55 mm con muros de 101,1). Confirmada por Fran | `roofPlane.js`, `roofPlaneAdapter.js` |
| **D-008** | B4.7.8-s2 | **`getRoofSystems` es la puerta única** del pipeline. Precedencia: mandan los faldones | Tres consumidores leían `model.roofSystems`, vacío tras migrar: el `.inp` salía sin ninguna cercha | `roofPlaneOutputs.js` |
| **D-009** | B4.7.8-s4 | **`memberOffsetMode` es la fuente única de "dónde está la cara"** para 2D, DXF y 3D. La línea del miembro es una **cara**, no el eje | El 3D centraba las barras y el 2D las apoyaba en su cara: 45 mm de desfase en sentidos opuestos | `trussLayout.js:491` |
| **D-010** | B4.7.8-s4 | La solera va atornillada **contra** la cara interior, del lado del recinto — no embutida en el espesor | Pregunta de obra, respondida por Fran | `build3d.js` |
| **D-011** | B4.7.8-s4 | **CSG para el destaje de canaleta: descartada.** No hay material que restar | `computeMonoTrussGeometry` ya excluye la zona; el rectángulo es referencia de vacío en `MURO-REF`. Se retoma solo si aparece un destaje real | `spec-B4_7_8-s4-C01.md` Parte 0 |
| **D-012** | B4.7.8-s5 | El alias `elevation` de los ledgers **muere en `getRoofSystems`** | Es dato derivado persistido en archivos guardados: quitarlo del emisor habría borrado la solera de todo modelo grabado | `normalizeLedger` |
| **D-013** | s5 addendum | El nivel base de fundaciones se resuelve por **`levelType === 'pisoTerminado'`**, nunca por `elevation === 0` | En Chile el ±0.00 es NTN y la tabiquería arranca en NPT (+450). El generador contradecía a su propio módulo de geometría | `foundationGeneration.js` |

---

## Reglas de dominio (26-jul-2026)

| id | decisión | por qué | estado |
|---|---|---|---|
| **D-014** | Taxonomía de reglas: ejes `scope` y `origen` independientes, con `origen='obra' ⇒ scope≠'sistema'`. Las tolerancias numéricas **no** son reglas | `EPS = 1` y `MIN_EDGE_MARGIN = 100` se ven idénticos en un grep y no tienen nada que ver | vigente |
| **D-015** | Sí al catálogo declarado (`core/domainRules.js`) — pero el argumento es que **declarar la regla obliga a que aparezca el dato que falta**, no la trazabilidad | Medido cinco veces: `COVER_SLACK`, `MIN_COURSE_HEIGHT`, `B_cadeneta`, paso de tornillos, espesor OSB | vigente |
| **D-016** | El finding extiende el vocabulario existente: severidades `error`/`warning`/`info`, **campos de id tipados** (`wallIds`, `elementIds`, `roofSystemIds`, `roofPlaneIds`), más `rule`, `measured`, `limit` | `ValidationModal` despacha según qué campo de id venga; un campo genérico rompería la navegación | vigente |
| **D-017** | Roles de muro con la nomenclatura del manual: **MP1 / MP2 / MP3 / tabique**. `aplicaA: [...]` es el dato; **no hay escala ni herencia entre roles** | MP2 es muro de corte **sin** placa: una escala le arrastraría las reglas de OSB. Falsificó la escala propuesta tres turnos después de adoptarla | vigente |
| **D-018** | `wallTypes`: **el tipo gana**, el override por muro se reporta y se descarta | Coherencia con D-005, que es el precedente vivo | vigente |
| **D-019** | Fase: `offset` = **eje del ala**, con tres excepciones declaradas (extremos de muro a ras · `corner`/`backup` heredan · **jambas a ras del vano hacia afuera**). Se registran en `memberOffsetMode` | La cara del alma depende de hacia dónde mira el perfil; el eje es invariante. El `\|\| 'center'` de D-009 ya hacía eje a todas las piezas de muro | vigente |
| **D-020** | La **cadeneta pasa a ser pieza del solver de tabiquería** (`role: 'nogging'` en `wall.studs`), despiezada entre montantes, centrada en la junta, perfil heredado del muro, **excluida del `.inp`** | Hoy no tiene sección, no está en el metrado ni en el 3D. Excluida del análisis por el mismo criterio que `edgeChord` | vigente |
| **D-021** | Orden sin ciclo: `computeCourseBreaks` (puro) → `metalconModulation(…, jointZs)` → `computeOsbPanelLayout`. **`computeOsbPanelLayout` debe ignorar `role:'nogging'`** | Sin la guarda, la cadeneta que respalda una junta se contaría a sí misma como respaldo de esa junta | vigente |
| **D-022** | `gap` (dilatación entre placas) **se queda en 5 mm** | Manual Práctico LP lo prescribe dos veces; los 3 mm de Anexo IV son mínimo normativo. **Deroga la decisión previa de bajarlo a 3**, tomada con fuente incompleta | vigente |
| **D-023** | El paso de montante **no** tiene que dividir al ancho de placa. La placa se recorta para que la junta caiga sobre pie derecho | LP §1.3, textual. El 1220 es tamaño de venta, no módulo | vigente |
| **D-024** | Traslape de esquina en L: **lapa el muro más largo** → desempate por mayor \|dx\| → por menor id. `origen: 'oficina'`, sin finding | El traslape no agrega ni quita largo contable de muro de corte: el efecto en el cálculo es **nulo**. Atarlo a la dirección de cerchas crearía acoplamiento techumbre→revestimiento y quedaría indefinido en `casa-L` | vigente |
| **D-025** | Montante pegado a jamba: `d < 30` `error`, `30 ≤ d < 150` `warning`. Se suprime el montante **solo si** el vano resultante ≤ 610; si no, se conserva y se avisa con ambas medidas | Nunca se produce en silencio un muro que incumple el paso máximo | vigente |
| **D-026** | Modular por tramos entre jambas: **descartada** | Repartir un tramo en 453,75 rompe la conmensurabilidad con la placa, que es justo lo que hay que preservar | descartada |
| **D-027** | Armado de la jamba de vano: `scope: proyecto`, default espalda con espalda, `check: null` | El manual remite a "refuerzo vano (ver ficha)" y "según cálculo": no corresponde codificarlo duro. No afecta el despiece de placas — ninguna junta cae sobre una jamba | vigente |
| **D-028** | OSB de **15 mm** queda como alternativa de proyecto para subir capacidad de corte ante demanda sísmica alta; no es default | Anexo IV p.81 lo exige en escantillón III | vigente |
| **D-029** | Nomenclatura chilena de piezas en el plano vía **leyenda** que traduce `ROLE_TAG`; el `role` no cambia | Las letras son correctas en elevación densa; lo que falta es la traducción. Cambiar el `role` obligaría a migrar modelos guardados sin ganar nada | vigente |
| **D-030** | Regla de trabajo: **el detalle en corte o elevación va antes de la decisión**, no después | Funcionó tres veces el mismo día: el corte de la junta reveló que el ala es todo el apoyo, la comparación C/U descartó el perfil U, y la cadena de cotas validó la fórmula contra el manual al décimo | vigente |

---

## Reglas de dominio — cierres posteriores

| id | fecha | decisión | por qué | vive en |
|---|---|---|---|---|
| **D-031** | R1 | La nomenclatura chilena se resuelve **reescribiendo la descripción de la fila de `SIMBOLOGIA` que ya existía**, no agregando un bloque de traducción. Solo `D` y `A` son filas nuevas | El gate de R1 midió que un bloque nuevo (≥9 filas) no entra en A3 (margen 4). Reescribir no suma filas por letra: A3 pasa de 12 a 14 sobre `maxRows` 16. Cumple D-029 sin tocar el layout de lámina | `sheetLegend.js` · `SYMBOLS.framing` |
| **D-032** | R2 (prep) | **Holgura de manilla**: el borde de un vano de puerta guarda **50–60 mm** contra la cara del muro perpendicular. `origen: obra` ⇒ `scope ≠ sistema`, severidad máxima `info` | Sin esa holgura la manilla golpea el muro y la hoja nunca abre 90°. Criterio recopilado por Fran en revisión en terreno. En `casa-L` hay una puerta con `edgeOffset: 0` que lo incumple, y es la causa raíz del desborde de 38 mm | regla → R4 · check → R7 |
| **D-033** | R2 (prep) | **El `backup` a 100 mm se elimina.** El encuentro L/T se resuelve con montantes **contiguos, cosidos** con N°10×3/4″ @150 zig-zag, según Anexo IV p.70 | El rol vino del vocabulario de tabiquería de **madera** (`metalconModulation.js:11`, textual: *"análogo al usado en tabiquería de madera, adaptado a acero"*): el *backer stud* americano se separa para dar clavado al yeso. Metalcon no lo hace así. El proyecto ya citaba esa página para el "pilar compuesto" y el generador la contradecía. Medido: hoy quedan **4 montantes por esquina L**, el manual pone 2. Confirmado por Fran | **R6** |
| **D-034** | R2 (prep) | La fase **no es propiedad del rol sino del rol en su posición**: `memberOffsetMode` gana un 2º argumento opcional de contexto. **No** se crean roles nuevos | El mismo `corner` necesita fase opuesta en `offset 0` y en `offset = length`; el mismo `king` según coincida con `oMin` u `oMax`. Roles nuevos obligarían a tocar `computeStudLayout` y a migrar modelos, contra D-029 | `spec-R2.md` §2.1 |
| **D-035** | R2 | **La excepción 2 de D-019 queda parcialmente derogada.** `corner` sí hereda la excepción de extremo —pero por estar *en* el extremo, no por su rol—; `backup` **no**, porque está a 100 mm del extremo. R2 lo trata como montante cualquiera: `center` | La excepción es de la posición, no del rol (D-034). Y la existencia misma del `backup` la revisa R6 (D-033) | `memberOffsetMode` · `spec-R2.md` §2.4 |
| **D-036** | R2 | El span local de una pieza de muro se lleva a coordenadas de mundo **por sus dos extremos** (`wallOffsetToWorldPoint` en `xMin` y en `xMax`), nunca proyectando el centro y sumando el ancho | Medido en R2: `casa-L` tiene 0 de 45 muros con `p1→p2` decreciente, así que hoy da lo mismo — pero el bloque viejo habría dibujado la jamba al lado equivocado en cuanto apareciera uno. Es un fallo silencioso esperando su fixture | `render/wall.js` |
| **D-037** | R3 (prep) | Las cadenas `7,5\|23\|7,5` y `6,5\|25\|6,5` **no son incompatibles: son la misma fórmula con distinto gap**. Se registra la fórmula, no el resultado: `separacion = gap + 2·e_borde` y `margen = B/2 − gap/2 − e_borde`. Con gap 5 (D-022 vigente) manda **`6,5 \| 25 \| 6,5`** | Dibujadas a escala, las dos preservan `e_borde = 10,0` exacto y ninguna baja del límite resistente de 9,5. La cadena del manual está calculada con el gap normativo de 3. Registrar el número y no la fórmula es lo que produjo la contradicción aparente | `00-reglas-de-dominio.md` §7 |
| **D-038** | R3 (prep) | La cadeneta va **centrada en la junta** —`[z − B/2, z + B/2]`— con la altura de banda igual al **`B` real del perfil del muro**. Muere `NOGGING_H = 60` | El ala tiene que recibir los **dos** bordes de placa; bajo la junta recibe uno solo. El 60 es inventado y el propio comentario del código lo admite (`exportFramingDxf.js:520`) | **R3** |
| **D-039** | R3 (prep) | El despiece de la cadeneta se calcula **de cara a cara con `studFlangeSpan`**, nunca restando `B` al offset | Falso desde R2: los montantes de extremo y las jambas ya no están al eje. Tercera aplicación del precedente de fuente única (`memberOffsetMode` → `getRoofSystems` → `studFlangeSpan`) | **R3** §2.2 |
| **D-040** | R3 (prep) | **El metrado de tabiquería por pieza se crea en R3**, como sección **aditiva**. La fila de muro por superficie **no se toca** | Medido: `takeoff.js` no lee `wall.studs` en ningún punto y el muro se metra por superficie neta (líneas 89-101). El plan decía que el metrado "se mueve" citando `90CA085 count 30 / ml 54,078`, que es una fila de **techumbre** (`getGroup('roof', …)`). No se movía nada: había que crearlo. Confirmado por Fran | **R3** Parte D |
| **D-041** | R3 (prep) | La cadeneta se dibuja en la capa **`MONTANTES`** (la de tabiquería que ya existe), no en una capa propia | Una capa `CADENETAS` obliga a tocar `tablesSection`, la leyenda de las cuatro láminas y el orden de plumas — fuera del núcleo de R3. Se reevalúa si un revisor pide apagarla por separado | **R3** §2.5 |
