# Cierre — SPEC-004 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `bbc9490474739b61313e0d4ac0cb274a4eaefb2d` |
| Spec | `specs/SPEC-004-B-project-document-session.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Python 3.14.5; ezdxf 1.4.4; CalculiX 2.23 |

## Alcance ejecutado

Se agregó una sesión de documento separada del JSON con ruta, título, estado sucio y diez recientes.
El store coordina Abrir, Guardar y Guardar como mediante el puerto A, conserva atomicidad al fallar
y no pierde el indicador sucio si el usuario modifica el modelo durante una escritura. El menú
consume un runtime inyectable y mantiene disponibles por separado los flujos web heredados.

## Cambios

- `projectDocument.js` define transiciones puras y títulos POSIX/Windows.
- `withHistory`, undo y redo marcan dirty; navegación, selección y vista no.
- Abrir valida antes de sustituir modelo/documento/historial en un único `set`.
- Guardar compara por identidad el snapshot enviado al puerto antes de limpiar dirty.
- `MenuBar` expone Abrir, Guardar, Guardar como y Recientes, selector cancelable e indicador `*`.
- `App` refleja título/sucio en el título de ventana; sin runtime nativo las acciones quedan
  deshabilitadas y los flujos de navegador conservan su funcionamiento.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Estado inicial, títulos y diez recientes | PASS | `projectDocument.test.mjs` 3/3 |
| 2–3. Dirty central, navegación limpia y nuevo proyecto | PASS | `projectDocumentStore.test.mjs` pruebas 1–2 |
| 4–5. Apertura fallida atómica y apertura válida con warning | PASS | `projectDocumentStore.test.mjs` pruebas 3–4 |
| 6–7. Ruta requerida, fallo estable y save concurrente | PASS | `projectDocumentStore.test.mjs` pruebas 5–6 |
| 8. Menú, runtime, recientes, cancelación y error visible | PASS | `projectDocument.component.test.jsx` 4/4 |
| 9. Pruebas de reversión | PASS | ruta publicada antes de validar y dirty limpiado sin comparar fueron detectados |
| 10. Puertas completas | PASS | `npm run validate` código 0 en `bbc9490`; no se modificaron DXF ni INP |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas SPEC-004-B enfocadas | PASS | 13/13 |
| `npm run validate` | PASS | 750/750 Node; 12/12 componentes; 35/35 lab; core 93,67 %; store 96,98 % |
| Goldens / DXF | PASS | 18/18; `artifacts/bbc949047473/audit-dxf.json`, 8 familias, 9 archivos, 0/0 |
| CalculiX | PASS | `artifacts/bbc949047473/smoke-ccx.json`, 3/3, 1.486 nodos y 8.649 valores finitos |
| Build | PASS | 719,32 kB raw / 223,67 kB gzip; warning heredado visible |
| Migración / artefactos / derivados | PASS | 187 archivos; 378 inspeccionados; 13 exportadores y 14 mutadores |
| `make governance` | PASS | 20 archivos, 29 requisitos y 39 decisiones después del cierre |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Ruta/título/reciente publicados antes de leer y validar | apertura inválida esperaba `vigente.json` dirty; obtuvo `roto.json` limpio |
| Dirty limpiado siempre al completar la escritura | save demorado esperaba `true`; obtuvo `false` |

Ambas regresiones se ejecutaron de forma enfocada y los resguardos se restauraron antes de repetir
13/13.

## Desviaciones y deudas descubiertas

- Los recientes viven sólo durante la sesión; persistirlos corresponde al adaptador de settings
  Tauri del corte C.
- En localhost las acciones nativas están visibles pero deshabilitadas; guardar/cargar navegador e
  importar/exportar JSON siguen operativos con etiquetas inequívocas.
- El bundle aumentó 4,62 kB raw / 1,53 kB gzip; el warning de chunk sigue gobernado por SPEC-005.
- R-004 permanece en mitigación hasta ejecutar el mismo contrato sobre el filesystem Tauri.
- No se modificaron emisores DXF ni archivos INP; los gates generales permanecen verdes.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `docs/DEVELOPMENT.md`
