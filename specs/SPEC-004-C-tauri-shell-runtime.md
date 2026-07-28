# SPEC-004-C — Shell Tauri y runtime de archivos autorizado

## Diagnóstico

`SPEC-004-A` probó el contrato de escritura atómica con Node y `SPEC-004-B` conectó el store y el
menú a un runtime inyectable. Sin embargo, el repositorio no contiene `src-tauri`, Rust ni
dependencias Tauri; `src/main.jsx` monta `App` sin runtime y, por ello, Abrir/Guardar/Guardar como
siguen deshabilitados fuera de las pruebas. Los recientes sólo existen en memoria y se pierden al
reiniciar.

El Mac objetivo es macOS 11.7.11 x86_64 con Xcode Command Line Tools, pero al iniciar el corte no
tiene `rustc` ni `cargo`. Tauri CLI/API vigentes son 2.11.4/2.11.1 y el plugin dialog 2.7.2. La
documentación oficial advierte que los comandos Rust registrados quedan expuestos por defecto a
todas las ventanas salvo que se declaren en `AppManifest`; además, entregar un plugin filesystem
genérico ampliaría el acceso más allá de las rutas que el usuario eligió.

## Decisión

Crear un shell Tauri 2 para una única ventana `main`, con Rust 1.97.1 fijado y frontend Vite
embebido. El frontend sólo usa `invoke` a través de un adaptador inyectable. Se implementan seis
comandos de aplicación declarados en `AppManifest`: seleccionar apertura, seleccionar guardado,
leer proyecto, escribir proyecto atómicamente, cargar recientes y guardar recientes.

Los diálogos se abren desde Rust. Toda ruta elegida se incorpora a un registro de autorización en
memoria; las rutas recientes válidas vuelven a autorizarse al arrancar. Lectura, escritura y
persistencia de recientes rechazan rutas fuera de ese registro. Así no se incorpora el plugin
filesystem ni una capacidad de shell genérica. Los recientes viven como configuración auxiliar
atómica en `app_config_dir`, fuera del JSON del modelo.

La capability se limita a `main` y sólo a los seis permisos de aplicación. La CSP de producción
admite recursos locales e IPC, sin orígenes remotos; la ventana declara `devtools=false` y
`withGlobalTauri=false`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Exponer `@tauri-apps/plugin-fs` al frontend | Amplía comandos y scopes cuando el caso de uso requiere sólo dos operaciones exactas |
| Confiar en cualquier ruta recibida por `invoke` | Una interfaz comprometida podría leer o sobrescribir archivos que el usuario nunca eligió |
| Persistir recientes con `localStorage` | No sobrevive como configuración nativa gobernada ni autoriza de forma verificable las rutas al reiniciar |
| Integrar autosave, recovery o CalculiX en este corte | Son contratos independientes y dejarían el primer shell demasiado amplio para probarlo y revertirlo |

## Alcance

- `src-tauri` mínimo para macOS x86_64, Rust fijado, Tauri 2 y una ventana.
- Adaptador JavaScript que sólo existe cuando `isTauri()` es verdadero.
- Diálogos nativos de apertura/guardado con filtro `modelador.json`/`json`.
- Registro Rust de rutas autorizadas por diálogo o por recientes previamente persistidos.
- Lectura UTF-8 y escritura temporal + `fsync` + backup exacto + `rename` + rotación a diez.
- Persistencia atómica de hasta diez recientes únicos en el directorio de configuración nativo.
- Hidratación de recientes al montar `App` y persistencia después de abrir/guardar correctamente.
- Error visible si falla la carga o persistencia auxiliar, sin deshacer una apertura/guardado ya
  completado ni afirmar que el archivo principal falló.
- Capability, CSP y configuración mínima inspeccionables automáticamente.
- Pruebas JS del adaptador/coordinación, pruebas Rust de filesystem/autorización/settings y
  compilación del shell dentro de `npm run validate`.
- Documentación para ejecutar `npm run tauri:dev` en este Mac.

## Fuera de alcance

- Autosave, marcador de sesión, recuperación de crash y limpieza de temporales abandonados.
- Migración única desde `localStorage`.
- Prompt nativo al cerrar con cambios, coordinación entre dos procesos o lock de archivos.
- CalculiX, plugin shell, plugin filesystem, HTTP, updater, logs nativos o sidecars.
- Crear `.app` de distribución, firma ad hoc, instalación en `/Applications` o smoke instalado.
- Soporte Apple Silicon, universal, Windows, Linux o mobile.
- Modificar formato del modelo, emisores DXF/INP, reglas constructivas o derivados.

## Criterios de aceptación

1. `npm run tauri:check` compila el shell Tauri con el Rust fijado y `cargo test --locked` pasa sus
   pruebas; `npm run build` sigue generando el frontend.
2. En localhost el adaptador devuelve `null`; dentro de Tauri implementa exactamente el puerto
   `fileSystem`, los dos selectores y el storage de recientes mediante los seis comandos declarados.
3. Sólo una ruta absoluta autorizada por diálogo o por recientes puede leerse/escribirse. Una ruta
   no autorizada devuelve un error tipado antes de tocar filesystem.
4. La implementación Rust conserva los bytes previos, publica por temporal hermano sincronizado y
   mantiene exactamente los diez backups reabribles más recientes después del límite.
5. Los recientes se normalizan a diez rutas absolutas, únicas y autorizadas; su archivo auxiliar se
   escribe atómicamente y un JSON inválido produce error en vez de descartarse en silencio.
6. `App` hidrata los recientes una vez y cada apertura/guardado exitoso intenta persistir la lista
   resultante. Un fallo auxiliar queda visible con un código propio y no revierte ni ensucia el
   resultado del archivo principal.
7. La única capability aplica a `main`, concede sólo los seis permisos de aplicación y no contiene
   shell, filesystem, HTTP, opener ni URLs remotas. La CSP permite sólo recursos locales e IPC; la
   configuración desactiva devtools, global Tauri y bundles en este corte.
8. `npm run tauri:dev` abre la interfaz desde Vite en el shell nativo y habilita las acciones de
   proyecto; la inspección manual se registra sin confundirla con un smoke de release instalado.
9. Revertir la verificación de autorización hace fallar una prueba Rust; omitir un permiso o
   relajar la CSP hace fallar la inspección automática.
10. `make governance` y `npm run validate` terminan con código 0. No aplica nueva auditoría DXF ni
    smoke CalculiX enfocados porque no se modifican emisores ni INP; ambos gates heredados siguen en
    la validación completa.

## Evidencia

- `tests/tauriProjectRuntime.test.mjs` para detección e IPC exacto.
- `tests/tauriSecurityConfig.test.mjs` para capability, CSP, plugins y configuración.
- `tests/projectDocument.component.test.jsx` para hidratación/persistencia y errores auxiliares.
- Pruebas unitarias Rust en `src-tauri/src/project_files.rs` y `src-tauri/src/recent_projects.rs`.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`.
- `npm run tauri:check`, `npm run build`, inspección manual `npm run tauri:dev` y cierre
  `sessions/close-SPEC-004-C.md`.

## Corte sugerido

Detener cuando el shell compile, el menú opere con los comandos autorizados, los recientes
persistan y todas las puertas locales estén verdes. Autosave/recovery comienza en un nuevo corte.
