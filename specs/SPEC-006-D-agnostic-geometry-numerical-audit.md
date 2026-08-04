# SPEC-006-D — Auditoría numérica de equivalencia geométrica

## Diagnóstico

El exportador `agnostic-geometry-v1.0` resuelve y descarga todos los tipos geométricos soportados,
rechaza entradas irresolubles y cuenta con regresiones exactas sobre fixtures. Sin embargo, una
descarga exitosa sólo prueba que la proyección terminó: el proyecto del usuario no recibe todavía
una comparación independiente que demuestre que cada coordenada, dimensión, vacío, sólido y
superficie exportada coincide con la geometría fuente vigente.

El visor 3D actual tampoco es una autoridad adecuada para esa prueba. Usa coordenadas Three.js y
representa además cerchas, costaneras y soleras constructivas; no consume directamente el contrato
agnóstico. Una inspección visual puede complementar la evidencia, pero no detecta de forma
reproducible desviaciones pequeñas, IDs omitidos o intercambios de ejes.

## Decisión

Crear un auditor puro e independiente del serializador que reciba el modelo fuente y un objeto
`agnostic-geometry-v1.0`. El auditor reconstruirá la geometría esperada desde las autoridades de
dominio del modelo, comparará por ID y ruta numérica con una tolerancia explícita en milímetros y
devolverá un informe estructurado, determinista y legible por máquina.

La independencia exige que el auditor no invoque `projectAgnosticGeometry`,
`serializeAgnosticGeometry` ni analice sus propios resultados como fuente esperada. Puede consumir
resolutores puros que ya son autoridad del modelo —ejes/referencias, parámetros y fundaciones—,
pero debe construir separadamente las primitivas esperadas y comparar estructura y números. La
auditoría cubrirá grilla, elementos, vanos y cubiertas; verificará biyección de IDs para impedir
omisiones o duplicaciones.

Toda descarga agnóstica ejecutará esta auditoría antes de Blob/URL/DOM. Una diferencia bloqueará la
descarga con error visible y contexto; un resultado correcto devolverá el informe asociado. Una
acción separada del menú permitirá descargar `auditoria-geometria-agnostica.json` para inspección y
archivo, sin agregar metadatos de auditoría al contrato geométrico.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: compara dos representaciones geométricas mediante caminos independientes, cubre todos
  los tipos y cubiertas, e integra un bloqueo atómico de exportación; `high` es suficiente y el
  alcance se separa deliberadamente del visor.

## Alcance

- Definir `agnostic-geometry-audit/v1` con estado, tolerancia, resumen, checks por entidad/ruta y
  desviación máxima expresada en milímetros.
- Reconstruir independientemente la geometría esperada de ejes, niveles, muros, vanos, columnas,
  vigas, capas de fundación y superficies legacy/modernas de cubierta.
- Comparar schema, unidades, convención cartesiana, tipos, IDs, cardinalidades, roles, clases de
  primitiva, valores y ausencia de miembros inesperados en las colecciones geométricas.
- Exigir biyección entre IDs fuente y exportados, incluidos vanos, capas y cubiertas; no aceptar
  elementos omitidos, extras o duplicados.
- Usar tolerancia absoluta por defecto de `0,001 mm`; declarar en cada informe la tolerancia
  efectiva y rechazar tolerancias negativas o no finitas.
- Hacer determinista el informe ante permutaciones equivalentes del modelo y del JSON.
- Auditar automáticamente la proyección justo antes de descargar la geometría y bloquear todo I/O
  DOM ante un informe fallido.
- Añadir una descarga separada `auditoria-geometria-agnostica.json`, con MIME JSON, revocación de
  URL y contenido suficiente para comparar qué se auditó y por qué pasó o falló.
- Integrar la acción como `Exportar auditoría geométrica…`, distinta de la geometría y del archivo
  nativo.
- Probar `casa-L`, FX-003, FX-004, coronaciones heterogéneas, modelos mínimos y payloads alterados.
- Ejecutar prueba de reversión que elimine transitoriamente una comparación crítica.
- Actualizar trazabilidad, riesgo, decisión, estado y cierre mediante las autoridades vigentes.

## Fuera de alcance

- Implementar el visor, superposición, colores de diferencias, Three.js o captura visual; será un
  corte posterior.
- Auditar archivos externos elegidos mediante selector, cambiar el formato nativo o importar el
  JSON agnóstico.
- Añadir hash, firma criptográfica o garantía de identidad posterior a que otro programa modifique
  el archivo descargado.
- Comparar perfiles, montantes, OSB, cerchas, costaneras, materiales, resultados, DXF o INP.
- Inventar espesor de cubierta o convertir superficies límite en volúmenes.
- Cambiar `agnostic-geometry-v1.0`, `modelVersion` 2 o implementar SPEC-08 a SPEC-14.
- Corregir divergencias ajenas del visor constructivo o refactorizar resolutores sin evidencia de
  que bloquean esta auditoría.
- Usar `xhigh` o `max`.

## Criterios de aceptación

1. El informe exacto declara `agnostic-geometry-audit/v1`, tolerancia `0,001 mm`, estado y resumen
   con cantidades fuente/exportadas, checks y desviación máxima finita.
2. Un payload correcto de cada tipo produce `pass`; los IDs de ejes, niveles, elementos, vanos,
   capas y cubiertas son biyectivos y sus coordenadas/dimensiones coinciden dentro de tolerancia.
3. Alterar por separado posición, largo, espesor, altura, vano, columna, viga, capa de fundación o
   vértice de cubierta produce `fail` con ID, ruta, esperado, observado y desviación; omitir,
   duplicar o agregar geometría también falla explícitamente.
4. Una diferencia de hasta `0,001 mm` pasa y una superior falla; `NaN`, infinito y tolerancia
   inválida nunca se aceptan.
5. `casa-L` audita 45 muros, 43 vanos, cuatro fundaciones y dos cubiertas; FX-003/004 y la regresión
   de coronaciones heterogéneas pasan sin datos constructivos.
6. Permutar colecciones equivalentes produce el mismo informe serializado y el auditor no importa
   ni llama al proyector/serializador agnóstico.
7. `downloadAgnosticGeometry` no crea Blob, URL ni enlace si la auditoría falla; si pasa conserva
   nombre, MIME, bytes canónicos y revocación de SPEC-006-A/B/C.
8. `Exportar auditoría geométrica…` descarga un informe determinista separado, no modifica el
   modelo ni el JSON geométrico y hace visible cualquier fallo.
9. Una prueba de reversión demuestra que retirar una comparación numérica deja pasar el payload
   alterado y que restaurarla devuelve la suite verde.
10. `make governance`, pruebas enfocadas, cobertura, `npm run validate`, build y auditoría del
    lanzador pasan; el cierre confirma `high` planificado, enviado y efectivo, sin escalamiento.

## Evidencia

- Pruebas unitarias del auditor con informe exacto, tolerancias, biyección, permutación y corpus de
  alteraciones por familia geométrica.
- Auditorías de `casa-L`, FX-003, FX-004 y coronaciones heterogéneas.
- Pruebas del bloqueo pre-DOM y de ambas descargas JSON.
- Prueba de componente para las dos acciones diferenciadas y error visible.
- Inspección estática que impide dependencias del auditor hacia el proyector/serializador.
- Prueba de la prueba retirando una comparación crítica.
- `make governance`, `npm run validate`, `npm run codex:audit` y `git diff --check`.
- Cierre `sessions/close-SPEC-006-D.md` y eventos append-only en
  `governance/CODEX_EXECUTIONS.jsonl`.

## Corte sugerido

Detener cuando cada exportación geométrica quede bloqueada por una auditoría numérica independiente
y el usuario pueda descargar su informe. No abrir ni implementar el visor comparativo en esta
sesión.
