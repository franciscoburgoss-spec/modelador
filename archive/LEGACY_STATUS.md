# 00 — Estado del proyecto

> **Este archivo es la única fuente de verdad del estado.** Ningún `cierre-*.md` declara qué está
> abierto o cerrado: los cierres cuentan lo que hizo *esa* sesión, este archivo dice dónde está el
> proyecto. Se actualiza al cerrar cada sesión, y es lo primero que se lee al abrir la siguiente.
>
> Última actualización: **27-jul-2026**, tras `R2` (plan de reglas de dominio).

---

## Versión actual

| | |
|---|---|
| Zip | `modelador-v49-R2.zip` |
| Suite | **518/518** |
| `vite build` | OK |
| `ezdxf doc.audit()` | 0 errores / 0 fixes en 40 DXF (6 planos R12 + 34 láminas AC1015) |
| Sesión cerrada | **R2** completo — Parte A + B. `studFlangeSpan` es la fuente única de fase de las piezas de muro; cero acero fuera del contorno |

## Qué se adjunta al abrir una sesión

1. El zip vigente.
2. `00-estado.md` — este archivo.
3. `00-protocolo.md` — cómo se trabaja.
4. `00-reglas-de-dominio.md` — reglas transversales.
5. `00-contexto-<bloque>.md` — solo el del bloque en curso.
6. El spec de la sesión, y **solo** ese.

`00-decisiones.md` y los `cierre-*.md` **no** se adjuntan: son consulta, se piden si hacen falta.

---

## Deudas abiertas

| # | deuda | origen | dónde |
|---|---|---|---|
| A-1 | Extraer `core/levelResolution.js` con `resolveLevelByType(grid, tipo, {conElementos})` y hacer que lo usen los tres llamadores | addendum s5 | `RoofPlaneModal.jsx:85`, `RoofTrussModal.jsx:96`, `foundationGeneration.js` |
| A-2 | Planta de techumbre: `exportDxf.js` no dibuja techumbre de ninguna clase. Antes de meter la solera hay que decidir si se dibuja del todo | s5 | `exportDxf.js` |
| A-3 | Solera como `*ELEMENT` en el `.inp` (hoy es comentario). Decisión de modelación FEM | s5 | `exportCalculixTruss.js` |
| A-4 | `side` distinto de `low`/`high`: el 3D y la tabiquería dibujan, la cercha no. Teórico — los dos emisores solo producen esos valores | s5 auditoría | `exportTrussDxf.js` |
| A-5 | `nogging` sin entrada en `ROLE_TAG`: la cadeneta no se rotula. **Reducida en R1** — `header`/`sill` cerrados; la cadeneta espera a ser pieza de tabiquería | 26-jul → R1 | `exportFramingDxf.js:167` → **R3** (tag `CD`, ya especificado) |
| A-6 | Plan de reglas de dominio: **R1 y R2 cerradas**, **R3 con spec lista** (`spec-R3.md`), R4…R8 pendientes | 27-jul | `plan-R-reglas.md` |
| A-7 | Vano de puerta sin holgura de manilla en `casa-L` (`edgeOffset: 0`). Causa raíz del desborde de 38 mm. **No lo arregla R2** | R2 prep (D-032) | regla → R4 · check → R7 |
| A-8 | `backup` a 100 mm contradice el pilar compuesto contiguo del Anexo IV p.70. 4 montantes por esquina donde el manual pone 2 | R2 prep (D-033) | `metalconModulation.js:135` → **R6** |
| A-9 | **Cobertura de fixtures.** `casa-L` y `modelo-26` comparten `elements` byte a byte: para tabiquería/OSB/fundaciones hay **un solo caso**. Falta un fixture con otra planta, **≥2 series de perfil** (R5 lo necesita) y **`roofPlanes` persistidos** (hoy ningún fixture los tiene; los tests los inyectan inline) | R2 prep | `tests/fixtures/` · `lab/roofPlane/fixtures/` |
| A-10 | Los montantes de muro **no se dibujan en 3D**: `build3d.js` hace cajas sólidas con vanos por CSG, no existe `buildWallStudMembers`. Por eso el criterio "2D/3D/DXF" del plan era inalcanzable. Si algún día se agregan, `studFlangeSpan` ya es la fuente de fase — no hay que volver a decidir nada | R2 (spec §1.3) | `build3d.js` |

## Deudas cerradas — no volver a listarlas

| deuda | cerrada en | cómo |
|---|---|---|
| `levelType` de los 6 `zLevels` | **B4.7.7** | Tipos `terreno` (NTN) y `pisoTerminado` (NPT) con `datum:true`; los 6 tipados en ambos fixtures. Prueba viva: `resolveBaseLevel` filtra por `levelType === 'pisoTerminado'` |
| Fusión de tramos colineales redundantes | B4.7.6 | `mergeCollinearTramos` en el adaptador. F3: 4 tramos → 2 sistemas |
| Findings del faldón en el reporte | B4.7.5 | `roofPlaneValidation.js` |
| `validateRoofSystems` sobre geometría fantasma | B4.7.8-s2b | Guarda temprana + 1 finding `legacyShadowed` |
| Alias `elevation` en `supportLedgers` | B4.7.8-s5 | Normalizado en `getRoofSystems`; el alias solo vive en `.json` viejos |
| B.3 — destaje de canaleta en 3D | s4 (descartado) | No hay material que restar; `computeMonoTrussGeometry` ya excluye la zona. CSG queda anotada solo para un destaje real futuro |
| Generar fundaciones no generaba nada | s5 addendum | `resolveBaseLevel` por `levelType`, nunca falla en silencio |
| R1 — dintel y alfeizar sin rotular en el plano | R1 | `pieceLabelEntities` recibe `headers`+`trackHeight`; `ROLE_TAG` con `header:'D'`/`sill:'A'`. Import muerto de `ROLE_TAG` retirado de `exportSheetsDxf.js` |
| R2 — piezas de muro dibujadas fuera del contorno del muro | R2 | 92 piezas en 45 de 45 muros (89 de 19 mm + 3 de 38 mm). `studFlangeSpan` en `trussLayout.js`: extremo de muro a ras hacia adentro, y el **extremo gana** sobre el borde de vano. 0 piezas fuera |
| R2 — bloque `nearAny` de jamba duplicado literal en dos emisores | R2 | `exportFramingDxf.js` y `render/wall.js` consumen `studFlangeSpan`. `grep -c nearAny` = 0 en ambos; verificado pieza a pieza: 926 piezas, mismo span |
| A-7 — leyenda de nomenclatura chilena (9 letras) | R1 (reabierta) | `sheetLegend.js`: la fila de `SIMBOLOGIA` que ya existía pasa a ser la traducción (no bloque nuevo). Entra en A3 con margen 2. Ver `cierre-R1.md` §Parte B |

> ⚠ `levelType` estuvo listado como abierto en cuatro documentos **después** de cerrarse. Si una
> deuda aparece en un cierre viejo, este archivo manda.

---

## Fixtures de referencia

> ⚠ **Corregido tras medición (R2 prep).** La ficha anterior decía que `modelo-26.json` era
> "techumbre por faldones (`roofPlanes`), faldón del eje A = caso patrón". **Es falso: tiene 0
> `roofPlanes` y 19 `roofSystems` legacy.** Y los dos fixtures comparten `elements` **byte a byte**.

| fixture | qué es | ruta |
|---|---|---|
| `casa-L.json` | Planta en L. `elements`: 45 muros + 4 fundaciones. Techumbre **legacy**: 2 `roofSystems`, 0 `roofPlanes` | `tests/fixtures/` |
| `modelo-26.json` | **El mismo modelo**, con 19 `roofSystems` en vez de 2. `elements`, `grid`, `library`, `projectParams` idénticos byte a byte | `lab/roofPlane/fixtures/` |

**Diferencia total entre ambos: `roofSystems` (5.312 vs 82.888 chars) y `currentZLevelId`.** Nada más.

Consecuencias, medidas:

- Para **todo lo que no sea techumbre** —tabiquería, OSB, fundaciones, metrado de muros, DXF de
  framing y elevación— hay **un solo caso**. Un criterio que diga "verificado en `casa-L` y
  `modelo-26`" mide dos veces lo mismo. Hoy **4 tests** cargan ambos creyendo tener dos casos:
  `build3dMemberOffset`, `levelTypes`, `roofPlaneSupportLedger`, `supportLedgerDxfS5`.
- **Ningún fixture tiene faldones.** Los tests de `roofPlane` cargan la geometría real del fixture
  y le **inyectan `roofPlanes` inline**. Es geometría real, pero el faldón nunca viene de un
  archivo guardado: no hay cobertura del camino "abrir un `.json` con faldones persistidos" —que
  es exactamente donde apareció D-012 (el alias `elevation` de los ledgers).
- Cobertura del caso único: **1 solo perfil de montante** (`90CA085p`) y **1 sola expresión de
  espesor**. R5 existe para permitir serie 90 y serie 60 en la misma casa, y no hay fixture que
  lo ejerza.

Lo que sí cubre bien: 22 muros en X y 23 en Y, los 8 roles de stud y los 2 de header, de 0 a 4
vanos por muro, 32 puertas y 11 ventanas, 6 `zLevels` con los 6 `levelType`, 7 combinaciones
`bottomZ→topZ`.

Todo test de geometría corre contra fixtures reales, no sintéticos — pero hoy contra **uno solo**.

## Stack

React 18 · Vite · Zustand · Tailwind · Three.js · `three-bvh-csg` (usado para vanos de muro) ·
`node:test` · Playwright (Chromium headless) · CalculiX `ccx 2.21` · Python `ezdxf` para auditar DXF.

DXF: R12 plano **sin** sección HEADER ni grupo 370 · AC1015 solo en láminas.
