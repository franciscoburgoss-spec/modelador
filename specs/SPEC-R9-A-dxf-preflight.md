# SPEC-R9-A — Motor geométrico y preflight de láminas DXF

## Diagnóstico

La puerta vigente demuestra que los DXF abren con `ezdxf` sin errores ni reparaciones, pero no
demuestra que una lámina sea legible o imprimible. Una auditoría reproducible de 32 archivos A1/A3
de tabiquería, OSB, cerchas y fundaciones obtuvo 0 errores y 0 reparaciones, pero detectó 942
entidades fuera del encuadre de su viewport y 162/162 viewports de contenido desbloqueados.

La causa común está antes del layout particular de cada familia:

- `entityBBox` trata un círculo como su centro y no incluye el radio;
- el texto rotado 90° se extiende hacia el lado opuesto al calculado;
- el ancho tipográfico usa un único factor optimista de 0,65;
- el margen del extent es 100 mm de modelo, sin depender de la escala de impresión;
- `packWallsIntoSheets` permite explícitamente que una vista demasiado grande sobresalga;
- la plantilla no declara milímetros ni variables de escala de línea, conserva extents fijos,
  imprime la capa `VIEWPORTS` y deja los viewports sin bloqueo;
- `upgradeEntity` sólo conoce `LINE`, `TEXT` y `CIRCLE`, aunque los niveles emiten `SOLID`, por lo
  que escribe un marcador de subclase vacío que la auditoría sintáctica no denuncia;
- no existe un preflight puro que bloquee clipping o informe colisiones antes de descargar.

Las colisiones de rótulos, burbujas y tablas también están confirmadas, pero resolver su composición
requiere cortes posteriores por familia. Mezclar esos rediseños con el contrato geométrico común
impediría atribuir las regresiones.

## Decisión

Crear una autoridad geométrica pura para las entidades DXF simples que ya generan los exportadores.
Sus cajas serán deterministas y conservadoras para `LINE`, `TEXT`, `CIRCLE`, `SOLID` y polilíneas;
la rotación se resolverá geométricamente y el margen se expresará en milímetros de papel convertido
por la escala activa.

Antes de construir cada archivo, un preflight verificará números finitos, escala positiva, extent
capaz de contener las entidades y slot contenido en el área de dibujo. Un error impide generar o
descargar la lámina y se devuelve como diagnóstico explícito; nunca se recorta, reduce ni omite
contenido silenciosamente. Las colisiones se reportan en este corte, pero sólo clipping, overflow
y contrato técnico inválido son bloqueantes hasta que R9-B/R9-C implementen la resolución visual.

Las láminas AC1015 declararán milímetros, variables de escala de línea y extents reales. Los
viewports de contenido quedarán bloqueados y su capa será no imprimible. Los bordes decorativos se
retiran: cualquier marco de vista futuro será una entidad intencional en otra capa, no el límite
técnico del viewport.

## Alcance

- Módulo puro de cajas y colisiones para entidades DXF simples.
- Caja completa de círculos y textos rotados; soporte explícito de `SOLID`.
- Estimación tipográfica conservadora y estable, sin depender de fuentes instaladas.
- Margen de seguridad de 3 mm de papel convertido con la escala activa.
- Validación de escala, extents y capacidad del área de dibujo antes del shelf-packing.
- Preflight de cada viewport contra las entidades que efectivamente se insertarán.
- Error tipado y diagnóstico consumible por generadores y adaptadores de descarga.
- `$INSUNITS=4`, `$MEASUREMENT=1`, `$LTSCALE`, `$CELTSCALE`, `$PSLTSCALE` y `$MSLTSCALE`
  explícitos en las láminas AC1015.
- `$EXTMIN`/`$EXTMAX` derivados del contenido real del espacio modelo.
- Capa `VIEWPORTS` no imprimible, sin borde duplicado, y viewports de contenido bloqueados.
- Auditoría automática con `ezdxf` para clipping, overflow, bloqueo y cabecera técnica.
- Pruebas enfocadas y regresión sobre las cuatro familias A1/A3.

## Fuera de alcance

- Reorganizar la composición particular de tabiquería, OSB, cerchas o fundaciones.
- Escalonar burbujas, mover rótulos con líderes o decidir prioridades de anotación.
- Rediseñar cuadros de despiece, cajetín, leyenda, zonas, escalas gráficas o nomenclatura.
- Reemplazar cotas dibujadas por entidades `DIMENSION`.
- Definir CTB/STB, color final de impresión o certificar conformidad normativa completa.
- Convertir los exportadores R12 de intercambio a AC1015.
- Agregar preview, selector de escala, ZIP, manifiesto de entrega o nueva UI de exportación.
- Cambiar geometría, reglas constructivas, store, persistencia, Tauri, CalculiX o INP.

## Criterios de aceptación

1. La caja de un `CIRCLE` incluye su radio; la de un `TEXT` rotado 90° ocupa el semiplano correcto;
   `SOLID`, `LINE` y polilíneas producen cajas finitas y reproducibles.
2. El extent de cada vista contiene todas sus entidades más 3 mm de papel a la escala activa.
3. Una escala no finita/no positiva, un extent inválido o una vista que no cabe sola produce un
   error tipado antes de construir el DXF; no se exporta contenido parcial.
4. Cada viewport generado contiene las cajas de sus entidades y queda dentro del área de dibujo.
5. Las láminas AC1015 declaran milímetros y las variables de escala de línea acordadas; sus extents
   de cabecera contienen el contenido real de modelspace.
6. Todos los viewports de contenido están bloqueados; `VIEWPORTS` no plotea y no existe un borde
   técnico duplicado en espacio papel.
7. `SOLID` se promueve con `AcDbTrace`; ningún marcador de subclase queda vacío.
8. El analizador puro detecta al menos colisiones texto–texto y burbuja–burbuja y las reporta sin
   convertirlas todavía en rechazo.
9. Las muestras A1/A3 de las cuatro familias obtienen 0 clipping, 0 overflow, 0 viewports
   desbloqueados y auditoría `ezdxf` con 0 errores / 0 reparaciones.
10. Revertir el cálculo de radio/rotación o la prohibición de overflow hace fallar una prueba
    enfocada.
11. `make governance` y `npm run validate` terminan con código 0, sin warnings nuevos silenciados.

## Evidencia

- Pruebas unitarias del motor geométrico, colisiones y error tipado.
- Pruebas de empaquetado y generación contra extents insuficientes y vistas sobredimensionadas.
- Auditoría Python de las cuatro familias A1/A3 con reporte JSON.
- `artifactGoldens.test.mjs`, `audit:dxf` y suite completa.
- Prueba de reversión enfocada y cierre `sessions/close-SPEC-R9-A.md`.

