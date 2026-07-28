# Desarrollo reproducible

## Requisitos de fase 0

- macOS;
- Node `22.x`;
- npm `10.x`;
- Rust/Cargo `1.97.1` con target `x86_64-apple-darwin`;
- Git y Xcode Command Line Tools;
- Python `3.14.x` para el entorno aislado de DXF;
- CalculiX `2.23` disponible como `ccx`.

El repositorio fija Node en `.nvmrc`, declara el rango en `package.json` y activa
`engine-strict=true`. Una versión distinta es rechazada antes de instalar dependencias.

## Instalación limpia

```bash
nvm install
nvm use
npm ci
npm run setup:verification-python
make doctor
npm run validate
```

`npm ci` usa exclusivamente `package-lock.json`; no se versionan `node_modules`, `dist`, cobertura
ni reportes. `npm run validate` no abre interfaces, no actualiza fixtures o goldens y detecta
Python/CalculiX sin rutas personales.

## Comandos

| Comando | Contrato |
|---|---|
| `npm test` | suite oficial, 770 Node + 18 componentes |
| `npm run test:components` | dieciocho workflows críticos con DOM |
| `npm run test:e2e` | build y Playwright; se ejecuta externamente en plataforma soportada |
| `npm run test:rust` | nueve invariantes del filesystem, recovery y configuración nativos |
| `npm run test:lab` | laboratorio de faldones, 35 pruebas |
| `npm run test:coverage` | umbrales separados para core y store |
| `npm run lint` | ESLint sobre JavaScript, JSX y scripts |
| `npm run format:check` | UTF-8, LF, whitespace, newline y JSON válido |
| `npm run format:rust` | formato Rust sin modificar fuentes |
| `npm run build` | bundle Vite de producción |
| `npm run tauri:check` | compila el shell nativo y su manifiesto con `Cargo.lock` |
| `npm run tauri:dev` | abre la aplicación Tauri; detener con `Ctrl+C` |
| `npm run verify:migration` | hashes originales y cambios posteriores registrados por spec |
| `npm run verify:artifacts` | ausencia de artefactos generados en el inventario |
| `npm run verify:derived` | matriz de mutadores e inventario de guardas de exportación |
| `npm run verify:goldens` | comparación semántica JSON/CSV/DXF/INP sin actualizar referencias |
| `npm run audit:dxf` | genera y audita las ocho familias DXF con el entorno Python del repo |
| `npm run smoke:ccx` | ejecuta global, cercha y fundaciones con CalculiX real |
| `npm run validate` | todos los gates locales anteriores y gobernanza, sin E2E |

## Entorno Python de verificación

`ezdxf` se instala únicamente en `.venv-verification`, que no se versiona:

```bash
npm run setup:verification-python
npm run audit:dxf
```

La versión vive en `harness/python/requirements-dxf.txt`. `audit:dxf` invoca directamente
`.venv-verification/bin/python`, genera nueve archivos de ocho familias en
`artifacts/<commit>/dxf` y escribe `artifacts/<commit>/audit-dxf.json`. No usa el Python global ni
rutas temporales personales. Actualizar goldens exige el comando explícito `npm run
update:goldens`; ninguna validación los modifica.

## E2E externo

Playwright actual no corre en el Mac objetivo según D-014. El workflow
`.github/workflows/e2e.yml` instala Chromium en Ubuntu, ejecuta `npm run test:e2e` y publica
reporte JSON/HTML con el SHA en el nombre. La evidencia de cierre de SPEC-003-E es la
[ejecución 30377254715](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30377254715)
sobre `11962f3b114cd0a60262f0f21ae4a156a20855ed`: 1/1 esperado, sin reintentos.

## Toolchain verificada el 28-jul-2026

| Herramienta | Versión |
|---|---|
| macOS | 11.7.11, x86_64 |
| Node | 22.23.1 |
| npm | 10.9.8 |
| Git | 2.32.0 |
| Vite | 5.4.21 |
| React | 18.3.1 |
| Zustand | 4.5.7 |
| Three.js | 0.185.1 |
| CalculiX | 2.23 |
| Python | 3.14.5 |
| ezdxf | 1.4.4, entorno `.venv-verification` |
| Playwright | 1.62.0, Chromium externo en Ubuntu |
| Apple Clang | 13.0.0 |
| Rust / Cargo | 1.97.1 |
| Tauri / API JS / CLI | 2.0.2 / 2.0.3 / 2.11.4 |
| tauri-runtime / runtime-wry / Wry | 2.0.1 / 2.0.1 / 0.44.1 |

`rust-toolchain.toml` fija compilador, `rustfmt` y target. `scripts/cargo.sh` carga la instalación
estándar de rustup antes de invocar Cargo. `make doctor` comprueba Rust y `ezdxf` en el entorno
fijado del repositorio para que una ausencia o versión distinta nunca sea silenciosa.

## Contrato de persistencia nativa

`SPEC-004-A` introduce una frontera pura de apertura/guardado y un adaptador Node de referencia
para probar filesystem real. El ensayo enfocado se ejecuta con:

```bash
node --test tests/nativeProjectFile.test.mjs tests/nodeProjectFileSystem.test.mjs
```

El adaptador crea un temporal en el directorio del proyecto, sincroniza, conserva diez backups y
publica con `rename`. La prueba usa `spawn` sin shell y mata el proceso por `SIGKILL` antes del
reemplazo. Es un adaptador de referencia para el contrato; no constituye por sí solo un runtime
disponible desde el navegador.

`SPEC-004-B` agrega la sesión de documento y conecta el menú a un runtime inyectable con este
contrato:

```js
{
  fileSystem: { readText, writeTextAtomic },
  chooseOpenPath,
  chooseSavePath,
  loadRecentPaths,
  saveRecentPaths,
  loadRecoverySnapshot,
  saveRecoverySnapshot,
  clearRecoverySnapshot
}
```

`SPEC-004-C/C1/D` implementa ese contrato en Tauri mediante nueve comandos estrechos. En localhost
no se publica un runtime nativo aparente: Abrir/Guardar/Guardar como aparecen deshabilitados,
mientras `Guardar copia en navegador`, `Cargar copia del navegador` e importar/exportar JSON siguen
operativos. En Tauri, un marcador distingue crash de cierre limpio y el autosave vive separado en
`<appDataDir>/Recovery`; recuperar nunca escribe el proyecto original hasta pulsar Guardar.

Si el WebView encuentra las claves legacy de su propio origen, muestra acciones `Guardar …` que
exigen destino y sólo consumen esas claves después de escribir y reabrir con éxito. Safari y Chrome
mantienen almacenamiento por origen: sus copias se trasladan con Exportar JSON en el navegador e
Importar JSON en la app nativa.

Para probar selectores, archivos, recientes y recovery reales se debe usar:

```bash
nvm use
npm run tauri:dev -- --no-watch
```

El runtime está fijado por D-040 porque Wry 0.46 o superior aborta al crear la ventana en macOS 11.
No actualizar Tauri, sus runtimes o Wry sin repetir el smoke real en ese sistema.

Una terminal nueva no activa `.nvmrc` por sí sola. Si `make doctor` informa Node 20, cargar NVM y
seleccionar la versión del repositorio antes de ejecutar Tauri:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
source "$HOME/.cargo/env"
make doctor
```

El smoke de Tauri sólo pasa cuando la ventana muestra contenido reconocible: barra de menú,
selector de vista y lienzo durante al menos diez segundos. Una ventana blanca, el texto
`Iniciando Modelador…` permanente o el mensaje `Modelador no pudo iniciar` son fallos, aunque el
proceso permanezca vivo. D-042 prohíbe `Object.hasOwn` en producción porque el WebView de macOS 11
no implementa ese built-in; `src/core/hasOwn.js` es la frontera compatible.

## Baselines visibles

- Suite: 770/770 Node; componentes: 18/18; Rust: 9/9; laboratorio: 35/35.
- Cobertura de líneas: core 93,39 %; store 96,97 %.
- Bundle inicial: 728,17 kB raw / 226,81 kB gzip.
- El warning de chunk mayor a 600 kB se conserva visible y se resolverá en `SPEC-005`.

Los umbrales y exclusiones heredadas están documentados en
[`governance/COVERAGE_BASELINE.md`](../governance/COVERAGE_BASELINE.md) y
[`governance/LINT_BASELINE.md`](../governance/LINT_BASELINE.md).
