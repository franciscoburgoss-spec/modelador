# SPEC-006-C — Coronaciones heterogéneas en cubierta agnóstica

## Diagnóstico

Al exportar desde la aplicación un proyecto con el faldón `1785161146258`, la descarga aborta con
`El faldón 1785161146258 tiene coronaciones incompatibles`. La reproducción está en
`projectRoofPlane`: selecciona todos los muros paralelos que coinciden con el borde alto del
polígono y exige que el conjunto de cotas superiores tenga cardinalidad uno.

Ese supuesto es más estricto que la geometría de un único plano. Dos tramos colineales pueden
tener coronaciones diferentes y seguir admitiendo una superficie común: la coronación más baja
gobierna y la superficie queda con mayor holgura bajo las demás. El solver vigente de `roofPlane`
aplica el mismo principio de restricción gobernante por tramo; sólo una restricción que produce
pendiente negativa o una geometría no resoluble debe bloquear.

El ID observado pertenece al estado editable del usuario y no está contenido en los fixtures del
repositorio. La regresión debe aislar la misma condición geométrica con un modelo mínimo de dos
tramos altos colineales y cotas distintas, sin copiar datos privados ni depender de localStorage.

## Decisión

Interpretar las coronaciones de todos los candidatos válidos del mismo borde alto como cotas
máximas. Para la superficie límite sin espesor, usar la menor cota `top - crownClearance` como
altura gobernante de ese borde. Una coronación mayor aporta holgura y no es incompatibilidad.

El exportador seguirá fallando atómicamente si no hay apoyo alto, si una cota no es finita o si la
restricción gobernante queda bajo la altura baja del faldón y produciría pendiente negativa. No se
invocará el solver constructivo ni se copiarán perfiles, costaneras, cerchas, miembros o findings:
la operación permanece como resolución de una superficie geométrica agnóstica.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: el fallo está localizado en una condición de borde y admite una regresión geométrica
  mínima; no cambia el schema ni implementa reglas constructivas.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Omitir el faldón que falla | Viola la prohibición de omitir geometría silenciosamente |
| Elegir la coronación máxima | Puede hacer que la superficie atraviese el tramo más bajo |
| Promediar coronaciones | No garantiza respetar ninguna restricción geométrica |
| Reutilizar `resolveRoofPlane` completo | Introduce perfiles, costaneras y criterios constructivos en una proyección que debe ser agnóstica |
| Aceptar cualquier pendiente negativa | Produce una superficie distinta de la orientación declarada por canaleta y apoyo alto |

## Alcance

- Corregir `projectRoofPlane` para resolver coronaciones heterogéneas colineales mediante la
  restricción mínima.
- Añadir un modelo mínimo con dos tramos de apoyo alto en el mismo borde, coronaciones distintas y
  un único faldón exportable.
- Verificar que la superficie es planar, finita, determinista e inferior o igual a todas las
  coronaciones descontando holgura.
- Mantener el rechazo de ausencia de apoyo, referencias rotas, dimensiones inválidas y pendiente
  negativa antes de Blob/DOM.
- Mantener intactos schema, `elements[]`, `roofGeometry[]`, archivo nativo y consumidor SPEC-14.
- Ejecutar prueba de reversión restaurando transitoriamente la igualdad estricta.
- Actualizar estado, trazabilidad, riesgo y cierre mediante las autoridades del proyecto.

## Fuera de alcance

- Corregir o refactorizar `resolveRoofPlane`, R-017, modulación, cerchas, costaneras o perfiles.
- Cambiar el polígono persistido, agregar espesor, dividir automáticamente el faldón o fabricar
  apoyos ausentes.
- Implementar reconocimiento topológico o clasificación estructural de SPEC-14.
- Editar cierres inmutables de SPEC-006-A/B.
- Usar `high`, `xhigh` o `max`.

## Criterios de aceptación

1. Un faldón con dos apoyos colineales de coronación distinta se exporta una sola vez y su borde
   alto usa `min(top) - crownClearance`.
2. La superficie resultante queda bajo o en la restricción de cada apoyo, contiene sólo números
   finitos y conserva el mismo resultado al permutar los muros candidatos.
3. Una coronación gobernante inferior a la altura baja sigue produciendo
   `AgnosticGeometryError/INVALID_DIMENSION` y no toca Blob, URL ni enlace.
4. El JSON conserva `elements[]` y `roofGeometry[]`, no filtra solución constructiva y continúa
   siendo aceptado por `consumeSpec14Input`.
5. `casa-L`, FX-003, FX-004, corpus adversario, determinismo, componente y archivo nativo siguen
   verdes.
6. La prueba de reversión demuestra que restaurar la exigencia de coronaciones idénticas reproduce
   el bloqueo y que la restauración deja la suite verde.
7. `make governance`, pruebas enfocadas, cobertura, `npm run validate`, build y auditoría del
   lanzador pasan; el cierre confirma `medium` planificado, enviado y efectivo, sin escalamiento.

## Evidencia

- Regresión mínima de coronaciones heterogéneas y permutación.
- Regresión negativa de pendiente imposible previa al DOM.
- Suite `agnosticGeometry`, consumidor SPEC-14 y flujo de menú.
- Prueba de la prueba con igualdad estricta restaurada temporalmente.
- `make governance`, `npm run validate`, `npm run codex:audit` y `git diff --check`.
- Cierre `sessions/close-SPEC-006-C.md` y eventos append-only.

## Corte sugerido

Detener cuando el falso bloqueo por coronaciones heterogéneas quede corregido sin relajar los
errores geométricos reales ni acoplar el exportador a una solución constructiva.
