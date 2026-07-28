# Cierre — SPEC-R7 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R7-checks.md`, corte B |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerraron exclusivamente el cruce llegada cercha–jamba, la fuente viva de techumbre, la
visibilidad de las tres guardas `MIN_TRAMO` y la preservación del finding extendido en faldones.
La capacidad de corte por dirección corresponde a R7-C.

## Cambios

- `roofSupportChecks.js` consume `getRoofSystems(model)`, por lo que un faldón vivo prevalece
  sobre `roofSystems` legacy sin duplicar la evaluación.
- Cada posición de cercha se proyecta sobre los muros de apoyo vivos en la cota. Sólo se evalúan
  posiciones dentro de la huella de un vano; huellas apiladas idénticas y offsets repetidos se
  agrupan.
- El límite se resuelve como `B/2` desde el perfil montante efectivo. Serie 90 usa 19 mm; perfil
  sin `B`, sistema stale, geometría/eje/cota no resolubles quedan en cobertura con razón estable y
  nunca reciben un fallback.
- El finding conserva regla Cintac, medida, límite y `wallIds`, más `roofPlaneIds` o
  `roofSystemIds` según la fuente viva. `validateModel` lo integra en la ruta ya consumida por
  `ValidationModal`.
- `roofPlane.js` hace observables `support-overlap`, `polygon-run` y `polygon-edge`: cada descarte
  de hasta 200 mm emite `shortRoofSpan` con etapa, medida, umbral estricto y muro candidato, sin
  crear el tramo.
- El contrato de finding admite `stage` y `limit.exclusiveMin`; la presentación muestra
  inequívocamente `> 200 mm`.
- `roofPlaneValidation` deja de reconstruir un shape reducido: agrega prefijo e ID de faldón
  preservando regla, medida, límite, etapa e IDs tipados originales.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 6. Llegada sobre vano y `B/2` | PASS | 19 mm cumple, 200 mm falla; vanos apilados agrupados; perfil sin `B` queda skipped |
| 7. Diagnóstico `casa-L` | PASS | 6 findings únicos sobre vano; todos medidos sobre 19 mm; modelo `deepEqual` |
| 8. Tres guardas `MIN_TRAMO` | PASS | casos exactos de 200 mm para `support-overlap`, `polygon-run` y `polygon-edge`; 0 tramos creados |
| 12. Presentación | PASS parcial de B | fuente Cintac, medida/límite y navegación `roofSystem`/`roofPlane`; wrapper conserva shape |
| 13. Prueba de la prueba B | PASS | retirar cruce rompe 4/4; retirar visibilidad rompe 3/3 |
| 14. Puertas oficiales | PASS | gobernanza y validación integral verdes |

Los criterios 1–5 y 9 quedaron cerrados en R7-A; 10–11 corresponden a R7-C. La integración final
del criterio 12 se completa con los resultados de capacidad de R7-C.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 28 decisiones |
| Pruebas focalizadas R7-B + wrapper | PASS | 14/14 |
| `npm run validate` con Node 22 | PASS | 678/678; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 92,96 % de líneas; `roofSupportChecks.js` 96,46 % |
| Cobertura oficial del store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 141 idénticos, 46 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 305 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 685,08 kB raw / 212,20 kB gzip |
| Auditoría DXF | No aplica | R7-B no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | R7-B no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Emisión `trussJambAlignment` retirada temporalmente de `roofSupportChecks` | 4/4: legacy, fuente faldón, `casa-L` e integración |
| Emisión `shortRoofSpan` retirada temporalmente de las tres guardas | 3/3: desaparece cada etapa |

Ambos arreglos se restauraron y las pruebas focalizadas volvieron a pasar antes de la validación
integral.

## Desviaciones y deudas descubiertas

- `casa-L` sigue sin roles; el diagnóstico legacy no infiere uno. Verifica la geometría de
  llegada porque el perfil montante persistido sí resuelve `B = 38 mm`, tal como exige el baseline
  del criterio 7.
- El umbral es estricto: 200 mm aún se descarta. `exclusiveMin` evita que la UI lo presente
  erróneamente como un cumplimiento `≥ 200 mm`.
- La prueba de fuente faldón usa el fixture de laboratorio existente. No se promueve como fixture
  persistido independiente; `REQ-TST-002` continúa pendiente bajo `SPEC-003`.
- No se corrigen las seis llegadas de `casa-L`; R7-B las vuelve verificables y navegables.
- El chunk inicial aumenta 4,07 kB raw / 1,24 kB gzip respecto de R7-A; el warning existente
  continúa bajo R-010 / `SPEC-005`.
- No hubo decisiones nuevas ni cambios de formato persistido, DXF o INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
