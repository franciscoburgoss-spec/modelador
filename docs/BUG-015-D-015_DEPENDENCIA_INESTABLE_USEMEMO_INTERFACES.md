# BUG-015-D-015 — Dependencia inestable de `useMemo` en panel de interfaces

## Estado

Corregido en SPEC-015-D REV8 Fase B, correctiva de lint 01.

## Reproducción

Sobre el working tree REV7 con el payload REV8 aplicado, el validador completo llegó a `npm run lint` después de aprobar evidencia, formato, independencia, contratos estáticos y 83/83 pruebas Node. ESLint detuvo el gate en:

```text
src/components/StructuralInterfacesPanel.jsx
39:9 error The 'interfaceIntents' logical expression could make the dependencies of useMemo Hook ... change on every render. react-hooks/exhaustive-deps
```

## Causa

Cuando `model.structuralIntent?.interfaceIntents` estaba ausente, la expresión `|| []` creaba un arreglo vacío nuevo en cada render. Ese valor se utilizaba como dependencia de `interfaceById`, por lo que su identidad podía cambiar aun sin cambio semántico del modelo.

`relationIntents` usaba el mismo patrón aunque no disparó el error actual.

## Corrección

Usar una constante vacía inmutable compartida como fallback para ambas colecciones:

```js
const EMPTY_INTENTS = Object.freeze([]);

const interfaceIntents = model.structuralIntent?.interfaceIntents ?? EMPTY_INTENTS;
const relationIntents = model.structuralIntent?.relationIntents ?? EMPTY_INTENTS;
```

La corrección modifica sólo estabilidad referencial de la UI. No cambia schema, geometría, interfaces persistidas, relaciones, candidateLoadPaths, stale, undo, trace ni Localizar.

## Criterio de cierre

- `npm run lint` debe pasar con cero errores.
- Debe volver a ejecutarse el validador completo REV8 sin Git.
- No se considera Fase B validada hasta que el validador completo termine en PASS.
