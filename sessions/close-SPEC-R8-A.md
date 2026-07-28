# Cierre — SPEC-R8 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R8-report-markdown.md`, corte A |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se implementó la unidad pura de R8: metadata explícita en el catálogo, evaluación estructurada
compartida, cobertura agregada, criterios aplicables y renderer Markdown determinista. No se
integró React, descarga, leyendas DXF ni geometría.

## Cambios

- Las ocho reglas declaran `reportSection` y `sheetVariants`, validadas y congeladas.
- `evaluateModelValidation` conserva las salidas R7 y agrupa geometría legacy; `validateModel`
  delega sin cambiar su retorno array ni el orden observable.
- `evaluateModelReview` agrega una vez sistemas/faldones y publica cobertura instrumentada o
  literalmente no instrumentada según el productor.
- `collectApplicableCriteria` usa sólo tipos asignados y roles explícitos, agrupa límites iguales y
  permite que una regla referenciada por un finding legacy entre sólo al informe.
- `renderReviewMarkdown` emite identificación, resumen, tres secciones, cobertura y criterios. Cada
  finding conserva una fila; sólo las fuentes HTTPS catalogadas se emiten como links.
- Pipes, CR/LF, backslashes, sintaxis de enlaces y HTML crudo de datos no confiables se neutralizan.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Snapshot puro y orden previo | PASS | `r8ReportMarkdown.test.mjs`: `deepEqual` con `validateModel` + sistemas + faldones |
| Compatibilidad de `validateModel` | PASS | array exacto y componentes concatenables sin duplicación |
| Baseline `casa-L` | PASS | 54 findings: 8 error, 1 warning, 45 info |
| Cardinalidad y secciones | PASS | una fila por finding; cero findings mantiene tres secciones explícitas |
| Fuente normativa honesta | PASS | casos manual, derivado, obra y sin regla catalogada |
| Estados de medición | PASS | límite/medida presentes, `null` y campos ausentes distinguidos |
| Cobertura | PASS | checked/clean/skipped, conditional/excluded/unknown y productores no instrumentados |
| Criterios aplicables | PASS | MP1/MP2, tipo no usado, muro legacy y límite 610/600 probados |
| Neutralización de entrada | PASS | pipe, CR/LF, backslash, HTML y link no catalogado |
| Determinismo | PASS | dos renderizados idénticos byte a byte, sólo LF |
| UI/descarga | Fuera del corte | corresponde a R8-B |
| Leyendas/DXF | Fuera del corte | corresponde a R8-C |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 29 decisiones |
| `npm run validate` con Node 22 | PASS | 693/693; laboratorio 35/35; build OK |
| Pruebas focalizadas R8-A | PASS | 8/8; catálogo focalizado 8/8 |
| Cobertura oficial core | PASS | 93,08 % líneas; `modelReview.js` 99,52 % |
| Cobertura oficial store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 141 idénticos, 46 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 314 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 691,92 kB raw / 214,27 kB gzip |
| Auditoría DXF | No aplica | el corte A no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte A no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Quitar findings de `validateRoofSystems` del snapshot compartido | 1: equivalencia y baseline `casa-L` pierden 3 findings |
| Omitir la primera fila de cada sección del renderer | 1: cardinalidad baja de 4 a 1 en el caso focalizado |

## Desviaciones y deudas descubiertas

- El shell de apertura seleccionó Node 20 pese a que `.nvmrc` y D-003 exigen Node 22. Las puertas
  oficiales se ejecutaron con Node 22.23.1 explícito; el seguimiento general continúa en R-011.
- `reportMarkdown.js` no incluye aún el adaptador DOM de descarga: corresponde explícitamente al
  corte B.
- La cobertura de geometría legacy y de techo sigue sin instrumentarse y se declara como tal, según
  la spec; instrumentarla permanece fuera de alcance.
- `casa-L` continúa sin roles explícitos: su criterio de llegada de cercha entra por finding y no
  queda habilitado para láminas.
- No hubo cambios de modelo persistido, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo decisión nueva
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
