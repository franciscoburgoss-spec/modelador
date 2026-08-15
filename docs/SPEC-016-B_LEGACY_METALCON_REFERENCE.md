# SPEC-016-B — Referencia congelada Metalcon legacy

## Estado

REFERENCIA HISTÓRICA CONGELADA — 15-ago-2026.

Baseline: `fde781c4c95fa66bab2fdb7014839922db1cdb33` — Implementa y cierra SPEC-016-A soluciones constructivas.

## Decisión

La implementación Metalcon existente no se migra ni se convierte en input de SPEC-016-B. Permanece físicamente disponible porque todavía existen consumidores productivos históricos, pero el nuevo adaptador Metalcon se desarrolla desde cero sobre la arquitectura de SPEC-015/016-A.

## Datos legacy excluidos de la nueva autoridad

`wallTypes`, `wallTypeId`, `wallRoles`, `metalconDefaults`, `osbDefaults`, `model.library.metalconProfiles`, `wall.studs`, `wall.headers`, `wall.osbCourses` y moduladores/derivados históricos.

## Uso permitido

El legacy puede consultarse como referencia para estudiar algoritmos previos, revisar decisiones geométricas, comparar representaciones, identificar lecciones aprendidas y diseñar pruebas adversarias. Una regla nueva no adquiere autoridad por existir en el legacy: debe quedar nuevamente especificada, justificada y probada dentro del contrato nuevo.

## Hallazgo histórico A5.1

FX-008 conserva `framingTrackProfileId = "1784585812050"` como string mientras el catálogo conserva `profile.id = 1784585812050` como number. La comparación textual encuentra el perfil U `92C085`, pero el lookup estricto usado por la ruta CalculiX legacy devuelve `null`.

Este hallazgo queda documentado, no se corrige en SPEC-016-B, no se incorpora a la biblioteca nueva y requerirá un corte correctivo independiente sólo si el legacy vuelve a necesitar evolución.

## Regla de independencia

Ningún módulo nuevo de SPEC-016-B puede importar o depender de esta implementación como fuente de datos, authority o fallback. Una futura SPEC podrá retirar físicamente el legacy sólo después de demostrar que los consumidores que todavía lo necesitan han sido reemplazados de forma controlada.
