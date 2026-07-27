# SPEC-004 — Persistencia nativa, Tauri y CalculiX

## Diagnóstico

La persistencia principal usa `localStorage`, sin atomicidad, backup o recuperación. El flujo de
fundaciones descarga un INP, exige ejecutar `ccx fundaciones` manualmente e importar el DAT. La
aplicación depende de un servidor Vite para uso normal.

## Decisión

Empaquetar con Tauri 2 y crear adaptadores nativos mínimos. Los proyectos viven en archivos elegidos
por el usuario; autosave y recovery son datos auxiliares. CalculiX se ejecuta mediante una API Rust
estrecha con argumentos estructurados.

## Alcance

- Abrir, Guardar, Guardar como, Recientes y estado sucio.
- Escritura atómica, diez backups, autosave y recuperación.
- Migración única desde `localStorage`.
- Tauri x86_64 con CSP y capabilities mínimas.
- Comando CalculiX con ruta configurada, versión, timeout, cancelación, logs y temporal privado.
- Firma ad hoc e instalación en `/Applications`.

## Fuera de alcance

- Bundlear CCX antes de la auditoría de licencia y dylibs.
- Actualizador automático, nube o sincronización.
- Firma Developer ID y notarización.
- Soporte Windows.

## Criterios de aceptación

1. Abrir un archivo inválido no cambia título, ruta, estado ni modelo activo.
2. Matar la app durante guardado conserva la última versión válida.
3. La rotación mantiene exactamente diez backups después del límite.
4. Un crash ofrece recuperar el autosave sin sobrescribir el original.
5. La migración de `localStorage` es idempotente y exige destino explícito.
6. La app release no tiene devtools, navegación remota ni permisos de shell genéricos.
7. Un smoke con Terminal cerrada cubre abrir, editar, guardar, exportar y reabrir.
8. CCX recibe argumentos sin shell, valida versión y respeta timeout/cancelación.
9. Temporales y procesos se limpian al cancelar o cerrar.
10. La `.app` firmada ad hoc abre desde `/Applications`.

## Evidencia

- pruebas de filesystem en directorio temporal;
- inspección de capabilities/CSP;
- logs de smoke Tauri y CCX;
- simulacro de recuperación con hashes.

