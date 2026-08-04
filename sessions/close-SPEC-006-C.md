# Cierre — SPEC-006-C / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-006-C` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |

## Alcance ejecutado

Se corrigió el falso bloqueo de faldones con apoyos altos colineales de coronaciones heterogéneas.
La superficie límite usa la menor cota `top - crownClearance`, queda bajo todos los apoyos y
conserva la guarda atómica cuando esa restricción produciría pendiente negativa. No se invoca el
solver constructivo ni se modifica el schema, el archivo nativo o los contratos de SPEC-006-A/B.

## Cambios

- `projectRoofPlane` reemplaza la igualdad estricta de coronaciones por su mínimo finito.
- Un modelo sintético con dos tramos colineales a 3.000/3.300 mm y holgura de 100 mm produce un
  único borde alto a 2.900 mm, finito y planar.
- La inversión del orden de los muros produce serialización idéntica.
- Campos señuelo de montantes, OSB, cerchas, miembros, costaneras y findings no aparecen en la
  salida; el consumidor SPEC-14 acepta el resultado.
- Una coronación gobernante a 2.500 mm con borde bajo a 2.500 mm después de holgura falla como
  `AgnosticGeometryError/INVALID_DIMENSION` antes de Blob, URL o enlace.
- F-012 y R-023 quedan resueltos mediante D-049. F-009 permanece abierto y los cierres A/B no se
  editaron.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Menor coronación gobierna una sola superficie | PASS | Regresión mínima: borde alto 2.900 mm, `roofGeometry.length === 1` |
| 2. Superficie finita, bajo apoyos e invariante | PASS | Cuatro puntos exactos, checks finitos/holgura y serialización idéntica al permutar |
| 3. Pendiente negativa falla antes del DOM | PASS | `INVALID_DIMENSION`, mensaje de pendiente y cero eventos Blob/URL/elemento |
| 4. Contratos A/B y separación constructiva | PASS | Consumidor SPEC-14 y ausencia de seis familias de campos señuelo |
| 5. Corpus, fixtures, componente y nativo | PASS | Suite del exportador 11/11, flujo de menú y roundtrip v2 verdes |
| 6. Prueba de reversión | PASS | Restaurar igualdad estricta reproduce 1 fallo con el bloqueo original; restauración 11/11 |
| 7. Puertas y esfuerzo | PASS al retorno | Gates técnicos verdes; medium planificado/enviado/efectivo, sin escalamiento |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `node --test tests/agnosticGeometry.test.mjs` | PASS | 11/11 |
| Flujo de menú y `nativeProjectFile.test.mjs` | PASS | 1/1 enfocado + 4/4 |
| `npm run build` | PASS | 284 módulos; chunk inicial 748,85 kB, warning baseline |
| `npm run validate` con Node 22.23.2 | PASS al retorno | 808 Node; 19 componentes; 9 Rust; 35 lab; core 92,80 %; store 96,59 %; 18 goldens; DXF 14 archivos 0/0; CCX 3/3; build OK |
| `make governance` | PASS al retorno | La ejecución hija sólo espera su propio `launch_completed` |
| `git diff --check` | PASS | Sin errores de whitespace |

El registro Codex es append-only: durante esta ejecución hija, `codex:audit` y `make governance`
rechazan correctamente el `launch_started` actual aún sin pareja. Al retornar código 0, el
lanzador lee este cierre, compara `medium == medium == medium` y anexa `launch_completed`; ese
evento no se simula ni se escribe manualmente desde el hijo.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Se restaura la exigencia de coronaciones idénticas | 1: regresión heterogénea, `INVALID_GEOMETRY` con el bloqueo original |
| Se restaura la menor restricción gobernante | 0; suite enfocada 11/11 |

## Desviaciones y deudas descubiertas

- No se pudo crear `spec/006-c-roof-crown-constraints`: `.git` está montado de sólo lectura. Se
  preservaron la rama heredada y todos los cambios acumulados de SPEC-006-A/B.
- La apertura `make governance` sólo falla por el `launch_started` de esta propia ejecución; el
  evento de cierre pertenece al proceso lanzador y no puede adelantarse sin romper el registro.
- El estado privado que contiene el ID real `1785161146258` no está en el repositorio. La regresión
  reproduce su condición geométrica sin copiar datos privados; la comprobación manual en la app
  queda como siguiente inspección del usuario, no como gate automatizable de este workspace.
- No se modificaron DXF ni INP. F-009 continúa P1 y bloquea declarar planos listos para ejecución.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-049
