# Cierre — SPEC-014-A / R0–R2

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-014-A` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No |

## Alcance ejecutado

Se implementaron exclusivamente R0–R2 sobre prismas resueltos de `agnostic-geometry-v1.0`.
El reconocedor puro valida la frontera, canonicaliza muros y vanos sin depender de su sentido,
agrupa líneas de soporte, clasifica relaciones colineales y construye cadenas sin fusionar
entidades. La salida parcial fija schema, versión, configuración, fases, findings y SHA-256.

R3–R12, intersecciones perpendiculares, nodos, roles, apoyos, segmentos, modelo v3 y toda solución
constructiva permanecen fuera de alcance. La salida declara `eligibleForSpec08=false`; no se
ejecutó ni habilitó SPEC-08. F-009 permanece abierto sin cambios.

## Cambios

- `recognizedStructuralTopology.js` implementa el contrato puro R0–R2, orden estable y SHA-256
  síncrono compatible con navegador, sin importar Node, store, React, Three.js ni fuentes
  constructivas.
- `spec14Input.js` deja de importar el exportador, valida IDs por dominio y conserva errores con
  ruta e IDs sin mutar la entrada.
- Dos suites nuevas cubren contrato, configuración, geometría adversaria, vanos, líneas,
  relaciones, cadenas, determinismo, hash, `casa-L`, aislamiento estático y evidencia.
- `npm run evidence:spec14` regenera el SVG de `casa-L` y un manifiesto con hashes, conteos y
  prohibición explícita de SPEC-08.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Contrato mínimo, fases, hash y no mutación | PASS | Entrada literal `deepEqual`; schema/version/config exactos; hash contrastado con `node:crypto` |
| 2. Sentido y prismas inválidos | PASS | X/Y invertidos `deepEqual`; diagonal, no horizontal, nulo, altura y no finito fallan con código/ruta/IDs |
| 3. Vanos y solape 3D | PASS | Coordenadas global/local exactas; límites S/Z; un solape real y un apilado sin falso positivo |
| 4. Configuración | PASS | Nueve defaults exactos, overrides reflejados y corpus negativo previo a consumir entrada |
| 5. Líneas, relaciones y cadenas | PASS | Tolerancia, `OVERLAP`/`CONTIGUOUS`/`SEPARATED`, simetría y cadena A–B sin fusión |
| 6. Determinismo | PASS | Permutación de grilla/elementos/vanos y repetición producen salida/hash idénticos |
| 7. `casa-L` y evidencia visual | PASS | 45 muros, 43 vanos, 32 líneas, 19 relaciones, 8 cadenas, 0 findings; SVG/manifiesto reproducibles |
| 8. R3–R12 y SPEC-08 pendientes | PASS | Fases pendientes declaradas, `eligibleForSpec08=false` y grafo productivo de sólo dos módulos puros |
| 9. Prueba de reversión | PASS | Retirar `min/max` hace fallar el caso invertido con `RT-OPENING-OUTSIDE-WALL`; restauración verde |
| 10. Puertas y esfuerzo | PASS técnico / G0 pendiente | Suite, cobertura, build, formatos, DXF, CCX y diff verdes; `high` planificado/enviado/efectivo |

El hash canónico esperado de `casa-L` es
`e73ca10984f18e94b345fbc427ce06dfcf246bcc963ae182c671a59fd6ef08a7`. El manifiesto visual fija
además SHA-256 `814c66f14e44b5f545bfe1b0af2a4ec5d1a23cecce62ae03306af9b3e36ef8d5` para el SVG.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas enfocadas | PASS | SPEC-014-A 11/11; contrato agnóstico conjunto 22/22 |
| `npm run validate` con Node 22.23.2 | PASS hasta `codex:audit` | 838 Node; 21 componentes; 9 Rust; 35 lab; 18 goldens; DXF 0/0; CCX 3/3; build OK |
| Cobertura oficial | PASS | core 92,92 %; store 95,48 % |
| `npm run build` | PASS | 290 módulos; warning inicial R-010 conocido, sin importación productiva del reconocedor |
| `npm run codex:audit` | BLOQUEADO | La ejecución SPEC-014-A actual espera retornar; el cierre concordante ya existe |
| `make governance` | BLOQUEADO | Misma causa exclusiva del registro Codex pendiente; documentación restante válida |
| `git diff --check` | PASS | Sin errores de whitespace |

El lanzador de esta ejecución (`2eb1fd2a-9514-4b78-b452-d2e9afae80ac`) recibió `high`. Al retornar
leerá este cierre, comparará `high == high == high` y anexará su `launch_completed`; ese evento no
se adelanta ni simula desde la ejecución hija.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Sustituir temporalmente `min/max` por el sentido declarado | 1/1 enfocada: el vano invertido queda fuera del dominio y emite `RT-OPENING-OUTSIDE-WALL` |
| Restaurar la canonicalización positiva | 0; caso invertido verde |

## Desviaciones y deudas descubiertas

- El shell no interactivo ofrecía Node 20.20.2; todas las puertas oficiales se ejecutaron cargando
  Node 22.23.2 mediante NVM, sin alterar el proyecto para ocultar la diferencia.
- Quick Look no materializó una previsualización bitmap en el sandbox y el Chromium disponible
  exige APIs posteriores a macOS 11. El SVG se valida como fuente reproducible byte a byte, con
  estructura, conteos, referencia R-VIS-05 y hashes automatizados; no se agregó una dependencia.
- No se modificaron DXF ni INP; auditoría y smoke se ejecutaron sólo como regresión.
- F-009 conserva severidad P1. R3–R12 y la habilitación futura de SPEC-08 requieren specs nuevas.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-053 ya vigente; no se duplicó la decisión
- [x] Manifiesto visual `evidence/SPEC-014-A/manifest.json`; `MIGRATION_MANIFEST.json` no cambia
  porque este corte no modifica rutas del baseline migrado
