# BUG-016-B-009 — Runtime Metalcon construye libraryContext sin libraryRef

## Estado

CERRADO — 15-ago-2026.

## Contexto

Durante SPEC-016-B B2.3a se incorporó el nuevo runtime Metalcon pre-B3 en:

- `src/core/metalconConstructiveRuntime.js`
- `tests/constructiveSpec016BMetalconRuntime.test.mjs`

Debe reutilizar exclusivamente B1, B2.1 y B2.2, sin consumir Metalcon legacy.

## Evidencia

Gate focal ejecutado:

    node --test tests/constructiveSpec016BMetalconRuntime.test.mjs

Resultado:

    tests 3
    pass 0
    fail 3

Los tres casos abortan con:

    MetalconConstructiveLibraryError
    code: METALCON_LIBRARY_TAMPER
    libraryRef: undefined

## Diagnóstico confirmado

B2.1 define:

    buildMetalconLibraryContext(
      manifest,
      libraryRef
    )

pero B2.3a introdujo:

    function expectedLibraryContext() {
      return buildMetalconLibraryContext(
        METALCON_LIBRARY_MANIFEST
      );
    }

El segundo argumento queda `undefined`.

## Causa

Defecto local introducido en B2.3a: llamada incorrecta a un contrato B2.1 ya cerrado.

B2.1 actúa correctamente al bloquear el desacople mediante `METALCON_LIBRARY_TAMPER`.

## Corrección permitida

La corrección debe limitarse a `src/core/metalconConstructiveRuntime.js`:

1. derivar `libraryRef` desde `METALCON_LIBRARY_MANIFEST`;
2. pasar ese mismo `libraryRef` a `buildMetalconLibraryContext`;
3. mantener una única cadena `manifest → libraryRef → libraryContext`;
4. no modificar ni relajar B2.1;
5. no introducir fallback ni Metalcon legacy;
6. no ampliar B2.3 hacia B3 o B4.

## Criterio de cierre

- desaparece `libraryRef: undefined`;
- el focal B2.3a queda verde;
- B1, B2.1 y B2.2 continúan verdes;
- D-070 continúa limpio.

## Cierre verificado

La corrección quedó limitada a `src/core/metalconConstructiveRuntime.js`.

Se restableció la cadena contractual única:

    METALCON_LIBRARY_MANIFEST
      → buildMetalconLibraryRef(...)
      → buildMetalconLibraryContext(manifest, libraryRef)

No se modificó ni relajó el contrato B2.1 ni su protección `METALCON_LIBRARY_TAMPER`.

Evidencia ejecutada:

- focal B2.3a: 3/3 PASS;
- regresión B1 + B2.1 + B2.2 + B2.3a: 25/25 PASS;
- `git diff --check`: PASS;
- D-070 Metalcon legacy: PASS, sin coincidencias.

La corrección no introdujo fallback, no consumió Metalcon legacy y no amplió B2.3 hacia B3 o B4.
