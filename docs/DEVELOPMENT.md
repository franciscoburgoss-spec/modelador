# Desarrollo reproducible

## Requisitos de fase 0

- macOS;
- Node `22.x`;
- npm `10.x`;
- Git y Xcode Command Line Tools.

El repositorio fija Node en `.nvmrc`, declara el rango en `package.json` y activa
`engine-strict=true`. Una versión distinta es rechazada antes de instalar dependencias.

## Instalación limpia

```bash
nvm install
nvm use
npm ci
npm run validate
```

`npm ci` usa exclusivamente `package-lock.json`; no se versionan `node_modules`, `dist`, cobertura
ni reportes. `npm run validate` no abre interfaces ni depende de rutas personales.

## Comandos

| Comando | Contrato |
|---|---|
| `npm test` | suite oficial, 533 pruebas |
| `npm run test:lab` | laboratorio de faldones, 35 pruebas |
| `npm run test:coverage` | umbrales separados para core y store |
| `npm run lint` | ESLint sobre JavaScript, JSX y scripts |
| `npm run format:check` | UTF-8, LF, whitespace, newline y JSON válido |
| `npm run build` | bundle Vite de producción |
| `npm run verify:migration` | hashes originales y cambios posteriores registrados por spec |
| `npm run verify:artifacts` | ausencia de artefactos generados en el inventario |
| `npm run verify:derived` | matriz de mutadores e inventario de guardas de exportación |
| `npm run validate` | todas las puertas anteriores y gobernanza |

## Toolchain verificada el 27-jul-2026

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
| Apple Clang | 13.0.0 |

Rust/Cargo entran cuando comience Tauri y `ezdxf` entra en el gate de formatos. `make doctor` los
reporta desde ahora para que su ausencia nunca sea silenciosa.

## Baselines visibles

- Suite: 566/566; laboratorio: 35/35.
- Cobertura de líneas: core 90,76 %; store 63,08 %.
- Bundle inicial: 630,77 kB raw / 194,75 kB gzip.
- El warning de chunk mayor a 600 kB se conserva visible y se resolverá en `SPEC-005`.

Los umbrales y exclusiones heredadas están documentados en
[`governance/COVERAGE_BASELINE.md`](../governance/COVERAGE_BASELINE.md) y
[`governance/LINT_BASELINE.md`](../governance/LINT_BASELINE.md).
