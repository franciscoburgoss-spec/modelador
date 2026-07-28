# Cierre — SPEC-R7 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R7-checks.md`, corte A |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerraron exclusivamente el catálogo R7 y los checks de muro: cobertura pura, paso,
montante–jamba, normalización conservadora durante regeneración tipada, cadeneta corta, holgura
del borde de referencia y largo MP2/MP3. El cruce de techumbre y `MIN_TRAMO` corresponden a R7-B;
la capacidad de corte por dirección corresponde a R7-C.

## Cambios

- El catálogo crece de tres a ocho reglas inmutables. Paso, llegada de cercha, largo de panel y
  capacidad citan el Manual de Diseño Metalcon; distancia montante–jamba conserva origen de obra
  y severidad máxima `info`.
- `domainChecks.js` inspecciona configuración, geometría y derivados persistidos sin mutarlos;
  devuelve `findings` y cobertura con razones estables para rol, geometría, referencia o framing
  ausente/desactualizado.
- MP1 y MP2 verifican el paso configurado contra 610/600 mm. MP2 acepta 3.000–5.000 mm y MP3
  acepta hasta 5.000 mm, usando el frame nominal R6.
- Montante–jamba mide ejes de piezas de altura completa: bajo 30 mm es error, entre 30 y 150 mm
  advertencia y desde 150 mm cumple. Piezas parciales no participan.
- La regeneración de un muro tipado reclasifica como `king` el `stud` exactamente coincidente.
  Sólo MP1/MP2 pueden omitir un `stud` próximo, y únicamente cuando el intervalo local resultante
  respeta el paso máximo; `edge`, `corner`, `king` y apoyos T nunca son candidatos.
- Toda cadeneta persistida menor a 30 mm produce un finding medido sin cambiar su geometría.
- Las puertas tipadas miden el borde de referencia a la cara del muro perpendicular, con signo,
  traslape Z y tolerancia de 1 mm. Espesores contradictorios producen ambigüedad explícita.
- `validateModel` agrega los findings de dominio y `ValidationModal` los presenta mediante el
  contrato R4 existente, conservando medida, límite, fuente y navegación al muro.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Pureza y cobertura | PASS | `structuredClone` inalterado; razones de skip para rol y framing stale/ausente |
| 2. Distancia eje a eje y piezas protegidas | PASS | casos 29/30/150 mm, pieza parcial excluida y apoyo T conservado como `corner` |
| 3. Omisión conservadora | PASS | MP1 elimina a 50 mm con paso resultante 450 mm; MP2 conserva cuando resultaría 650 mm; legacy no cambia |
| 4. Cadenetas cortas | PASS | `casa-L`: 6 findings, largos 12/12/24/24/24/24 mm, 45 patches y 0 bloqueos |
| 5. Holgura a cara perpendicular | PASS | −50,55 mm firmado; 49,45 mm aceptado por tolerancia; ambigüedad y Z disjunto |
| 9. Largo MP2/MP3 | PASS | límites exactos 3.000/5.000 mm y fallos 1.000/5.100 mm sobre frame nominal |
| 12. Presentación | PASS parcial de A | medida, límite, fuente Cintac y navegación `wall` preservados |
| 13. Prueba de la prueba A | PASS | retirar integración y normalización rompe una prueba focalizada por frontera |
| 14. Puertas oficiales | PASS | gobernanza y validación integral verdes |

Los criterios 6–8 corresponden a R7-B; 10–11 a R7-C. La integración final de presentación del
criterio 12 se completa en B/C sin modificar el contrato ya probado.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 28 decisiones |
| Pruebas focalizadas R7-A | PASS | 12/12; catálogo 7/7 |
| `npm run validate` con Node 22 | PASS | 669/669; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 92,81 % de líneas; `domainChecks.js` 95,65 % |
| Cobertura oficial del store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 143 idénticos, 44 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 302 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 681,01 kB raw / 210,96 kB gzip |
| Auditoría DXF | No aplica | R7-A no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | R7-A no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Integración de `domainChecks.findings` retirada temporalmente de `validateModel` | 1/1: desaparece el largo MP2 inválido |
| Normalización próxima a jamba retirada temporalmente de `computeStudLayout` | 1/2: reaparece el `stud` que MP1 podía omitir |

Ambos arreglos se restauraron y las pruebas focalizadas volvieron a pasar antes de la validación
integral.

## Desviaciones y deudas descubiertas

- El dato persistido se llama `referenceEdge`, no handedness. La UI y los findings dicen “borde de
  referencia”; no se presenta como verificación del lado real de manilla.
- La tolerancia de 1 mm permite el caso 49,45 mm contra un muro de 101,1 mm, sin alterar el límite
  declarado de 50–60 mm.
- `casa-L` no recibe tipos: conserva 45 skips `wall-role-unresolved`, y los checks condicionados no
  convierten configuración legacy en cumplimiento. Las seis cadenetas cortas sí quedan visibles
  porque son un diagnóstico de constructibilidad no condicionado por rol.
- No se resolvió constructivamente ninguna cadeneta corta; la deuda permanece bajo R-005.
- El chunk inicial aumenta 9,45 kB raw / 2,92 kB gzip respecto de la preparación; el warning
  existente continúa bajo R-010 / `SPEC-005`.
- `validate-governance` aún no recorre `specs/domain/`; la spec activa se verificó manualmente.
- No hubo decisiones nuevas ni cambios de formato persistido, DXF o INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
