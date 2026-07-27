# Cierre — SPEC-R4 / preparación

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R4-finding-catalog.md`, preparación |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se redactó y gobernó R4 antes de modificar código. La preparación midió productores y consumidores,
fijó el contrato del catálogo/finding, separó tres cortes y verificó las fuentes oficiales
disponibles. No se implementó comportamiento.

## Cambios

- Se corrigió el diagnóstico a 29 `findings.push`, 27 usos del helper de validación, 10 issues de
  preparación estructural y 51 `warnings.push` locales en 14 módulos.
- Se decidió un catálogo inicial de tres reglas que representa orígenes manual, derivado y obra.
- Se fijaron shape numérico, IDs tipados, compatibilidad legacy y presentación de `info`.
- Se dejó explícito que R7 emite los checks y que R4 no cambia geometría ni datos importados.
- D-018 evita inventar una edición documental cuando la publicación oficial no la declara.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Diagnóstico medido | PASS | conteos reproducibles con `rg`; inspección de cuatro productores y `ValidationModal` |
| Decisión cerrada | PASS | catálogo, shape, fuentes, compatibilidad y orden A→B→C definidos |
| Alcance y exclusiones | PASS | checks R7, roles R5, warnings locales, persistencia y exportadores excluidos |
| Aceptación verificable | PASS | 12 criterios vinculados a pruebas, inspecciones y reversión |
| Fuente identificada sin metadata inventada | PASS | publicaciones oficiales LP/Cintac y D-018 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 18 decisiones |
| `npm run validate` con Node 22 | PASS | 578/578; laboratorio 35/35; build OK |
| `npm run verify:migration` | PASS | 187 archivos; 158 idénticos; 29 cambios registrados; 2 fixtures |
| Auditoría DXF | No aplica | preparación documental; no se modificaron emisores ni DXF |
| Smoke CalculiX | No aplica | preparación documental; no se modificaron emisores ni INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: esta unidad sólo emite el contrato previo a implementación | 0 |

## Desviaciones y deudas descubiertas

- El roadmap conservaba un conteo de warnings anterior a R3 y mezclaba findings con resultados
  locales. La spec usa el baseline actual sin ampliar el alcance a una migración masiva.
- `casa-L` conserva gap 3 aunque proyectos nuevos usan 5; el límite futuro debe resolver 23/25 con
  el dato efectivo, sin migración silenciosa.
- `validate-governance` no recorre `specs/domain/`; se registró bajo R-011 y la estructura de esta
  spec se revisó manualmente.
- No hubo cambios de código, modelo, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
