# Baseline de lint heredado

`SPEC-000` incorpora ESLint sin modificar comportamiento funcional. La línea base heredada tiene
siete hallazgos de `react-hooks/exhaustive-deps` en cinco archivos:

| Archivo | Hallazgos | Tratamiento |
|---|---:|---|
| `src/components/Canvas.jsx` | 1 | exclusión acotada al archivo |
| `src/components/modals/AddDimensionModal.jsx` | 2 | exclusión acotada al archivo |
| `src/components/modals/AddOpeningModal.jsx` | 1 | exclusión acotada al archivo |
| `src/components/modals/RoofPlaneModal.jsx` | 2 | exclusión acotada al archivo |
| `src/components/modals/RoofTrussModal.jsx` | 1 | exclusión acotada al archivo |

La regla permanece activa y bloqueante para todo otro archivo. Estas exclusiones no afirman que los
hooks sean correctos; sólo preservan el baseline durante la migración reproducible. Su revisión
funcional se deriva a la fase de UX/operación, donde puede verificarse el comportamiento visible.

También se aceptan, sólo en el baseline migrado:

- variables sin uso, porque retirarlas sería una modificación masiva ajena a la spec;
- las dos claves duplicadas intencionales de `mergeLoadedModel`, ligadas al hallazgo F-002;
- expresiones regulares de pruebas que verifican caracteres de control.

Las reglas de sintaxis, globals, hooks, JSX y el resto de `eslint:recommended` continúan activas.
