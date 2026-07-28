# Desarrollo reproducible

## Requisitos de fase 0

- macOS;
- Node `22.x`;
- npm `10.x`;
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
npm run validate
```

`npm ci` usa exclusivamente `package-lock.json`; no se versionan `node_modules`, `dist`, cobertura
ni reportes. `npm run validate` no abre interfaces, no actualiza fixtures o goldens y detecta
Python/CalculiX sin rutas personales.

## Comandos

| Comando | Contrato |
|---|---|
| `npm test` | suite oficial, 732 Node + 4 componentes |
| `npm run test:components` | cuatro workflows críticos con DOM |
| `npm run test:e2e` | build y Playwright; se ejecuta externamente en plataforma soportada |
| `npm run test:lab` | laboratorio de faldones, 35 pruebas |
| `npm run test:coverage` | umbrales separados para core y store |
| `npm run lint` | ESLint sobre JavaScript, JSX y scripts |
| `npm run format:check` | UTF-8, LF, whitespace, newline y JSON válido |
| `npm run build` | bundle Vite de producción |
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

Rust/Cargo entran cuando comience Tauri. `make doctor` comprueba `ezdxf` en el entorno fijado del
repositorio para que una ausencia o versión distinta nunca sea silenciosa.

## Baselines visibles

- Suite: 732/732 Node; componentes: 4/4; laboratorio: 35/35.
- Cobertura de líneas: core 93,55 %; store 97,85 %.
- Bundle inicial: 703,69 kB raw / 218,63 kB gzip.
- El warning de chunk mayor a 600 kB se conserva visible y se resolverá en `SPEC-005`.

Los umbrales y exclusiones heredadas están documentados en
[`governance/COVERAGE_BASELINE.md`](../governance/COVERAGE_BASELINE.md) y
[`governance/LINT_BASELINE.md`](../governance/LINT_BASELINE.md).
