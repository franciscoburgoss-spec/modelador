# Cierre — SPEC-R8 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R8-report-markdown.md`, corte B |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se integró el snapshot R8-A a `ValidationModal` y se agregó la descarga Markdown desde esa misma
instancia. No se modificaron reglas, store, leyendas, exportadores DXF, geometría ni INP.

## Cambios

- El modal reemplaza `validateModel` más dos validadores de techo por un único `useMemo` de
  `evaluateModelReview(model, normalizedExtraMargin)`.
- La lista visible se deriva de `review.findings`; no existe otra concatenación de productores.
- “Exportar informe (.md)” entrega ese mismo `review` a `downloadReviewMarkdown`, junto con
  `model.projectInfo`, sin reevaluar ni leer/escribir el store.
- El adaptador crea un Blob `text/markdown;charset=utf-8`, descarga
  `revision-constructiva.md` y revoca el object URL dentro de `finally`.
- Las dependencias Blob/document/URL son inyectables para reproducir descarga, click fallido y
  revocación sin navegador.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Snapshot único pantalla/informe | PASS | `ValidationModal` tiene un `useMemo`; lista y descarga usan `review` |
| Mismo margen | PASS | `normalizedExtraMargin` alimenta la única llamada a `evaluateModelReview` |
| Sin productores duplicados | PASS | prueba rechaza llamadas a `validateModel`, `validateRoofSystems` y `validateRoofPlanes` |
| Descarga exacta | PASS | nombre `revision-constructiva.md` y MIME Markdown comprobados |
| Cero findings | PASS | Blob contiene las tres secciones explícitamente vacías |
| Revocación | PASS | orden create/click/revoke y rama de click fallido |
| No mutación | PASS | snapshot `deepEqual` antes/después del adaptador |
| UI compilable | PASS | lint sin warnings y build de producción |
| Leyendas/DXF | Fuera del corte | corresponde a R8-C |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 29 decisiones |
| `npm run validate` con Node 22 | PASS | 696/696; laboratorio 35/35; build OK |
| Pruebas focalizadas R8 | PASS | 11/11; 3 corresponden a R8-B |
| Cobertura oficial core | PASS | 93,03 % de líneas |
| Cobertura oficial store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 141 idénticos, 46 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 315 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 700,70 kB raw / 217,12 kB gzip |
| Auditoría DXF | No aplica | el corte B no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte B no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Reevaluar el modelo dentro de `exportReport` en vez de descargar `review` | 1: equivalencia de snapshot/margen pantalla-informe |

## Desviaciones y deudas descubiertas

- El branch conserva la desviación ambiental ya registrada: el shell abre con Node 20 y las
  puertas oficiales se ejecutan con Node 22.23.1 explícito bajo R-011.
- La integración React se comprueba por contrato fuente, lint y build; el adaptador DOM sí se
  ejecuta con dependencias inyectadas, incluida la rama de error.
- Los criterios de lámina y toda modificación DXF siguen reservados para R8-C.
- No hubo cambios de modelo persistido, geometría, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo decisión nueva
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
