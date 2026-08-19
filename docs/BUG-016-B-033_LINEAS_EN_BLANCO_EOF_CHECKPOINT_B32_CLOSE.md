# BUG-016-B-033 — Líneas en blanco EOF en checkpoint B3.2-CLOSE

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

Durante la auditoría staged previa al commit de `SPEC-016-B / B3.2-CLOSE`,
`git diff --cached --check` detectó `new blank line at EOF` en diez archivos
del corte ya aprobado.

Archivos afectados:

- `docs/BUG-016-B-021_KIT_B32_CONFUNDE_SECCIONES_TECNICAS_CON_SUBCORTES_IMPLEMENTACION.md`;
- `docs/BUG-016-B-022_UMBRAL_AMBIGUO_SOLAPE_2D_OPENINGS_B32.md`;
- `docs/BUG-016-B-023_CONTENCION_OPENING_VOID_EN_DOMINIO_HOST_B32.md`;
- `docs/BUG-016-B-024_CRITERIO_AMBIGUO_PRISMAS_CASI_ORTOGONALES_Y_NIVELADOS_B32.md`;
- `docs/BUG-016-B-026_DOMINIO_B32_MAS_ESTRICTO_QUE_GEOMETRIA_AGNOSTICA_AUDITADA.md`;
- `docs/BUG-016-B-027_OPENING_VOID_AUDITADO_MAS_AMPLIO_QUE_DOMINIO_MATERIALIZABLE_B32.md`;
- `docs/BUG-016-B-028_INVARIANTES_KIND_HEIGHT_THICKNESS_HOST_B32_NO_CONGELADAS.md`;
- `docs/BUG-016-B-032_CORPUS_BUG027_LONGITUD_NEGATIVA_CONTRADICE_INVERSION_D082.md`;
- `src/core/metalconConstructiveGeometry.js`;
- `tests/constructiveSpec016BMetalconGeometryB32.test.mjs`.

## Clasificación

Correctiva mecánica de formato EOF.

No modifica decisiones, contrato, semántica, tests, comportamiento ni alcance.

No reabre B3.2 y no habilita implementación B3.3.

## Resolución propuesta

Eliminar exclusivamente las líneas vacías adicionales al EOF, conservando
exactamente un salto de línea final POSIX.

No se autoriza ninguna otra modificación en los archivos afectados.

## Criterios de cierre

1. los diez archivos terminan con exactamente un salto de línea final;
2. no cambia ningún contenido no-whitespace;
3. `git diff --cached --check` queda limpio;
4. el staged set permanece limitado al checkpoint B3.2 más este BUG;
5. los gates funcionales no requieren repetición porque la correctiva es
   estrictamente whitespace; cualquier diferencia adicional detiene el cierre.

## Cierre verificado

CERRADO — 19-ago-2026.

Se verificó byte a byte contra el contenido staged previo que los diez
archivos afectados difieren exclusivamente por la normalización del EOF:

- se eliminaron sólo saltos de línea excedentes;
- cada archivo conserva exactamente un LF final POSIX;
- no cambió contenido no-whitespace;
- no se modificó contrato, implementación, comportamiento ni alcance;
- B3.2 permanece cerrado mediante D-087;
- B3.3 permanece únicamente en Fase A READ-ONLY.

Por tratarse exclusivamente de una correctiva EOF demostrada mecánicamente,
no se repiten los gates funcionales ya aprobados de B3.2-CLOSE.
