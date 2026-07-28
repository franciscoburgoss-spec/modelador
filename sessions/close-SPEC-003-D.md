# Cierre — SPEC-003 / corte D

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `c4ce87d891cf` para producto; commit que contiene este cierre para gobernanza |
| Spec | `specs/SPEC-003-verification-harness.md`, corte D |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8 |

## Alcance ejecutado

Se cerraron los criterios 11 y 12 mediante contratos observables del store y pruebas de componentes
con DOM. No se exportaron helpers internos, no se movieron reglas de dominio a React y no se
incorporaron E2E, persistencia nativa ni refactors generales.

## Cambios

- Siete pruebas conductuales cubren historial, invalidación, proyecto, biblioteca, grilla,
  selección, navegación, paneles, techumbre, mutaciones agrupadas y fronteras de archivo.
- Cuatro pruebas de componentes cubren importación fallida visible y descartable, bloqueo de
  exportación stale, carga persistida desde el menú y revisión/descarga con un mismo snapshot.
- El lector de archivos admite un adaptador `FileReader` controlado y devuelve errores tipados ante
  ausencia, fallo asíncrono o excepción de lectura.
- El menú carga el modelo persistido sin entregar el evento React como entrada al store.
- La eliminación de perfiles Metalcon bloquea referencias activas y devuelve los tipos dependientes.
- El gate oficial del store sube de 50 % a 85 %; React Testing Library, JSDOM y `tsx` quedan fijados.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 11. Core `>=90 %`, store `>=85 %` y reversión conductual | PASS | core 93,55 %; store 97,85 %; `storeContracts.test.mjs` 7/7 |
| 12. Componentes: importación fallida, stale y revisión/descarga | PASS | `criticalWorkflows.component.test.jsx` 4/4 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 33 decisiones |
| `npm run test:components` | PASS | 4/4 |
| `npm test` | PASS | 730/730 Node + 4/4 componentes |
| `npm run test:lab` | PASS | 35/35 |
| `npm run test:coverage:core` | PASS | 93,55 % líneas; gate 90 % |
| `npm run test:coverage:store` | PASS | 97,85 % líneas; gate 85 % |
| `npm run build` | PASS | 703,69 kB raw / 218,63 kB gzip |
| `npm run verify:migration` | PASS | 187 archivos: 138 idénticos, 49 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 353 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| `npm run validate` final con Node 22 | PASS | suite, cobertura, build, manifiesto, artefactos, derivados y gobernanza |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Retirar el adaptador/error de `FileReader` | el componente de importación falla con `FileReader is not defined` y no muestra alerta |
| Volver a entregar `loadModel` directamente a `onClick` | la prueba del menú conserva “Modelo actual” en vez de cargar “Modelo persistido” |
| Retirar el bloqueo de perfil Metalcon referenciado | el contrato permite la eliminación silenciosa, muta el modelo y no devuelve `wallTypeIds` |

## Desviaciones y deudas descubiertas

- `tsx` queda fijado en 4.19.4 porque su ejecutable compatible funciona en macOS 11 mediante
  `node --import tsx`; no se usa un CLI que requiera IPC.
- El E2E Playwright actual y la incorporación de herramientas externas a la puerta única
  corresponden al corte E.
- R-012 sigue abierto: este corte hace visibles dos flujos críticos, pero no implementa el error
  boundary ni el log local de SPEC-005.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `harness/README.md`
