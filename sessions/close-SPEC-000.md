# Cierre — SPEC-000

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-000-bootstrap-reproducible.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se migró el baseline `modelador-v49-R2`, sus pruebas y dos fixtures sin cambios funcionales. Se
fijaron Node/npm, dependencias, lint, formato, cobertura, build, validadores de migración/artefactos
y la puerta única `npm run validate`.

## Cambios

- 187 archivos heredados inventariados y comparados por SHA-256.
- Suite oficial de 518 pruebas y laboratorio de 35 pruebas.
- Node 22 obligatorio por `.nvmrc`, `engines` y `.npmrc`.
- Lockfile npm v3 y 328 paquetes instalables mediante `npm ci`.
- ESLint 9, cobertura nativa de Node y checks deterministas de formato/artefactos.
- Baselines de cobertura, lint, toolchain y tamaño de bundle documentados.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Worktree limpio después de instalar y validar | PASS | clon local del commit; `npm ci`; `npm run validate`; `git status --short` vacío |
| 2. Node fuera de 22 es rechazado | PASS | Node 20.20.2 / npm 10.8.2 devuelve `EBADENGINE` |
| 3. `npm ci` funciona sin `node_modules` | PASS | copia temporal limpia: 328 paquetes instalados |
| 4. Los 518 tests heredados pasan oficialmente | PASS | `npm test`: 518/518 |
| 5. Build pasa y warning queda medido | PASS | 611,54 kB raw / 188,67 kB gzip; warning visible |
| 6. `npm run validate` ejecuta todas las puertas | PASS | formato, lint, tests, lab, cobertura, build, migración, artefactos y gobernanza |
| 7. Fixtures conservan hash de origen | PASS | `MIGRATION_MANIFEST.json`; 2 fixtures idénticos |
| 8. No se migran artefactos | PASS | `npm run verify:artifacts` |
| 9. Gobernanza continúa verde | PASS | 20 archivos requeridos, 26 requisitos y 16 decisiones |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos requeridos; 26 requisitos; 16 decisiones |
| `npm test` | PASS | 518/518 |
| `npm run test:lab` | PASS | 35/35 |
| `npm run test:coverage` | PASS | core 90,70 %; store 54,75 % |
| `npm run build` | PASS | 250 módulos; chunk inicial 611,54 kB |
| `npm run validate` | PASS | puerta completa |
| `npm ci` en copia limpia | PASS | 328 paquetes |
| `npm run validate` en copia limpia | PASS | puerta completa |

## Prueba de la prueba

No hubo correcciones funcionales críticas en esta spec. Las guardas de infraestructura se probaron
negativamente: Node 20 falla con `EBADENGINE`; un hash distinto hace fallar
`verify:migration`; un artefacto conocido hace fallar `verify:artifacts`.

## Desviaciones y deudas descubiertas

- El store parte en 54,75 % de cobertura; R-015 conserva un piso de 50 % y objetivo de 85 % para
  `SPEC-003`.
- Siete hallazgos `react-hooks/exhaustive-deps` se acotaron a cinco archivos y se registraron como
  R-016 para `SPEC-005`.
- Rust/Cargo y `ezdxf` aún no están instalados; no aparecen en el código de fase 0. `make doctor`
  mantiene el diagnóstico visible para las fases que los requieren.
- No se modificó lógica DXF ni INP respecto del origen, por lo que no aplica una nueva auditoría
  `ezdxf` ni smoke CalculiX en esta migración byte a byte.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
