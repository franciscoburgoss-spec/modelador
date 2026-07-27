# Seguridad y ciclo de datos

## Fronteras de confianza

Se consideran no confiables los archivos JSON abiertos, fórmulas, nombres de parámetros, rutas
elegidas, resultados de CalculiX y cualquier texto que llegue desde un proyecto heredado.

## Controles obligatorios

- Las expresiones se analizan con una gramática numérica y una lista cerrada de operadores.
- No se permite `eval`, `new Function`, acceso a propiedades, llamadas, constructores ni globals.
- El modelo se valida en memoria antes de reemplazar el estado activo.
- Cada archivo declara `modelVersion`; las migraciones son puras, secuenciales e idempotentes.
- Todo guardado usa archivo temporal, `fsync` cuando corresponda y renombrado atómico.
- Se mantienen diez backups rotativos y un autosave separado del archivo principal.
- Las rutas Tauri se limitan a proyectos elegidos por el usuario y al directorio de soporte.
- Release sin devtools, sin navegación remota, con CSP estricta y sin plugin de shell genérico.
- CalculiX se ejecuta con ruta y argumentos separados, directorio temporal, timeout y cancelación.
- Los logs no incluyen contenido completo del proyecto ni datos del sistema innecesarios.

## Ubicaciones

| Dato | Ubicación |
|---|---|
| Proyectos sugeridos | `~/Documents/Modelador/Proyectos` |
| Configuración y recientes | `~/Library/Application Support/Modelador` |
| Autosave y recuperación | `~/Library/Application Support/Modelador/Recovery` |
| Logs rotativos | `~/Library/Logs/Modelador` |
| Temporales de cálculo | directorio temporal privado por ejecución |

## Contrato de importación

1. Leer bytes con límite de tamaño.
2. Parsear JSON sin modificar el estado.
3. Validar encabezado y versión.
4. Migrar una copia en memoria.
5. Validar el modelo migrado y sus invariantes.
6. Mostrar advertencias que requieran decisión.
7. Reemplazar el estado en una sola operación.
8. Conservar el archivo original intacto.

Si falla cualquier paso, el modelo activo permanece byte y semánticamente equivalente al anterior.

## Compatibilidad heredada

`roofPlanes` es la fuente moderna de techumbre. Un archivo que sólo contenga `roofSystems` conserva
esos sistemas y se abre en modo heredado; nunca se vacían al cargar. Si conviven ambas formas, la
precedencia se aplica sólo al cálculo, no elimina el dato y registra una advertencia de migración.

## Recuperación

La aplicación escribe un marcador de sesión sucia al primer cambio. Al cerrar correctamente lo
retira. Si el siguiente inicio detecta marcador y autosave más reciente, ofrece comparar, recuperar
o descartar. Ninguna opción sobrescribe el proyecto original antes de confirmar.

## Respuesta a fallos

Los errores se muestran con operación, archivo o subsistema, causa segura y siguiente acción. El
detalle técnico queda en log local con un identificador visible. `console.error` no constituye una
interfaz de error de producción.

