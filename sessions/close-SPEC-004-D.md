# Cierre — SPEC-004-D / autosave y recuperación nativos

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `9480850c548469a538f8c5ff9c722863dc3fedbe` |
| Spec | `specs/SPEC-004-D-native-autosave-recovery.md` |
| Toolchain | Node 22.23.1; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Tauri 2.0.2; tauri-runtime/tauri-runtime-wry 2.0.1; Wry 0.44.1; macOS 11.7.11 x86_64 |

## Alcance ejecutado

Se reemplazó el autosave web dentro de Tauri por un snapshot nativo separado, privado y atómico,
habilitado para restauración sólo cuando un marcador demuestra que la sesión anterior no terminó
limpiamente. Se incorporó migración controlada de las dos claves `localStorage` accesibles al
WebView. Localhost conserva su flujo web. El corte no incorpora CalculiX nativo, instalación,
packaging ni cambios de dominio, DXF o INP.

## Cambios

- El sobre de autosave v2 conserva timestamp, ruta y modelo; el parser migra el fixture v1 y
  distingue ausencia, corrupción, modelo inválido y versión futura mediante errores tipados.
- Rust administra `<appDataDir>/Recovery/session-active` y `autosave-v2.json`: directorio modo
  0700, archivos modo 0600, escritura atómica, límite de 64 MiB, cierre limpio e idempotencia.
- Tres comandos nuevos completan una capability de exactamente nueve comandos propios. La ruta de
  un recovery válido se vuelve a autorizar antes de reusarla y no se habilitan shell, fs, HTTP,
  opener, navegación remota ni devtools.
- El frontend autoguarda sólo documentos sucios con debounce; abrir, guardar o crear un documento
  limpio retira el snapshot. Restaurar valida antes de un único commit, limpia undo/redo, conserva
  la ruta y mantiene `dirty=true`.
- Las copias legacy se validan y deduplican sin consumirlas. Migrar exige Guardar como, escribe
  atómicamente, reabre y recién entonces retira las claves fuente; cancelar o fallar preserva
  estado y almacenamiento.
- La documentación distingue el `localStorage` del WebView de los orígenes privados de
  Safari/Chrome y mantiene Exportar JSON → Importar JSON como puente explícito.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Sobre v2 y migración v1 | PASS | `tests/autosave.test.mjs` y `tests/data/autosave-v1.json` |
| Crash ofrece snapshot exacto; cierre limpio no; original intacto | PASS | Rust `crash_exposes_exact_snapshot_but_clean_exit_does_not`; reversión del marcador |
| Corrupción y versión futura se preservan con feedback visible | PASS | Rust `corrupt_snapshot_is_reported_and_preserved`; pruebas Node y componente |
| Recuperación transaccional, sin historiales, con ruta y dirty | PASS | `projectDocumentStore.test.mjs` y `nativeRecovery.component.test.jsx` |
| Autosave sólo dirty; estados limpios borran; descartar conserva | PASS | `nativeRecovery.component.test.jsx`, seis workflows |
| Migración exige destino, preserva fallo y consume después de reabrir | PASS | `legacyProjectMigration.test.mjs`; componentes; reversión del orden |
| Localhost conserva flujo web y orígenes externos usan puente manual | PASS | pruebas heredadas y `docs/DEVELOPMENT.md` / `docs/SECURITY_AND_DATA.md` |
| Capability contiene exactamente nueve comandos estrechos | PASS | `tauriSecurityConfig.test.mjs` y `tauriProjectRuntime.test.mjs` |
| Runtime D-040 permanece vivo en macOS 11 | PASS | `npm run tauri:dev -- --no-watch`: ventana viva >30 s sin panic WebKit |
| Gobernanza, puerta local, DXF y CCX | PASS | `make governance`; `npm run validate` sobre `9480850c5484`; artefactos por SHA |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos requeridos, 29 requisitos y 41 decisiones |
| `npm run validate` | PASS | 765 Node; 18 componentes; 9 Rust; 35 lab; core 93,59 %; store 96,97 %; 18 goldens; DXF 9 archivos/8 familias, 0 errores y 0 reparaciones; CCX 3/3; build; migración 187 verificados (133 idénticos, 54 registrados, 2 fixtures) |
| `npm run tauri:dev -- --no-watch` | PASS | ventana viva >30 s en macOS 11.7.11 x86_64; `Recovery` 0700 y marcador 0600 |
| E2E externo | PASS | [run 30398940925](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30398940925), 1/1 en 3,8 s; reporte JSON/HTML por `9480850c5484` |
| Auditoría DXF | PASS | `artifacts/9480850c5484/audit-dxf.json`: ezdxf 1.4.4, 0 errores / 0 reparaciones |
| Smoke CalculiX | PASS | `artifacts/9480850c5484/smoke-ccx.json`: CCX 2.23, 3/3 jobs, 1.486 nodos y 8.649 valores finitos |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Chequeo de sesión previa anulada temporalmente en Rust | `crash_exposes_exact_snapshot_but_clean_exit_does_not`, 1/1 |
| Claves legacy retiradas antes de reabrir el archivo | `migración guarda y reabre antes de retirar la clave legacy`, 1/1 |

## Desviaciones y deudas descubiertas

- El directorio `tests/fixtures/` está reservado al manifiesto de modelos estructurales completos;
  el fixture auxiliar de sobre v1 quedó en `tests/data/` y la evidencia de la spec se corrigió
  antes del commit de producto. No cambia el comportamiento ni el criterio.
- El smoke se terminó con `Ctrl-C` para simular una salida no limpia, por lo que dejó el marcador
  0600 deliberadamente. La prueba Rust separada demuestra que `RunEvent::Exit` lo retira en un
  cierre limpio; un siguiente arranque sin snapshot no ofrece datos inexistentes.
- El chunk inicial creció de 721,29 a 727,24 kB raw y conserva el warning mayor a 600 kB; sigue
  acotado a `SPEC-005`.
- La línea compatible con macOS 11 mantiene el aviso futuro de `block` 0.1.6 bajo R-009.
- Actions mantiene los avisos de Node 20 forzado a 24 en acciones oficiales, ya registrados bajo
  R-011. El E2E de producto terminó verde y sin reintentos.
- El aislamiento por origen impide leer directamente datos privados de Safari o Chrome; no es un
  fallo migrable sin ampliar permisos y se mantiene el puente manual documentado.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, decisión D-041
