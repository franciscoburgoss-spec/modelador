# BUG-016-A-001 — Contratos canónicos y regresión de evidencia en B1

## Estado

CERRADO — 11-ago-2026.

## Hallazgo

La primera implementación de SPEC-016-A B1 presenta cinco defectos contractuales y una regresión
de evidencia que impiden aprobar el corte:

1. la gramática `\d{6,}` admite aliases con ceros iniciales para un mismo ordinal de escenario o
   assignment;
2. la canonicalización ordena IDs como texto en vez de ordenar sus ordinales numéricos;
3. `migrateV3ToV4()` puede sobrescribir un `constructiveSolutions` preexistente en v3 y no rechaza
   explícitamente versiones ajenas a v3/v4;
4. el validador persistente admite assignments semánticamente idénticos con IDs diferentes;
5. la frontera entre validación persistente B1 y resolución contextual futura B2 no quedó
   documentada explícitamente;
6. `npm run validate` falla porque el generador histórico de SPEC-015-C pasa su estado v3 por el
   importador nativo vigente, que ahora migra correctamente a v4, y deja de reproducir byte a byte
   la evidencia cerrada.

## Impacto

Los primeros cuatro defectos permiten representaciones no canónicas o pérdida silenciosa durante
la migración. La omisión documental puede inducir una validación B1 indebidamente contextual. La
regresión SPEC-015-C impide el gate integral, aunque no altera la geometría ni las autoridades de
SPEC-015-E.

## Corrección requerida

- imponer una representación decimal canónica con ancho mínimo seis y sin ceros adicionales;
- ordenar escenarios y assignments por ordinal numérico;
- hacer la migración directa fail-closed ante colisión y versiones distintas de v3/v4;
- rechazar duplicados semánticos persistidos excluyendo `assignmentId` de la comparación;
- congelar en SPEC/sesión la frontera persistente B1 frente a la validación contextual B2;
- conservar intactos artefacto y checksum históricos de SPEC-015-C y, sólo si es posible desde sus
  fuentes originales sin migración inversa ni heurística, fijar una ruta explícita de reproducción
  v3. Si no es posible, detener la correctiva para decisión humana.

## Fronteras

- no iniciar B2 ni resolver requirements, regiones o bibliotecas contra contexto vivo;
- no migrar inversamente v4→v3;
- no reemplazar ni regenerar evidencia histórica cerrada;
- no ampliar a eligibility, adapters, generación, freshness, UI, FX-008 de SPEC-016-A o
  SPEC-016-B/C;
- no modificar autoridades upstream ni datos Metalcon legacy.

## Criterio de cierre

La identidad y el orden son canónicos, la migración es exacta y fail-closed, los duplicados
semánticos persistidos se rechazan, la frontera B1/B2 queda documentada y todos los gates B1.1,
incluido `npm run validate`, pasan sin alterar la evidencia histórica SPEC-015-C.

## Resolución

La correctiva B1.1:

- exige la representación decimal única de ancho mínimo seis para `scenarioId` y `assignmentId`;
- ordena escenarios y assignments por su ordinal numérico, incluido el salto 999999→1000000;
- limita `migrateV3ToV4()` a v3/v4, rechaza colisiones v3 y conserva la entrada intacta;
- rechaza assignments persistidos semánticamente duplicados, excluyendo sólo `assignmentId` de
  la comparación;
- congela la frontera entre validación persistente B1 y validación contextual futura B2;
- reproduce el contrato histórico SPEC-015-C directamente como v3 desde sus fuentes originales,
  sin migración inversa, heurística ni modificación de los artefactos cerrados.

La reproducción SPEC-015-C conservó byte a byte:

- JSON: `bbe6ab1dd4111b300625b17f5157bea30936a5db534b5b15ed94f0f9c3b05b9f`;
- HTML: `f66bfe6081de42924e7fced09a4d64077c5df6d00c9a322278257d34510fb7a2`;
- manifiesto: `a4b6654e0547ae5da23cd9c53bb2594a22d57b12de9b92cf420161489b809b96`.

## Evidencia de cierre

- focal B1/B1.1 y persistencia relacionada: 32/32 PASS;
- Node: 1044/1044 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS;
- goldens: 19 artefactos verificados, sin actualización durante B1.1;
- DXF: 14 archivos, 0 errores, 0 reparaciones y 0 fallos de calidad;
- CalculiX: 3/3 PASS;
- build: PASS, con warning heredado de chunks mayores a 600 kB;
- migración: 187 archivos, 129 idénticos y 58 cambios registrados, 2 fixtures;
- gobernanza: 22 archivos requeridos, 53 requisitos y 64 decisiones;
- `npm run validate`: PASS;
- `git diff --check`: PASS.

BUG-016-A-001 queda cerrado. B2 no fue iniciado ni queda autorizado por este cierre.
