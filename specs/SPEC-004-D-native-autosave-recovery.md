# SPEC-004-D — Autosave, recuperación y migración nativos

## Diagnóstico

El shell de `SPEC-004-C1` ya abre y guarda proyectos con un puerto nativo autorizado, pero
`useAutosave` todavía escribe `modelador-autosave` en `localStorage`, descarta silenciosamente JSON
corrupto y sólo imprime el fallo de cuota en consola. Además, `App` ejecuta `loadModel()` al montar:
en Tauri puede reemplazar el modelo vacío con `modelador-structural-v1` sin pedir un archivo de
destino, dejando la copia principal nuevamente ligada al almacenamiento web.

Rust no mantiene un marcador de sesión, no distingue cierre limpio de crash y no tiene comandos
para un snapshot de recuperación separado. Por ello el banner actual no prueba que la sesión
anterior haya terminado de forma anormal ni relaciona el snapshot con la ruta del proyecto.

El almacenamiento web está aislado por origen. El WebView Tauri sólo puede migrar las claves que
existan en su propio origen; no puede leer directamente el `localStorage` privado de Safari o
Chrome. Para esos orígenes externos, el puente existente Exportar JSON → Importar JSON debe seguir
siendo explícito y documentado.

## Decisión

El autosave nativo usa un sobre versión 2 `{version, timestamp, projectPath, model}`. El parser puro
acepta y migra el sobre versión 1 sin ruta, valida el modelo antes de cualquier commit y nunca
convierte corrupción en ausencia. Se agrega un fixture persistido de la versión anterior.

Rust administra `<appDataDir>/Recovery/session-active` y `autosave-v2.json`. Al iniciar registra si
el marcador ya existía y crea el marcador de la sesión actual; sólo una existencia previa habilita
la lectura como candidato de crash. `RunEvent::Exit` retira el marcador en un cierre limpio. El
snapshot se escribe de forma atómica, privada y acotada; un snapshot corrupto se preserva y produce
un error visible. Abrir, guardar o crear correctamente un proyecto limpio retira el snapshot, pero
descartar el banner no lo elimina ni toca el archivo principal.

El frontend sólo autoguarda estados `dirty` con debounce. Recuperar hace un único commit validado,
limpia undo/redo, conserva la ruta asociada cuando existe y deja el documento sucio: nunca guarda
sobre el original hasta que el usuario pulse Guardar.

En Tauri, las copias legacy accesibles de `modelador-structural-v1` y `modelador-autosave` se
presentan como candidatos. Cada migración exige `Guardar como…`, escribe mediante el puerto atómico,
reabre el archivo validado y sólo entonces elimina las claves fuente. Cancelar o fallar conserva
claves, modelo y documento; repetir después de éxito no vuelve a ofrecer el mismo candidato.

## Alcance

- Evolucionar el sobre de autosave a v2 con migración v1 y errores tipados.
- Agregar estado de recuperación Rust, marcador de sesión y snapshot atómico en app data.
- Exponer tres comandos estrechos: cargar, guardar y limpiar snapshot de recuperación.
- Integrar autosave nativo, recuperación transaccional y feedback visible.
- Migrar una vez las claves legacy accesibles con destino explícito.
- Mantener el autosave web actual cuando no existe runtime Tauri.
- Documentar el puente manual para datos pertenecientes a un navegador externo.

## Fuera de alcance

- Leer bases privadas de Safari/Chrome, automatizar sus perfiles o sortear el aislamiento por origen.
- Comparador visual entre el archivo principal y el autosave.
- Recuperar múltiples sesiones, sincronización, nube o telemetría.
- Ejecutar CalculiX, logs rotativos generales, packaging, firma o instalación.
- Cambiar modelo, reglas de dominio, DXF, INP o el grafo Tauri fijado por D-040.

## Criterios de aceptación

1. El sobre v2 conserva timestamp, ruta y modelo; el fixture v1 migra sin perder bytes semánticos.
2. Una simulación de crash ofrece exactamente el snapshot atómico de la sesión previa; después de
   cierre limpio no lo ofrece y el archivo de proyecto original conserva su hash.
3. Un snapshot corrupto o de versión futura se preserva y genera feedback visible, nunca `null`
   silencioso ni reemplazo parcial.
4. Recuperar valida antes de un único commit, limpia ambos historiales, conserva la ruta si existe
   y deja `dirty=true`; Guardar sigue siendo una acción explícita.
5. En Tauri sólo un documento sucio produce autosave con debounce. Abrir, guardar y Nuevo exitosos
   limpian el snapshot; descartar el banner no lo borra.
6. Migrar desde las dos claves legacy accesibles exige un destino elegido. Cancelación/fallo no
   cambia estado ni claves; éxito guarda, reabre, retira sólo las claves migradas y es idempotente.
7. Localhost conserva la carga y autosave web; el origen externo se migra mediante
   Exportar/Importar JSON documentado.
8. La capability de `main` contiene exactamente nueve comandos propios y sigue sin shell,
   filesystem, HTTP, opener, navegación remota o devtools.
9. El runtime fijado por D-040 compila y la ventana permanece viva al menos diez segundos en
   macOS 11.7.11 x86_64.
10. `make governance` y `npm run validate` terminan con código 0; DXF y CCX heredados no cambian.

## Evidencia

- `tests/data/autosave-v1.json` y pruebas puras de sobre/migración.
- Pruebas Rust en directorio temporal para crash, cierre limpio, corrupción, atomicidad y límites.
- Pruebas de store/componentes para recuperación, fallos, migración, destino y claves.
- Inspección automática de capability, comandos, CSP y grafo fijado.
- Reversión temporal del chequeo de marcador y del orden guardar→eliminar claves.
- `npm run tauri:dev -- --no-watch`, `npm run validate` y E2E externo por SHA.

## Corte sugerido

Detener al cerrar autosave, recuperación y migración desde almacenamiento web accesible. El
siguiente corte de `SPEC-004` debe diagnosticar la ejecución controlada de CalculiX, sin incorporar
todavía packaging o instalación.
