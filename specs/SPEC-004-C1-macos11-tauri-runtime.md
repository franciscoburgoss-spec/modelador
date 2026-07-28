# SPEC-004-C1 — Runtime Tauri compatible con macOS 11

## Diagnóstico

`SPEC-004-C` implementó y compiló el shell con Tauri 2.11.5, tauri-runtime-wry 2.11.4 y Wry
0.55.1. Sus pruebas Rust, la inspección de capabilities/CSP y el build Vite pasaron. Sin embargo,
el smoke real en el Mac objetivo macOS 11.7.11 abortó antes de crear la ventana:

```text
failed overriding protocol method
-[WKUIDelegate webView:requestMediaCapturePermissionForOrigin:...]:
method not found
```

WebKit declara ese método sólo desde macOS 12. El primer intento de compatibilidad bajó hasta Wry
0.48.1, pero el smoke reprodujo exactamente el mismo panic. El historial de Wry muestra que la
migración del backend a `objc2` entró en Wry 0.46; por tanto, la última línea Tauri 2 anterior al
cambio verificable es Tauri 2.0.2 → tauri-runtime/runtime-wry 2.0.1 → Wry 0.44.1. El primer
intento de esa línea mezcló por semver `tauri-runtime` 2.1.1 y reprodujo una incompatibilidad de
firma; por eso ambos runtimes deben quedar fijados juntos.

La compilación aislada no detecta este defecto: el criterio decisivo debe ser ejecutar la ventana
en macOS 11, además de mantener las pruebas y la seguridad estática de C.

## Decisión

Conservar los contratos y el código de `SPEC-004-C`, pero fijar el backend al conjunto compatible:
Tauri 2.0.2, tauri-build 2.0.2 y tauri-plugin-dialog 2.0.1. `Cargo.lock` debe resolver
tauri-runtime y tauri-runtime-wry 2.0.1 y Wry 0.44.1, sin otra versión Wry.

Se mantienen Rust 1.97.1 y Tauri CLI 2.11.4, pero `@tauri-apps/api` se alinea a 2.0.3 para evitar
la incompatibilidad menor que el propio CLI detecta. El compilador y el CLI no se ejecutan dentro
de la aplicación terminada y deben demostrar compatibilidad con el backend Tauri 2 fijado. Una
actualización futura del runtime sólo puede entrar con smoke real en macOS 11 o después de elevar
explícitamente el sistema mínimo.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Elevar el mínimo a macOS 12 | El Mac x86_64 de producción está fijado en 11.7.11 y el riesgo R-009 fue aceptado expresamente |
| Parchear Wry/objc2 localmente | Crea un fork de seguridad difícil de mantener para evitar una versión oficial compatible |
| Omitir el smoke y cerrar sólo con `cargo check` | El fallo demostrado ocurre únicamente al registrar protocolos Objective-C durante el arranque |
| Retirar Tauri y volver a localhost | Contradice D-002 y no entrega persistencia nativa |

## Alcance

- Fijar Tauri/tauri-build/dialog a la combinación compatible.
- Regenerar `Cargo.lock` y verificar la cadena Tauri → runtime-wry → Wry.
- Adaptar sólo incompatibilidades de API que aparezcan al bajar versiones.
- Ejecutar nuevamente pruebas Rust, seguridad estática, build y `tauri:check`.
- Ejecutar `npm run tauri:dev -- --no-watch` en macOS 11 y comprobar que la ventana permanece viva
  sin el panic de `WKUIDelegate`.
- Completar documentación, trazabilidad y cierre originalmente previstos para C.

## Fuera de alcance

- Cambiar contratos de rutas, escritura atómica, recientes, capability o CSP fijados en C.
- Elevar el sistema mínimo, parchear crates o mantener forks.
- Autosave/recovery, migración desde `localStorage`, CalculiX, packaging, firma o instalación.
- Soporte de plataformas adicionales y cambios a modelo, dominio, DXF o INP.

## Criterios de aceptación

1. Los diez criterios de `SPEC-004-C` se cumplen con la combinación compatible.
2. `Cargo.lock` contiene Tauri 2.0.2, tauri-runtime y tauri-runtime-wry 2.0.1 y Wry 0.44.1, y no
   contiene otra versión Wry.
3. El ejecutable inicia en macOS 11.7.11 x86_64, crea la ventana y permanece vivo al menos diez
   segundos sin panic Objective-C/WebKit.
4. Tauri CLI 2.11.4 ejecuta el backend fijado sin relajar config, capability o CSP.
5. Reponer Tauri 2.11.5 reproduce el panic del smoke; retirar la guarda de versión Wry hace fallar
   la inspección automática.
6. `make governance` y `npm run validate` terminan con código 0; los gates DXF y CalculiX heredados
   siguen ejecutándose sin cambios enfocados.

## Evidencia

- `cargo tree --manifest-path src-tauri/Cargo.toml --locked`.
- Prueba automática de versiones dentro de `tests/tauriSecurityConfig.test.mjs`.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`.
- `npm run tauri:check`, `npm run build` y smoke real `npm run tauri:dev -- --no-watch`.
- Reproducción de Tauri 2.11.5 registrada en `sessions/close-SPEC-004-C-DIAG.md`.
- Cierre esperado `sessions/close-SPEC-004-C1.md`.

## Corte sugerido

Detener al demostrar que la misma implementación de C arranca y opera con la línea Tauri 2
compatible en macOS 11, sin incorporar el siguiente contrato de autosave/recovery.
