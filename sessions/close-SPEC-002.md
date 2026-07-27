# Cierre — SPEC-002 / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-002-derived-state-and-exports.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; CalculiX 2.23; ezdxf 1.4.4 |

## Alcance ejecutado

Se cerró la invalidación central de derivados y la política única de exportación. Parámetros,
biblioteca, grilla, muros, vanos, fundaciones y techumbre declaran sus dependencias; sólo comandos
de regeneración completos pueden escribir resultados persistidos. JSON y CSV explicitan stale,
los DXF derivados se bloquean y ninguna variante INP permite descargar datos obsoletos.

## Cambios

- Registro puro con tres derivados y doce clases de mutación, materializado en
  `governance/DERIVED_STATE_MATRIX.md`.
- Comandos atómicos para regenerar framing, OSB y cerchas; escrituras parciales rechazadas.
- Parámetros, defaults, biblioteca, niveles, topología y ambas rutas de eliminación de vanos
  invalidan centralizadamente.
- Inventario de trece exportadores con política `live`, `explicit` o `block`.
- Guardas duras para CalculiX global, cerchas y fundaciones; mensajes visibles indican regenerar.
- El CSV declara `VIGENTE` o `DERIVADOS_DESACTUALIZADOS`; JSON conserva los flags stale.
- `verify:derived` impide que la matriz o un entry point diverjan de sus registros.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Matriz mutador→derivado revisable | PASS | `DERIVED_STATE_MATRIX.md`; `verify:derived`: 12 mutadores |
| 2. `espesor_placa` invalida 45 muros | PASS | `derivedStateContract.test.mjs`: 45/45 framing y OSB |
| 3. Perfil 90→140 invalida salidas | PASS | contrato de librería invalida muros y cerchas |
| 4. Eliminar vano por cualquier ruta invalida | PASS | acción directa y selección verificadas |
| 5. Derivados sólo por comandos autorizados | PASS | `updateElement` rechaza campos derivados |
| 6. Cada exportador prueba current/stale | PASS | 13 políticas parametrizadas en `exportPolicy.test.mjs` |
| 7. Ningún INP se descarga stale | PASS | tres entry points abortan antes del DOM |
| 8. Regenerar limpia sólo al completar | PASS | framing, OSB y cerchas probados |
| 9. Fallo parcial conserva stale | PASS | resultados incompletos lanzan antes del commit |
| 10. Revertir guardas rompe pruebas | PASS | cuatro mutaciones controladas, una falla esperada cada una |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 17 decisiones |
| `npm run validate` con Node 22 | PASS | 558/558; laboratorio 35/35; build OK |
| `npm run test:coverage` | PASS | core 90,65 %; store 62,77 % |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| `ezdxf doc.audit()` | PASS | 19 DXF; 0 errores / 0 reparaciones cada uno |
| `ccx -i truss` | PASS | 22 nodos; 30 elementos; job finished |
| `ccx -i foundation` + parser DAT | PASS | job finished; 89 nodos con desplazamiento |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Invalidación de `updateProjectParam` | 1/1: contrato de los 45 muros |
| Invalidación al borrar vano por selección | 1/1: ruta anidada conserva flags falsos |
| Guarda dura `calculix-truss` | 1/1: la política autoriza stale |
| Validación completa de regeneración framing | 1/1: deja de lanzar ante headers ausentes |

## Desviaciones y deudas descubiertas

- El chunk inicial subió de 621,69 a 629,04 kB raw. El warning continúa bajo R-010 /
  `SPEC-005`; no se amplió el corte con optimización.
- Las fundaciones y los faldones se resuelven en vivo; la matriz declara explícitamente que no
  tienen caché persistida propia que invalidar.
- `ezdxf` se instaló sólo en un entorno temporal para la auditoría; no agrega dependencia runtime.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
