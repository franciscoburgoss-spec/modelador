# Estado del proyecto

> Única fuente de verdad del estado. Los cierres y documentos archivados no declaran qué está
> abierto. Actualizar al cerrar cada sesión.

Última actualización: **27-jul-2026**

## Línea base

| Campo | Estado |
|---|---|
| Etapa | Invalidación y confiabilidad de salidas |
| Código en este repositorio | Baseline migrado; hashes de origen preservados y cambios posteriores registrados |
| Spec activa | `SPEC-002-derived-state-and-exports.md` |
| Suite oficial | 533/533; laboratorio 35/35 |
| Build | OK, con warning medido de chunk inicial de 621,69 kB |
| DXF heredados | 40 archivos auditados, 0 errores / 0 reparaciones |
| Objetivo de release | `v1.0.0-local` |
| Bloqueo actual | Mutaciones dejan derivados obsoletos y una salida estructural puede omitir su guarda |

## Hallazgos bloqueantes confirmados

| ID | Severidad | Hallazgo | Spec |
|---|---|---|---|
| F-004 | P1 | Parámetros, biblioteca y eliminación de vanos no invalidan derivados | SPEC-002 |
| F-005 | P1 | Exportación de cercha CalculiX omite la guarda de stale | SPEC-002 |
| F-006 | P1 | Persistencia local puede fallar sin recuperación ni error visible | SPEC-004 |

## Hallazgos resueltos

| ID | Resultado | Evidencia |
|---|---|---|
| F-007 | Existen scripts oficiales y `npm run validate` es la puerta única | `sessions/close-SPEC-000.md` |
| F-001 | Fórmulas usan un parser aritmético cerrado, sin evaluación de JavaScript | `sessions/close-SPEC-001.md` |
| F-002 | `roofSystems` se preserva y `roofPlanes` declara precedencia sin pérdida | `sessions/close-SPEC-001.md` |
| F-003 | El modelo se migra y valida antes de cualquier commit al store | `sessions/close-SPEC-001.md` |

## Fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Repositorio y entorno reproducibles | Completada |
| 1 | Seguridad e integridad de importación | Completada |
| 2 | Invalidación, reglas y salidas verificadas | En preparación |
| 3 | Persistencia y recuperación nativas | No iniciada |
| 4 | Aplicación Tauri y CalculiX integrado | No iniciada |
| 5 | UX, rendimiento y observabilidad local | No iniciada |
| 6 | Release `v1.0.0-local` | No iniciada |

## Deudas de dominio heredadas

Las deudas A-1 a A-10 se conservan en `archive/LEGACY_STATUS.md`. La ejecución vigente es:

- R3: spec cerrada y lista; cadeneta como pieza de tabiquería.
- R4–R8: pendientes según `domain/ROADMAP-R1-R8.md`.
- A-7 y A-8 tienen prioridad por afectar reglas constructivas.
- Hace falta un fixture realmente independiente y otro con `roofPlanes` persistidos.

## Deudas técnicas del baseline

- El store tiene 54,75 % de cobertura de líneas frente al objetivo de 85 %; seguimiento R-015 /
  `SPEC-003`.
- Siete hallazgos heredados de dependencias de hooks quedan acotados a cinco archivos; seguimiento
  R-016 / `SPEC-005`.

## Próximo cierre

`SPEC-002` sólo puede cerrarse con invalidación central para todos los mutadores alcanzados y
bloqueo uniforme de cualquier exportación estructural con datos obsoletos.
