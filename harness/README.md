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
npm run verify:goldens
npm run audit:dxf
npm run smoke:ccx
npm run build
npm run validate
```

Los goldens y `audit:dxf` se incorporaron en `SPEC-003-B`; `smoke:ccx` se incorporó en
`SPEC-003-C2`. Antes de la primera auditoría se ejecuta
`npm run setup:verification-python`. Ningún comando de validación abre interfaces, modifica
fixtures ni depende de rutas personales.

El conjunto de referencia de `SPEC-003` cubre JSON y CSV semánticos; planta y fundaciones DXF;
framing, OSB y cerchas en R12/A3; e INP global, de cerchas y de fundaciones. Los smoke INP usan los
IDs persistidos del fixture, sin renumerarlos para acomodar al solver. Cada job se ejecuta en un
directorio limpio y aislado. El global usa una copia con sonda cinemática explícita y permite sólo
el warning exacto por ausencia de grados de libertad; cercha y fundaciones no permiten warnings.

El manifiesto de fixtures ya es parte de `npm test`. Para comprobar únicamente esa frontera:

```bash
node --test tests/fixtureManifest.test.mjs
npm run verify:goldens
npm run audit:dxf
```

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
- No normalizar IDs referenciados de muro, eje, perfil, tipo, faldón, `NSET` o `ELSET`.
- Un cambio de golden exige explicar si es corrección o regresión aceptada.
- DXF se audita además de comparar entidades.
- INP se ejecuta además de comparar texto.

## Gates locales y externos

El Mac objetivo debe ejecutar toda validación salvo E2E Playwright actual. Ese E2E se registra por el
mismo commit desde CI u otro equipo soportado. La ausencia de CI no habilita una versión obsoleta del
browser harness como sustituto silencioso.
