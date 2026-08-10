# BUG-015-D-007 — Lint bloquea la validación completa de SPEC-015-D REV1

## Detección

Durante la validación local completa en macOS, después de que el preflight REV1 quedara verde,
`npm run lint` detuvo la puerta con 11 errores:

- 10 `no-useless-escape` en `scripts/generate-spec015d-evidence.mjs`;
- 1 `react-hooks/exhaustive-deps` en `StructuralProposalWorkspaceDialog.jsx` porque
  `recalculation` figuraba sólo como dependencia de `useMemo` y no era consumido en el callback.

## Causa

El prototipo HTML embebía un `onclick` dentro de un string de una plantilla literal. Los escapes
de comillas simples eran necesarios para el JavaScript emitido, pero innecesarios para la plantilla
literal fuente y por ello ESLint los rechazaba.

El contador `recalculation` se usaba como token deliberado para invalidar la memoización, pero la
regla de Hooks considera inválida una dependencia que el callback no referencia.

## Corrección

1. Se elimina el `onclick` inline del HTML de evidencia y se sustituye por `data-locate` más un
   listener registrado después de renderizar las tarjetas. La conducta visual es equivalente y no
   requiere escapes innecesarios.
2. El callback memoizado consume explícitamente `recalculation` al seleccionar un clon superficial
   del modelo para una reproyección manual. El contenido del modelo no cambia y los motores siguen
   siendo puros/no autoritativos.

## Invariantes

- No cambia `structuralIntent` ni el review log.
- No cambia la semántica de propuestas o grafos.
- `Localizar en planta` sigue siendo temporal y no autoritativo.
- No se incorporan materiales, perfiles ni soluciones constructivas.
- No se ejecuta Git.

## Validación requerida

- `node --check scripts/generate-spec015d-evidence.mjs`;
- regeneración determinista de evidencia;
- suite enfocada SPEC-015-D;
- `npm run lint` en el Mac con dependencias;
- continuación del validador completo sólo si lint queda verde.
