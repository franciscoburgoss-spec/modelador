# Cierre — SPEC-004-C / diagnóstico sustituido

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-004-C-tauri-shell-runtime.md` — sustituida por C1 |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Rust/Cargo 1.97.1; Tauri 2.11.5 |

## Alcance ejecutado

Se implementaron el shell, los comandos autorizados, la escritura atómica Rust, la persistencia de
recientes, la capability/CSP y la coordinación React. Pruebas, compilación y build pasaron. El
smoke real reveló una incompatibilidad de Wry/objc2 con WebKit de macOS 11 antes de crear la
ventana. El protocolo obliga a sustituir el corte antes de cambiar la versión decidida.

## Cambios

- Seis comandos estrechos quedan declarados en `AppManifest` y limitados a `main`.
- Lectura/escritura rechazan rutas no autorizadas antes de tocar filesystem.
- Cuatro pruebas Rust pasan: autorización, atomicidad/10 backups, recientes y JSON inválido.
- La CSP no contiene orígenes remotos y no existen permisos shell/fs/HTTP/opener.
- Tauri 2.11.5 resuelve runtime-wry 2.11.4, Wry 0.55.1 y `objc2` 0.6.4.
- El smoke aborta al registrar un método `WKUIDelegate` disponible sólo desde macOS 12.
- D-040 y `SPEC-004-C1-macos11-tauri-runtime.md` gobiernan la sustitución.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Contratos JS, seguridad y configuración | PASS diagnóstico | 11/11 pruebas enfocadas |
| Filesystem/autorización/settings Rust | PASS diagnóstico | 4/4 pruebas |
| Compilación y build frontend | PASS diagnóstico | `tauri:check`; Vite 721,27/224,38 kB |
| Arranque nativo macOS 11 | FAIL diagnóstico | panic `WKUIDelegate ... method not found` antes de ventana |
| Criterios C completos | NO CERRADOS | corte sustituido por C1 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 29 requisitos; 39 decisiones |
| pruebas JS enfocadas | PASS | 11/11 |
| `cargo test --locked` | PASS | 4/4 |
| `npm run lint` | PASS | 0 warnings |
| `npm run build` | PASS | 721,27 kB raw / 224,38 kB gzip; warning heredado |
| `make doctor` | PASS | 0 fallos / 0 advertencias |
| `npm run tauri:dev -- --no-watch` | FAIL diagnóstico | abort por método WebKit ausente en macOS 11 |
| `npm run validate` | NO EJECUTADO | corresponde a C1 después de resolver el bloqueo |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica aún: el runtime vigente es precisamente la reproducción del defecto | smoke real Tauri aborta consistentemente |

## Desviaciones y deudas descubiertas

- El mínimo de bundle declarado no basta para garantizar compatibilidad dinámica del grafo Wry.
- Toda actualización futura de Tauri/Wry requiere smoke real en macOS 11, no sólo compilación.
- No se eleva el sistema mínimo ni se parchean crates; C1 evaluará la última línea oficial previa.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] nueva spec sustituta C1
