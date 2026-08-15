# BUG-016-A-021 — Regex inválido en auditoría de requirements productivos

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

La auditoría previa a la integración store/UI intentó buscar consumidores productivos de:

- `buildStructuralRequirementsWithReferenceResolutionContext`;
- `buildStructuralRequirements`.

El patrón usado produjo:

`regex parse error: unclosed group`

por escapar incorrectamente el paréntesis de llamada.

## Impacto

La auditoría no respondió todavía si existe un ensamblador productivo de
`structuralRequirements` reutilizable fuera de su módulo.

No es una falla de producto.

## Correctiva

Repetir la búsqueda con patrones literales o expresiones sin grupos ambiguos.

## Resguardos

- no modificar producto por este hallazgo;
- no asumir ausencia de consumidor productivo hasta repetir la búsqueda;
- no duplicar una tubería existente;
- no tocar B1/B2/B3.1/B3.2/B3.3.

## Criterio de cierre

La consulta corregida debe ejecutar sin error y permitir decidir explícitamente si la integración
reutiliza un ensamblador existente o crea uno nuevo.

## Evidencia de cierre

La auditoría se repitió usando búsquedas válidas y separadas para:

- `buildStructuralRequirementsWithReferenceResolutionContext`;
- `buildStructuralRequirements(`;
- `integrateStructuralRequirements(`.

No se encontraron consumidores productivos fuera de
`src/core/structuralRequirements.js`.

Conclusión:

- no existe actualmente un ensamblador productivo reutilizable;
- la integración SPEC-016-A deberá crear una capa de ensamblaje nueva;
- esa capa reutilizará los builders existentes y no duplicará sus algoritmos.

No se modificó producto.
