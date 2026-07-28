# Cierre — SPEC-004-C1 / runtime Tauri macOS 11

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `59bf6e67d2a542f9da8b043969266ff9916ddc88` |
| Spec | `specs/SPEC-004-C1-macos11-tauri-runtime.md` |
| Toolchain | Node 22.23.1; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Tauri 2.0.2; tauri-runtime/tauri-runtime-wry 2.0.1; Wry 0.44.1; macOS 11.7.11 x86_64 |

## Alcance ejecutado

Se conservó el shell y los contratos de `SPEC-004-C`, pero se fijó una línea Tauri 2 que arranca
realmente en el Mac objetivo. El corte conecta la sesión documental del frontend con seis comandos
Rust estrechos para abrir, guardar, guardar como y mantener recientes; no incorpora autosave,
CalculiX nativo, packaging ni instalación.

## Cambios

- Se fijaron Tauri/tauri-build 2.0.2, tauri-runtime/tauri-runtime-wry 2.0.1, Wry 0.44.1,
  `tauri-plugin-dialog` 2.0.1 y `@tauri-apps/api` 2.0.3 mediante manifiestos y lock reproducibles.
- Se agregó una única ventana `main`, CSP local, capability limitada a seis comandos y frontend
  que sólo publica runtime nativo dentro de Tauri.
- Rust mantiene un conjunto de rutas autorizadas; escribe con temporal hermano modo 0600,
  sincronización, backup byte a byte, reemplazo atómico, sincronización de directorio y diez
  rotaciones. Recientes se persisten aparte, se limitan a diez y nunca descartan JSON inválido.
- El store hidrata recientes al montar y el menú los persiste sólo después de abrir o guardar con
  éxito. Los errores auxiliares quedan tipados y visibles.
- `npm run validate`, `make doctor` y la documentación de desarrollo incorporan Rust y Tauri.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Los diez contratos de C permanecen vigentes | PASS | 759/759 Node, 12/12 componentes y 4/4 Rust |
| Grafo único compatible | PASS | `Cargo.lock`: Tauri 2.0.2, runtimes 2.0.1 y una sola Wry 0.44.1; prueba `SPEC-004-C1` |
| Arranque real en macOS 11 | PASS | `npm run tauri:dev -- --no-watch`: ventana creada y proceso vivo más de 15 s en macOS 11.7.11 x86_64 |
| CLI moderno sin relajar seguridad | PASS | Tauri CLI 2.11.4 ejecutó el backend; pruebas de capability/CSP 5/5 |
| Prueba de compatibilidad | PASS | Tauri 2.11.5/Wry 0.55.1 y Wry 0.48.1 reproducen el panic; retirar la guarda Wry falla la prueba automática |
| Puertas local y externa | PASS | `npm run validate` código 0; [Actions 30396039167](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30396039167), 1/1 sin reintentos sobre el SHA del producto |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos requeridos, 29 requisitos y 40 decisiones |
| `npm run validate` | PASS | 759 Node; 12 componentes; 4 Rust; 35 lab; core 93,71 %; store 96,91 %; 18 goldens; DXF 9 archivos/8 familias, 0 errores y 0 reparaciones; CCX 3/3; build; migración 187/51 |
| `npm run tauri:dev -- --no-watch` | PASS | ventana viva >15 s, sin panic Objective-C/WebKit |
| E2E externo | PASS | run 30396039167, 1/1 en 2,6 s; reporte JSON/HTML por `59bf6e67d2a5` |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Guarda de rutas autorizadas anulada temporalmente | `unauthorized_paths_are_rejected_before_filesystem_access`, 1/1 |
| Permiso `allow-save-recent-project-paths` retirado temporalmente | inspección de capability, 1/1 |
| Runtime elevado a Tauri 2.11.5/Wry 0.55.1 | smoke aborta antes de crear ventana |
| Primer candidato Wry 0.48.1 | smoke reproduce el mismo panic |

## Desviaciones y deudas descubiertas

- La compilación por sí sola no detecta el panic Objective-C: cualquier cambio de runtime requiere
  smoke real en macOS 11 mientras R-009 siga aceptado.
- La línea compatible arrastra `block` 0.1.6; Rust 1.97.1 avisa que será rechazado por una versión
  futura. Actualizar el compilador exige resolver el runtime junto con R-009.
- El chunk inicial queda en 721,29 kB y el workflow externo fuerza acciones con runtime Node 20 a
  Node 24. Ambas deudas ya están acotadas en `STATUS.md`/R-011 y no se ampliaron en este corte.
- La primera ejecución integral tuvo un fallo Node no reproducible; dos ejecuciones completas
  posteriores de `npm test` pasaron 759/759 y el segundo `npm run validate` terminó verde.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, decisión D-040
