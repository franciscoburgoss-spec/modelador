# Cierre — SPEC-R5 / corte D

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `81c91ec364fc76d55031283c7222551b24618d5d` |
| Spec | `specs/SPEC-R5-D-element-inventory.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Python 3.14.5; ezdxf 1.4.4; CalculiX 2.23; Playwright 1.62.0 externo |

## Alcance ejecutado

Se agregó un inventario de elementos y vanos con búsqueda, filtros, estados, localización, acceso al
editor existente y edición directa de tipo/rol. Los muros filtrados pueden recibir un tipo mediante
una operación explícita y atómica. El inspector no modal compartido por elementos, techumbres y
faldones pasó a ser arrastrable y queda acotado al viewport.

## Cambios

- `projectElementInventory.js` proyecta filas estables sin mutar el modelo.
- `assignWallTypesBatch` valida tipo y todos los IDs antes de escribir, deduplica el lote, invalida
  framing+OSB mediante `wallTypeAssignment` y agrega una sola entrada al historial.
- `Elementos → Listado de elementos del proyecto…` muestra el contador de muros sin tipo y permite
  asignación individual o masiva sin inferir roles.
- Las ediciones complejas siguen delegadas a sus formularios; la tabla no modifica geometría ni
  referencias directamente.
- `FloatingPanel` unifica los tres inspectores, conserva interacción con el canvas y limita el drag
  a ocho píxeles del viewport.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1–3. Proyección, estado y filtros puros | PASS | `projectElementInventory.test.mjs` 2/2; `casa-L`: 92 filas, 45 muros y 45 sin tipo |
| 4–5. Batch validado, atómico, invalidado y con un undo | PASS | `wallTypeBatch.test.mjs` 2/2 |
| 6–7. Tabla, edición directa, menú y contador | PASS | `elementInventory.component.test.jsx` pruebas 1–3 |
| 8. Inspector común arrastrable y acotado | PASS | `elementInventory.component.test.jsx` prueba 4 |
| 9. Prueba de reversión | PASS | fallos previos por módulos/batch ausentes y reversión enfocada de drag |
| 10. Puertas completas | PASS | `npm run validate` código 0 en `81c91ec`; no se modificaron DXF ni INP |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas R5-D enfocadas | PASS | 4/4 puras/store + 4/4 componentes |
| Fixture real `casa-L` | PASS | 92 filas; 45/45 muros señalados como `Sin tipo / rol` |
| `npm run validate` | PASS | 736/736 Node; 8/8 componentes; 35/35 lab; core 93,63 %; store 97,77 % |
| Goldens / DXF | PASS | 18/18; `artifacts/81c91ec364fc/audit-dxf.json`, 8 familias, 9 archivos, 0/0 |
| CalculiX | PASS | `artifacts/81c91ec364fc/smoke-ccx.json`, 3/3, 1.486 nodos y 8.649 valores finitos |
| Build | PASS | 714,70 kB raw / 222,14 kB gzip; warning heredado visible |
| Migración / artefactos / derivados | PASS | 187 archivos; 365 inspeccionados; 13 exportadores y 14 mutadores |
| `make governance` | PASS | 20 archivos, 29 requisitos y 37 decisiones después del cierre |
| GitHub Actions | PASS | [run 30381500063](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30381500063), SHA exacto, Playwright 1/1 esperado |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Módulo de inventario ausente | `projectElementInventory.test.mjs`: 2/2 no pueden cargar la autoridad |
| Acción `assignWallTypesBatch` ausente | `wallTypeBatch.test.mjs`: 2/2 fallan antes de mutar |
| Movimiento retirado de `FloatingPanel` | componente de inspector: esperaba `left=472px`, obtuvo vacío |

Los dos primeros fallos se observaron antes de implementar. La tercera reversión se ejecutó sobre
el commit final y después se restauró el archivo byte a byte.

## Desviaciones y deudas descubiertas

- No se infirió `tabique` para ningún muro; el usuario debe escoger una autoridad existente.
- No se incorporaron virtualización ni edición tabular de geometría, expresamente fuera de alcance.
- El bundle aumenta 11,01 kB raw / 3,51 kB gzip; el warning de chunk sigue gobernado por SPEC-005.
- No aplica auditoría DXF o smoke CCX adicional por cambio de emisores; ambos gates generales se
  ejecutaron igualmente y permanecen verdes.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `docs/DEVELOPMENT.md`
- [x] `specs/domain/README.md`
