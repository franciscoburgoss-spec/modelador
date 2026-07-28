# SPEC-R5-D — Inventario de elementos y resolución explícita de tipos

## Diagnóstico

La migración R5 preserva correctamente los muros legacy sin `wallTypeId`: inferir un rol desde
espesor, geometría o derivados sería inseguro. Sin embargo, resolver un proyecto real exige hoy
seleccionar y editar cada muro por separado. `casa-L` contiene 45/45 muros en ese estado y la única
señal visible queda enterrada como finding informativo en la revisión general.

El menú `Elementos` sólo crea objetos. No existe una vista transversal para buscar, filtrar,
localizar o modificar elementos existentes. El panel de propiedades seleccionado es no modal, pero
duplica tres implementaciones con posición fija y no reutiliza el comportamiento arrastrable de los
modales.

## Decisión

Agregar un inventario no destructivo del proyecto y una operación explícita de asignación masiva.
La aplicación nunca adivina el rol: el usuario elige un `wallType` existente y confirma qué muros
lo reciben. La mutación valida el lote completo antes de escribir, invalida derivados mediante el
registro central y crea una sola entrada de historial.

El inventario permite edición directa sólo de `wallTypeId`, cuya frontera ya está definida. Las
ediciones geométricas o referenciales siguen usando los formularios existentes. El panel de
propiedades permanece no modal y pasa a usar un contenedor flotante común, arrastrable desde su
encabezado y limitado al viewport.

## Alcance

- Proyección pura de muros, pilares, vigas, fundaciones y vanos anidados a filas de inventario.
- Nombre, ID, clase, nivel, sección, tipo/rol y estado visible por fila.
- Búsqueda y filtros por clase, nivel y estado `sin tipo/rol`.
- Entrada `Elementos → Listado de elementos del proyecto…` con contador de muros sin tipo.
- Selección individual/masiva y asignación de un tipo existente a los muros seleccionados.
- Edición directa del tipo de un muro; quitar el tipo sigue siendo una acción explícita.
- Acciones para seleccionar/localizar y abrir el editor individual existente.
- Batch de store atómico, una sola entrada de undo y una invalidación central de todos los muros.
- Contenedor común para propiedades de elemento, sistema y faldón, arrastrable y recuperable dentro
  del viewport.
- Pruebas puras, de store y de componentes para los flujos anteriores.

## Fuera de alcance

- Inferir o asignar automáticamente MP1, MP2, MP3 o `tabique` sin elección del usuario.
- Crear tipos desde overrides legacy o modificar `modelVersion`.
- Edición tabular directa de geometría, IDs, ejes, niveles o referencias entre elementos.
- Persistir preferencias de posición del inspector en el archivo del proyecto.
- Rediseño visual completo, virtualización de tablas o edición estilo planilla.
- Persistencia nativa, Tauri, packaging o cambios a emisores DXF/INP.

## Criterios de aceptación

1. La proyección pura incluye cada elemento superior una vez y cada vano anidado una vez, con
   identidad estable, padre explícito, etiqueta, nivel, sección y estado reproducibles.
2. Todo muro sin `wallTypeId` se muestra como `Sin tipo / rol`; el inventario expone el conteo y
   puede filtrarlos sin ocultar otros findings ni alterar el modelo.
3. Búsqueda y filtros son deterministas y no dependen del orden incidental de render.
4. Asignar un tipo a uno o varios muros valida IDs y tipo antes de mutar; un lote inválido no cambia
   modelo, historial ni derivados.
5. Un lote válido modifica exactamente los muros solicitados, invalida framing y OSB de todos ellos
   mediante la autoridad central y se revierte con un solo `undo`.
6. La tabla permite asignar tipo directamente, seleccionar/localizar la fila y abrir el formulario
   individual para campos complejos.
7. `Elementos` muestra `Listado de elementos del proyecto…` y un contador visible cuando existen
   muros sin tipo.
8. El inspector de propiedades de elemento, techumbre y faldón se arrastra desde su encabezado,
   no bloquea el canvas y no puede quedar completamente fuera del viewport.
9. Revertir el batch hace fallar su contrato; revertir el listado o el drag hace fallar su prueba de
   componente.
10. `make governance` y `npm run validate` terminan con código 0. No aplica auditoría DXF ni smoke
    CalculiX adicional porque el corte no modifica emisores ni archivos de solver.

## Evidencia

- Pruebas de `projectElementInventory` con elementos superiores, vanos y filtros.
- Contrato de store para éxito, rechazo atómico, invalidación y undo del batch.
- Prueba con DOM del menú, contador, filtro, asignación y delegación al editor.
- Prueba con DOM del inspector arrastrable y acotado al viewport.
- Prueba de reversión enfocada y cierre `sessions/close-SPEC-R5-D.md`.
