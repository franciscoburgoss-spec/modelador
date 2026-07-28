# SPEC-004-B — Sesión de documento y coordinación transaccional

## Diagnóstico

El contrato A puede abrir y guardar una ruta explícita, pero el store no sabe qué archivo representa
el modelo activo. No existen ruta, título, indicador de cambios sin guardar ni proyectos recientes.
`Archivo → Guardar/Cargar` todavía opera sobre `localStorage`, por lo que tampoco hay coordinación
para Abrir, Guardar o Guardar como mediante un runtime nativo.

Las mutaciones persistentes actuales pasan por `withHistory`; selección, nivel, modo de vista, zoom
y paneles usan cambios sin historial. Esa diferencia permite gobernar el estado sucio sin comparar
JSON ni marcar como edición la navegación.

## Decisión

Agregar al store una sesión de documento separada del modelo persistido. Su estado contiene ruta,
título, `dirty` y hasta diez rutas recientes únicas. `withHistory`, undo y redo marcan el documento
como modificado; navegación y estado transitorio no lo hacen.

Abrir prepara y valida el archivo completo antes de un único commit que sustituye modelo, sesión e
historial. Guardar captura el modelo que envía al puerto y sólo limpia `dirty` si ese mismo objeto
sigue activo al terminar; una edición concurrente permanece marcada. React coordina los selectores
de ruta inyectados por el runtime y mantiene visibles los flujos legacy del navegador con nombres
distintos hasta que exista Tauri.

## Alcance

- Módulo puro para crear y transicionar ruta, título, sucio y recientes.
- Título derivado de rutas POSIX o Windows sin importar APIs de filesystem.
- Diez rutas recientes, sin duplicados y ordenadas desde la última apertura/guardado.
- Marcado central de mutaciones persistentes mediante historial, incluido undo/redo.
- Nuevo proyecto limpio, sin ruta ni historial, preservando recientes.
- Abrir una ruta mediante el puerto A, con commit atómico sólo después de lectura, migración y
  validación exitosas.
- Guardar en la ruta activa y Guardar como en una ruta explícita.
- Fallos de selector, lectura o escritura visibles mediante el feedback existente.
- Menú `Archivo` con Abrir, Guardar, Guardar como y Recientes; indicador visible de título/sucio.
- Runtime inyectable para selectores y filesystem, con acciones nativas deshabilitadas cuando falta.
- Conservación explícita de guardar/cargar navegador e importar/exportar JSON.
- Pruebas puras, store y componentes, incluida una escritura demorada con edición concurrente.

## Fuera de alcance

- Implementar diálogos, comandos o plugins Tauri reales.
- Persistir recientes entre lanzamientos; el adaptador de settings entra junto con Tauri.
- Reemplazar o migrar todavía `localStorage`.
- Autosave nativo, recuperación de crash o limpieza de temporales abandonados.
- Prompt de cierre de ventana, bloqueo de ediciones durante I/O o escritores concurrentes.
- Packaging, capabilities, CSP, firma, instalación o integración de CalculiX.
- Cambiar `modelVersion`, el contenido del archivo o emisores DXF/INP.

## Criterios de aceptación

1. Una sesión nueva se titula `Sin título`, tiene ruta nula, `dirty=false` y normaliza recientes
   POSIX/Windows a una lista única de máximo diez sin modificar las rutas.
2. Toda acción de modelo que entra al historial, además de undo/redo, marca `dirty=true`; selección,
   niveles, modo de vista, zoom y paneles no cambian el indicador.
3. Nuevo proyecto reemplaza el modelo por uno vacío, limpia historial/ruta/sucio y conserva recientes.
4. Abrir JSON truncado, modelo inválido o una lectura fallida conserva `deepEqual` modelo, ruta,
   título, sucio, recientes, `past` y `future`; sólo agrega feedback visible del error.
5. Abrir correctamente aplica en un único commit el modelo preparado, ruta, título limpio y
   reciente; `past` y `future` quedan vacíos y los warnings de migración siguen visibles.
6. Guardar sin ruta exige un destino explícito. Guardar/Guardar como fallidos no cambian sesión ni
   modelo; al completar registran ruta/reciente y limpian sucio.
7. Si el modelo cambia mientras el puerto escribe un snapshot anterior, la operación registra la
   ruta pero conserva `dirty=true`.
8. El menú y el título visible distinguen `Sin título`/nombre de archivo y `*`; exponen recientes y
   coordinan selectores cancelables. Sin runtime nativo las acciones quedan deshabilitadas y los
   flujos de navegador continúan disponibles con etiquetas inequívocas.
9. Revertir el commit posterior a validación hace fallar la atomicidad de apertura; limpiar sucio
   incondicionalmente hace fallar la prueba de edición concurrente.
10. `make governance` y `npm run validate` terminan con código 0. No aplica auditoría DXF ni smoke
    CalculiX adicional porque no se modifican emisores ni archivos de solver.

## Evidencia

- `tests/projectDocument.test.mjs` para estado y transiciones puras.
- `tests/projectDocumentStore.test.mjs` para dirty central, apertura, guardado, errores y carrera.
- `tests/projectDocument.component.test.jsx` para menú, selectores, indicador y recientes.
- Prueba de reversión enfocada y cierre `sessions/close-SPEC-004-B.md`.
