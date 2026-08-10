# BUG-015-D-017 — Etiquetas accesibles contaminadas por ayuda semántica en Interfaces

## Estado

Reproducido durante la validación completa de SPEC-015-D REV8, después de aprobar 977/977 pruebas Node.

## Reproducción

La suite de componentes se detuvo en:

```text
SPEC-015-D REV8: pestaña Interfaces declara ubicación separada de acción con un history
TestingLibraryElementError: Unable to find a label with the text of: Cara canónica
```

La pestaña Interfaces sí estaba renderizada y el control de cara existía. El problema estaba en la
estructura accesible del formulario.

## Causa

`StructuralInterfacesPanel.jsx` envolvía dentro de un mismo `<label>`:

- el texto `Cara canónica`;
- el `<select>` correspondiente;
- y `StructuralConceptHint`, que agrega texto como `Qué declara` y `No significa`.

Por tanto, la etiqueta accesible efectiva del control incorporaba también el bloque explicativo y
dejaba de ser exactamente `Cara canónica`. El mismo patrón existía en `Extremo canónico`,
`Familia de acción` y `Función`.

Además de romper la prueba, mezclar contenido explicativo de bloque dentro del `<label>` hace menos
predecible la relación label-control para tecnologías de asistencia.

## Corrección

- Asociar cada `<label>` al `<select>` mediante `htmlFor`/`id` estable.
- Mantener el texto de etiqueta separado del bloque `StructuralConceptHint`.
- Aplicar la misma regla preventiva a cara, extremo, familia de acción y función.
- No cambiar valores canónicos, estado React, store, schema ni persistencia.

## Invariantes

- `Cara canónica` continúa seleccionando `positiveN`/`negativeN`.
- `Extremo canónico` continúa seleccionando `lowS`/`highS`.
- La ayuda semántica sigue visible inmediatamente bajo cada control.
- No cambia geometría, intención persistida, candidateLoadPaths, stale, undo, review, trace o Localizar.
- No se ejecuta Git.

## Criterio de cierre

- La prueba de componente REV8 debe encontrar `Cara canónica` por su etiqueta accesible exacta.
- `npm run lint` debe continuar en PASS.
- Debe volver a ejecutarse el validador completo REV8 sin Git.
