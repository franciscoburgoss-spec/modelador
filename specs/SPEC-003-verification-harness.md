# SPEC-003 — Arnés de verificación y fixtures

## Diagnóstico

La suite heredada tiene buena cobertura de módulos importados, pero el store ronda 54,75% de líneas
y no hay cobertura real de flujos UI. `casa-L` y `modelo-26` comparten `elements` byte a byte, por lo
que no constituyen dos casos para muros, OSB o fundaciones. Ningún fixture guarda `roofPlanes`.
Playwright y `ezdxf` figuran en documentación pero no están instalados de forma reproducible.

## Decisión

Construir una pirámide de pruebas con fixtures independientes y validadores semánticos de artefactos.
Los E2E con Playwright actual se ejecutan en una plataforma soportada; el Mac objetivo ejecuta
unitarias, integración, auditoría de archivos y smoke Tauri.

## Alcance

- Fixture nuevo con planta distinta, perfiles serie 60 y 90 y vanos diferentes.
- Fixture guardado con `roofPlanes`, ledgers y versión de modelo.
- Golden tests semánticos para JSON, CSV, DXF e INP.
- Entorno Python fijado con `ezdxf`.
- Smoke real de CalculiX y parser de resultados.
- Coverage por área, pruebas de componentes críticos y comando único.
- Convención de artefactos y evidencia.

## Fuera de alcance

- Snapshots masivos de texto sensible a orden no semántico.
- E2E local con una versión obsoleta de Playwright sólo para soportar el Mac.
- Tests visuales de cada variante menor.
- Nuevas reglas de dominio no incluidas en R3–R8.

## Criterios de aceptación

1. Los fixtures nuevos no comparten `elements` ni biblioteca byte a byte con `casa-L`.
2. Al menos un fixture contiene dos familias de perfil y `roofPlanes` persistidos.
3. Todo fixture pasa el esquema y registra propósito y cobertura.
4. Todos los DXF de referencia pasan `ezdxf doc.audit()` con 0/0.
5. Los INP de referencia ejecutan con CCX y el resultado se parsea sin valores no finitos.
6. `core` alcanza >=90% y `store` >=85% de líneas.
7. Cada requisito crítico de `TRACEABILITY.md` enlaza evidencia automática.
8. Los golden tests normalizan ids, timestamps y orden no contractual.
9. `npm run validate` funciona sin edición manual.

## Evidencia

- manifiesto de fixtures;
- reportes coverage, DXF y CCX;
- matriz de aceptación actualizada;
- ejecución externa de E2E registrada por commit.

