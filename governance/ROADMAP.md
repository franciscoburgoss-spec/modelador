# Hoja de ruta a v1.0.0-local

Las duraciones son sesiones concentradas, no fechas contractuales.

| Fase | Sesiones | Specs | Resultado |
|---|---:|---|---|
| 0. Baseline | 1–2 | SPEC-000 | repositorio, herramientas y validación reproducibles |
| 1. Stop-ship | 2–3 | SPEC-001, SPEC-002 | fórmulas seguras, importación íntegra, derivados confiables |
| 2. Dominio | 3–5 | SPEC-003 + R3–R8 | fixtures y salidas constructivas/cálculo auditadas |
| 3. Datos nativos | 2 | SPEC-004 parte A | open/save/recovery por filesystem |
| 4. Runtime | 2–3 | SPEC-004 parte B | `.app` Tauri y CalculiX controlado |
| 5. Operación | 2–3 | SPEC-005 parte A | UX de errores, logs y rendimiento |
| 6. Release | 1 | SPEC-005 parte B | `v1.0.0-local`, runbook y restauración probada |

## Secuencia obligatoria

```text
SPEC-000
  -> SPEC-001
  -> SPEC-002
  -> R3 -> R4 -> R5 -> R6 -> R7 -> R8
  -> SPEC-003
  -> SPEC-004
  -> SPEC-005
```

R3 puede prepararse en paralelo documentalmente, pero no se integra antes de cerrar los defectos
stop-ship. El empaquetado no comienza mientras importación e invalidación puedan producir pérdida o
entregables falsos.

## Hitos

- **M0:** baseline heredado reproducido desde el repositorio nuevo.
- **M1:** cualquier modelo abierto es seguro y no pierde información.
- **M2:** resultados y exportaciones siempre representan el estado actual.
- **M3:** reglas R3–R8 y formatos pasan auditoría cruzada.
- **M4:** candidato de producción local instalable y recuperable.
- **M5:** release `v1.0.0-local`.

