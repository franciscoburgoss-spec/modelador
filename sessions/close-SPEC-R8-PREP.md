# Cierre — SPEC-R8 / preparación

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R8-report-markdown.md`, preparación |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se redactó y gobernó R8 antes de modificar producción. La preparación midió la salida visible de
`casa-L`, revisó las cinco fronteras de validación, los contratos de cobertura R7, el catálogo y la
composición actual de `NOTAS GENERALES`; fijó tres cortes cerrables.

## Cambios

- Se decidió una evaluación pura compartida para pantalla e informe, preservando el retorno array
  de `validateModel`.
- El catálogo declarará sección de informe y variantes de lámina explícitas; no se usarán
  heurísticas por texto.
- El informe distinguirá normas manuales, criterios derivados/de obra y findings sin regla.
- La cobertura R7 se mostrará con checked/skipped/unknown; productores legacy sin contrato se
  rotularán “no instrumentados”.
- Los criterios se resolverán sólo desde tipos asignados y roles explícitos. Reglas referenciadas
  por findings legacy podrán aparecer en el informe, nunca como criterio inferido de plano.
- El markdown será determinista y neutralizará estructura/HTML proveniente de datos no confiables.
- `NOTAS GENERALES` conservará notas existentes y antepondrá criterios, no observaciones.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Diagnóstico medido | PASS | `casa-L`: 54 findings = 8 errores, 1 warning, 45 info |
| Trazabilidad medida | PASS | 6 findings con regla/fuente; 48 sin regla catalogada |
| Cobertura medida | PASS | 45 muros sin rol omitidos; 3 apoyos inspeccionados; capacidad MP1 sin casos |
| Decisión cerrada | PASS | snapshot único, metadata explícita, renderer, cobertura y notas definidos |
| Seguridad | PASS | escape de markdown/HTML y links restringidos a fuentes HTTPS catalogadas |
| Alcance y exclusiones | PASS | sin roles inferidos, reglas nuevas, PDF, persistencia, findings en DXF ni cambios INP |
| Aceptación verificable | PASS | 15 criterios con snapshots, matrices, reversión y auditoría DXF |
| Cortes transaccionales | PASS | A core puro; B descarga/pantalla; C criterios de lámina/DXF |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 29 decisiones |
| `npm run validate` con Node 22 | PASS | 684/684; laboratorio 35/35; build OK |
| Cobertura oficial del store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 141 idénticos, 46 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 310 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 690,96 kB raw / 214,04 kB gzip |
| Auditoría DXF | No aplica | preparación documental; R8-C sí exige auditoría 0/0 |
| Smoke CalculiX | No aplica | R8 no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: esta unidad sólo emite el contrato previo a implementación | 0 |

## Desviaciones y deudas descubiertas

- El brief heredado menciona `check: null`, pero el contrato implementado usa `coverage.skipped` y
  condiciones `unknown`. R8 consume esas formas vigentes y no agrega otro campo.
- Los checks geométricos legacy y validadores de sistema/faldón no exponen cobertura. R8 declara
  esa frontera como no instrumentada; instrumentarlos queda fuera de la spec.
- `casa-L` no tiene roles. Sus seis reglas de llegada de cercha entrarán al informe por referencia
  del finding, pero no se convertirán en criterios de lámina.
- Los criterios cambian DXF en R8-C; ese corte deberá auditar cada salida modificada con 0 errores y
  0 reparaciones.
- `validate-governance` aún no recorre `specs/domain/`; diagnóstico, decisión, alcance, exclusiones
  y aceptación se comprobaron manualmente, bajo R-011.
- No hubo cambios de código, modelo, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
