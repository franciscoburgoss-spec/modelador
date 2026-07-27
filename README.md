# Modelador

Aplicación de escritorio local para modelar, documentar y verificar viviendas en perfiles de acero
liviano. El producto objetivo funciona sin servicios externos, conserva los proyectos en archivos
versionados y genera salidas trazables para revisión constructiva y análisis con CalculiX.

## Estado

El baseline heredado está migrado con inventario SHA-256, Node 22 fijado y una puerta única de
validación. El estado vigente y la spec activa viven únicamente en
[`governance/STATUS.md`](governance/STATUS.md).

## Objetivo de producción local

- Aplicación Tauri 2 instalable en `/Applications`, ejecutable sin Terminal.
- React/Vite para la interfaz y módulos de dominio puros.
- Operación offline, de un solo usuario y sin servidor en ejecución.
- Proyectos JSON validados, migrables, guardados atómicamente y recuperables.
- Exportaciones DXF, CSV e INP verificadas antes de considerarse entregables.
- CalculiX invocado mediante una interfaz nativa estrecha, sin shell arbitrario.

## Orden de lectura

1. [`docs/FOUNDATION.md`](docs/FOUNDATION.md)
2. [`governance/STATUS.md`](governance/STATUS.md)
3. [`governance/PROTOCOL.md`](governance/PROTOCOL.md)
4. [`governance/TRACEABILITY.md`](governance/TRACEABILITY.md)
5. La spec activa indicada en `STATUS.md`

## Comandos de control

```bash
make governance   # integridad documental y trazabilidad
make doctor       # prerrequisitos estrictos de la estación de trabajo
make foundation   # gobernanza + diagnóstico informativo
npm ci             # instalación exacta desde package-lock.json
npm run validate   # formato, lint, tests, cobertura, build y validadores
```

La instalación de desarrollo se documenta en [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
El contrato JSON vigente y sus migraciones se documentan en
[`docs/MODEL_FORMAT.md`](docs/MODEL_FORMAT.md).

## Estructura

| Ruta | Propósito |
|---|---|
| `docs/` | alcance, arquitectura, seguridad y ciclo de datos |
| `governance/` | estado, decisiones, riesgos, trazabilidad y gates |
| `specs/` | contratos de implementación cerrados |
| `domain/` | reglas constructivas vigentes y su hoja de ruta |
| `harness/` | estrategia de pruebas, fixtures y pruebas manuales |
| `templates/` | formatos obligatorios para sesiones y decisiones |
| `archive/` | evidencia histórica; nunca es fuente de estado vigente |
| `scripts/` | arneses ejecutables de control |
| `src/` | aplicación React y módulos de dominio heredados |
| `tests/` | suite oficial y fixtures de regresión |
| `lab/` | laboratorio reproducible de faldones |
