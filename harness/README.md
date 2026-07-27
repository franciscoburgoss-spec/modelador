# Arnés de verificación

## Objetivo

Transformar criterios de aceptación en evidencia reproducible. Un test verde sólo es evidencia si
falla al retirar el comportamiento que pretende proteger.

## Capas

| Capa | Herramienta prevista | Responsabilidad |
|---|---|---|
| Unidad | `node:test` | geometría, reglas, parser, migraciones y exportadores puros |
| Store | `node:test` | comandos, transacciones, invalidación y fallos |
| Componentes | React Testing Library | errores, diálogos y workflows críticos |
| Artefactos | `ezdxf`, parsers propios | validez semántica de DXF/CSV/JSON/INP |
| Solver | CalculiX real | ejecución, convergencia y parser de resultados |
| Escritorio | tests Rust + smoke | filesystem, permisos, procesos y recuperación |
| E2E | Playwright actual externo | navegación completa en plataforma soportada |

## Comandos oficiales

```bash
npm test
npm run test:lab
npm run test:coverage
npm run lint
npm run format:check
npm run audit:dxf
npm run smoke:ccx
npm run build
npm run validate
```

Los comandos disponibles en fase 0 forman parte de `npm run validate`. `audit:dxf` y `smoke:ccx`
se incorporan en `SPEC-003`, cuando existan los fixtures y arneses correspondientes. Ningún comando
de validación abre interfaces, modifica fixtures ni depende de rutas personales.

## Evidencia

Los resultados generados van a `artifacts/<commit>/<harness>/` y no se versionan. El cierre registra:

- commit;
- toolchain;
- comando;
- código de salida;
- conteo;
- hashes de inputs;
- ubicación del reporte;
- prueba de reversión para fixes críticos.

## Reglas de golden tests

- Comparar estructura y magnitudes contractuales, no timestamps ni orden incidental.
- Normalizar ids generados sólo si no tienen semántica.
- Un cambio de golden exige explicar si es corrección o regresión aceptada.
- DXF se audita además de comparar entidades.
- INP se ejecuta además de comparar texto.

## Gates locales y externos

El Mac objetivo debe ejecutar toda validación salvo E2E Playwright actual. Ese E2E se registra por el
mismo commit desde CI u otro equipo soportado. La ausencia de CI no habilita una versión obsoleta del
browser harness como sustituto silencioso.
