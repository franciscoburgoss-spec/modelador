# SPEC-000 — Baseline reproducible

## Diagnóstico

El código heredado vive en un directorio de copia sobre un volumen externo, no tiene repositorio
Git, `.gitignore`, versión de Node ni scripts oficiales de test, lint, coverage o validación. El
build pasa y la suite directa alcanza 518/518, pero el resultado depende del entorno ya preparado.

## Decisión

Migrar sólo fuentes y fixtures al repositorio nuevo, fijar Node 22 LTS y establecer una puerta única
`npm run validate`. No se cambian dependencias mayores ni comportamiento funcional en esta spec.

## Alcance

- Inicializar Git y registrar el baseline documental.
- Inventariar archivos de origen mediante hash.
- Migrar código, fixtures y documentos de dominio; excluir `node_modules`, `dist` y temporales.
- Fijar Node, npm, dependencias y herramientas Python/Rust cuando aparezcan.
- Agregar scripts `test`, `test:lab`, `test:coverage`, `lint`, `format:check`, `build`, `validate`.
- Documentar instalación limpia y versions reales.

## Fuera de alcance

- Corregir hallazgos funcionales.
- Actualizar majors de React, Vite, Zustand, Three o Tailwind.
- Crear la aplicación Tauri.
- Modificar reglas de dominio o baselines de outputs.

## Criterios de aceptación

1. `git status --short` está limpio tras una instalación y validación.
2. Node 22 es rechazado si no coincide con `engines`/`.nvmrc`.
3. `npm ci` funciona desde una copia sin `node_modules`.
4. Los 518 tests heredados pasan con un comando oficial.
5. `npm run build` pasa y el warning de tamaño queda medido, no oculto.
6. `npm run validate` ejecuta formato, lint, pruebas, cobertura y build.
7. Se registra hash de cada fixture migrado y se comprueba igualdad con el origen.
8. No se migra ningún artefacto de build.
9. `make governance` continúa verde.

## Evidencia

- `sessions/close-SPEC-000.md`
- log de instalación limpia;
- manifiesto de versiones;
- inventario SHA-256 de migración.

