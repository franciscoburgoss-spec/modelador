# SPEC-006-E — Visor comparativo de geometría agnóstica

## Diagnóstico

SPEC-006-D demuestra numéricamente, con tolerancia de 0,001 mm y por un camino independiente, que
la proyección agnóstica coincide con el modelo fuente. El usuario puede descargar tanto geometría
como informe, pero todavía no puede inspeccionar espacialmente esa equivalencia dentro de la
aplicación.

La `Vista 3D` existente no sirve para esta comparación: construye cajas desde `build3d.js`, aplica
coordenadas propias de Three.js y añade cerchas, costaneras y soleras constructivas. Usarla como
segunda representación mezclaría nuevamente geometría arquitectónica con soluciones constructivas
y no mostraría literalmente el JSON agnóstico que se descarga.

## Decisión

Crear un visor comparativo independiente que prepare dos snapshots bajo
`agnostic-geometry-v1.0`: la expectativa geométrica reconstruida por el auditor y la proyección que
produce el exportador. El visor renderizará ambas directamente, sin pasar por `build3d.js`, y
mostrará el informe numérico asociado.

La interfaz ofrecerá tres modos: `Fuente`, `Exportada` y `Superposición`. En superposición, la
fuente será una capa sólida translúcida y la exportada un contorno contrastante en las mismas
coordenadas, sin desplazarla artificialmente. Los IDs con checks fallidos se resaltarán y el panel
indicará estado, tolerancia, cantidades, máxima desviación y primera diferencia. La comparación
visual complementa la auditoría; nunca sustituye su resultado ni afirma precisión basada sólo en
píxeles.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: la equivalencia y el contrato ya están decididos y probados; resta un adaptador puro de
  escena, render Three.js aislado, modal y pruebas enfocadas. `medium` evita sobredimensionar el
  corte sin rebajar sus gates.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Reutilizar `Viewer3D` constructivo | Añade derivados Metalcon/techumbre y no consume literalmente el contrato agnóstico |
| Mostrar sólo el JSON exportado | No permite superponer la reconstrucción independiente del modelo fuente |
| Desplazar una capa algunos milímetros | Facilita verla, pero fabrica una diferencia geométrica inexistente |
| Declarar equivalencia por captura de pantalla | La resolución visual no reemplaza la auditoría numérica por ruta |
| Importar un JSON externo en este corte | Introduce selección, validación y ciclo de archivo distintos al proyecto vivo |

## Alcance

- Exponer de forma explícita y de sólo lectura la expectativa canónica construida por el auditor,
  conservando su independencia respecto del proyector.
- Crear un preparador puro de comparación que reúna fuente, exportada, informe, entidades fallidas,
  estadísticas y bounds sin Three.js, React, DOM ni mutaciones.
- Traducir exactamente el contrato cartesiano `(x plan, y plan, z vertical)` a la escena Three.js
  `(x, y vertical, z plan)` en una única frontera probada.
- Renderizar prismas orientados, prismas alineados, capas de fundación, vanos sustraídos y
  superficies límite de cubierta de ambas capas.
- Ofrecer `Fuente`, `Exportada` y `Superposición`, con leyenda, estado PASS/FAIL, tolerancia,
  cantidades, desviación máxima y primera diferencia.
- Resaltar entidades fallidas desde los IDs del informe sin ocultar geometría correcta.
- Ajustar cámara/bounds de forma determinista y conservar órbita, zoom, pan, resize y liberación de
  geometrías/materiales/renderer.
- Añadir `Comparar geometría agnóstica…` al menú `Ver` y un modal lazy separado de `Vista 3D…`.
- Hacer visible un error de preparación/render sin abrir una escena parcial silenciosa.
- Probar modelo mínimo, `casa-L`, FX-003, FX-004 y un payload inyectado alterado.
- Actualizar trazabilidad, riesgo, decisión, estado y cierre.

## Fuera de alcance

- Cambiar o reemplazar la `Vista 3D` constructiva existente.
- Renderizar perfiles, montantes, OSB, cerchas, costaneras, soleras, materiales, DXF o resultados.
- Importar, editar o guardar un JSON agnóstico externo.
- Convertir cubiertas límite en volúmenes o inventar su espesor.
- Añadir medición, selección editable, picking, anotaciones o exportación de imágenes.
- Modificar `agnostic-geometry-v1.0`, tolerancia contractual o reglas de SPEC-08 a SPEC-14.
- Resolver F-009 o deudas DXF/INP.
- Usar `high`, `xhigh` o `max`.

## Criterios de aceptación

1. El preparador devuelve dos snapshots `agnostic-geometry-v1.0` independientes y un informe
   `agnostic-geometry-audit/v1`; no muta el modelo ni usa `build3d.js`.
2. Modelo mínimo, `casa-L`, FX-003 y FX-004 producen estado `pass`, mismas cantidades, cero IDs
   fallidos y máxima desviación dentro de 0,001 mm.
3. Alterar posición, dimensión o ID de una proyección inyectada produce estado `fail`, primera
   diferencia reproducible e IDs fallidos para resaltado; el visor sigue siendo diagnóstico.
4. La conversión de coordenadas es exactamente `{x, y:z, z:y}` y los bounds incluyen prismas,
   vanos, sólidos de fundación y superficies de cubierta sin valores no finitos.
5. Los tres modos controlan las capas sin desplazar sus coordenadas: fuente sólida translúcida,
   exportada como contorno y superposición de ambas.
6. Muros muestran sus vanos, columnas/vigas/fundaciones sus sólidos y cubiertas sus superficies;
   ningún dato constructivo llega al plan de escena ni aparece en la leyenda.
7. El modal se abre desde `Ver > Comparar geometría agnóstica…`, muestra estado, tolerancia,
   conteos y desviación, y conserva separada la acción `Vista 3D…`.
8. Fallos de proyección/auditoría son visibles en el modal y no crean canvas ni escena parcial.
9. Una prueba de reversión demuestra que intercambiar ejes en la frontera o incluir una fuente
   constructiva hace fallar la prueba correspondiente.
10. Pruebas enfocadas, componentes, cobertura, `npm run validate`, `make governance`, auditoría
    Codex, build y `git diff --check` pasan; el cierre confirma `medium` en las tres etapas.

## Evidencia

- Pruebas unitarias del preparador, transformación, bounds, estilos/modos e IDs fallidos.
- Pruebas sobre `casa-L`, FX-003, FX-004, modelo mínimo y payload alterado inyectable.
- Prueba de componente del menú/modal con resumen PASS y error visible.
- Inspección estática que impida importar `build3d.js` o campos constructivos en el comparador.
- Prueba de reversión de ejes o aislamiento constructivo.
- `make governance`, `npm run validate`, `npm run codex:audit`, build y cierre
  `sessions/close-SPEC-006-E.md`.

## Corte sugerido

Detener cuando la aplicación compare visualmente la reconstrucción auditora y la proyección
agnóstica viva, con evidencia numérica visible y sin mezclar ninguna solución constructiva.
