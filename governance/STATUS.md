# Estado del proyecto

> Única fuente de verdad del estado. Los cierres y documentos archivados no declaran qué está
> abierto. Actualizar al cerrar cada sesión.

Última actualización: **27-jul-2026**

## Línea base

| Campo | Estado |
|---|---|
| Etapa | Reglas de dominio — R4 cerrada; preparar roles de muro R5 |
| Código en este repositorio | Baseline migrado; hashes de origen preservados y cambios posteriores registrados |
| Spec activa | Ninguna; la siguiente unidad R5 requiere spec gobernada |
| Suite oficial | 598/598; laboratorio 35/35 |
| Build | OK, con warning medido de chunk inicial de 639,73 kB |
| DXF heredados | 40 archivos auditados, 0 errores / 0 reparaciones |
| DXF R3-B | 14 archivos (`casa-L`: 2 R12 + 12 AC1015), 0 errores / 0 reparaciones |
| Objetivo de release | `v1.0.0-local` |
| Bloqueo actual | Ninguno; antes de implementar R5 corresponde emitir su spec |

## Hallazgos bloqueantes confirmados

| ID | Severidad | Hallazgo | Spec |
|---|---|---|---|
| F-006 | P1 | Persistencia local puede fallar sin recuperación ni error visible | SPEC-004 |

## Hallazgos resueltos

| ID | Resultado | Evidencia |
|---|---|---|
| F-007 | Existen scripts oficiales y `npm run validate` es la puerta única | `sessions/close-SPEC-000.md` |
| F-001 | Fórmulas usan un parser aritmético cerrado, sin evaluación de JavaScript | `sessions/close-SPEC-001.md` |
| F-002 | `roofSystems` se preserva y `roofPlanes` declara precedencia sin pérdida | `sessions/close-SPEC-001.md` |
| F-003 | El modelo se migra y valida antes de cualquier commit al store | `sessions/close-SPEC-001.md` |
| F-004 | Parámetros, biblioteca, niveles y vanos invalidan mediante el registro central | `sessions/close-SPEC-002.md` |
| F-005 | Las tres variantes CalculiX tienen guarda dura y no descargan stale | `sessions/close-SPEC-002.md` |

## Fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Repositorio y entorno reproducibles | Completada |
| 1 | Seguridad, integridad e invalidación | Completada |
| 2 | Reglas de dominio R3–R8 y formatos | En ejecución |
| 3 | Persistencia y recuperación nativas | No iniciada |
| 4 | Aplicación Tauri y CalculiX integrado | No iniciada |
| 5 | UX, rendimiento y observabilidad local | No iniciada |
| 6 | Release `v1.0.0-local` | No iniciada |

## Deudas de dominio heredadas

Las deudas A-1 a A-10 se conservan en `archive/LEGACY_STATUS.md`. La ejecución vigente es:

- R3-A/B/C/D: cerrados; `casa-L` genera y dibuja 493 cadenetas reales (134,551 m) con rótulo `CD`,
  sin alterar el despiece OSB ni los 1.529 nodos / 1.104 elementos del INP; kerf independiente.
  El metrado agrega 11 filas por perfil y rol, con 1.473 piezas y 2.679,051 m, y preserva
  `deepEqual` las 11 filas heredadas.
- R4-A/B/C: cerrados; catálogo inmutable, constructor canónico, cuatro fronteras públicas
  `deepEqual`, presentación de tres severidades y navegación por cuatro IDs tipados.
- R5–R8: pendientes según `domain/ROADMAP-R1-R8.md`.
- R7 debe decidir el tratamiento constructivo de las 6 piezas de cadeneta menores a 30 mm
  detectadas en `casa-L`; R3-A no inventa una regla de absorción.
- A-7 y A-8 tienen prioridad por afectar reglas constructivas.
- Hace falta un fixture realmente independiente y otro con `roofPlanes` persistidos.

## Deudas técnicas del baseline

- El store tiene 63,08 % de cobertura de líneas frente al objetivo de 85 %; seguimiento R-015 /
  `SPEC-003`.
- Siete hallazgos heredados de dependencias de hooks quedan acotados a cinco archivos; seguimiento
  R-016 / `SPEC-005`.
- `migration-manifest --record` sólo acepta identificadores `SPEC-NNN`; debe admitir las specs
  gobernadas `SPEC-Rn` antes del siguiente registro de reglas de dominio.
- `validate-governance` sólo inspecciona specs en el primer nivel de `specs/`; las specs de
  `specs/domain/` requieren revisión manual hasta ampliar el validador bajo R-011.
- El INP global usa IDs persistidos dentro de nombres `ELSET`; en `casa-L` superan los 20
  caracteres que CalculiX conserva y las secciones no encuentran sus conjuntos. Seguimiento R-007
  antes de G5.

## Próximo cierre

Emitir y gobernar `SPEC-R5` para roles MP1 / MP2 / MP3 / tabique, `wallTypes`, `aplicaA`, defaults
por tipo y migración sin inferencia geométrica. La implementación no comienza hasta confirmar
diagnóstico, decisión, alcance, exclusiones y aceptación verificable.
